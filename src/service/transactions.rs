use crate::models::*;
use crate::schema::*;
use crate::service::{DomainError, accounts as account_service};

use chrono::{DateTime, Utc};
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

/// Narrows `list`; every field left `None` matches all transactions.
#[derive(Debug, Default)]
pub struct TransactionFilter {
    pub account_id: Option<i32>,
    pub isin: Option<String>,
    /// Inclusive.
    pub from: Option<DateTime<Utc>>,
    /// Exclusive.
    pub until: Option<DateTime<Utc>>,
}

pub fn list(
    c: &mut PgConnection,
    user_id: i32,
    filter: TransactionFilter,
    offset: Option<i64>,
    count: Option<i64>,
) -> Result<Vec<Transaction>, DomainError> {
    let mut query = transactions::table
        .filter(transactions::account_id.eq_any(owned_account_ids(user_id)))
        .into_boxed();

    if let Some(account_id) = filter.account_id {
        query = query.filter(transactions::account_id.eq(account_id));
    }
    if let Some(isin) = filter.isin {
        query = query.filter(transactions::isin.eq(isin.to_uppercase()));
    }
    if let Some(from) = filter.from {
        query = query.filter(transactions::date.ge(from));
    }
    if let Some(until) = filter.until {
        query = query.filter(transactions::date.lt(until));
    }

    Ok(query
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
                account_id: mine.account_id,
                comments: "hijacked".into(),
                ..theirs.clone()
            };
            assert_eq!(
                update(c, mallory, theirs.id, hijack),
                Err(DomainError::NotFound)
            );
            let stored = transactions::table
                .find(theirs.id)
                .first::<Transaction>(c)?;
            assert_eq!(
                (stored.account_id, stored.comments),
                (theirs.account_id, String::new())
            );

            // Moved into alice's account, which is not mallory's to book into.
            let gift = Transaction {
                account_id: theirs.account_id,
                ..mine.clone()
            };
            assert!(matches!(
                update(c, mallory, mine.id, gift),
                Err(DomainError::Invalid(_))
            ));

            let edit = Transaction {
                comments: "edited".into(),
                ..mine.clone()
            };
            assert_eq!(update(c, mallory, mine.id, edit), Ok(()));
            let stored = transactions::table.find(mine.id).first::<Transaction>(c)?;
            assert_eq!(stored.comments, "edited");
            Ok(())
        });
    }
}
