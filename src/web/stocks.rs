use crate::analysis::returns::StockReturns;
use crate::service::DomainError;
use crate::service::stocks::{self, Stock};
use crate::web::DbConn;
use crate::web::user::UserId;

use chrono::Utc;
use rocket::serde::json::Json;
use std::collections::HashMap;

#[get("/stocks?<offset>&<count>")]
pub async fn list(
    _uid: UserId,
    connection: DbConn,
    offset: Option<i64>,
    count: Option<i64>,
) -> Result<Json<Vec<Stock>>, DomainError> {
    connection
        .run(move |c| stocks::list(c, offset, count).map(Json))
        .await
}

/// Keyed by ISIN; a static segment, so it takes precedence over `/stocks/<isin>`.
#[get("/stocks/returns")]
pub async fn returns(
    _uid: UserId,
    connection: DbConn,
) -> Result<Json<HashMap<String, StockReturns>>, DomainError> {
    connection
        .run(|c| stocks::returns(c, Utc::now()).map(Json))
        .await
}

#[get("/stocks/<isin>")]
pub async fn get(
    _uid: UserId,
    connection: DbConn,
    isin: String,
) -> Result<Json<Stock>, DomainError> {
    connection
        .run(move |c| stocks::get(c, &isin).map(Json))
        .await
}
