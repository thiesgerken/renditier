use crate::models::*;
use crate::schema::*;
use crate::web::user::UserId;
use crate::web::DbConn;

use diesel::prelude::*;
use rocket_contrib::databases::diesel;
use rocket_contrib::json::Json;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Stock {
  info: StockInfo,
  exchanges: Vec<Exchange>,
}

#[derive(Debug, Serialize, Deserialize)]
struct Exchange {
  info: StockExchange,
  current_price: Option<RealtimePrice>,
}

#[get("/stocks?<offset>&<count>")]
pub fn list(
  _uid: UserId,
  connection: DbConn,
  offset: Option<i64>,
  count: Option<i64>,
) -> Option<Json<Vec<Stock>>> {
  let infos = stock_infos::table
    .order(stock_infos::isin.asc())
    .limit(count.unwrap_or(i64::max_value()))
    .offset(offset.unwrap_or(0))
    .load::<StockInfo>(&*connection)
    .ok()?;

  let exchanges = stock_exchanges::table
    .filter(stock_exchanges::isin.eq_any(infos.iter().map(|s| &s.isin)))
    .load::<StockExchange>(&*connection)
    .ok()?;

  let prices = realtime_prices::table
    .filter(
      realtime_prices::onvista_record_id.eq_any(exchanges.iter().map(|e| &e.onvista_record_id)),
    )
    .order_by(realtime_prices::onvista_record_id.asc())
    .then_order_by(realtime_prices::date.desc())
    .load::<RealtimePrice>(&*connection)
    .ok()?;

  let mut es = exchanges
    .into_iter()
    .map(|e| Exchange {
      current_price: prices
        .iter()
        .filter(|p| p.onvista_record_id == e.onvista_record_id)
        .next()
        .map(|p| p.clone()),
      info: e,
    })
    .peekable();

  let mut x = Vec::with_capacity(infos.len());

  for s in infos.into_iter() {
    let mut s_es = Vec::with_capacity(8); // up to 5 exchanges are grabbed in cli/data.rs
    while es.peek().map(|e| &e.info.isin) == Some(&s.isin) {
      s_es.push(es.next().unwrap())
    }

    x.push(Stock {
      info: s,
      exchanges: s_es,
    });
  }

  Some(Json(x))
}

#[get("/stocks/<isin>")]
pub fn get(_uid: UserId, connection: DbConn, isin: String) -> Option<Json<Stock>> {
  let isin = isin.to_uppercase();
  let info = stock_infos::table
    .find(&isin)
    .first::<StockInfo>(&*connection)
    .ok()?;

  let exchanges = stock_exchanges::table
    .filter(stock_exchanges::isin.eq(isin))
    .load::<StockExchange>(&*connection)
    .ok()?;

  let prices = realtime_prices::table
    .filter(
      realtime_prices::onvista_record_id.eq_any(exchanges.iter().map(|e| &e.onvista_record_id)),
    )
    .order_by(realtime_prices::onvista_record_id.asc())
    .then_order_by(realtime_prices::date.desc())
    .load::<RealtimePrice>(&*connection)
    .ok()?;

  let es = exchanges
    .into_iter()
    .map(|e| Exchange {
      current_price: prices
        .iter()
        .filter(|p| p.onvista_record_id == e.onvista_record_id)
        .next()
        .map(|p| p.clone()),
      info: e,
    })
    .collect();

  Some(Json(Stock {
    info,
    exchanges: es,
  }))
}
