use crate::models::*;
use crate::schema::*;
use crate::web::DbConn;
use crate::web::user::UserId;

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use regex::Regex;
use rocket::serde::json::Json;
use rocket_sync_db_pools::diesel;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Stock {
    #[serde(flatten)]
    info: StockInfo,
    exchanges: Vec<Exchange>,
    index: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Price {
    date: DateTime<Utc>,
    price: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Exchange {
    isin: String,
    name: String,
    code: String,
    quality: Option<String>,
    onvista_record_id: i32,           // ID specific to exchange+stock
    onvista_exchange_id: Option<i32>, // ID specific to exchange only
    current_price: Option<Price>,
}

impl Exchange {
    fn new(current_price: Option<RealtimePrice>, e: StockExchange) -> Self {
        Self {
            isin: e.isin,
            name: e.name,
            code: e.code,
            quality: e.quality,
            onvista_record_id: e.onvista_record_id, // ID specific to exchange+stock
            onvista_exchange_id: e.onvista_exchange_id, // ID specific to exchange only
            current_price: current_price.map(|p| Price {
                date: p.date,
                price: p.price,
            }),
        }
    }
}

#[get("/stocks?<offset>&<count>")]
pub async fn list(
    _uid: UserId,
    connection: DbConn,
    offset: Option<i64>,
    count: Option<i64>,
) -> Option<Json<Vec<Stock>>> {
    connection
        .run(move |c| {
            let infos = stock_infos::table
                .order(stock_infos::isin.asc())
                .limit(count.unwrap_or(i64::MAX))
                .offset(offset.unwrap_or(0))
                .load::<StockInfo>(c)
                .ok()?;

            let exchanges = stock_exchanges::table
                .filter(stock_exchanges::isin.eq_any(infos.iter().map(|s| &s.isin)))
                .load::<StockExchange>(c)
                .ok()?;

            let prices = newest_prices(c, &exchanges).ok()?;

            let es = exchanges
                .into_iter()
                .map(|e| {
                    Exchange::new(
                        prices
                            .iter()
                            .find(|p| p.onvista_record_id == e.onvista_record_id)
                            .cloned(),
                        e,
                    )
                })
                .collect::<Vec<_>>();

            let x = infos
                .into_iter()
                .map(|s| {
                    let s_es = es
                        .iter()
                        .filter(|e| e.isin == s.isin)
                        .cloned()
                        .collect::<Vec<_>>();
                    let idx = find_index(&s);
                    Stock {
                        info: s,
                        exchanges: s_es,
                        index: idx,
                    }
                })
                .collect::<Vec<_>>();

            Some(Json(x))
        })
        .await
}

/// The newest realtime price of each exchange, however old it is.
fn newest_prices(
    c: &mut diesel::PgConnection,
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

#[get("/stocks/<isin>")]
pub async fn get(_uid: UserId, connection: DbConn, isin: String) -> Option<Json<Stock>> {
    connection
        .run(move |c| {
            let isin = isin.to_uppercase();
            let info = stock_infos::table.find(&isin).first::<StockInfo>(c).ok()?;

            let exchanges = stock_exchanges::table
                .filter(stock_exchanges::isin.eq(isin))
                .load::<StockExchange>(c)
                .ok()?;

            let prices = newest_prices(c, &exchanges).ok()?;

            let es = exchanges
                .into_iter()
                .map(|e| {
                    Exchange::new(
                        prices
                            .iter()
                            .find(|p| p.onvista_record_id == e.onvista_record_id)
                            .cloned(),
                        e,
                    )
                })
                .collect();

            let idx = find_index(&info);
            Some(Json(Stock {
                info,
                exchanges: es,
                index: idx,
            }))
        })
        .await
}
