use crate::models::*;
use crate::service::{DomainError, prices};
use crate::web::DbConn;
use crate::web::user::UserId;
use crate::web::util::parse_date;

use rocket::serde::json::Json;

#[get("/stocks/prices/historical/<record>?<offset>&<count>&<from>&<to>")]
pub async fn list(
    _uid: UserId,
    connection: DbConn,
    record: i32,
    offset: Option<i64>,
    count: Option<i64>,
    from: Option<&str>,
    to: Option<&str>,
) -> Result<Json<Vec<HistoricalPrice>>, DomainError> {
    let from = from.map(parse_date).transpose()?;
    let to = to.map(parse_date).transpose()?;

    connection
        .run(move |c| prices::historical(c, record, from, to, offset, count).map(Json))
        .await
}
