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

/// `account_id` narrows the portfolio to a single account; `None` is the whole user. The user
/// filter stays either way, so an account belonging to somebody else yields an empty portfolio
/// rather than theirs.
pub fn compute<T>(
    connection: &mut diesel::PgConnection,
    user_id: i32,
    account_id: Option<i32>,
    date: DateTime<Utc>,
) -> Result<Portfolio<T>, Box<dyn Error>>
where
    T: Price + Sized,
{
    // read all transactions for the user from db
    let mut query = transactions::table
        .inner_join(accounts::table)
        .filter(accounts::user_id.eq(user_id))
        .filter(transactions::date.le(date))
        .into_boxed();

    if let Some(account_id) = account_id {
        query = query.filter(transactions::account_id.eq(account_id));
    }

    let ts = query
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
        .try_fold(0.0, |acc, p| p.value.map(|x| acc + x));

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

    // A position that has been sold out is worth nothing, price or no price -- and a stock
    // nobody holds any more is precisely the one whose price stops being fetched. Without this
    // a single such position leaves the whole depot's `value` at None, since the total is a
    // try_fold over the parts: one position with a holding of zero cost the whole depot its
    // market value. The tolerance is there because fractional units bought and sold
    // back do not cancel exactly in binary.
    let value = if units.abs() < 1e-9 {
        Some(0.0)
    } else {
        price.as_ref().map(|x| units * x.price.value())
    };

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

#[cfg(test)]
mod tests {
    use super::*;

    use chrono::TimeZone;

    fn transaction(units: f64, amount: i64, day: u32) -> Transaction {
        Transaction {
            id: day as i32,
            account_id: 1,
            isin: "DE0001234567".to_owned(),
            date: Utc.with_ymd_and_hms(2024, 1, day, 12, 0, 0).unwrap(),
            units,
            amount,
            fees: 0,
            onvista_exchange_id: None,
            comments: String::new(),
            exchange: None,
            receipt_number: None,
        }
    }

    /// The case that hid a whole depot's market value: bought and sold again, so nobody fetches
    /// a price for it any more, and the portfolio total is a try_fold over the positions.
    #[test]
    fn a_position_sold_out_is_worth_nothing_rather_than_unknown() {
        let ts = vec![
            transaction(10.0, -100_000, 1),
            transaction(-10.0, 120_000, 2),
        ];

        let position: Position<RealtimePrice> =
            compute_position("DE0001234567".to_owned(), &ts, None);

        assert_eq!(position.units, 0.0);
        assert_eq!(position.value, Some(0.0));
    }

    /// Fractional units bought in several goes and sold in one do not add back to a literal
    /// zero, and a depot must not lose its value over the last bit of floating point.
    #[test]
    fn fractional_units_that_cancel_count_as_sold_out() {
        let ts = vec![
            transaction(0.1, -1_000, 1),
            transaction(0.2, -2_000, 2),
            transaction(-0.3, 3_500, 3),
        ];

        let position: Position<RealtimePrice> =
            compute_position("DE0001234567".to_owned(), &ts, None);

        assert_ne!(position.units, 0.0, "0.1 + 0.2 - 0.3 is not exactly zero");
        assert_eq!(position.value, Some(0.0));
    }

    /// Still held and unpriced stays unknown: that is a number nobody can state, and saying
    /// zero would quietly delete it from the total.
    #[test]
    fn a_held_position_without_a_price_has_no_value() {
        let ts = vec![transaction(10.0, -100_000, 1)];

        let position: Position<RealtimePrice> =
            compute_position("DE0001234567".to_owned(), &ts, None);

        assert_eq!(position.value, None);
    }
}
