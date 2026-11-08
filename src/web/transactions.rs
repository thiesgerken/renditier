use crate::models::*;
use crate::service::{DomainError, transactions};
use crate::web::DbConn;
use crate::web::user::UserId;

use rocket::serde::json::Json;

#[get("/transactions?<offset>&<count>")]
pub async fn list(
    uid: UserId,
    connection: DbConn,
    offset: Option<i64>,
    count: Option<i64>,
) -> Result<Json<Vec<Transaction>>, DomainError> {
    connection
        .run(move |c| transactions::list(c, *uid, offset, count).map(Json))
        .await
}

#[get("/transactions/<id>")]
pub async fn get(
    uid: UserId,
    connection: DbConn,
    id: i32,
) -> Result<Json<Transaction>, DomainError> {
    connection
        .run(move |c| transactions::get(c, *uid, id).map(Json))
        .await
}

#[delete("/transactions/<id>")]
pub async fn delete(uid: UserId, connection: DbConn, id: i32) -> Result<(), DomainError> {
    connection
        .run(move |c| transactions::delete(c, *uid, id))
        .await
}

#[put("/transactions/<id>", data = "<transaction>")]
pub async fn update(
    uid: UserId,
    connection: DbConn,
    id: i32,
    transaction: Json<Transaction>,
) -> Result<(), DomainError> {
    connection
        .run(move |c| transactions::update(c, *uid, id, transaction.0))
        .await
}

#[post("/transactions", data = "<transaction>")]
pub async fn create(
    uid: UserId,
    connection: DbConn,
    transaction: Json<NewTransaction>,
) -> Result<Json<Transaction>, DomainError> {
    connection
        .run(move |c| transactions::create(c, *uid, transaction.0).map(Json))
        .await
}
