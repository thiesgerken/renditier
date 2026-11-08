use crate::models::*;
use crate::schema::*;
use crate::service::{DomainError, accounts as account_service};

use diesel::pg::Pg;
use diesel::prelude::*;
use diesel::sql_types::Integer;
use log::info;

fn owned_account_ids(user_id: i32) -> accounts::BoxedQuery<'static, Pg, Integer> {
    accounts::table
        .filter(accounts::user_id.eq(user_id))
        .select(accounts::id)
        .into_boxed()
}

/// A transaction may only be booked into an account of the caller.
fn check_target_account(c: &mut PgConnection, user_id: i32, id: i32) -> Result<(), DomainError> {
    match account_service::get(c, user_id, id) {
        Ok(_) => Ok(()),
        Err(DomainError::NotFound) => Err(DomainError::Invalid(format!("account {id} not found"))),
        Err(e) => Err(e),
    }
}

pub fn list(
    c: &mut PgConnection,
    user_id: i32,
    offset: Option<i64>,
    count: Option<i64>,
) -> Result<Vec<Transaction>, DomainError> {
    Ok(transactions::table
        .filter(transactions::account_id.eq_any(owned_account_ids(user_id)))
        .order(transactions::id.asc())
        .limit(count.unwrap_or(i64::MAX))
        .offset(offset.unwrap_or(0))
        .load(c)?)
}

pub fn get(c: &mut PgConnection, user_id: i32, id: i32) -> Result<Transaction, DomainError> {
    Ok(transactions::table
        .find(id)
        .filter(transactions::account_id.eq_any(owned_account_ids(user_id)))
        .first(c)?)
}

pub fn create(
    c: &mut PgConnection,
    user_id: i32,
    transaction: NewTransaction,
) -> Result<Transaction, DomainError> {
    check_target_account(c, user_id, transaction.account_id)?;

    Ok(diesel::insert_into(transactions::table)
        .values(&transaction)
        .get_result(c)?)
}

/// Both the stored transaction and the account it moves to must belong to the caller.
pub fn update(
    c: &mut PgConnection,
    user_id: i32,
    id: i32,
    transaction: Transaction,
) -> Result<(), DomainError> {
    check_target_account(c, user_id, transaction.account_id)?;

    let row_count = diesel::update(
        transactions::table
            .filter(transactions::id.eq(id))
            .filter(transactions::account_id.eq_any(owned_account_ids(user_id))),
    )
    .set(transaction)
    .execute(c)?;

    if row_count == 0 {
        return Err(DomainError::NotFound);
    }

    info!("updated record {} from the transaction table", id);
    Ok(())
}

pub fn delete(c: &mut PgConnection, user_id: i32, id: i32) -> Result<(), DomainError> {
    let row_count = diesel::delete(
        transactions::table
            .filter(transactions::id.eq(id))
            .filter(transactions::account_id.eq_any(owned_account_ids(user_id))),
    )
    .execute(c)?;

    if row_count == 0 {
        return Err(DomainError::NotFound);
    }

    info!("Deleted record {} from the transaction table", id);
    Ok(())
}
