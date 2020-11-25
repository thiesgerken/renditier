use crate::models::*;
use crate::schema::*;
use crate::web::user::UserId;
use crate::web::DbConn;

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use regex::Regex;
use rocket_contrib::databases::diesel;
use rocket_contrib::json::Json;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Stock {
    isin: String,
    wkn: String,
    title: String,
    kind: String,
    company: String,
    fonds_type: Option<String>,
    focus: Option<String>,
    persistent: bool,
    onvista_url: String,
    last_historical_update: Option<DateTime<Utc>>,
    last_realtime_update: Option<DateTime<Utc>>,
    industry_breakdown: Option<String>, // serialized Array of Arrays, containing a industry name and a percentage
    instrument_breakdown: Option<String>, // serialized Array of Arrays, containing a name and a percentage
    country_breakdown: Option<String>, // serialized Array of Arrays, containing a name and a percentage
    currency_breakdown: Option<String>, // serialized Array of Arrays, containing a name and a percentage
    holdings: Option<String>,           // serialized Vec<Holding>
    launch_date: Option<DateTime<Utc>>,
    currency: Option<String>,
    management_type: Option<String>,
    payout_type: Option<String>,
    ter: Option<f64>,
    description: Option<String>,
    exchanges: Vec<Exchange>,
    index: Option<String>,
}

impl Stock {
    fn new(s: StockInfo, exchanges: Vec<Exchange>, index: Option<String>) -> Self {
        Self {
            isin: s.isin,
            wkn: s.wkn,
            title: s.title,
            kind: s.kind,
            fonds_type: s.fonds_type,
            company: s.company,
            focus: s.focus,
            persistent: s.persistent,
            onvista_url: s.onvista_url,
            last_historical_update: s.last_historical_update,
            last_realtime_update: s.last_realtime_update,
            industry_breakdown: s.industry_breakdown,
            instrument_breakdown: s.instrument_breakdown,
            country_breakdown: s.country_breakdown,
            currency_breakdown: s.currency_breakdown,
            holdings: s.holdings,
            launch_date: s.launch_date,
            currency: s.currency,
            management_type: s.management_type,
            payout_type: s.payout_type,
            ter: s.ter,
            description: s.description,
            exchanges,
            index,
        }
    }
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
                .limit(count.unwrap_or(i64::max_value()))
                .offset(offset.unwrap_or(0))
                .load::<StockInfo>(c)
                .ok()?;

            let exchanges = stock_exchanges::table
                .filter(stock_exchanges::isin.eq_any(infos.iter().map(|s| &s.isin)))
                .load::<StockExchange>(c)
                .ok()?;

            let prices = realtime_prices::table
                .filter(
                    realtime_prices::onvista_record_id
                        .eq_any(exchanges.iter().map(|e| &e.onvista_record_id)),
                )
                .order_by(realtime_prices::date.desc())
                .limit(200) // might return nothing if the newest price is very old ...
                .load::<RealtimePrice>(c)
                .ok()?;

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
                    Stock::new(s, s_es, idx)
                })
                .collect::<Vec<_>>();

            Some(Json(x))
        })
        .await
}

fn find_index(s: &StockInfo) -> Option<String> {
    let re = Regex::new(r"(MSCI|iSTOXX|STOXX|S&P|Dow Jones)[^ ]*(:? [^a-z(][\w]*)+").unwrap();
    s.description
        .as_ref()
        .map(|desc| {
            re.find_iter(&desc)
                .map(|m| m.as_str().to_owned())
                .find(|m| !m.contains("ETF"))
        })
        .flatten()
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

            let prices = realtime_prices::table
                .filter(
                    realtime_prices::onvista_record_id
                        .eq_any(exchanges.iter().map(|e| &e.onvista_record_id)),
                )
                .order_by(realtime_prices::onvista_record_id.asc())
                .then_order_by(realtime_prices::date.desc())
                .load::<RealtimePrice>(c)
                .ok()?;

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
            Some(Json(Stock::new(info, es, idx)))
        })
        .await
}
