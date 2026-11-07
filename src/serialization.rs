use crate::models::*;
use crate::schema::*;

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use itertools::Itertools;
use log::{info, warn};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::error::Error;

#[derive(Serialize, Deserialize, Debug)]
pub struct NativeFormat {
    users: Vec<User>,
    accounts: Vec<Account>,
    transactions: Vec<Transaction>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct DataFormat {
    realtime_prices: Vec<RealtimePrice>,
    historical_prices: Vec<HistoricalPrice>,
}

impl DataFormat {
    pub fn new(connection: &mut PgConnection) -> Self {
        let realtime_prices = realtime_prices::table
            .load::<RealtimePrice>(connection)
            .expect("Error loading realtime prices");
        let historical_prices = historical_prices::table
            .load::<HistoricalPrice>(connection)
            .expect("Error loading historical prices");

        DataFormat {
            historical_prices,
            realtime_prices,
        }
    }

    pub fn write_to(self, connection: &mut PgConnection) {
        let known_exchanges = stock_exchanges::table
            .load::<StockExchange>(connection)
            .expect("Error loading stock exchanges")
            .into_iter()
            .map(|e| e.onvista_record_id)
            .collect::<Vec<_>>();

        for chunk in &self
            .historical_prices
            .into_iter()
            .filter(|p| known_exchanges.contains(&p.onvista_record_id))
            .chunks(5000)
        {
            let chunk = chunk.collect::<Vec<_>>();

            let historical_prices_count = diesel::insert_into(historical_prices::table)
                .values(&chunk)
                .on_conflict_do_nothing()
                .execute(connection)
                .expect("Error writing historical prices into the database");
            info!(
                "imported {} of {} historical prices into the database",
                historical_prices_count,
                chunk.len()
            );
        }

        for chunk in &self
            .realtime_prices
            .into_iter()
            .filter(|p| known_exchanges.contains(&p.onvista_record_id))
            .chunks(5000)
        {
            let chunk = chunk.collect::<Vec<_>>();

            let realtime_prices_count = diesel::insert_into(realtime_prices::table)
                .values(&chunk)
                .on_conflict_do_nothing()
                .execute(connection)
                .expect("Error writing realtime prices into the database");
            info!(
                "imported {} of {} realtime prices into the database",
                realtime_prices_count,
                chunk.len()
            );
        }
    }
}

impl NativeFormat {
    pub fn new(connection: &mut PgConnection) -> Self {
        let us = users::table
            .load::<User>(connection)
            .expect("Error loading users");
        let acs = accounts::table
            .load::<Account>(connection)
            .expect("Error loading accounts");
        let ts = transactions::table
            .load::<Transaction>(connection)
            .expect("Error loading transactions");

        NativeFormat {
            users: us,
            accounts: acs,
            transactions: ts,
        }
    }

    /// Restores the users in this backup with their accounts and transactions. Users are matched
    /// by name: an existing user with the same name is deleted first (cascading to their accounts
    /// and transactions), every other user stays untouched.
    ///
    /// All rows get fresh ids from the database sequences. The backup's ids only link its rows
    /// among each other, so they can never collide with the rows of users that stay, and no
    /// sequence needs fixing afterwards. All or nothing: any error rolls the whole import back.
    pub fn write_to(
        &self,
        connection: &mut PgConnection,
    ) -> Result<(), Box<dyn Error + Send + Sync>> {
        self.check_references()?;

        connection.transaction(|connection| {
            let mut account_ids = HashMap::new();
            for user in &self.users {
                let replaced = diesel::delete(users::table.filter(users::name.eq(&user.name)))
                    .execute(connection)?
                    > 0;
                let user_id = diesel::insert_into(users::table)
                    .values((
                        users::name.eq(&user.name),
                        users::full_name.eq(&user.full_name),
                        users::hash.eq(&user.hash),
                        users::api_token_hash.eq(&user.api_token_hash),
                    ))
                    .returning(users::id)
                    .get_result::<i32>(connection)?;

                for account in self.accounts.iter().filter(|a| a.user_id == user.id) {
                    let account_id = diesel::insert_into(accounts::table)
                        .values(NewAccount {
                            user_id,
                            name: account.name.clone(),
                            iban: account.iban.clone(),
                        })
                        .returning(accounts::id)
                        .get_result::<i32>(connection)?;
                    account_ids.insert(account.id, account_id);
                }

                info!(
                    "{} user {}",
                    if replaced { "replaced" } else { "created" },
                    user.name
                );
            }

            let transactions = self
                .transactions
                .iter()
                .map(|t| NewTransaction {
                    account_id: account_ids[&t.account_id],
                    isin: t.isin.clone(),
                    date: t.date,
                    units: t.units,
                    amount: t.amount,
                    fees: t.fees,
                    onvista_exchange_id: t.onvista_exchange_id,
                    comments: t.comments.clone(),
                    exchange: t.exchange.clone(),
                    receipt_number: t.receipt_number,
                })
                .collect::<Vec<_>>();
            let transaction_count = diesel::insert_into(transactions::table)
                .values(&transactions)
                .execute(connection)?;
            info!(
                "imported {} accounts and {} transactions",
                account_ids.len(),
                transaction_count
            );

            Ok(())
        })
    }

    /// Rejects a backup whose ids do not link its rows unambiguously, before anything is written.
    fn check_references(&self) -> Result<(), String> {
        let mut user_names = HashSet::new();
        let mut user_ids = HashSet::new();
        for user in &self.users {
            if !user_names.insert(&user.name) {
                return Err(format!("user name '{}' appears twice", user.name));
            }
            if !user_ids.insert(user.id) {
                return Err(format!("user id {} appears twice", user.id));
            }
        }

        let mut account_ids = HashSet::new();
        for account in &self.accounts {
            if !user_ids.contains(&account.user_id) {
                return Err(format!(
                    "account {} belongs to user id {}, which is not in the backup",
                    account.id, account.user_id
                ));
            }
            if !account_ids.insert(account.id) {
                return Err(format!("account id {} appears twice", account.id));
            }
        }

        for transaction in &self.transactions {
            if !account_ids.contains(&transaction.account_id) {
                return Err(format!(
                    "transaction {} belongs to account id {}, which is not in the backup",
                    transaction.id, transaction.account_id
                ));
            }
        }

        Ok(())
    }
}

#[derive(Deserialize, Debug)]
pub struct MoneyDBFormat {
    users: Vec<MoneyDBUser>,
    #[serde(rename = "securitiesAccounts")]
    accounts: Vec<MoneyDBSecurityAccount>,
    stocks: Vec<MoneyDBStock>,
    #[serde(rename = "stockTransactions")]
    transactions: Vec<MoneyDBTransaction>,
}

impl MoneyDBFormat {
    pub fn write_to(&self, connection: &mut PgConnection) {
        let users = diesel::insert_into(users::table)
            .values(self.users.iter().map(|u| u.convert()).collect::<Vec<_>>())
            .load::<User>(connection)
            .expect("Error writing users into the database");
        let user_map = users
            .iter()
            .zip(&self.users)
            .map(|(n, o)| (o.id, n.id))
            .collect::<HashMap<_, _>>();
        info!("imported {} users into the database", users.len());

        let accounts = diesel::insert_into(accounts::table)
            .values(
                self.accounts
                    .iter()
                    .map(|a| a.convert(&user_map))
                    .collect::<Vec<_>>(),
            )
            .load::<Account>(connection)
            .expect("Error writing accounts into the database");
        let account_map = accounts
            .iter()
            .zip(&self.accounts)
            .map(|(n, o)| (o.id, n.id))
            .collect::<HashMap<_, _>>();
        info!("imported {} accounts into the database", accounts.len());

        let stock_map = self
            .stocks
            .iter()
            .map(|s| (s.id, s.isin.to_string()))
            .collect::<HashMap<_, _>>();

        let exchanges = stock_exchanges::table
            .load::<StockExchange>(connection)
            .expect("Error loading stock exchanges from the database");

        let transaction_count = diesel::insert_into(transactions::table)
            .values(
                self.transactions
                    .iter()
                    .map(|t| t.convert(&account_map, &stock_map, &exchanges))
                    .collect::<Vec<_>>(),
            )
            .execute(connection)
            .expect("Error writing transactions into the database");
        info!(
            "imported {} transactions into the database",
            transaction_count
        );

        warn!("Note that the passwords of all users have been reset!")
    }
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct MoneyDBUser {
    full_name: String,
    name: String,
    id: i32,
}

impl MoneyDBUser {
    fn convert(&self) -> NewUser {
        NewUser {
            name: self.name.to_string(),
            full_name: self.full_name.to_string(),
            hash: String::new(),
        }
    }
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct MoneyDBSecurityAccount {
    id: i32,
    user_id: i32,
    iban: String,
    title: String,
    broker: String,
}

impl MoneyDBSecurityAccount {
    fn convert(&self, user_map: &HashMap<i32, i32>) -> NewAccount {
        NewAccount {
            user_id: *user_map.get(&self.user_id).unwrap(),
            name: format!("{} ({})", self.title, self.broker),
            iban: Some(self.iban.to_string()),
        }
    }
}

#[derive(Deserialize, Debug)]
struct MoneyDBStock {
    id: i32,
    isin: String,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct MoneyDBTransaction {
    account_id: i32,
    stock_id: i32,
    amount: f64,
    fees: f64,
    exchange: String,
    date: DateTime<Utc>,
    units: f64,
}

impl MoneyDBTransaction {
    fn convert(
        &self,
        account_map: &HashMap<i32, i32>,
        stock_map: &HashMap<i32, String>,
        exchanges: &[StockExchange],
    ) -> NewTransaction {
        let isin = stock_map.get(&self.stock_id).unwrap().to_string();

        let mut t = NewTransaction {
            account_id: *account_map.get(&self.account_id).unwrap(),
            isin: isin.clone(),
            amount: (self.amount * -100.0).round() as i64,
            fees: (self.fees * -100.0).round() as i64,
            date: self.date,
            units: self.units,
            onvista_exchange_id: None,
            exchange: None,
            receipt_number: None,
            comments: String::new(),
        };

        let ex = exchanges
            .iter()
            .find(|e| e.isin == isin && e.name == self.exchange);
        if let Some(ex) = ex {
            t.onvista_exchange_id = ex.onvista_exchange_id;
        } else if !self.exchange.is_empty() {
            warn!(
                "Unknown exchange '{}' for transaction {:?}, assuming OTC",
                self.exchange, self
            );
            t.exchange = Some(self.exchange.clone());
        }

        t
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{Value, json};

    fn backup(users: Value, accounts: Value, transactions: Value) -> NativeFormat {
        serde_json::from_value(json!({
            "users": users,
            "accounts": accounts,
            "transactions": transactions,
        }))
        .unwrap()
    }

    fn user(id: i32, name: &str) -> Value {
        json!({ "id": id, "name": name, "fullName": name, "hash": "" })
    }

    fn account(id: i32, user_id: i32) -> Value {
        json!({ "id": id, "userId": user_id, "name": format!("Account {id}"), "iban": null })
    }

    fn transaction(id: i32, account_id: i32) -> Value {
        json!({
            "id": id, "accountId": account_id, "isin": "DE0007164600",
            "date": "2021-03-01T09:00:00Z", "units": 10.0, "amount": -100000, "fees": -990,
            "onvistaExchangeId": null, "comments": "", "exchange": null, "receiptNumber": null,
        })
    }

    #[test]
    fn accepts_a_consistent_backup() {
        let b = backup(
            json!([user(1, "a"), user(2, "b")]),
            json!([account(10, 1), account(11, 2)]),
            json!([transaction(100, 10), transaction(101, 11)]),
        );
        assert_eq!(b.check_references(), Ok(()));
    }

    #[test]
    fn rejects_ambiguous_or_dangling_ids() {
        let cases = [
            backup(json!([user(1, "a"), user(2, "a")]), json!([]), json!([])),
            backup(json!([user(1, "a"), user(1, "b")]), json!([]), json!([])),
            backup(json!([user(1, "a")]), json!([account(10, 2)]), json!([])),
            backup(
                json!([user(1, "a")]),
                json!([account(10, 1), account(10, 1)]),
                json!([]),
            ),
            backup(
                json!([user(1, "a")]),
                json!([account(10, 1)]),
                json!([transaction(100, 11)]),
            ),
        ];
        for b in cases {
            assert!(b.check_references().is_err(), "{b:?}");
        }
    }

    /// Needs a scratch Postgres database (its contents are rolled back):
    /// `RENDITIER_TEST_DATABASE=postgres://... cargo test -- --ignored`
    #[test]
    #[ignore = "needs a database in RENDITIER_TEST_DATABASE"]
    fn import_replaces_only_the_users_in_the_backup() {
        let url =
            std::env::var("RENDITIER_TEST_DATABASE").expect("RENDITIER_TEST_DATABASE not set");
        let mut connection = crate::connect(&url).unwrap();
        connection.test_transaction::<_, diesel::result::Error, _>(|c| {
            let count = |c: &mut PgConnection, name: &str| {
                transactions::table
                    .inner_join(accounts::table.inner_join(users::table))
                    .filter(users::name.eq(name))
                    .count()
                    .get_result::<i64>(c)
                    .unwrap()
            };

            backup(
                json!([user(1, "other"), user(2, "rudolph")]),
                json!([account(1, 1), account(2, 2)]),
                json!([transaction(1, 1), transaction(2, 1), transaction(3, 2)]),
            )
            .write_to(c)
            .unwrap();
            let other_before = users::table
                .filter(users::name.eq("other"))
                .first::<User>(c)?;
            assert_eq!((count(c, "other"), count(c, "rudolph")), (2, 1));

            // The backup's ids deliberately reuse ids the database already holds.
            backup(
                json!([user(1, "rudolph")]),
                json!([account(1, 1), account(2, 1)]),
                json!([transaction(1, 1), transaction(2, 2), transaction(3, 2)]),
            )
            .write_to(c)
            .unwrap();

            let other_after = users::table
                .filter(users::name.eq("other"))
                .first::<User>(c)?;
            assert_eq!(other_after.id, other_before.id);
            assert_eq!((count(c, "other"), count(c, "rudolph")), (2, 3));
            let rudolph_accounts = accounts::table
                .inner_join(users::table)
                .filter(users::name.eq("rudolph"))
                .count()
                .get_result::<i64>(c)?;
            assert_eq!(rudolph_accounts, 2);
            Ok(())
        });
    }
}
