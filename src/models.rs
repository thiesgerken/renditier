use crate::schema::*;

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};

// grabbed periodically for relevant ISINs
#[derive(Debug, Clone, Queryable, Insertable, Identifiable, Serialize, Deserialize)]
#[primary_key("isin")]
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

#[derive(
    Debug, Clone, Queryable, Insertable, Identifiable, Associations, Serialize, Deserialize,
)]
#[primary_key("onvista_record_id")]
#[belongs_to(StockInfo, foreign_key = "isin")]
pub struct StockExchange {
    pub isin: String,
    pub name: String,
    pub code: String,
    pub quality: String,
    pub onvista_record_id: i32,   // ID specific to exchange+stock
    pub onvista_exchange_id: i32, // ID specific to exchange only
}

// grabbed periodically for watched ISINs
#[derive(
    Debug, Clone, Queryable, Insertable, Identifiable, Associations, Serialize, Deserialize,
)]
#[belongs_to(StockExchange, foreign_key = "onvista_record_id")]
#[primary_key("date", "onvista_record_id")]
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
#[derive(
    Debug, Clone, Queryable, Insertable, Identifiable, Associations, Serialize, Deserialize,
)]
#[belongs_to(StockExchange, foreign_key = "onvista_record_id")]
#[primary_key("date", "onvista_record_id")]
pub struct RealtimePrice {
    pub date: DateTime<Utc>,
    pub price: f64,
    pub currency: String,
    pub onvista_record_id: i32, // ID specific to exchange+stock
}

#[derive(Debug, Clone, Queryable, Insertable, Identifiable, Serialize, Deserialize)]
pub struct User {
    pub id: i32,
    pub name: String,
    pub full_name: String,
    pub hash: String,
}

#[derive(Debug, Clone, Insertable)]
#[table_name = "users"]
pub struct NewUser {
    pub name: String,
    pub full_name: String,
    pub hash: String,
}

#[derive(
    Debug, Clone, Queryable, Insertable, Associations, Identifiable, Serialize, Deserialize,
)]
#[belongs_to(User, foreign_key = "user_id")]
pub struct Account {
    pub id: i32,
    pub user_id: i32,
    pub name: String,
    pub iban: Option<String>,
}

#[derive(Debug, Clone, Insertable)]
#[table_name = "accounts"]
pub struct NewAccount {
    pub user_id: i32,
    pub name: String,
    pub iban: Option<String>,
}

#[derive(
    Debug, Clone, Queryable, Insertable, Associations, Identifiable, Serialize, Deserialize,
)]
#[belongs_to(User, foreign_key = "user_id")]
#[primary_key("endpoint")]
pub struct PushSubscription {
    pub endpoint: String,
    pub user_id: i32,
    pub auth: String,
    pub p256dh: String,
    pub created: DateTime<Utc>,
    pub last_contact: DateTime<Utc>,
    pub last_notification: Option<DateTime<Utc>>,
}

#[derive(
    Debug, Clone, Queryable, Insertable, Associations, Identifiable, Serialize, Deserialize,
)]
#[belongs_to(Account, foreign_key = "account_id")]
pub struct Transaction {
    pub id: i32,
    pub account_id: i32,
    pub isin: String,
    pub date: DateTime<Utc>,
    pub units: f64,
    pub amount: i64, // -units*price in cents (or simply the amount in case of dividends); does not include fees; negative sign -> gave money away.
    pub fees: i64,   // sign should be negative
    pub onvista_exchange_id: Option<i32>,
    pub comments: String,
}

#[derive(Debug, Clone, Insertable, Serialize, Deserialize)]
#[table_name = "transactions"]
pub struct NewTransaction {
    pub account_id: i32,
    pub isin: String,
    pub date: DateTime<Utc>,
    pub units: f64,
    pub amount: i64,
    pub fees: i64,
    pub onvista_exchange_id: Option<i32>,
    pub comments: String,
}
