use crate::analysis::performance::PortfolioPerformance;
use crate::analysis::plots::{DataSourceSelection, PortfolioPlot, StockPlot};
use crate::analysis::portfolio::Portfolio;
use crate::models::*;
use crate::service::{DomainError, analysis};
use crate::web::user::UserId;
use crate::web::util::parse_date;
use crate::web::{Config, DbConn};

use chrono::Utc;
use rocket::State;
use rocket::serde::json::Json;

/// The portfolio as of the market close on `date`, valued at that day's closing prices.
#[get("/analysis/portfolio?<date>")]
pub async fn compute_historic_portfolio(
    uid: UserId,
    connection: DbConn,
    date: &str,
) -> Result<Json<Portfolio<HistoricalPrice>>, DomainError> {
    let date = parse_date(date)?;

    connection
        .run(move |c| analysis::historic_portfolio(c, *uid, None, date).map(Json))
        .await
}

#[get("/analysis/portfolio")]
pub async fn compute_realtime_portfolio(
    uid: UserId,
    connection: DbConn,
) -> Result<Json<Portfolio<RealtimePrice>>, DomainError> {
    connection
        .run(move |c| analysis::portfolio(c, *uid, None, Utc::now()).map(Json))
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
) -> Result<Json<Portfolio<RealtimePrice>>, DomainError> {
    connection
        .run(move |c| analysis::portfolio(c, *uid, Some(id), Utc::now()).map(Json))
        .await
}

#[get("/analysis/performance")]
pub async fn compute_performance(
    uid: UserId,
    connection: DbConn,
    config: &State<Config>,
) -> Result<Json<Vec<PortfolioPerformance>>, DomainError> {
    let timezone = config.timezone;

    connection
        .run(move |c| analysis::performance(c, *uid, Utc::now(), timezone).map(Json))
        .await
}

fn parse_source(source: Option<&str>) -> Result<DataSourceSelection, DomainError> {
    source.map_or(Ok(DataSourceSelection::Automatic), |s| {
        s.parse().map_err(DomainError::Invalid)
    })
}

#[get("/analysis/plots/portfolio?<start>&<end>&<source>")]
pub async fn compute_portfolio_plot(
    uid: UserId,
    connection: DbConn,
    start: &str,
    end: &str,
    source: Option<&str>,
) -> Result<Json<PortfolioPlot>, DomainError> {
    let (start, end, source) = (parse_date(start)?, parse_date(end)?, parse_source(source)?);

    connection
        .run(move |c| analysis::portfolio_plot(c, *uid, start, end, source).map(Json))
        .await
}

#[get("/analysis/plots/<isin>?<start>&<end>&<source>")]
pub async fn compute_stock_plot(
    uid: UserId,
    connection: DbConn,
    isin: String,
    start: &str,
    end: &str,
    source: Option<&str>,
) -> Result<Json<StockPlot>, DomainError> {
    let (start, end, source) = (parse_date(start)?, parse_date(end)?, parse_source(source)?);

    connection
        .run(move |c| analysis::stock_plot(c, *uid, isin, start, end, source).map(Json))
        .await
}
