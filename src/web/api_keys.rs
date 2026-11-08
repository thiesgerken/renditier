use crate::api_keys::{self, ApiKey, CreateError, CreatedApiKey, NewApiKey};
use crate::web::DbConn;
use crate::web::user::SessionUserId;
use crate::web::util::log_error_and_500;

use log::info;
use rocket::http::Status;
use rocket::serde::json::Json;

#[get("/keys")]
pub async fn list(uid: SessionUserId, connection: DbConn) -> Result<Json<Vec<ApiKey>>, Status> {
    connection
        .run(move |c| api_keys::list(c, *uid))
        .await
        .map(Json)
        .map_err(|e| log_error_and_500(Box::new(e)))
}

#[post("/keys", data = "<key>")]
pub async fn create(
    uid: SessionUserId,
    connection: DbConn,
    key: Json<NewApiKey>,
) -> Result<Json<CreatedApiKey>, Status> {
    let uid = *uid;
    let created = connection
        .run(move |c| api_keys::create(c, uid, key.0))
        .await
        .map_err(|e| match e {
            CreateError::EmptyName | CreateError::ExpiryNotInFuture => Status::UnprocessableEntity,
            CreateError::NameTaken => Status::Conflict,
            CreateError::Database(e) => log_error_and_500(Box::new(e)),
        })?;

    info!(
        "Created API key '{}' ({:?}) for user {}",
        created.api_key.name, created.api_key.access, uid
    );
    Ok(Json(created))
}

#[delete("/keys/<id>")]
pub async fn delete(uid: SessionUserId, connection: DbConn, id: i32) -> Result<(), Status> {
    let uid = *uid;
    let deleted = connection
        .run(move |c| api_keys::delete(c, uid, id))
        .await
        .map_err(|e| log_error_and_500(Box::new(e)))?;

    if !deleted {
        return Err(Status::NotFound);
    }

    info!("Deleted API key {} of user {}", id, uid);
    Ok(())
}
