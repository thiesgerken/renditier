use crate::analysis::price::{DataSource, EitherPrice, Price, PriceMap};
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
#[serde(rename_all = "camelCase")]
pub struct PortfolioPerformance {
    pub kind: PerformanceKind,
    pub start: PortfolioSnapshot,
    pub end: PortfolioSnapshot,
    pub irr_annual: Option<f64>,
    pub irr_period: Option<f64>,
    pub positions: HashMap<String, PositionPerformance>,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PositionPerformance {
    pub start: PositionSnapshot,
    pub end: PositionSnapshot,
    pub irr_annual: Option<f64>,
    pub irr_period: Option<f64>,
    pub transactions: Vec<Transaction>,
}

#[derive(Deserialize, Serialize)]
pub struct PortfolioSnapshot {
    pub date: NaiveDate,
    pub invested: f64,
    pub fees: f64, // these are included in `invested`
    pub value: Option<f64>,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PositionSnapshot {
    pub date: NaiveDate,
    pub units: f64,
    pub invested: f64,
    pub fees: f64, // these are included in `invested`
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
    let current_prices: PriceMap<RealtimePrice> =
        price::find(connection, &isins, date, 4 * 24, 4 * 24)?;

    // assemble dates for which we need to get HistoricalPrices
    let mut current_day = current_prices
        .values()
        .map(|d| d.price.date)
        .max()
        .unwrap_or_else(Utc::now)
        .with_timezone(&Local)
        .date()
        .naive_local();
    while current_day.weekday().number_from_monday() > 5 {
        current_day = current_day.pred();
    }

    let mut prev_day = current_day.pred();
    while prev_day.weekday().number_from_monday() > 5 {
        prev_day = prev_day.pred();
    }

    let first_transaction_date = ts
        .iter()
        .map(|t| t.date)
        .min()
        .map(|d| d.with_timezone(&Local).date().naive_local())
        .unwrap_or_else(|| NaiveDate::from_ymd(prev_day.year(), 1, 1));

    let mut jobs = Vec::new();
    jobs.push((PerformanceKind::Total, first_transaction_date.pred(), None));

    /*
      EOD prices <-> current_prices:
      * previous trading day
      * end of last week
      * end of last month
      * end of last year
    */

    jobs.push((PerformanceKind::Today, prev_day, None));

    let days_from_friday = (prev_day.weekday().number_from_monday() as i64
        - Weekday::Fri.number_from_monday() as i64
        + 7)
        % 7;
    jobs.push((
        PerformanceKind::WeekToDate,
        prev_day
            .checked_sub_signed(Duration::days(days_from_friday))
            .unwrap(),
        None,
    ));

    let first_of_month = NaiveDate::from_ymd(prev_day.year(), prev_day.month(), 1);
    jobs.push((
        PerformanceKind::MonthToDate,
        first_of_month
            .checked_sub_signed(Duration::days(1))
            .unwrap(),
        None,
    ));

    let first_of_year = NaiveDate::from_ymd(prev_day.year(), 1, 1);
    jobs.push((
        PerformanceKind::YearToDate,
        first_of_year.checked_sub_signed(Duration::days(1)).unwrap(),
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
    .map(|(x, y)| (PerformanceKind::YearToYear, x, Some(y)));
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
    .map(|(x, y)| (PerformanceKind::MonthToMonth, x, Some(y)));
    jobs.extend(monthlies);

    // collect all relevant dates
    let dates = jobs
        .iter()
        .map(|(_, x, _)| Some(*x))
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
    start: NaiveDate,
    end: NaiveDate,
) -> PositionPerformance {
    let (prior_ts, relevant_ts): (Vec<_>, Vec<_>) = ts
        .iter()
        .filter(|t| t.isin == isin && t.date.with_timezone(&Local).date().naive_local() <= end)
        .cloned()
        .partition(|t| t.date.with_timezone(&Local).date().naive_local() <= start);

    let (prior_units, prior_invested, prior_fees) =
        prior_ts.iter().fold((0.0, 0.0, 0.0), |(au, ac, af), t| {
            (
                au + t.units,
                ac + (t.amount + t.fees) as f64 / 100.0,
                af + t.fees as f64 / 100.0,
            )
        });

    let (units, invested, fees) = relevant_ts.iter().fold((0.0, 0.0, 0.0), |(au, ac, af), t| {
        (
            au + t.units,
            ac + (t.amount + t.fees) as f64 / 100.0,
            af + t.fees as f64 / 100.0,
        )
    });

    let end_snapshot = PositionSnapshot {
        date: end,
        units: units + prior_units,
        invested: invested + prior_invested,
        fees: fees + prior_fees,
        value: if units + prior_units == 0.0 {
            Some(0.0)
        } else {
            end_price
                .as_ref()
                .map(|x| (prior_units + units) * x.price.value())
        },
        data_source: end_price.as_ref().cloned(),
    };

    let start_snapshot = PositionSnapshot {
        date: start,
        units: prior_units,
        invested: prior_invested,
        fees: prior_fees,
        value: if prior_units == 0.0 {
            Some(0.0)
        } else {
            start_price.as_ref().map(|x| prior_units * x.price.value())
        },
        data_source: start_price.clone().map(EitherPrice::wrap_historical),
    };

    let (irr_annual, irr_period) = if start_price.is_none() && prior_units != 0.0 {
        (None, None)
    } else if let Some(ep) = end_price {
        let mut ts = Vec::new();

        // simulated sale
        if units + prior_units != 0.0 {
            ts.push((ep.price.date(), (units + prior_units) * ep.price.value()));
        }

        if prior_units != 0.0 {
            if let Some(sp) = start_price.as_ref() {
                // simulated purchase
                ts.push((sp.price.date(), -1.0 * prior_units * sp.price.value()));
            }
        }

        ts.extend(
            relevant_ts
                .iter()
                .map(|t| (t.date, (t.amount + t.fees) as f64 / 100.0)),
        );

        let period_length = ep.price.date().signed_duration_since(
            start_price
                .as_ref()
                .map(|sp| sp.price.date())
                .unwrap_or_else(|| DateTime::<Utc>::from_utc(start.and_hms(12, 0, 0), Utc)),
        );
        let year = chrono::Duration::days(365);

        // to avoid loss in accuracy, calculate the irr on the smaller of the two time scales and convert that one
        if period_length > year {
            let irr_annual = irr::compute(&ts, year);
            (
                irr_annual,
                irr_annual.map(|x| irr::convert(x, year, period_length)),
            )
        } else {
            let irr_period = irr::compute(&ts, period_length);
            (
                irr_period.map(|x| irr::convert(x, period_length, year)),
                irr_period,
            )
        }
    } else {
        (None, None)
    };

    PositionPerformance {
        start: start_snapshot,
        end: end_snapshot,
        transactions: relevant_ts,
        irr_annual,
        irr_period,
    }
}

fn compute_performance(
    ts: &[Transaction],
    isins: &[String],
    current_prices: &PriceMap<RealtimePrice>,
    prices: &HashMap<NaiveDate, PriceMap<HistoricalPrice>>,
    kind: PerformanceKind,
    start: NaiveDate,
    end: Option<NaiveDate>,
) -> PortfolioPerformance {
    let empty = HashMap::new();
    let end_historical_prices = end.map(|x| prices.get(&x).unwrap_or_else(|| &empty));
    let start_prices = prices.get(&start).unwrap_or_else(|| &empty);

    // possible way of optimizing performance: filter for 'transactions <= end' here, and not in compute_position ?

    let positions = if let Some(end) = end {
        isins
            .iter()
            .map(|isin| {
                (
                    isin.clone(),
                    compute_position(
                        isin.clone(),
                        &ts,
                        start_prices.get(isin).cloned(),
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
                        start_prices.get(isin).cloned(),
                        current_prices
                            .get(isin)
                            .cloned()
                            .map(EitherPrice::wrap_realtime),
                        start,
                        Local::today().naive_local(),
                    ),
                )
            })
            .collect::<HashMap<_, _>>()
    };

    let (p_invested, p_value, p_fees, invested, value, fees) = positions.values().fold(
        (0.0, Some(0.0), 0.0, 0.0, Some(0.0), 0.0),
        |(api, apv, apf, ai, av, af), p| {
            (
                api + p.start.invested,
                apv.and_then(|apv1| p.start.value.map(|v| apv1 + v)),
                apf + p.start.fees,
                ai + p.end.invested,
                av.and_then(|av1| p.end.value.map(|v| av1 + v)),
                af + p.end.fees,
            )
        },
    );

    let end_snapshot = PortfolioSnapshot {
        date: end.unwrap_or_else(|| Local::today().naive_local()),
        invested,
        fees,
        value,
    };

    let start_snapshot = PortfolioSnapshot {
        date: start,
        invested: p_invested,
        fees: p_fees,
        value: p_value,
    };

    let (irr_annual, irr_period) = if (p_value.is_none()) || value.is_none() {
        (None, None)
    } else {
        let mut ts = Vec::new();

        // simulated sales
        ts.extend(positions.values().filter_map(|p| {
            p.end.data_source.as_ref().and_then(|s| {
                if p.end.units == 0.0 {
                    None
                } else {
                    Some((s.price.date(), p.end.units * s.price.value()))
                }
            })
        }));

        // simulated purchases
        ts.extend(positions.values().filter_map(|p| {
            p.start.data_source.as_ref().and_then(|s| {
                if p.start.units == 0.0 {
                    None
                } else {
                    Some((s.price.date(), -1.0 * p.start.units * s.price.value()))
                }
            })
        }));

        // relevant transactions
        ts.extend(positions.values().flat_map(|p| {
            p.transactions
                .iter()
                .map(|t| (t.date, (t.amount + t.fees) as f64 / 100.0))
        }));

        let first_purchase = positions
            .values()
            .filter_map(|p| p.start.data_source.as_ref().map(|s| (s.price.date())))
            .min();
        let last_sale = positions
            .values()
            .filter_map(|p| p.end.data_source.as_ref().map(|s| (s.price.date())))
            .max();

        // Note that if the options are 'None' the irr will be 'None' no matter what period_length is
        let period_length = first_purchase
            .and_then(|fp| last_sale.map(|ls| ls.signed_duration_since(fp)))
            .unwrap_or_else(|| Duration::days(7));
        let year = chrono::Duration::days(365);

        // to avoid loss in accuracy, calculate the irr on the smaller of the two time scales and convert that one
        if period_length > year {
            let irr_annual = irr::compute(&ts, year);
            (
                irr_annual,
                irr_annual.map(|x| irr::convert(x, year, period_length)),
            )
        } else {
            let irr_period = irr::compute(&ts, period_length);
            (
                irr_period.map(|x| irr::convert(x, period_length, year)),
                irr_period,
            )
        }
    };

    PortfolioPerformance {
        kind,
        start: start_snapshot,
        end: end_snapshot,
        irr_annual,
        irr_period,
        positions,
    }
}
