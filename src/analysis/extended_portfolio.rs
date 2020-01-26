use crate::analysis::price::{DataSource, Price, PriceMap};
use crate::analysis::{irr, price};
use crate::models::*;
use crate::schema::*;

use chrono::offset::TimeZone;
use chrono::{DateTime, Datelike, Duration, Local, NaiveDate, Utc, Weekday};
use diesel::prelude::*;
use log::debug;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::collections::HashSet;
use std::error::Error;
use std::iter::successors;

#[derive(Deserialize, Serialize)]
#[serde(tag = "type")]
pub enum EitherPrice {
  RealtimePrice(RealtimePrice),
  HistoricalPrice(HistoricalPrice),
}

#[derive(Deserialize, Serialize)]
pub struct PortfolioPerformance {
  pub description: String,
  pub start: Option<PortfolioSnapshot>,
  pub end: PortfolioSnapshot,
  pub irr: Option<f64>,
  pub positions: HashMap<String, PositionPerformance>,
}

#[derive(Deserialize, Serialize)]
pub struct PositionPerformance {
  pub start: Option<PositionSnapshot>,
  pub end: PositionSnapshot,
  pub irr: Option<f64>,
  pub transactions: Vec<Transaction>,
}

#[derive(Deserialize, Serialize)]
pub struct PortfolioSnapshot {
  pub date: NaiveDate,
  pub invested: f64,
  pub value: Option<f64>,
}

#[derive(Deserialize, Serialize)]
pub struct PositionSnapshot {
  pub date: NaiveDate,
  pub units: f64,
  pub invested: f64,
  pub value: Option<f64>,
  pub data_source: Option<DataSource<EitherPrice>>,
}

pub fn compute(
  connection: &diesel::PgConnection,
  user_id: i32,
  date: DateTime<Utc>,
) -> Result<Vec<PortfolioPerformance>, Box<dyn Error>> {
  // read all transactions for the user from db
  let ts = transactions::table
    .inner_join(accounts::table)
    .filter(accounts::user_id.eq(user_id))
    .filter(transactions::date.le(date))
    .order(transactions::date.asc())
    .load::<(Transaction, Account)>(&*connection)?
    .into_iter()
    .map(|(a, _)| a)
    .collect::<Vec<_>>();

  // collect isins that appear in the transactions
  let mut isins = ts
    .iter()
    .map(|t| &t.isin)
    .cloned()
    .collect::<HashSet<_>>()
    .into_iter()
    .collect::<Vec<_>>();
  isins.sort();
  let isins = isins;

  // find suitable price information
  let current_prices: PriceMap<RealtimePrice> =
    price::find(connection, &isins, date, 7 * 24, 7 * 24)?;

  // assemble dates for which we need to get HistoricalPrices
  let current_day = current_prices
    .values()
    .map(|d| d.price.date)
    .max()
    .unwrap_or_else(Utc::now)
    .with_timezone(&Local)
    .date()
    .naive_local();
  let prev_day = current_day.pred();

  let first_transaction_date = ts
    .iter()
    .map(|t| t.date)
    .max()
    .unwrap_or_else(Utc::now)
    .with_timezone(&Local)
    .date()
    .naive_local();

  let mut jobs = Vec::new();
  jobs.push(("Insgesamt".to_owned(), None, None));

  /*
    EOD prices <-> current_prices:
    * previous trading day
    * end of last week
    * end of last month
    * end of last year
  */

  jobs.push(("Heute".to_owned(), Some(prev_day), None));

  let days_from_friday =
    (prev_day.weekday().number_from_monday() as i64 - Weekday::Fri.number_from_monday() as i64 + 7)
      % 7;
  jobs.push((
    "Diese Woche".to_owned(),
    prev_day.checked_sub_signed(Duration::days(days_from_friday)),
    None,
  ));

  let first_of_month = NaiveDate::from_ymd(prev_day.year(), prev_day.month(), 1);
  jobs.push((
    "Dieser Monat".to_owned(),
    first_of_month.checked_sub_signed(Duration::days(1)),
    None,
  ));

  let first_of_year = NaiveDate::from_ymd(prev_day.year(), 1, 1);
  jobs.push((
    "Dieses Jahr".to_owned(),
    first_of_year.checked_sub_signed(Duration::days(1)),
    None,
  ));

  /*
  EOD prices <-> EOD prices for
    * every year since first_transaction_date
    * every of the last 12 months (if after first_transaction_date)
  */

  let yearlies = successors(
    first_of_year
      .checked_sub_signed(Duration::days(1))
      .map(|x| (String::new(), x, first_of_year)),
    |(_, last, _)| {
      NaiveDate::from_ymd(last.year(), 1, 1)
        .checked_sub_signed(Duration::days(1))
        .map(|x| (format!("{}", x.year()), x, *last))
    },
  )
  .skip(1)
  .take_while(|(_, _, last)| first_transaction_date < *last)
  .map(|(s, x, y)| (s, Some(x), Some(y)));
  jobs.extend(yearlies);

  let monthlies = successors(
    first_of_month
      .checked_sub_signed(Duration::days(1))
      .map(|x| (String::new(), x, first_of_month)),
    |(_, last, _)| {
      NaiveDate::from_ymd(last.year(), last.month(), 1)
        .checked_sub_signed(Duration::days(1))
        .map(|x| (format!("{}/{}", x.month(), x.year()), x, *last))
    },
  )
  .skip(1)
  .take_while(|(_, _, last)| first_transaction_date < *last)
  .take(12)
  .map(|(s, x, y)| (s, Some(x), Some(y)));
  jobs.extend(monthlies);

  // collect all relevant dates
  let dates = jobs
    .iter()
    .map(|(_, x, _)| *x)
    .chain(jobs.iter().map(|(_, _, y)| *y))
    .filter_map(|x| x)
    .collect::<HashSet<_>>()
    .into_iter()
    .collect::<Vec<_>>();

  // find_multiple needs DateTime<Utc> ...
  let utc_date_times = dates
    .iter()
    .map(|d| {
      Local
        .from_utc_date(d)
        .and_hms(17, 30, 0)
        .with_timezone(&Utc)
    })
    .collect::<Vec<_>>();

  debug!(
    "Querying prices for {} isins and {} dates",
    isins.len(),
    dates.len()
  );

  // query db for prices on these dates
  let prices = Price::find_multiple(connection, &isins, &utc_date_times, 7 * 24, 7 * 24)?;
  let prices = dates.into_iter().zip(prices).collect();

  Ok(
    jobs
      .into_iter()
      .map(|(s, st, en)| compute_performance(&ts, &current_prices, &prices, s, st, en))
      .collect::<Vec<_>>(),
  )
}

fn compute_performance(
  ts: &[Transaction],
  current_prices: &PriceMap<RealtimePrice>,
  prices: &HashMap<NaiveDate, PriceMap<HistoricalPrice>>,
  description: String,
  start: Option<NaiveDate>,
  end: Option<NaiveDate>,
) -> PortfolioPerformance {
  todo!() // TODO: complete the job

  // let positions = isins
  //   .into_iter()
  //   .map(|isin| compute_position(isin.clone(), &ts, prices.remove(&isin)))
  //   .collect::<Vec<Position<T>>>();

  // // calculate total cost and value
  // let cost = positions.iter().fold(0.0, |acc, p| acc + p.cost);
  // let value = positions
  //   .iter()
  //   .fold(Some(0.0), |acc, p| acc.and_then(|a| p.value.map(|x| a + x)));

  // // calculate the total irr
  // // (only possible if we can simulate sales for all positions, i.e. value != None)
  // let irr = if value.is_some() {
  //   // is guaranteed to have the same length as positions
  //   let sales = positions.iter().filter_map(|p| {
  //     p.data_source
  //       .as_ref()
  //       .map(|s| (s.price.date(), p.units * s.price.value()))
  //   });

  //   let ts = ts
  //     .iter()
  //     .map(|t| (t.date, (t.amount + t.fees) as f64 / 100.0))
  //     .chain(sales)
  //     .collect::<Vec<_>>();

  //   irr::compute(&ts)
  // } else {
  //   None
  // };

  // Ok(Portfolio {
  //   cost,
  //   value,
  //   stocks: positions,
  //   irr,
  // })
}

// fn compute_position<T>(
//   isin: String,
//   ts: &[Transaction],
//   price: Option<DataSource<T>>,
// ) -> Position<T>
// where
//   T: Price + Sized,
// {
//   let relevant_ts = ts
//     .iter()
//     .filter(|t| t.isin == isin)
//     .cloned()
//     .collect::<Vec<_>>();
//   let (units, cost) = relevant_ts.iter().fold((0.0, 0.0), |(au, ac), t| {
//     (au + t.units, ac + (t.amount + t.fees) as f64 / 100.0)
//   });

//   let value = price.as_ref().map(|x| units * x.price.value());

//   let irr = if let Some(x) = price.as_ref() {
//     // is guaranteed to have the same length as positions
//     let sale = (x.price.date(), units * x.price.value());

//     let ts = relevant_ts
//       .iter()
//       .map(|t| (t.date, (t.amount + t.fees) as f64 / 100.0))
//       .chain(std::iter::once(sale))
//       .collect::<Vec<_>>();

//     irr::compute(&ts)
//   } else {
//     None
//   };

//   Position {
//     value,
//     isin,
//     transactions: relevant_ts,
//     units,
//     cost,
//     irr,
//     data_source: price,
//   }
// }
