use crate::analysis::price::{DataSource, Price, PriceMap};
use crate::analysis::{irr, price};
use crate::models::*;
use crate::schema::*;

use chrono::offset::TimeZone;
use chrono::{DateTime, Datelike, Duration, Local, NaiveDate, Utc, Weekday};
use diesel::prelude::*;
use log::debug;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::collections::HashSet;
use std::error::Error;
use std::iter::successors;

#[derive(Deserialize, Serialize, Clone)]
#[serde(tag = "type")]
pub enum EitherPrice {
    RealtimePrice(RealtimePrice),
    HistoricalPrice(HistoricalPrice),
}

impl EitherPrice {
    pub fn wrap_realtime(d: DataSource<RealtimePrice>) -> DataSource<EitherPrice> {
        DataSource {
            price: EitherPrice::RealtimePrice(d.price),
            exchange: d.exchange,
        }
    }

    pub fn wrap_historical(d: DataSource<HistoricalPrice>) -> DataSource<EitherPrice> {
        DataSource {
            price: EitherPrice::HistoricalPrice(d.price),
            exchange: d.exchange,
        }
    }

    pub fn value(&self) -> f64 {
        match self {
            EitherPrice::RealtimePrice(p) => p.value(),
            EitherPrice::HistoricalPrice(p) => p.value(),
        }
    }
    pub fn date(&self) -> DateTime<Utc> {
        match self {
            EitherPrice::RealtimePrice(p) => p.date(),
            EitherPrice::HistoricalPrice(p) => p.date(),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, PartialEq)]
pub enum PerformanceKind {
    Total,
    Today,
    YearToDate,
    MonthToDate,
    WeekToDate,
    YearToYear,
    MonthToMonth,
}

#[derive(Deserialize, Serialize)]
pub struct PortfolioPerformance {
    pub kind: PerformanceKind,
    pub start: Option<PortfolioSnapshot>,
    pub end: PortfolioSnapshot,
    pub irr: Option<f64>,
    pub positions: HashMap<String, PositionPerformance>,
}

#[derive(Deserialize, Serialize)]
pub struct PositionPerformance {
    pub start: Option<PositionSnapshot>,
    pub end: PositionSnapshot,
    pub irr: Option<f64>,
    pub transactions: Vec<Transaction>,
}

#[derive(Deserialize, Serialize)]
pub struct PortfolioSnapshot {
    pub date: NaiveDate,
    pub invested: f64,
    pub value: Option<f64>,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PositionSnapshot {
    pub date: NaiveDate,
    pub units: f64,
    pub invested: f64,
    pub value: Option<f64>,
    pub data_source: Option<DataSource<EitherPrice>>,
}

pub fn compute(
    connection: &diesel::PgConnection,
    user_id: i32,
    date: DateTime<Utc>,
) -> Result<Vec<PortfolioPerformance>, Box<dyn Error>> {
    // read all transactions for the user from db
    let ts = transactions::table
        .inner_join(accounts::table)
        .filter(accounts::user_id.eq(user_id))
        .filter(transactions::date.le(date))
        .order(transactions::date.asc())
        .load::<(Transaction, Account)>(&*connection)?
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
    let current_prices: PriceMap<RealtimePrice> =
        price::find(connection, &isins, date, 4 * 24, 4 * 24)?;

    // assemble dates for which we need to get HistoricalPrices
    let current_day = current_prices
        .values()
        .map(|d| d.price.date)
        .max()
        .unwrap_or_else(Utc::now)
        .with_timezone(&Local)
        .date()
        .naive_local();
    let prev_day = current_day.pred();

    let first_transaction_date = ts
        .iter()
        .map(|t| t.date)
        .min()
        .unwrap_or_else(Utc::now)
        .with_timezone(&Local)
        .date()
        .naive_local();

    let mut jobs = Vec::new();
    jobs.push((
        PerformanceKind::Total,
        Some(first_transaction_date.pred()),
        None,
    ));

    /*
      EOD prices <-> current_prices:
      * previous trading day
      * end of last week
      * end of last month
      * end of last year
    */

    jobs.push((PerformanceKind::Today, Some(prev_day), None));

    let days_from_friday = (prev_day.weekday().number_from_monday() as i64
        - Weekday::Fri.number_from_monday() as i64
        + 7)
        % 7;
    jobs.push((
        PerformanceKind::WeekToDate,
        prev_day.checked_sub_signed(Duration::days(days_from_friday)),
        None,
    ));

    let first_of_month = NaiveDate::from_ymd(prev_day.year(), prev_day.month(), 1);
    jobs.push((
        PerformanceKind::MonthToDate,
        first_of_month.checked_sub_signed(Duration::days(1)),
        None,
    ));

    let first_of_year = NaiveDate::from_ymd(prev_day.year(), 1, 1);
    jobs.push((
        PerformanceKind::YearToDate,
        first_of_year.checked_sub_signed(Duration::days(1)),
        None,
    ));

    /*
    EOD prices <-> EOD prices for
      * every year since first_transaction_date
      * every of the last 12 months (if after first_transaction_date)
    */

    let yearlies = successors(
        first_of_year
            .checked_sub_signed(Duration::days(1))
            .map(|x| (x, first_of_year)),
        |(last, _)| {
            NaiveDate::from_ymd(last.year(), 1, 1)
                .checked_sub_signed(Duration::days(1))
                .map(|x| (x, *last))
        },
    )
    .skip(1)
    .take_while(|(_, last)| first_transaction_date < *last)
    .map(|(x, y)| (PerformanceKind::YearToYear, Some(x), Some(y)));
    jobs.extend(yearlies);

    let monthlies = successors(
        first_of_month
            .checked_sub_signed(Duration::days(1))
            .map(|x| (x, first_of_month)),
        |(last, _)| {
            NaiveDate::from_ymd(last.year(), last.month(), 1)
                .checked_sub_signed(Duration::days(1))
                .map(|x| (x, *last))
        },
    )
    .skip(1)
    .take_while(|(_, last)| first_transaction_date < *last)
    .take(12)
    .map(|(x, y)| (PerformanceKind::MonthToMonth, Some(x), Some(y)));
    jobs.extend(monthlies);

    // collect all relevant dates
    let dates = jobs
        .iter()
        .map(|(_, x, _)| *x)
        .chain(jobs.iter().map(|(_, _, y)| *y))
        .filter_map(|x| x)
        .collect::<HashSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();

    // find_multiple needs DateTime<Utc> ...
    let utc_date_times = dates
        .iter()
        .map(|d| {
            Local
                .from_utc_date(d)
                .and_hms(17, 30, 0)
                .with_timezone(&Utc)
        })
        .collect::<Vec<_>>();

    // query db for prices on these dates
    debug!(
        "Querying prices for {} isins and {} dates",
        isins.len(),
        dates.len()
    );
    let prices = Price::find_multiple(connection, &isins, &utc_date_times, 4 * 24, 4 * 24)?;
    let prices = dates.into_iter().zip(prices).collect();

    Ok(jobs
        .into_iter()
        .map(|(k, st, en)| compute_performance(&ts, &isins, &current_prices, &prices, k, st, en))
        .collect::<Vec<_>>())
}

fn compute_position(
    isin: String,
    ts: &[Transaction],
    start_price: Option<DataSource<HistoricalPrice>>,
    end_price: Option<DataSource<EitherPrice>>,
    start: Option<NaiveDate>,
    end: Option<NaiveDate>,
) -> PositionPerformance {
    let (prior_ts, relevant_ts): (Vec<_>, Vec<_>) = ts
        .iter()
        .filter(|t| {
            t.isin == isin
                && t.date.with_timezone(&Local).date().naive_local()
                    <= end.unwrap_or_else(|| Local::today().naive_local())
        })
        .cloned()
        .partition(|t| {
            start
                .map(|x| t.date.with_timezone(&Local).date().naive_local() <= x)
                .unwrap_or(false)
        });

    let (prior_units, prior_invested) = prior_ts.iter().fold((0.0, 0.0), |(au, ac), t| {
        (au + t.units, ac + (t.amount + t.fees) as f64 / 100.0)
    });

    let (units, invested) = relevant_ts.iter().fold((0.0, 0.0), |(au, ac), t| {
        (au + t.units, ac + (t.amount + t.fees) as f64 / 100.0)
    });

    let end_snapshot = PositionSnapshot {
        date: end.unwrap_or_else(|| Local::today().naive_local()),
        units: units + prior_units,
        invested: invested + prior_invested,
        value: end_price
            .as_ref()
            .map(|x| (prior_units + units) * x.price.value()),
        data_source: end_price.as_ref().cloned(),
    };

    let start_snapshot = start.map(|start| PositionSnapshot {
        date: start,
        units: prior_units,
        invested: prior_invested,
        value: start_price.as_ref().map(|x| prior_units * x.price.value()),
        data_source: start_price.clone().map(EitherPrice::wrap_historical),
    });

    let irr = if start.is_some() && start_price.is_none() {
        None
    } else if let Some(ep) = end_price {
        let mut ts = Vec::new();

        // simulated sale
        ts.push((ep.price.date(), (units + prior_units) * ep.price.value()));

        if let Some(sp) = start_price {
            // simulated purchase
            ts.push((sp.price.date(), -1.0 * prior_units * sp.price.value()));
        }

        ts.extend(
            relevant_ts
                .iter()
                .map(|t| (t.date, (t.amount + t.fees) as f64 / 100.0)),
        );

        irr::compute(&ts)
    } else {
        None
    };

    PositionPerformance {
        start: start_snapshot,
        end: end_snapshot,
        transactions: relevant_ts,
        irr,
    }
}

fn compute_performance(
    ts: &[Transaction],
    isins: &[String],
    current_prices: &PriceMap<RealtimePrice>,
    prices: &HashMap<NaiveDate, PriceMap<HistoricalPrice>>,
    kind: PerformanceKind,
    start: Option<NaiveDate>,
    end: Option<NaiveDate>,
) -> PortfolioPerformance {
    let empty = HashMap::new();
    let end_historical_prices = end.map(|x| prices.get(&x).unwrap_or_else(|| &empty));
    let start_prices = start.map(|x| prices.get(&x).unwrap_or_else(|| &empty));

    // possible way of optimizing performance: filter for 'transactions <= end' here, and not in compute_position ?

    let positions = if end.is_some() {
        isins
            .iter()
            .map(|isin| {
                (
                    isin.clone(),
                    compute_position(
                        isin.clone(),
                        &ts,
                        start_prices.and_then(|p| p.get(isin).cloned()),
                        end_historical_prices
                            .and_then(|p| p.get(isin).cloned().map(EitherPrice::wrap_historical)),
                        start,
                        end,
                    ),
                )
            })
            .collect::<HashMap<_, _>>()
    } else {
        isins
            .iter()
            .map(|isin| {
                (
                    isin.clone(),
                    compute_position(
                        isin.clone(),
                        &ts,
                        start_prices.and_then(|p| p.get(isin).cloned()),
                        current_prices
                            .get(isin)
                            .cloned()
                            .map(EitherPrice::wrap_realtime),
                        start,
                        end,
                    ),
                )
            })
            .collect::<HashMap<_, _>>()
    };

    let (p_invested, p_value, invested, value) =
        positions
            .values()
            .fold((0.0, Some(0.0), 0.0, Some(0.0)), |(api, apv, ai, av), p| {
                (
                    api + p.start.as_ref().map(|s| s.invested).unwrap_or(0.0),
                    apv.and_then(|apv1| p.start.as_ref().and_then(|s| s.value).map(|v| apv1 + v)),
                    ai + p.end.invested,
                    av.and_then(|av1| p.end.value.map(|v| av1 + v)),
                )
            });

    let end_snapshot = PortfolioSnapshot {
        date: end.unwrap_or_else(|| Local::today().naive_local()),
        invested,
        value,
    };

    let start_snapshot = start.map(|start| PortfolioSnapshot {
        date: start,
        invested: p_invested,
        value: p_value,
    });

    let irr = if (start.is_some() && p_value.is_none()) || value.is_none() {
        None
    } else {
        let mut ts = Vec::new();

        // simulated sales
        ts.extend(positions.values().filter_map(|p| {
            p.end
                .data_source
                .as_ref()
                .map(|s| (s.price.date(), p.end.units * s.price.value()))
        }));

        // simulated purchases
        ts.extend(positions.values().filter_map(|p| {
            p.start.as_ref().and_then(|ps| {
                ps.data_source
                    .as_ref()
                    .map(|s| (s.price.date(), -1.0 * ps.units * s.price.value()))
            })
        }));

        // relevant transactions
        ts.extend(positions.values().flat_map(|p| {
            p.transactions
                .iter()
                .map(|t| (t.date, (t.amount + t.fees) as f64 / 100.0))
        }));

        irr::compute(&ts)
    };

    PortfolioPerformance {
        kind,
        start: start_snapshot,
        end: end_snapshot,
        irr,
        positions,
    }
}
