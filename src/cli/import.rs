use crate::models::*;

use chrono::{DateTime, Utc};
use clap::ArgMatches;
use clap::{App, Arg, SubCommand};
use diesel::prelude::*;
use log::info;
use serde::{Deserialize, Serialize};
use serde_json;
use std::io;

pub fn build() -> App<'static, 'static> {
  SubCommand::with_name("import")
    .about("Importing of data via stdin")
    .arg(
      Arg::with_name("moneydb")
        .long("moneydb")
        .help("import from moneydb json data"),
    )
    .arg(
      Arg::with_name("clean").help("clean database contents before importing (use with caution!)"),
    )
}

#[derive(Serialize, Deserialize, Debug)]
struct MoneyDBFormat {
  users: Vec<MoneyDBUser>,
  #[serde(rename = "securitiesAccounts")]
  accounts: Vec<MoneyDBSecurityAccount>,
  stocks: Vec<MoneyDBStock>,
  #[serde(rename = "stockTransactions")]
  transactions: Vec<MoneyDBTransaction>,
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

pub fn handle(connection: &PgConnection, sub_matches: &&ArgMatches<'_>) {
  if sub_matches.is_present("clean") {
    // TODO: clean database
  }

  if sub_matches.is_present("moneydb") {
    // TODO: import from moneydb data
    // TODO: import exchange as comment? e.g. "Imported from MoneyDB, exchange=..."

    let p: MoneyDBFormat = serde_json::from_reader(io::stdin()).expect("Could not parse input");

    dbg!(p);

  // TODO: log how much stuff has been imported; warn user that all passwords have been reset
  } else {
    // TODO: import from stockdb export data (first: write exporter!)
    // TODO: log how much stuff has been imported
  }
}
