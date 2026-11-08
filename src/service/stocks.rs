use crate::analysis::returns::{self, StockReturns};
use crate::models::*;
use crate::schema::*;
use crate::service::DomainError;

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
pub struct Stock {
    #[serde(flatten)]
    pub info: StockInfo,
    pub exchanges: Vec<Exchange>,
    pub index: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Price {
    pub date: DateTime<Utc>,
    pub price: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Exchange {
    pub isin: String,
    pub name: String,
    pub code: String,
    pub quality: Option<String>,
    pub onvista_record_id: i32,           // ID specific to exchange+stock
    pub onvista_exchange_id: Option<i32>, // ID specific to exchange only
    pub current_price: Option<Price>,
}

impl Exchange {
    fn new(current_price: Option<&RealtimePrice>, e: StockExchange) -> Self {
        Self {
            isin: e.isin,
            name: e.name,
            code: e.code,
            quality: e.quality,
            onvista_record_id: e.onvista_record_id,
            onvista_exchange_id: e.onvista_exchange_id,
            current_price: current_price.map(|p| Price {
                date: p.date,
                price: p.price,
            }),
        }
    }
}

pub fn list(
    c: &mut PgConnection,
    offset: Option<i64>,
    count: Option<i64>,
) -> Result<Vec<Stock>, DomainError> {
    let infos = stock_infos::table
        .order(stock_infos::isin.asc())
        .limit(count.unwrap_or(i64::MAX))
        .offset(offset.unwrap_or(0))
        .load::<StockInfo>(c)?;

    with_exchanges(c, infos)
}

pub fn get(c: &mut PgConnection, isin: &str) -> Result<Stock, DomainError> {
    let info = stock_infos::table
        .find(isin.to_uppercase())
        .first::<StockInfo>(c)?;

    let mut stocks = with_exchanges(c, vec![info])?;
    Ok(stocks.remove(0))
}

/// The returns of every stock, keyed by ISIN.
pub fn returns(
    c: &mut PgConnection,
    now: DateTime<Utc>,
) -> Result<HashMap<String, StockReturns>, DomainError> {
    Ok(returns::compute(c, now)?)
}

fn with_exchanges(c: &mut PgConnection, infos: Vec<StockInfo>) -> Result<Vec<Stock>, DomainError> {
    let exchanges = stock_exchanges::table
        .filter(stock_exchanges::isin.eq_any(infos.iter().map(|s| &s.isin)))
        .load::<StockExchange>(c)?;

    let prices = newest_prices(c, &exchanges)?;

    let exchanges = exchanges
        .into_iter()
        .map(|e| {
            let price = prices
                .iter()
                .find(|p| p.onvista_record_id == e.onvista_record_id);
            Exchange::new(price, e)
        })
        .collect::<Vec<_>>();

    Ok(infos
        .into_iter()
        .map(|info| Stock {
            exchanges: exchanges
                .iter()
                .filter(|e| e.isin == info.isin)
                .cloned()
                .collect(),
            index: find_index(&info),
            info,
        })
        .collect())
}

/// The newest realtime price of each exchange, however old it is.
fn newest_prices(
    c: &mut PgConnection,
    exchanges: &[StockExchange],
) -> QueryResult<Vec<RealtimePrice>> {
    let record_ids = exchanges
        .iter()
        .map(|e| e.onvista_record_id)
        .collect::<Vec<_>>();

    // One index lookup per exchange (realtime_prices_by_record); diesel has no
    // LATERAL join.
    diesel::sql_query(
        "SELECT p.* FROM unnest($1) AS e(onvista_record_id) CROSS JOIN LATERAL (
            SELECT * FROM realtime_prices r WHERE r.onvista_record_id = e.onvista_record_id
            ORDER BY r.date DESC LIMIT 1
        ) p",
    )
    .bind::<diesel::sql_types::Array<diesel::sql_types::Integer>, _>(record_ids)
    .load(c)
}

fn find_index(s: &StockInfo) -> Option<String> {
    let re = Regex::new(r"(MSCI|iSTOXX|STOXX|S&P|Dow Jones)[^ ]*(:? [^a-z(][\w]*)+").unwrap(); // cSpell: disable-line
    s.description.as_ref().and_then(|desc| {
        re.find_iter(desc)
            .map(|m| m.as_str().to_owned())
            .find(|m| !m.contains("ETF"))
    })
}
