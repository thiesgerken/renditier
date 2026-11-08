use crate::models::*;
use crate::receipts::{self, ParsedReceiptTransaction};
use crate::schema::*;
use crate::service::DomainError;

use diesel::prelude::*;
use log::info;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct ReceiptImport<T> {
    /// What was booked, or for a preview what would be.
    pub transactions: Vec<T>,
    /// Already booked under the same receipt number, and therefore skipped.
    pub duplicates: Vec<NewTransaction>,
}

/// Parses the receipts and tells what `import` would do with them, without booking anything.
pub fn preview(
    c: &mut PgConnection,
    user_id: i32,
    files: &[(String, Vec<u8>)],
) -> Result<ReceiptImport<NewTransaction>, DomainError> {
    let parsed =
        receipts::parse_mem_preview(files).map_err(|e| DomainError::Invalid(e.to_string()))?;

    plan(c, user_id, parsed)
}

/// Books the transactions on the receipts, skipping those that are booked already.
pub fn import(
    c: &mut PgConnection,
    user_id: i32,
    files: &[(String, Vec<u8>)],
) -> Result<ReceiptImport<Transaction>, DomainError> {
    let plan = preview(c, user_id, files)?;

    book(c, plan)
}

fn plan(
    c: &mut PgConnection,
    user_id: i32,
    parsed: Vec<ParsedReceiptTransaction>,
) -> Result<ReceiptImport<NewTransaction>, DomainError> {
    let accounts = accounts::table
        .filter(accounts::user_id.eq(user_id))
        .load::<Account>(c)?;
    let exchanges = stock_exchanges::table
        .filter(stock_exchanges::isin.eq_any(parsed.iter().map(|t| &t.content.isin)))
        .load::<StockExchange>(c)?;

    let ts = parsed
        .into_iter()
        .map(|t| {
            let account = accounts
                .iter()
                .find(|a| {
                    a.iban
                        .as_ref()
                        .is_some_and(|iban| iban.contains(&t.account_number))
                })
                .ok_or_else(|| {
                    DomainError::Invalid(format!(
                        "no account matches the account number {}",
                        t.account_number
                    ))
                })?;

            Ok(NewTransaction {
                account_id: account.id,
                ..receipts::replace_exchange(&exchanges, t).content
            })
        })
        .collect::<Result<Vec<_>, DomainError>>()?;

    let booked = transactions::table
        .filter(transactions::account_id.eq_any(accounts.iter().map(|a| a.id)))
        .filter(transactions::receipt_number.eq_any(ts.iter().filter_map(|t| t.receipt_number)))
        .select(transactions::receipt_number)
        .load::<Option<i64>>(c)?;
    let (duplicates, transactions) = ts
        .into_iter()
        .partition(|t| booked.contains(&t.receipt_number));

    Ok(ReceiptImport {
        transactions,
        duplicates,
    })
}

fn book(
    c: &mut PgConnection,
    plan: ReceiptImport<NewTransaction>,
) -> Result<ReceiptImport<Transaction>, DomainError> {
    let transactions = diesel::insert_into(transactions::table)
        .values(&plan.transactions)
        .get_results::<Transaction>(c)?;
    info!(
        "Inserted {} transactions into the database, skipped {} duplicates",
        transactions.len(),
        plan.duplicates.len()
    );

    Ok(ReceiptImport {
        transactions,
        duplicates: plan.duplicates,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn parsed(receipt_number: i64) -> ParsedReceiptTransaction {
        ParsedReceiptTransaction {
            content: NewTransaction {
                account_id: -1,
                isin: "DE0007164600".into(),
                date: Utc::now(),
                units: 10.0,
                amount: -100000,
                fees: -990,
                onvista_exchange_id: None,
                comments: String::new(),
                exchange: None,
                receipt_number: Some(receipt_number),
            },
            account_number: "1234567".into(),
            over_the_counter: true,
        }
    }

    /// Needs a scratch Postgres database (its contents are rolled back):
    /// `RENDITIER_TEST_DATABASE=postgres://... cargo test -- --ignored`
    #[test]
    #[ignore = "needs a database in RENDITIER_TEST_DATABASE"]
    fn booked_receipts_are_reported_as_duplicates() {
        let mut connection = crate::test_connection();
        connection.test_transaction::<_, diesel::result::Error, _>(|c| {
            let user: User = diesel::insert_into(users::table)
                .values(NewUser {
                    name: "rudolph".into(),
                    full_name: "Rudolph".into(),
                    hash: String::new(),
                })
                .get_result(c)?;
            let account: Account = diesel::insert_into(accounts::table)
                .values(NewAccount {
                    user_id: user.id,
                    name: "Depot".into(),
                    iban: Some("DE00 1234567".into()),
                })
                .get_result(c)?;

            let first = plan(c, user.id, vec![parsed(1)]).unwrap();
            let first = book(c, first).unwrap();
            assert_eq!(first.transactions.len(), 1);
            assert_eq!(first.transactions[0].account_id, account.id);

            let preview = plan(c, user.id, vec![parsed(1), parsed(2)]).unwrap();
            let numbers =
                |ts: &[NewTransaction]| ts.iter().map(|t| t.receipt_number).collect::<Vec<_>>();
            assert_eq!(numbers(&preview.transactions), [Some(2)]);
            assert_eq!(numbers(&preview.duplicates), [Some(1)]);

            assert_eq!(
                plan(c, -1, vec![parsed(3)]).map(|_| ()),
                Err(DomainError::Invalid(
                    "no account matches the account number 1234567".into()
                ))
            );
            Ok(())
        });
    }
}
