use crate::models::*;
use crate::schema::*;

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use itertools::Itertools;
use log::{info, warn};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

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
    pub fn new(connection: &PgConnection) -> Self {
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

    pub fn write_to(self, connection: &PgConnection) {
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
