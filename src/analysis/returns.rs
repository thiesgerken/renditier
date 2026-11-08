use crate::analysis::price::{
    self, MARKET_CLOSE, Price, PriceMap, last_trading_day_until, market_time, to_market_time,
    trading_day_before,
};
use crate::models::{HistoricalPrice, RealtimePrice};
use crate::schema::stock_infos;

use chrono::{DateTime, Months, NaiveDate, Utc};
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::error::Error;

/// How a stock's price changed up to its current price, as a fraction (0.05 = +5 %). `None`
/// where a price is missing on either end.
#[derive(Serialize, Deserialize, Debug, PartialEq)]
pub struct StockReturns {
    /// since the previous trading day's close
    pub today: Option<f64>,
    /// since the close one month before the current trading day
    pub month: Option<f64>,
    /// since the close one year before the current trading day
    pub year: Option<f64>,
}

/// The trading days whose closes the returns start from: the one before the newest price's,
/// and the ones a month and a year before it.
fn reference_days(newest_price: DateTime<Utc>) -> [NaiveDate; 3] {
    let current = last_trading_day_until(to_market_time(newest_price).date());
    let back =
        |months| last_trading_day_until(current.checked_sub_months(Months::new(months)).unwrap());

    [trading_day_before(newest_price), back(1), back(12)]
}

/// The returns of every stock, keyed by ISIN. Prices are looked up like the dashboard's
/// performance: realtime for now, closes at 18:00 exchange time for the past, each from the
/// preferred exchange that has one.
pub fn compute(
    connection: &mut diesel::PgConnection,
    now: DateTime<Utc>,
) -> Result<HashMap<String, StockReturns>, Box<dyn Error>> {
    let isins = stock_infos::table
        .select(stock_infos::isin)
        .load::<String>(connection)?;

    let current: PriceMap<RealtimePrice> = price::find(connection, &isins, now)?;
    let newest = current.values().map(|d| d.price.date).max().unwrap_or(now);
    let closes = reference_days(newest).map(|d| market_time(d.and_time(MARKET_CLOSE)));
    let [previous, month_ago, year_ago]: [PriceMap<HistoricalPrice>; 3] =
        HistoricalPrice::find_multiple(connection, &isins, &closes)?
            .try_into()
            .map_err(|_| "find_multiple returned a map per date")?;

    Ok(isins
        .into_iter()
        .map(|isin| {
            let since = |then: &PriceMap<HistoricalPrice>| {
                let start = then.get(&isin)?.price.value();
                let end = current.get(&isin)?.price.value();
                Some(end / start - 1.0).filter(|r| r.is_finite())
            };
            let returns = StockReturns {
                today: since(&previous),
                month: since(&month_ago),
                year: since(&year_ago),
            };

            (isin, returns)
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn returns_start_from_the_trading_days_a_day_a_month_and_a_year_back() {
        let date = |y, m, d| NaiveDate::from_ymd_opt(y, m, d).unwrap();

        // Monday 2026-03-30, 10:00 at the exchange: Friday before, then Saturday 2026-02-28
        // and Sunday 2025-03-30 fall back to their Fridays
        assert_eq!(
            reference_days("2026-03-30T08:00:00Z".parse().unwrap()),
            [date(2026, 3, 27), date(2026, 2, 27), date(2025, 3, 28)]
        );

        // Tuesday 2026-03-31: a month back is clamped to 2026-02-28, a Saturday
        assert_eq!(
            reference_days("2026-03-31T08:00:00Z".parse().unwrap()),
            [date(2026, 3, 30), date(2026, 2, 27), date(2025, 3, 31)]
        );
    }
}
