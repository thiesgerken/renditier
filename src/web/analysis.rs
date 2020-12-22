use crate::analysis::performance;
use crate::analysis::performance::PortfolioPerformance;
use crate::analysis::plots;
use crate::analysis::plots::{DataSourceSelection, PortfolioPlot, StockPlot};
use crate::analysis::portfolio;
use crate::analysis::portfolio::Portfolio;
use crate::models::*;
use crate::web::user::UserId;
use crate::web::DbConn;

use chrono::offset::TimeZone;
use chrono::{NaiveDate, Utc};
use rocket_contrib::json::Json;

#[get("/analysis/portfolio?<date>")]
pub async fn compute_historic_portfolio(
    uid: UserId,
    connection: DbConn,
    date: String, // DateTime<Utc> not possible
) -> Option<Json<Portfolio<HistoricalPrice>>> {
    connection
        .run(move |c| {
            let date = Utc
                .datetime_from_str(&format!("{} 17:30:00", &date), "%Y-%m-%d %H:%M:%S")
                .ok()?;

            portfolio::compute(c, *uid, date).ok().map(Json)
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
            portfolio::compute(c, *uid, now).ok().map(Json)
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
