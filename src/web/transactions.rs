use crate::models::*;
use crate::schema::*;
use crate::web::user::UserId;
use crate::web::DbConn;

use diesel::prelude::*;
use rocket_contrib::databases::diesel;
use rocket_contrib::json::Json;

#[get("/transactions?<offset>&<count>")]
pub fn list(
    uid: UserId,
    connection: DbConn,
    offset: Option<i64>,
    count: Option<i64>,
) -> Option<Json<Vec<Transaction>>> {
    transactions::table
        .inner_join(accounts::table)
        .filter(accounts::user_id.eq(*uid))
        .order(transactions::id.asc())
        .limit(count.unwrap_or(i64::max_value()))
        .offset(offset.unwrap_or(0))
        .load::<(Transaction, Account)>(&*connection)
        .map(|a| Json(a.into_iter().map(|(a, _)| a).collect()))
        .ok()
}

#[get("/transactions/<id>")]
pub fn get(uid: UserId, connection: DbConn, id: i32) -> Option<Json<Transaction>> {
    transactions::table
        .inner_join(accounts::table)
        .filter(accounts::user_id.eq(*uid))
        .filter(transactions::id.eq(id))
        .first::<(Transaction, Account)>(&*connection)
        .map(|(a, _)| Json(a))
        .ok()
}
