use crate::schema::historical_prices;
use crate::schema::realtime_prices;
use crate::schema::stock_exchanges;
use crate::schema::stock_infos;

use chrono::{DateTime, NaiveDate, Utc};

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
