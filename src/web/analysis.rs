use crate::analysis::performance;
use crate::analysis::performance::PortfolioPerformance;
use crate::analysis::plots;
use crate::analysis::plots::{DataSourceSelection, PortfolioPlot, StockPlot};
use crate::analysis::portfolio;
use crate::analysis::portfolio::Portfolio;
use crate::models::*;
use crate::web::DbConn;
use crate::web::user::UserId;

use chrono::{NaiveDate, NaiveDateTime, Utc};
use rocket::serde::json::Json;

#[get("/analysis/portfolio?<date>")]
pub async fn compute_historic_portfolio(
    uid: UserId,
    connection: DbConn,
    date: String, // DateTime<Utc> not possible
) -> Option<Json<Portfolio<HistoricalPrice>>> {
    connection
        .run(move |c| {
            let date =
                NaiveDateTime::parse_from_str(&format!("{} 17:30:00", date), "%Y-%m-%d %H:%M:%S")
                    .ok()?
                    .and_utc();

            portfolio::compute(c, *uid, None, date).ok().map(Json)
        })
        .await
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
) -> Option<Json<Vec<PortfolioPerformance>>> {
    connection
        .run(move |c| {
            let now = Utc::now();
            performance::compute(c, *uid, now).ok().map(Json)
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
