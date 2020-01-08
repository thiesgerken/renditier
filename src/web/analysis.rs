use crate::analysis::*;
use crate::models::*;
use crate::schema::*;
use crate::web::user::UserId;
use crate::web::DbConn;

use chrono::Utc;
use diesel::prelude::*;
use rocket_contrib::databases::diesel;
use rocket_contrib::json::Json;

#[get("/analysis/portfolio?<date>")]
pub fn compute_historic_portfolio(
  uid: UserId,
  connection: DbConn,
  date: String, // DateTime<Utc> not possible
) -> Option<Json<Portfolio<HistoricalPrice>>> {
  let date = date.parse().ok()?;

  compute_portfolio(&*connection, *uid, date).ok().map(Json)
}

#[get("/analysis/portfolio")]
pub fn compute_realtime_portfolio(
  uid: UserId,
  connection: DbConn,
) -> Option<Json<Portfolio<RealtimePrice>>> {
  let now = Utc::now();
  compute_portfolio(&*connection, *uid, now).ok().map(Json)
}
