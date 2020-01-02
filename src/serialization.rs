use crate::models::*;
use crate::schema::*;

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use log::{info, warn};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Debug)]
pub struct NativeFormat {
    users: Vec<User>,
    accounts: Vec<Account>,
    transactions: Vec<Transaction>,
}

impl NativeFormat {
    pub fn new(connection: &PgConnection) -> Self {
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

    pub fn write_to(&self, connection: &PgConnection) {
        let user_count = diesel::insert_into(users::table)
            .values(&self.users)
            .on_conflict_do_nothing()
            .execute(connection)
            .expect("Error writing users into the database");
        info!(
            "imported {} of {} users into the database",
            user_count,
            self.users.len()
        );

        let account_count = diesel::insert_into(accounts::table)
            .values(&self.accounts)
            .on_conflict_do_nothing()
            .execute(connection)
            .expect("Error writing accounts into the database");
        info!(
            "imported {} of {} accounts into the database",
            account_count,
            self.accounts.len()
        );

        let transaction_count = diesel::insert_into(transactions::table)
            .values(&self.transactions)
            .on_conflict_do_nothing()
            .execute(connection)
            .expect("Error writing transactions into the database");
        info!(
            "imported {} of {} transactions into the database",
            transaction_count,
            self.transactions.len()
        );
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct MoneyDBFormat {
    users: Vec<MoneyDBUser>,
    #[serde(rename = "securitiesAccounts")]
    accounts: Vec<MoneyDBSecurityAccount>,
    stocks: Vec<MoneyDBStock>,
    #[serde(rename = "stockTransactions")]
    transactions: Vec<MoneyDBTransaction>,
}

impl MoneyDBFormat {
    pub fn write_to(&self, connection: &PgConnection) {
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

        let transaction_count = diesel::insert_into(transactions::table)
            .values(
                self.transactions
                    .iter()
                    .map(|t| t.convert(&account_map, &stock_map))
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

#[derive(Serialize, Deserialize, Debug)]
struct MoneyDBUser {
    #[serde(rename = "fullName")]
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

#[derive(Serialize, Deserialize, Debug)]
struct MoneyDBSecurityAccount {
    id: i32,
    #[serde(rename = "ownerId")]
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

#[derive(Serialize, Deserialize, Debug)]
struct MoneyDBStock {
    id: i32,
    isin: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct MoneyDBTransaction {
    #[serde(rename = "accountId")]
    account_id: i32,
    #[serde(rename = "stockId")]
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
    ) -> NewTransaction {
        NewTransaction {
            account_id: *account_map.get(&self.account_id).unwrap(),
            isin: stock_map.get(&self.stock_id).unwrap().to_string(),
            amount: (self.amount * -100.0).round() as i64,
            fees: (self.fees * -100.0).round() as i64,
            date: self.date,
            units: self.units,
            onvista_exchange_id: None,
            comments: format!("Imported from MoneyDB, exchange='{}'", self.exchange),
        }
    }
}
