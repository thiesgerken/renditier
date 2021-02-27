use crate::schema::*;

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};

// grabbed periodically for relevant ISINs
#[derive(Debug, Clone, Queryable, Insertable, Identifiable, Serialize, Deserialize, AsChangeset)]
#[primary_key("isin")]
#[serde(rename_all = "camelCase")]
pub struct StockInfo {
    pub isin: String,
    pub wkn: String,
    pub title: String,
    pub kind: String,
    pub company: String,
    pub fonds_type: Option<String>,
    pub focus: Option<String>,
    pub persistent: bool,
    pub onvista_url: String,
    pub last_historical_update: Option<DateTime<Utc>>,
    pub last_realtime_update: Option<DateTime<Utc>>,
    pub industry_breakdown: Option<String>, // serialized Array of Arrays, containing a name and a percentage
    pub instrument_breakdown: Option<String>, // serialized Array of Arrays, containing a name and a percentage
    pub country_breakdown: Option<String>, // serialized Array of Arrays, containing a name and a percentage
    pub currency_breakdown: Option<String>, // serialized Array of Arrays, containing a name and a percentage
    pub holdings: Option<String>,           // serialized Vec<Holding>
    pub launch_date: Option<DateTime<Utc>>,
    pub currency: Option<String>,
    pub management_type: Option<String>,
    pub payout_type: Option<String>,
    pub ter: Option<f64>,
    pub description: Option<String>,
    pub benchmark_index: Option<String>,
    pub instrument_id: Option<String>,
}

#[derive(
    Debug, Clone, Queryable, Insertable, Identifiable, Associations, Serialize, Deserialize,
)]
#[primary_key("onvista_record_id")]
#[belongs_to(StockInfo, foreign_key = "isin")]
#[serde(rename_all = "camelCase")]
pub struct StockExchange {
    pub isin: String,
    pub name: String,
    pub code: String,
    pub quality: Option<String>,
    pub onvista_record_id: i32,           // ID specific to exchange+stock
    pub onvista_exchange_id: Option<i32>, // ID specific to exchange only
}

// grabbed periodically for watched ISINs
#[derive(
    Debug, Clone, Queryable, Insertable, Identifiable, Associations, Serialize, Deserialize,
)]
#[belongs_to(StockExchange, foreign_key = "onvista_record_id")]
#[primary_key("date", "onvista_record_id")]
#[serde(rename_all = "camelCase")]
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
#[serde(rename_all = "camelCase")]
pub struct RealtimePrice {
    pub date: DateTime<Utc>,
    pub price: f64,
    pub onvista_record_id: i32, // ID specific to exchange+stock
}

#[derive(Debug, Clone, Queryable, Insertable, Identifiable, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id: i32,
    pub name: String,
    pub full_name: String,
    pub hash: String,
}

#[derive(Debug, Clone, Insertable, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[table_name = "users"]
pub struct NewUser {
    pub name: String,
    pub full_name: String,
    pub hash: String,
}

#[derive(
    Debug,
    Clone,
    Queryable,
    Insertable,
    Associations,
    Identifiable,
    Serialize,
    Deserialize,
    AsChangeset,
)]
#[belongs_to(User, foreign_key = "user_id")]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub id: i32,
    pub user_id: i32,
    pub name: String,
    pub iban: Option<String>,
}

#[derive(Debug, Clone, Insertable, Serialize, Deserialize)]
#[table_name = "accounts"]
#[serde(rename_all = "camelCase")]
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
#[serde(rename_all = "camelCase")]
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
    Debug,
    Clone,
    Queryable,
    Insertable,
    Associations,
    Identifiable,
    Serialize,
    Deserialize,
    AsChangeset,
)]
#[belongs_to(Account, foreign_key = "account_id")]
#[serde(rename_all = "camelCase")]
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
    pub exchange: Option<String>,
    pub receipt_number: Option<i64>,
}

#[derive(Debug, Clone, Insertable, Serialize, Deserialize)]
#[table_name = "transactions"]
#[serde(rename_all = "camelCase")]
pub struct NewTransaction {
    pub account_id: i32,
    pub isin: String,
    pub date: DateTime<Utc>,
    pub units: f64,
    pub amount: i64,
    pub fees: i64,
    pub onvista_exchange_id: Option<i32>,
    pub comments: String,
    pub exchange: Option<String>,
    pub receipt_number: Option<i64>,
}
