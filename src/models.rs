use crate::schema::*;

use chrono::{DateTime, NaiveDate, Utc};
use diesel::data_types::Cents;

// grabbed periodically for relevant ISINs
#[derive(Debug, Queryable, Insertable)]
pub struct StockInfo {
  pub isin: String,
  pub wkn: String,
  pub title: String,
  pub country: String,
  pub fonds_type: String,
  pub managing_company: String,
  pub focus: String,
  pub persistent: bool,
  pub onvista_url: String,
  pub last_historical_update: Option<DateTime<Utc>>,
  pub last_realtime_update: Option<DateTime<Utc>>,
}

#[derive(Debug, Queryable, Insertable)]
pub struct StockExchange {
  pub isin: String,
  pub name: String,
  pub code: String,
  pub quality: String,
  pub onvista_record_id: i32,   // ID specific to exchange+stock
  pub onvista_exchange_id: i32, // ID specific to exchange only
}

// grabbed periodically for watched ISINs
#[derive(Debug, Queryable, Insertable)]
pub struct HistoricalPrice {
  pub date: NaiveDate,
  pub opening: f64,
  pub closing: f64,
  pub high: f64,
  pub low: f64,
  pub volume: i32,
  pub onvista_record_id: i32, // ID specific to exchange+stock
}

// grabbed periodically for watched ISINs; can be updated manually;
// should do regular (or upon inserts) cleanups of these
#[derive(Debug, Queryable, Insertable)]
pub struct RealtimePrice {
  pub date: DateTime<Utc>,
  pub price: f64,
  pub currency: String,
  pub onvista_record_id: i32, // ID specific to exchange+stock
}

#[derive(Debug, Queryable, Insertable)]
pub struct User {
  pub id: i32,
  pub name: String,
  pub full_name: String,
  pub hash: String,
}

#[derive(Debug, Insertable)]
#[table_name = "users"]
pub struct NewUser {
  pub name: String,
  pub full_name: String,
  pub hash: String,
}

#[derive(Debug, Queryable, Insertable)]
pub struct Account {
  pub id: i32,
  pub owner_id: i32,
  pub broker: String,
  pub iban: String,
}

#[derive(Debug, Queryable, Insertable)]
pub struct Transaction {
  pub id: i32,
  pub account_id: i32,
  pub isin: String,
  pub date: DateTime<Utc>,
  pub units: f64,
  pub amount: Cents,
  pub fees: Cents,
  pub onvista_exchange_id: i32,
}
