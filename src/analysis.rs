use crate::models::*;

use chrono::{DateTime, Utc};
use std::collections::HashMap;

pub struct Portfolio<T> {
  pub cost: i64,
  pub value: Option<i64>,
  pub irr: Option<f64>,
  pub stocks: Vec<Position<T>>,
}

pub struct Position<T> {
  pub isin: String,
  pub units: f64,
  pub cost: i64,
  pub value: Option<f64>,
  pub irr: Option<f64>,
  pub data_source: Option<T>,
  pub transactions: Vec<Transaction>,
}

pub trait Price {
  // hard_threshold: amount of days the price may be off
  // soft_threshold: amount of days that are considered irrelevant to scoring of exchanges
  // return value might not contain prices for all of the provided ISINs
  fn find(
    connection: &diesel::PgConnection,
    isins: &[String],
    date: DateTime<Utc>,
    hard_threshold: f64,
    soft_threshold: f64,
  ) -> HashMap<String, Self>
  where
    Self: Sized;

  fn value(&self) -> i64;
}

// TODO: impl Price for Realtime and Historic
// in both cases: * query prices with time diff up to +/- hard_threshold
//                * if any in soft_threshold: use the preferred in there
//                * otherwise, first the prices with minimum time diff and pick the preferred in there

pub fn compute_portfolio<T>(user_id: i32, date: DateTime<Utc>) -> Portfolio<T>
where
  T: Price + Sized,
{
  // TODO: read all transactions for the user from db
  // TODO: collect isins that appear in the transactions
  // TODO: use Price::find to obtain suitable price information
  // TODO: for each ISIN, use the price information to build a Position<T>
  // TODO: use this to build a Portfolio<T>

  todo!();
}
