use crate::models::*;
use crate::schema::*;
use crate::web::user::UserId;
use crate::web::DbConn;

use diesel::prelude::*;
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
