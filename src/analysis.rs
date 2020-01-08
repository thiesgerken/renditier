use crate::models::*;
use crate::schema::*;

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::collections::HashSet;
use std::error::Error;

#[derive(Deserialize, Serialize)]
pub struct Portfolio<T> {
  pub cost: i64,
  pub value: Option<i64>,
  pub irr: Option<f64>,
  pub stocks: Vec<Position<T>>,
}

#[derive(Deserialize, Serialize)]
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

  //  collect isins that appear in the transactions
  let isins = ts.iter().map(|t| &t.isin).cloned().collect::<HashSet<_>>();
  dbg!(isins);

  // TODO: use Price::find to obtain suitable price information
  // TODO: for each ISIN, use the price information to build a Position<T>
  // TODO: use this to build a Portfolio<T>

  todo!();
}
