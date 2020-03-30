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
pub fn compute_historic_portfolio(
    uid: UserId,
    connection: DbConn,
    date: String, // DateTime<Utc> not possible
) -> Option<Json<Portfolio<HistoricalPrice>>> {
    let date = Utc
        .datetime_from_str(&format!("{} 17:30:00", &date), "%Y-%m-%d %H:%M:%S")
        .ok()?;

    portfolio::compute(&*connection, *uid, date).ok().map(Json)
}

#[get("/analysis/portfolio")]
pub fn compute_realtime_portfolio(
    uid: UserId,
    connection: DbConn,
) -> Option<Json<Portfolio<RealtimePrice>>> {
    let now = Utc::now();
    portfolio::compute(&*connection, *uid, now).ok().map(Json)
}

#[get("/analysis/performance")]
pub fn compute_performance(
    uid: UserId,
    connection: DbConn,
) -> Option<Json<Vec<PortfolioPerformance>>> {
    let now = Utc::now();
    performance::compute(&*connection, *uid, now).ok().map(Json)
}

#[get("/analysis/plots/portfolio?<start>&<end>&<source>")]
pub fn compute_portfolio_plot(
    uid: UserId,
    connection: DbConn,
    start: String,
    end: String,
    source: Option<String>,
) -> Option<Json<PortfolioPlot>> {
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

    plots::compute_portfolio_plot(&*connection, *uid, start, end, source?)
        .ok()
        .map(Json)
}

#[get("/analysis/plots/<isin>?<start>&<end>&<source>")]
pub fn compute_stock_plot(
    uid: UserId,
    connection: DbConn,
    isin: String,
    start: String,
    end: String,
    source: Option<String>,
) -> Option<Json<StockPlot>> {
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

    plots::compute_stock_plot(&*connection, *uid, isin, start, end, source?)
        .ok()
        .map(Json)
}
