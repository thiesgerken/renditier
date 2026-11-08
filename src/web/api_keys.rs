use crate::service::DomainError;
use crate::service::api_keys::{self, ApiKey, CreatedApiKey, NewApiKey};
use crate::web::DbConn;
use crate::web::user::SessionUserId;

use rocket::serde::json::Json;

#[get("/keys")]
pub async fn list(
    uid: SessionUserId,
    connection: DbConn,
) -> Result<Json<Vec<ApiKey>>, DomainError> {
    connection
        .run(move |c| api_keys::list(c, *uid).map(Json))
        .await
}

#[post("/keys", data = "<key>")]
pub async fn create(
    uid: SessionUserId,
    connection: DbConn,
    key: Json<NewApiKey>,
) -> Result<Json<CreatedApiKey>, DomainError> {
    connection
        .run(move |c| api_keys::create(c, *uid, key.0).map(Json))
        .await
}

#[delete("/keys/<id>")]
pub async fn delete(uid: SessionUserId, connection: DbConn, id: i32) -> Result<(), DomainError> {
    connection.run(move |c| api_keys::delete(c, *uid, id)).await
}
