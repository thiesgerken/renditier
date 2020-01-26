use crate::analysis::portfolio;
use crate::analysis::portfolio::Portfolio;
use crate::models::*;
use crate::web::user::UserId;
use crate::web::DbConn;

use chrono::offset::TimeZone;
use chrono::Utc;
use rocket_contrib::json::Json;

#[get("/analysis/portfolio?<date>")]
pub fn compute_historic_portfolio(
  uid: UserId,
  connection: DbConn,
  date: String, // DateTime<Utc> not possible
) -> Option<Json<Portfolio<HistoricalPrice>>> {
  let date = Utc
    .datetime_from_str(&format!("{} 17:30:00", &date), "%Y-%m-%d %H:%M:%S")
    .ok()?;

  portfolio::compute(&*connection, *uid, date).ok().map(Json)
}

#[get("/analysis/portfolio")]
pub fn compute_realtime_portfolio(
  uid: UserId,
  connection: DbConn,
) -> Option<Json<Portfolio<RealtimePrice>>> {
  let now = Utc::now();
  portfolio::compute(&*connection, *uid, now).ok().map(Json)
}
