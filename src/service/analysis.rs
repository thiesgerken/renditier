use crate::analysis::performance::{self, PortfolioPerformance};
use crate::analysis::plots::{self, DataSourceSelection, PortfolioPlot, StockPlot};
use crate::analysis::portfolio::{self, Portfolio};
use crate::analysis::price::{MARKET_CLOSE, Price, market_time};
use crate::models::*;
use crate::service::{DomainError, accounts};

use chrono::{DateTime, NaiveDate, Utc};
use chrono_tz::Tz;
use diesel::PgConnection;

/// The current portfolio, of the whole user or narrowed to one of their accounts.
pub fn portfolio(
    c: &mut PgConnection,
    user_id: i32,
    account_id: Option<i32>,
    now: DateTime<Utc>,
) -> Result<Portfolio<RealtimePrice>, DomainError> {
    portfolio_at(c, user_id, account_id, now)
}

/// The portfolio as of the market close on `date`, valued at that day's closing prices.
pub fn historic_portfolio(
    c: &mut PgConnection,
    user_id: i32,
    account_id: Option<i32>,
    date: NaiveDate,
) -> Result<Portfolio<HistoricalPrice>, DomainError> {
    portfolio_at(c, user_id, account_id, market_close(date))
}

fn portfolio_at<T: Price>(
    c: &mut PgConnection,
    user_id: i32,
    account_id: Option<i32>,
    date: DateTime<Utc>,
) -> Result<Portfolio<T>, DomainError> {
    if let Some(id) = account_id {
        accounts::get(c, user_id, id)?;
    }

    Ok(portfolio::compute(c, user_id, account_id, date)?)
}

fn market_close(date: NaiveDate) -> DateTime<Utc> {
    market_time(date.and_time(MARKET_CLOSE))
}

pub fn performance(
    c: &mut PgConnection,
    user_id: i32,
    now: DateTime<Utc>,
    timezone: Tz,
) -> Result<Vec<PortfolioPerformance>, DomainError> {
    Ok(performance::compute(c, user_id, now, timezone)?)
}

pub fn portfolio_plot(
    c: &mut PgConnection,
    user_id: i32,
    start: NaiveDate,
    end: NaiveDate,
    source: DataSourceSelection,
) -> Result<PortfolioPlot, DomainError> {
    Ok(plots::compute_portfolio_plot(
        c, user_id, start, end, source,
    )?)
}

pub fn stock_plot(
    c: &mut PgConnection,
    user_id: i32,
    isin: String,
    start: NaiveDate,
    end: NaiveDate,
    source: DataSourceSelection,
) -> Result<StockPlot, DomainError> {
    Ok(plots::compute_stock_plot(
        c, user_id, isin, start, end, source,
    )?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_historic_portfolio_is_taken_at_the_exchange_close() {
        let close = |y, m, d| market_close(NaiveDate::from_ymd_opt(y, m, d).unwrap()).to_rfc3339();

        assert_eq!(close(2026, 7, 6), "2026-07-06T16:00:00+00:00");
        assert_eq!(close(2026, 11, 6), "2026-11-06T17:00:00+00:00");
    }
}
