use crate::models::*;
use crate::service::{DomainError, accounts};
use crate::web::DbConn;
use crate::web::user::UserId;

use rocket::serde::json::Json;

#[get("/accounts?<offset>&<count>")]
pub async fn list(
    uid: UserId,
    connection: DbConn,
    offset: Option<i64>,
    count: Option<i64>,
) -> Result<Json<Vec<Account>>, DomainError> {
    connection
        .run(move |c| accounts::list(c, *uid, offset, count).map(Json))
        .await
}

#[get("/accounts/<id>")]
pub async fn get(uid: UserId, connection: DbConn, id: i32) -> Result<Json<Account>, DomainError> {
    connection
        .run(move |c| accounts::get(c, *uid, id).map(Json))
        .await
}

#[delete("/accounts/<id>")]
pub async fn delete(uid: UserId, connection: DbConn, id: i32) -> Result<(), DomainError> {
    connection.run(move |c| accounts::delete(c, *uid, id)).await
}

#[put("/accounts/<id>", data = "<account>")]
pub async fn update(
    uid: UserId,
    connection: DbConn,
    id: i32,
    account: Json<Account>,
) -> Result<(), DomainError> {
    connection
        .run(move |c| accounts::update(c, *uid, id, account.0))
        .await
}

#[post("/accounts", data = "<account>")]
pub async fn create(
    uid: UserId,
    connection: DbConn,
    account: Json<NewAccount>,
) -> Result<Json<Account>, DomainError> {
    connection
        .run(move |c| accounts::create(c, *uid, account.0).map(Json))
        .await
}
