use crate::analysis::price::{DataSource, Price};
use crate::analysis::{irr, price};
use crate::models::*;
use crate::schema::*;

use chrono::{DateTime, Utc};
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::collections::HashSet;
use std::error::Error;

#[derive(Deserialize, Serialize)]
pub struct Portfolio<T> {
    pub invested: f64,
    pub value: Option<f64>,
    pub irr: Option<f64>,
    pub stocks: Vec<Position<T>>,
}

#[derive(Deserialize, Serialize)]
pub struct Position<T> {
    pub isin: String,
    pub units: f64,
    pub invested: f64,
    pub value: Option<f64>,
    pub irr: Option<f64>,
    pub data_source: Option<DataSource<T>>,
    pub transactions: Vec<Transaction>,
}

pub fn compute<T>(
    connection: &diesel::PgConnection,
    user_id: i32,
    date: DateTime<Utc>,
) -> Result<Portfolio<T>, Box<dyn Error>>
where
    T: Price + Sized,
{
    // read all transactions for the user from db
    let ts = transactions::table
        .inner_join(accounts::table)
        .filter(accounts::user_id.eq(user_id))
        .filter(transactions::date.le(date))
        .order(transactions::date.asc())
        .load::<(Transaction, Account)>(connection)?
        .into_iter()
        .map(|(a, _)| a)
        .collect::<Vec<_>>();

    // collect isins that appear in the transactions
    let mut isins = ts
        .iter()
        .map(|t| &t.isin)
        .cloned()
        .collect::<HashSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();
    isins.sort();
    let isins = isins;

    // find suitable price information
    let mut prices: HashMap<String, DataSource<T>> =
        price::find(connection, &isins, date, 4 * 24, 4 * 24)?;

    let positions = isins
        .into_iter()
        .map(|isin| compute_position(isin.clone(), &ts, prices.remove(&isin)))
        .collect::<Vec<Position<T>>>();

    // calculate total invested money and value
    let invested = positions.iter().fold(0.0, |acc, p| acc + p.invested);
    let value = positions
        .iter()
        .fold(Some(0.0), |acc, p| acc.and_then(|a| p.value.map(|x| a + x)));

    // calculate the total irr
    // (only possible if we can simulate sales for all positions, i.e. value != None)
    let irr = if value.is_some() {
        // is guaranteed to have the same length as positions
        let sales = positions.iter().filter_map(|p| {
            p.data_source
                .as_ref()
                .map(|s| (s.price.date(), p.units * s.price.value()))
        });

        let ts = ts
            .iter()
            .map(|t| (t.date, (t.amount + t.fees) as f64 / 100.0))
            .chain(sales)
            .collect::<Vec<_>>();

        irr::compute(&ts, chrono::Duration::days(365))
    } else {
        None
    };

    Ok(Portfolio {
        invested,
        value,
        stocks: positions,
        irr,
    })
}

fn compute_position<T>(
    isin: String,
    ts: &[Transaction],
    price: Option<DataSource<T>>,
) -> Position<T>
where
    T: Price + Sized,
{
    let relevant_ts = ts
        .iter()
        .filter(|t| t.isin == isin)
        .cloned()
        .collect::<Vec<_>>();
    let (units, invested) = relevant_ts.iter().fold((0.0, 0.0), |(au, ac), t| {
        (au + t.units, ac + (t.amount + t.fees) as f64 / 100.0)
    });

    let value = price.as_ref().map(|x| units * x.price.value());

    let irr = if let Some(x) = price.as_ref() {
        // is guaranteed to have the same length as positions
        let sale = (x.price.date(), units * x.price.value());

        let ts = relevant_ts
            .iter()
            .map(|t| (t.date, (t.amount + t.fees) as f64 / 100.0))
            .chain(std::iter::once(sale))
            .collect::<Vec<_>>();

        irr::compute(&ts, chrono::Duration::days(365))
    } else {
        None
    };

    Position {
        value,
        isin,
        transactions: relevant_ts,
        units,
        invested,
        irr,
        data_source: price,
    }
}
