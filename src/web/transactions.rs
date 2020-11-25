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

#[get("/transactions?<offset>&<count>")]
pub async fn list(
    uid: UserId,
    connection: DbConn,
    offset: Option<i64>,
    count: Option<i64>,
) -> Option<Json<Vec<Transaction>>> {
    connection
        .run(move |c| {
            transactions::table
                .inner_join(accounts::table)
                .filter(accounts::user_id.eq(*uid))
                .order(transactions::id.asc())
                .limit(count.unwrap_or(i64::max_value()))
                .offset(offset.unwrap_or(0))
                .load::<(Transaction, Account)>(c)
                .map(|a| Json(a.into_iter().map(|(a, _)| a).collect()))
                .ok()
        })
        .await
}

#[get("/transactions/<id>")]
pub async fn get(uid: UserId, connection: DbConn, id: i32) -> Option<Json<Transaction>> {
    connection
        .run(move |c| {
            transactions::table
                .inner_join(accounts::table)
                .filter(accounts::user_id.eq(*uid))
                .filter(transactions::id.eq(id))
                .first::<(Transaction, Account)>(c)
                .map(|(a, _)| Json(a))
                .ok()
        })
        .await
}

#[delete("/transactions/<id>")]
pub async fn delete(uid: UserId, connection: DbConn, id: i32) -> Result<(), Status> {
    connection
        .run(move |c| {
            let accs = accounts::table
                .filter(accounts::user_id.eq(*uid))
                .load::<Account>(c)
                .map_err(|e| log_error_and_500(Box::new(e)))?
                .into_iter()
                .map(|a| a.id)
                .collect::<Vec<_>>();

            let row_count = diesel::delete(
                transactions::table
                    .filter(transactions::account_id.eq_any(accs))
                    .filter(transactions::id.eq(id)),
            )
            .execute(c)
            .map_err(|e| log_error_and_500(Box::new(e)))?;

            if row_count == 0 {
                Err(Status::NotFound)
            } else {
                info!("Deleted record {} from the transaction table", id);
                Ok(())
            }
        })
        .await
}

#[put("/transactions/<id>", data = "<transaction>")]
pub async fn update(
    uid: UserId,
    connection: DbConn,
    id: i32,
    transaction: Json<Transaction>,
) -> Result<(), Status> {
    connection
        .run(move |c| {
            let accs = accounts::table
                .filter(accounts::user_id.eq(*uid))
                .load::<Account>(c)
                .map_err(|e| log_error_and_500(Box::new(e)))?
                .into_iter()
                .map(|a| a.id)
                .collect::<Vec<_>>();

            if !accs.contains(&transaction.account_id) {
                return Err(Status::Unauthorized);
            }

            let row_count = diesel::update(transactions::table.filter(transactions::id.eq(id)))
                .set(transaction.0)
                .execute(c)
                .map_err(|e| log_error_and_500(Box::new(e)))?;

            if row_count == 0 {
                Err(Status::NotFound)
            } else {
                info!("updated record {} from the transaction table", id);
                Ok(())
            }
        })
        .await
}

#[post("/transactions", data = "<transaction>")]
pub async fn create(
    uid: UserId,
    connection: DbConn,
    transaction: Json<NewTransaction>,
) -> Result<Json<Transaction>, Status> {
    connection
        .run(move |c| {
            let accs = accounts::table
                .filter(accounts::user_id.eq(*uid))
                .load::<Account>(c)
                .map_err(|e| log_error_and_500(Box::new(e)))?
                .into_iter()
                .map(|a| a.id)
                .collect::<Vec<_>>();

            if !accs.contains(&transaction.account_id) {
                return Err(Status::Unauthorized);
            }

            let t: Transaction = diesel::insert_into(crate::schema::transactions::table)
                .values(&transaction.0)
                .get_result(c)
                .map_err(|e| log_error_and_500(Box::new(e)))?;

            Ok(Json(t))
        })
        .await
}
