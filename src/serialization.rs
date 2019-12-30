use crate::models::*;
use crate::schema::*;

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use log::{info, warn};
use serde::{Deserialize, Serialize};

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
    // TODO: import from moneydb data;
    // TODO: log how much stuff has been imported

    // convert MoneyDBUsers to NewUsers, insert, setup mapping old id -> new id
    // convert MoneyDBAccounts to NewAccounts, insert, setup mapping old id -> new id
    // convert MoneyDBTransactions to Transactions (import exchange as comment "Imported from MoneyDB, exchange={}", replace stock id with ISIN), insert

    warn!("Note that the passwords of all users have been reset!")
  }
}

#[derive(Serialize, Deserialize, Debug)]
struct MoneyDBUser {
  #[serde(rename = "fullName")]
  full_name: String,
  name: String,
  id: i64,
}

#[derive(Serialize, Deserialize, Debug)]
struct MoneyDBSecurityAccount {
  id: i64,
  #[serde(rename = "ownerId")]
  user_id: i64,
  iban: String,
  title: String,
  broker: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct MoneyDBStock {
  id: i64,
  isin: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct MoneyDBTransaction {
  #[serde(rename = "accountId")]
  account_id: i64,
  amount: f64,
  fees: f64,
  exchange: String,
  date: DateTime<Utc>,
  units: f64,
}
