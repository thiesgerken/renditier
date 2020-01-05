use crate::models::*;
use crate::schema::*;
use crate::web::user::UserId;
use crate::web::DbConn;

use diesel::prelude::*;
use rocket_contrib::databases::diesel;
use rocket_contrib::json::Json;

#[get("/stocks/prices/historical?<offset>&<count>")]
pub fn list(
  _uid: UserId,
  connection: DbConn,
  offset: Option<i64>,
  count: Option<i64>,
) -> Option<Json<Vec<RealtimePrice>>> {
  realtime_prices::table
    .order(realtime_prices::isin.asc())
    .limit(count.unwrap_or(i64::max_value()))
    .offset(offset.unwrap_or(0))
    .load::<RealtimePrice>(&*connection)
    .map(|a| Json(a))
    .ok()
}

#[get("/stocks/prices/historical/<isin>")]
pub fn get(_uid: UserId, connection: DbConn, isin: String) -> Option<Json<RealtimePrice>> {
  let isin = isin.to_uppercase();

  stock_infos::table
    .find(isin)
    .first::<StockInfo>(&*connection)
    .map(|a| Json(a))
    .ok()
}
