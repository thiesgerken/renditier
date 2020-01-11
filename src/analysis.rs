use crate::data::exchange_comparison;
use crate::models::*;
use crate::schema::*;

use chrono::offset::TimeZone;
use chrono::{DateTime, Duration, Utc};
use diesel::prelude::*;
use log::{debug, warn};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::collections::HashSet;
use std::error::Error;

#[derive(Deserialize, Serialize)]
pub struct Portfolio<T> {
  pub cost: f64,
  pub value: Option<f64>,
  pub irr: Option<f64>,
  pub stocks: Vec<Position<T>>,
}

#[derive(Deserialize, Serialize)]
pub struct Position<T> {
  pub isin: String,
  pub units: f64,
  pub cost: f64,
  pub value: Option<f64>,
  pub irr: Option<f64>,
  pub data_source: Option<DataSource<T>>,
  pub transactions: Vec<Transaction>,
}

#[derive(Deserialize, Serialize)]
pub struct DataSource<T> {
  pub price: T,
  pub exchange: StockExchange,
}

pub trait Price {
  // hard_threshold: amount of hours the price may be off
  // soft_threshold: amount of hours that are considered irrelevant to scoring of exchanges
  // return value might not contain prices for all of the provided ISINs
  fn find(
    connection: &diesel::PgConnection,
    isins: &[String],
    date: DateTime<Utc>,
    hard_threshold: i64,
    soft_threshold: i64,
  ) -> Result<HashMap<String, DataSource<Self>>, Box<dyn Error>>
  where
    Self: Sized;

  fn value(&self) -> f64;
  fn date(&self) -> DateTime<Utc>;
}

impl Price for RealtimePrice {
  fn value(&self) -> f64 {
    self.price
  }

  fn date(&self) -> DateTime<Utc> {
    self.date
  }

  fn find(
    connection: &diesel::PgConnection,
    isins: &[String],
    date: DateTime<Utc>,
    hard_threshold: i64,
    soft_threshold: i64,
  ) -> Result<HashMap<String, DataSource<Self>>, Box<dyn Error>> {
    let hard_ub = date
      .checked_add_signed(Duration::hours(hard_threshold))
      .ok_or("overflow")?;
    let hard_lb = date
      .checked_sub_signed(Duration::hours(hard_threshold))
      .ok_or("overflow")?;

    let soft_ub = date
      .checked_add_signed(Duration::hours(soft_threshold))
      .ok_or("overflow")?;
    let soft_lb = date
      .checked_sub_signed(Duration::hours(soft_threshold))
      .ok_or("overflow")?;

    let ps = realtime_prices::table
      .inner_join(
        stock_exchanges::table
          .on(realtime_prices::onvista_record_id.eq(stock_exchanges::onvista_record_id)),
      )
      .filter(stock_exchanges::isin.eq_any(isins))
      .filter(realtime_prices::date.le(hard_ub))
      .filter(realtime_prices::date.ge(hard_lb))
      .order(realtime_prices::date.desc())
      .load::<(RealtimePrice, StockExchange)>(connection)?;

    let mut res = HashMap::new();

    for isin in isins {
      let mut hard = ps.iter().filter(|(_, se)| &se.isin == isin);
      let mut soft = ps
        .iter()
        .filter(|(p, se)| p.date <= soft_ub && p.date >= soft_lb && &se.isin == isin)
        .collect::<Vec<_>>();
      soft.sort_by(|(_, se1), (_, se2)| exchange_comparison(se1, se2));

      if let Some((p, se)) = soft.first().copied().or_else(|| hard.next()) {
        res.insert(
          isin.clone(),
          DataSource {
            price: p.clone(),
            exchange: se.clone(),
          },
        );
      }
    }

    Ok(res)
  }
}

impl Price for HistoricalPrice {
  fn value(&self) -> f64 {
    self.closing
  }

  fn date(&self) -> DateTime<Utc> {
    // does not have to be exact
    let d = self.date.and_hms(17, 30, 0);

    chrono::Local
      .from_local_datetime(&d)
      .earliest()
      .unwrap_or_else(|| chrono::Local.from_utc_datetime(&d))
      .with_timezone(&Utc)
  }

  fn find(
    connection: &diesel::PgConnection,
    isins: &[String],
    date: DateTime<Utc>,
    hard_threshold: i64,
    soft_threshold: i64,
  ) -> Result<HashMap<String, DataSource<Self>>, Box<dyn Error>> {
    let hard_ub = date
      .checked_add_signed(Duration::hours(hard_threshold))
      .ok_or("overflow")?
      .naive_utc()
      .date();
    let hard_lb = date
      .checked_sub_signed(Duration::hours(hard_threshold))
      .ok_or("overflow")?
      .naive_utc()
      .date();

    let soft_ub = date
      .checked_add_signed(Duration::hours(soft_threshold))
      .ok_or("overflow")?
      .naive_utc()
      .date();
    let soft_lb = date
      .checked_sub_signed(Duration::hours(soft_threshold))
      .ok_or("overflow")?
      .naive_utc()
      .date();

    let ps = historical_prices::table
      .inner_join(
        stock_exchanges::table
          .on(historical_prices::onvista_record_id.eq(stock_exchanges::onvista_record_id)),
      )
      .filter(stock_exchanges::isin.eq_any(isins))
      .filter(historical_prices::date.le(hard_ub))
      .filter(historical_prices::date.ge(hard_lb))
      .order(historical_prices::date.desc())
      .load::<(HistoricalPrice, StockExchange)>(connection)?;

    let mut res = HashMap::new();

    for isin in isins {
      let mut hard = ps.iter().filter(|(_, se)| &se.isin == isin);
      let mut soft = ps
        .iter()
        .filter(|(p, se)| p.date <= soft_ub && p.date >= soft_lb && &se.isin == isin)
        .collect::<Vec<_>>();
      soft.sort_by(|(_, se1), (_, se2)| exchange_comparison(se1, se2));

      if let Some((p, se)) = soft.first().copied().or_else(|| hard.next()) {
        res.insert(
          isin.clone(),
          DataSource {
            price: p.clone(),
            exchange: se.clone(),
          },
        );
      }
    }

    Ok(res)
  }
}

pub fn compute_portfolio<T>(
  connection: &diesel::PgConnection,
  user_id: i32,
  date: DateTime<Utc>,
) -> Result<Portfolio<T>, Box<dyn Error>>
where
  T: Price + Sized,
{
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
  let mut prices: HashMap<String, DataSource<T>> =
    Price::find(connection, &isins, date, 7 * 24, 3 * 24)?;

  let positions = isins
    .into_iter()
    .map(|isin| compute_position(isin.clone(), &ts, prices.remove(&isin)))
    .collect::<Vec<Position<T>>>();

  // calculate total cost and value
  let cost = positions.iter().fold(0.0, |acc, p| acc + p.cost);
  let value = positions
    .iter()
    .fold(Some(0.0), |acc, p| acc.and_then(|a| p.value.map(|x| a + x)));

  // calculate the total irr
  // (only possible if we can simulate sales for all positions, i.e. value != None)
  let irr = if value.is_some() {
    // is guaranteed to have the same length as positions
    let sales = positions.iter().filter_map(|p| {
      p.data_source
        .as_ref()
        .map(|s| (s.price.date(), p.units * s.price.value()))
    });

    let ts = ts
      .iter()
      .map(|t| (t.date, (t.amount + t.fees) as f64 / 100.0))
      .chain(sales)
      .collect::<Vec<_>>();

    irr(&ts)
  } else {
    None
  };

  Ok(Portfolio {
    cost,
    value,
    stocks: positions,
    irr,
  })
}

fn compute_position<T>(
  isin: String,
  ts: &[Transaction],
  price: Option<DataSource<T>>,
) -> Position<T>
where
  T: Price + Sized,
{
  let relevant_ts = ts
    .iter()
    .filter(|t| t.isin == isin)
    .cloned()
    .collect::<Vec<_>>();
  let (units, cost) = relevant_ts.iter().fold((0.0, 0.0), |(au, ac), t| {
    (au + t.units, ac + (t.amount + t.fees) as f64 / 100.0)
  });

  let value = price.as_ref().map(|x| units * x.price.value());

  let irr = if let Some(x) = price.as_ref() {
    // is guaranteed to have the same length as positions
    let sale = (x.price.date(), units * x.price.value());

    let ts = relevant_ts
      .iter()
      .map(|t| (t.date, (t.amount + t.fees) as f64 / 100.0))
      .chain(std::iter::once(sale))
      .collect::<Vec<_>>();

    irr(&ts)
  } else {
    None
  };

  Position {
    value,
    isin,
    transactions: relevant_ts,
    units,
    cost,
    irr,
    data_source: price,
  }
}

fn irr(ts: &[(DateTime<Utc>, f64)]) -> Option<f64> {
  let beginning = ts.iter().map(|(d, _)| d).min()?;

  let seconds_per_interval = chrono::Duration::days(365).num_seconds();
  let ts = ts
    .iter()
    .map(|(d, x)| {
      (
        d.signed_duration_since(*beginning).num_seconds() as f64 / seconds_per_interval as f64,
        *x,
      )
    })
    .collect::<Vec<_>>();

  let f = |x: f64| {
    ts.iter()
      .fold(0.0, |acc, (t, y)| acc + y * (1.0 + x).powf(-t))
  };
  let df = |x: f64| {
    ts.iter()
      .fold(0.0, |acc, (t, y)| acc - t * y * (1.0 + x).powf(-t - 1.0))
  };

  newton(&f, &df, 0.1, 25, 1e-2, 1e-4, -0.999)
}

// newton method with projection of x to >= some lower bound (e.g. -0.999 for IRR)
fn newton(
  f: &dyn Fn(f64) -> f64,
  df: &dyn Fn(f64) -> f64,
  x0: f64,
  max_iter: u32,
  eps_val: f64,
  eps_step: f64,
  project_lb: f64,
) -> Option<f64> {
  let mut n = 0;
  let mut x = x0;
  let mut fx = 0.0;
  loop {
    if n >= max_iter {
      warn!(
        "newton: maximum iteration count of {} reached; x={:0.2}, f(x)={:0.2}",
        n, x, fx
      );
      return None;
    }

    fx = f(x);
    if fx.abs() < eps_val {
      debug!("newton: |f(x)|<{:0.2e} after {} iterations", eps_val, n);
      break;
    }

    let dfx = df(x);
    if dfx == 0.0 {
      warn!(
        "newton: reached critical point after {} iterations; x={:0.2}, f(x)={:0.2}",
        n, x, fx
      );
      return None;
    }

    let step = fx / dfx;
    x -= step;

    if x < project_lb {
      debug!("newton: projecting iterate to {:0.4}", project_lb);
      x = project_lb;
    }

    if step.abs() < eps_step {
      debug!(
        "newton: |x_n-x_{{n-1}}|<{:0.2e} after {} iterations, f(x_n)={:0.2}",
        eps_step, n, fx
      );
      break;
    }

    n += 1;
  }

  Some(x)
}
