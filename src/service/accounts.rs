use crate::models::*;
use crate::schema::*;
use crate::service::DomainError;

use diesel::prelude::*;
use log::info;

pub fn list(
    c: &mut PgConnection,
    user_id: i32,
    offset: Option<i64>,
    count: Option<i64>,
) -> Result<Vec<Account>, DomainError> {
    Ok(accounts::table
        .filter(accounts::user_id.eq(user_id))
        .order(accounts::id.asc())
        .limit(count.unwrap_or(i64::MAX))
        .offset(offset.unwrap_or(0))
        .load(c)?)
}

pub fn get(c: &mut PgConnection, user_id: i32, id: i32) -> Result<Account, DomainError> {
    Ok(accounts::table
        .find(id)
        .filter(accounts::user_id.eq(user_id))
        .first(c)?)
}

pub fn create(
    c: &mut PgConnection,
    user_id: i32,
    account: NewAccount,
) -> Result<Account, DomainError> {
    Ok(diesel::insert_into(accounts::table)
        .values(NewAccount { user_id, ..account })
        .get_result(c)?)
}

pub fn update(
    c: &mut PgConnection,
    user_id: i32,
    id: i32,
    account: Account,
) -> Result<(), DomainError> {
    let row_count = diesel::update(
        accounts::table
            .filter(accounts::id.eq(id))
            .filter(accounts::user_id.eq(user_id)),
    )
    .set(Account { user_id, ..account })
    .execute(c)?;

    if row_count == 0 {
        return Err(DomainError::NotFound);
    }

    info!("updated record {} from the account table", id);
    Ok(())
}

pub fn delete(c: &mut PgConnection, user_id: i32, id: i32) -> Result<(), DomainError> {
    let row_count = diesel::delete(
        accounts::table
            .filter(accounts::user_id.eq(user_id))
            .filter(accounts::id.eq(id)),
    )
    .execute(c)?;

    if row_count == 0 {
        return Err(DomainError::NotFound);
    }

    info!("Deleted record {} from the account table", id);
    Ok(())
}
