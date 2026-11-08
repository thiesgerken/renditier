use crate::models::*;
use crate::schema::*;
use crate::web::DbConn;
use crate::web::user::UserId;
use crate::web::util::log_error_and_500;

use diesel::prelude::*;
use log::info;
use rocket::http::Status;
use rocket::serde::json::Json;
use rocket_sync_db_pools::diesel;

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
                .limit(count.unwrap_or(i64::MAX))
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
        .run(move |c| update_owned(c, *uid, id, transaction.0))
        .await
}

/// Both the stored row and the account it moves to must belong to `uid`. A row of someone else
/// answers 404 like a missing one, so ids of other users' transactions cannot be probed.
fn update_owned(
    c: &mut PgConnection,
    uid: i32,
    id: i32,
    transaction: Transaction,
) -> Result<(), Status> {
    let accs = accounts::table
        .filter(accounts::user_id.eq(uid))
        .select(accounts::id)
        .load::<i32>(c)
        .map_err(|e| log_error_and_500(Box::new(e)))?;

    if !accs.contains(&transaction.account_id) {
        return Err(Status::Unauthorized);
    }

    let row_count = diesel::update(
        transactions::table
            .filter(transactions::account_id.eq_any(accs))
            .filter(transactions::id.eq(id)),
    )
    .set(transaction)
    .execute(c)
    .map_err(|e| log_error_and_500(Box::new(e)))?;

    if row_count == 0 {
        Err(Status::NotFound)
    } else {
        info!("updated record {} from the transaction table", id);
        Ok(())
    }
}

#[post("/transactions", data = "<transaction>")]
pub async fn create(
    uid: UserId,
    connection: DbConn,
    transaction: Json<NewTransaction>,
) -> Result<Json<Transaction>, Status> {
    connection
        .run(move |c| {
            let mut accs = accounts::table
                .filter(accounts::user_id.eq(*uid))
                .load::<Account>(c)
                .map_err(|e| log_error_and_500(Box::new(e)))?
                .into_iter()
                .map(|a| a.id);

            if !accs.any(|i| i == transaction.account_id) {
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

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn insert_user_with_transaction(c: &mut PgConnection, name: &str) -> Transaction {
        let user: User = diesel::insert_into(users::table)
            .values(NewUser {
                name: name.into(),
                full_name: name.into(),
                hash: String::new(),
            })
            .get_result(c)
            .unwrap();
        let account: Account = diesel::insert_into(accounts::table)
            .values(NewAccount {
                user_id: user.id,
                name: format!("{name}'s account"),
                iban: None,
            })
            .get_result(c)
            .unwrap();
        diesel::insert_into(transactions::table)
            .values(NewTransaction {
                account_id: account.id,
                isin: "DE0007164600".into(),
                date: Utc::now(),
                units: 10.0,
                amount: -100000,
                fees: -990,
                onvista_exchange_id: None,
                comments: String::new(),
                exchange: None,
                receipt_number: None,
            })
            .get_result(c)
            .unwrap()
    }

    /// Needs a scratch Postgres database (its contents are rolled back):
    /// `RENDITIER_TEST_DATABASE=postgres://... cargo test -- --ignored`
    #[test]
    #[ignore = "needs a database in RENDITIER_TEST_DATABASE"]
    fn update_rejects_transactions_of_other_users() {
        let mut connection = crate::test_connection();
        connection.test_transaction::<_, diesel::result::Error, _>(|c| {
            let mine = insert_user_with_transaction(c, "mallory");
            let theirs = insert_user_with_transaction(c, "alice");
            let mallory = accounts::table
                .find(mine.account_id)
                .select(accounts::user_id)
                .first::<i32>(c)?;

            // Moved into mallory's own account, so only the stored row's owner can stop it.
            let hijack = Transaction {
                id: theirs.id,
                account_id: mine.account_id,
                comments: "hijacked".into(),
                ..theirs.clone()
            };
            assert_eq!(
                update_owned(c, mallory, theirs.id, hijack),
                Err(Status::NotFound)
            );
            let stored = transactions::table
                .find(theirs.id)
                .first::<Transaction>(c)?;
            assert_eq!(
                (stored.account_id, stored.comments),
                (theirs.account_id, String::new())
            );

            let edit = Transaction {
                comments: "edited".into(),
                ..mine.clone()
            };
            assert_eq!(update_owned(c, mallory, mine.id, edit), Ok(()));
            let stored = transactions::table.find(mine.id).first::<Transaction>(c)?;
            assert_eq!(stored.comments, "edited");
            Ok(())
        });
    }
}
