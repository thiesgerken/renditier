use crate::models::*;
use crate::schema::*;
use crate::web::user::UserId;
use crate::web::util::log_error_and_500;
use crate::web::DbConn;

use diesel::prelude::*;
use log::info;
use rocket::http::Status;
use rocket_contrib::databases::diesel;
use rocket_contrib::json::Json;

#[get("/accounts?<offset>&<count>")]
pub fn list(
    uid: UserId,
    connection: DbConn,
    offset: Option<i64>,
    count: Option<i64>,
) -> Option<Json<Vec<Account>>> {
    accounts::table
        .filter(accounts::user_id.eq(*uid))
        .order(accounts::id.asc())
        .limit(count.unwrap_or(i64::max_value()))
        .offset(offset.unwrap_or(0))
        .load::<Account>(&*connection)
        .map(Json)
        .ok()
}

#[get("/accounts/<id>")]
pub fn get(uid: UserId, connection: DbConn, id: i32) -> Option<Json<Account>> {
    accounts::table
        .find(id)
        .filter(accounts::user_id.eq(*uid)) // return a 404 on other accounts
        .first(&*connection)
        .map(Json)
        .ok()
}

#[delete("/accounts/<id>")]
pub fn delete(uid: UserId, connection: DbConn, id: i32) -> Result<(), Status> {
    let row_count = diesel::delete(
        accounts::table
            .filter(accounts::user_id.eq(*uid))
            .filter(accounts::id.eq(id)),
    )
    .execute(&*connection)
    .map_err(|e| log_error_and_500(Box::new(e)))?;

    if row_count == 0 {
        Err(Status::NotFound)
    } else {
        info!("Deleted record {} from the account table", id);
        Ok(())
    }
}

#[put("/accounts/<id>", data = "<account>")]
pub fn update(
    uid: UserId,
    connection: DbConn,
    id: i32,
    account: Json<Account>,
) -> Result<(), Status> {
    let mut acc = account.0;
    acc.user_id = *uid;

    let row_count = diesel::update(
        accounts::table
            .filter(accounts::id.eq(id))
            .filter(accounts::user_id.eq(*uid)),
    )
    .set(acc)
    .execute(&*connection)
    .map_err(|e| log_error_and_500(Box::new(e)))?;

    if row_count == 0 {
        Err(Status::NotFound)
    } else {
        info!("updated record {} from the account table", id);
        Ok(())
    }
}

#[post("/accounts", data = "<account>")]
pub fn create(
    uid: UserId,
    connection: DbConn,
    account: Json<NewAccount>,
) -> Result<Json<Account>, Status> {
    let mut acc = account.0;
    acc.user_id = *uid;

    let t: Account = diesel::insert_into(crate::schema::accounts::table)
        .values(&acc)
        .get_result(&*connection)
        .map_err(|e| log_error_and_500(Box::new(e)))?;

    Ok(Json(t))
}
