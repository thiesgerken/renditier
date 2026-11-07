use crate::analysis::performance;
use crate::analysis::performance::PortfolioPerformance;
use crate::analysis::plots;
use crate::analysis::plots::{DataSourceSelection, PortfolioPlot, StockPlot};
use crate::analysis::portfolio;
use crate::analysis::portfolio::Portfolio;
use crate::analysis::price::{MARKET_CLOSE, market_time};
use crate::models::*;
use crate::web::user::UserId;
use crate::web::util::log_error_and_500;
use crate::web::{Config, DbConn};

use chrono::{DateTime, NaiveDate, Utc};
use rocket::State;
use rocket::http::Status;
use rocket::serde::json::Json;

/// The portfolio as of the market close on `date`, valued at that day's closing prices.
#[get("/analysis/portfolio?<date>")]
pub async fn compute_historic_portfolio(
    uid: UserId,
    connection: DbConn,
    date: String, // NaiveDate not possible
) -> Result<Json<Portfolio<HistoricalPrice>>, Status> {
    let close = market_close(&date)?;

    connection
        .run(move |c| {
            portfolio::compute(c, *uid, None, close)
                .map(Json)
                .map_err(log_error_and_500)
        })
        .await
}

fn market_close(date: &str) -> Result<DateTime<Utc>, Status> {
    let date = NaiveDate::parse_from_str(date, "%Y-%m-%d").map_err(|_| Status::BadRequest)?;

    Ok(market_time(date.and_time(MARKET_CLOSE)))
}

#[get("/analysis/portfolio")]
pub async fn compute_realtime_portfolio(
    uid: UserId,
    connection: DbConn,
) -> Option<Json<Portfolio<RealtimePrice>>> {
    connection
        .run(move |c| {
            let now = Utc::now();
            portfolio::compute(c, *uid, None, now).ok().map(Json)
        })
        .await
}

/// The same portfolio narrowed to one account. Its own path rather than a filter on the two
/// routes above, because the pair already tells itself apart by whether a query parameter is
/// present at all -- adding one to both makes them equally wild matchers, and rocket then refuses
/// to mount either. Negative ranks would say it too, but the macro takes no negative literal, and
/// positive ones lose the request to the static-file catch-all.
#[get("/accounts/<id>/portfolio")]
pub async fn compute_account_portfolio(
    uid: UserId,
    connection: DbConn,
    id: i32,
) -> Option<Json<Portfolio<RealtimePrice>>> {
    connection
        .run(move |c| {
            let now = Utc::now();
            portfolio::compute(c, *uid, Some(id), now).ok().map(Json)
        })
        .await
}

#[get("/analysis/performance")]
pub async fn compute_performance(
    uid: UserId,
    connection: DbConn,
    config: &State<Config>,
) -> Option<Json<Vec<PortfolioPerformance>>> {
    let timezone = config.timezone;
    connection
        .run(move |c| {
            let now = Utc::now();
            performance::compute(c, *uid, now, timezone).ok().map(Json)
        })
        .await
}

#[get("/analysis/plots/portfolio?<start>&<end>&<source>")]
pub async fn compute_portfolio_plot(
    uid: UserId,
    connection: DbConn,
    start: String,
    end: String,
    source: Option<String>,
) -> Option<Json<PortfolioPlot>> {
    connection
        .run(move |c| {
            let start = NaiveDate::parse_from_str(&start, "%Y-%m-%d").ok()?;
            let end = NaiveDate::parse_from_str(&end, "%Y-%m-%d").ok()?;

            let source = if let Some(s) = source {
                let s = s.to_lowercase();
                if s == "realtime" {
                    Some(DataSourceSelection::Realtime)
                } else if s == "historical" {
                    Some(DataSourceSelection::Historical)
                } else if s == "auto" || s == "automatic" {
                    Some(DataSourceSelection::Automatic)
                } else {
                    None
                }
            } else {
                Some(DataSourceSelection::Automatic)
            };

            plots::compute_portfolio_plot(c, *uid, start, end, source?)
                .ok()
                .map(Json)
        })
        .await
}

#[get("/analysis/plots/<isin>?<start>&<end>&<source>")]
pub async fn compute_stock_plot(
    uid: UserId,
    connection: DbConn,
    isin: String,
    start: String,
    end: String,
    source: Option<String>,
) -> Option<Json<StockPlot>> {
    connection
        .run(move |c| {
            let start = NaiveDate::parse_from_str(&start, "%Y-%m-%d").ok()?;
            let end = NaiveDate::parse_from_str(&end, "%Y-%m-%d").ok()?;

            let source = if let Some(s) = source {
                let s = s.to_lowercase();
                if s == "realtime" {
                    Some(DataSourceSelection::Realtime)
                } else if s == "historical" {
                    Some(DataSourceSelection::Historical)
                } else if s == "auto" || s == "automatic" {
                    Some(DataSourceSelection::Automatic)
                } else {
                    None
                }
            } else {
                Some(DataSourceSelection::Automatic)
            };

            plots::compute_stock_plot(c, *uid, isin, start, end, source?)
                .ok()
                .map(Json)
        })
        .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_historic_portfolio_is_taken_at_the_exchange_close() {
        let close = |date| market_close(date).map(|t| t.to_rfc3339());

        assert_eq!(close("2026-07-06"), Ok("2026-07-06T16:00:00+00:00".into()));
        assert_eq!(close("2026-11-06"), Ok("2026-11-06T17:00:00+00:00".into()));
        assert_eq!(close("06.07.2026"), Err(Status::BadRequest));
    }
}
