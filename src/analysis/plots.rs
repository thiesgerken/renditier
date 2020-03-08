use crate::analysis::price::{DataSource, Price};
use crate::analysis::{irr, price};
use crate::data::exchange_comparison;
use crate::models::*;
use crate::schema::*;

use chrono::offset::TimeZone;
use chrono::{DateTime, Duration, NaiveDate, Utc};
use diesel::prelude::*;
use itertools::Itertools;
use log::debug;
use serde::{Deserialize, Serialize};
use std::cmp::max;
use std::collections::HashMap;
use std::collections::HashSet;
use std::error::Error;
use std::iter::successors;

#[derive(Deserialize, Serialize)]
pub struct PortfolioPlot {
  dates: Vec<NaiveDate>,
  investments: Vec<f32>,
  values: Vec<Option<f32>>,
  exchanges: Vec<StockExchange>,
}

pub fn compute_portfolio_plot<T>(
  connection: &diesel::PgConnection,
  user_id: i32,
  start_date: NaiveDate,
  end_date: NaiveDate,
) -> Result<PortfolioPlot, Box<dyn Error>>
where
  T: Price + Sized,
{
  // read all transactions up to end_time from db
  let ts = transactions::table
    .inner_join(accounts::table)
    .filter(accounts::user_id.eq(user_id))
    .filter(transactions::date.le(Utc.from_utc_date(&end_date).and_hms(17, 30, 0)))
    .order(transactions::date.asc())
    .load::<(Transaction, Account)>(&*connection)?
    .into_iter()
    .map(|(a, _)| a)
    .collect::<Vec<_>>();

  // collect ISINs in the transactions
  let isins = ts.iter().map(|t| &t.isin).cloned().collect::<Vec<_>>();

  // for these ISINs, grab all exchanges and select the preferred one
  let exs = stock_exchanges::table
    .filter(stock_exchanges::isin.eq_any(isins.clone()))
    .order(stock_exchanges::isin.asc())
    .load::<StockExchange>(&*connection)?
    .into_iter()
    .group_by(|se| se.isin.clone())
    .into_iter()
    .filter_map(|(_, es)| {
      es.min_by(exchange_comparison)
        .map(|e| (e.onvista_record_id, e))
    })
    .collect::<HashMap<_, _>>();

  // stock without exchanges? -> no price data for this one, all values would be None
  if isins.len() != exs.len() {
    return Ok(PortfolioPlot {
      dates: Vec::new(),
      exchanges: Vec::new(),
      investments: Vec::new(),
      values: Vec::new(),
    });
  }

  // for these Exchanges, grab all historical prices from start_date to end_date
  let prices = historical_prices::table
    .filter(historical_prices::onvista_record_id.eq_any(exs.values().map(|e| e.onvista_record_id)))
    .filter(historical_prices::date.ge(start_date))
    .filter(historical_prices::date.le(end_date))
    .order((
      historical_prices::onvista_record_id.asc(),
      historical_prices::date.asc(),
    ))
    .load::<HistoricalPrice>(&*connection)?;
  debug!(
    "loaded {} historical prices for {} exchanges",
    prices.len(),
    exs.len()
  );

  let prices = prices.into_iter().group_by(|p| p.onvista_record_id);
  let prices = prices.into_iter().collect::<HashMap<_, _>>();

  // sample 200 days between start and end, but at most once a day
  let interval = max((end_date - start_date) / 200, Duration::days(1));
  let dates = successors(Some(Utc.from_utc_date(&start_date).and_hms(1, 0, 0)), |x| {
    x.checked_add_signed(interval)
  })
  .map(|d| d.date().naive_utc())
  .take_while(|d| d <= &end_date)
  .collect::<Vec<_>>();

  // TODO: at these dates, calculate invested money and units for each ISIN (one loop for each isin should be enough, advancing both the price list and the transactions)
  // TODO: use the prices to calculate the values at the dates (take the newest price that is <= the searched for date, one loop for each isin)

  todo!()
}
