use crate::models::*;
use crate::schema::*;
use crate::web::user::UserId;
use crate::web::DbConn;

use chrono::NaiveDate;
use diesel::prelude::*;
use rocket_contrib::databases::diesel;
use rocket_contrib::json::Json;

#[get("/stocks/prices/historical/<record>?<offset>&<count>&<from>&<to>")]
pub async fn list(
    _uid: UserId,
    connection: DbConn,
    record: i32,
    offset: Option<i64>,
    count: Option<i64>,
    from: Option<String>, // NaiveDate not possible
    to: Option<String>,   // NaiveDate not possible
) -> Option<Json<Vec<HistoricalPrice>>> {
    connection
        .run(move |c| {
            let from = from.and_then(|t| t.parse().ok());
            let to = to.and_then(|t| t.parse().ok());

            historical_prices::table
                .filter(historical_prices::onvista_record_id.eq(record))
                .filter(
                    historical_prices::date
                        .le(to.unwrap_or_else(|| NaiveDate::from_ymd(2100, 1, 1))),
                )
                .filter(
                    historical_prices::date
                        .ge(from.unwrap_or_else(|| NaiveDate::from_ymd(1900, 1, 1))),
                )
                .order(historical_prices::date.asc())
                .limit(count.unwrap_or(i64::max_value()))
                .offset(offset.unwrap_or(0))
                .load::<HistoricalPrice>(c)
                .map(Json)
                .ok()
        })
        .await
}
