use crate::analysis::price::{EitherPrice, MARKET_CLOSE, MARKET_OPEN, market_time, to_market_time};
use crate::data::exchange_comparison;
use crate::models::*;
use crate::schema::*;

use chrono::offset::TimeZone;
use chrono::{DateTime, Datelike, Duration, NaiveDate, NaiveDateTime, Utc};
use diesel::prelude::*;
use itertools::Itertools;
use log::{debug, info};
use serde::{Deserialize, Serialize};
use std::cmp::{max, min};
use std::collections::HashMap;
use std::collections::HashSet;
use std::error::Error;
use std::iter::successors;

#[derive(Deserialize, Serialize)]
pub struct PortfolioPlotDataPoint {
    date: DateTime<Utc>,
    invested: f64,
    value: Option<f64>,
}

#[derive(Deserialize, Serialize)]
pub struct PortfolioPlot {
    points: Vec<PortfolioPlotDataPoint>,
    exchanges: Vec<StockExchange>,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StockPlotDataPoint {
    date: DateTime<Utc>,
    units: f64,
    invested: f64,
    price_date: Option<DateTime<Utc>>,
    price: Option<f64>,
    value: Option<f64>,
}

#[derive(Deserialize, Serialize)]
pub struct StockPlot {
    points: Vec<StockPlotDataPoint>,
    exchanges: Vec<StockExchange>,
}

#[derive(PartialEq, Debug)]
pub enum DataSourceSelection {
    Realtime,
    Historical,
    Automatic,
}

impl std::str::FromStr for DataSourceSelection {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "realtime" => Ok(Self::Realtime),
            "historical" => Ok(Self::Historical),
            "auto" | "automatic" => Ok(Self::Automatic),
            _ => Err(format!(
                "unknown source {s:?}, expected realtime, historical or automatic"
            )),
        }
    }
}

type MyResult<T> = Result<T, Box<dyn Error>>;

/// Prices older than this (relative to a data point) are considered stale.
const MAX_PRICE_AGE: Duration = Duration::days(7);

/// Ranges up to this length get intraday detail: realtime quotes when available,
/// otherwise historical opening and closing prices.
const INTRADAY_RANGE: Duration = Duration::weeks(3);

fn is_trading_day(date: NaiveDate) -> bool {
    date.weekday().number_from_monday() <= 5
}

/// Exchange times at which a plot backed by historical prices is sampled: the close of every
/// trading day, and for short ranges also the open, because then the intraday move is the
/// only detail the plot can show. For longer ranges, opening prices would only add noise.
fn historical_sample_times(start_date: NaiveDate, end_date: NaiveDate) -> Vec<NaiveDateTime> {
    let with_open = end_date - start_date <= INTRADAY_RANGE;

    start_date
        .iter_days()
        .take_while(|d| *d <= end_date)
        .filter(|d| is_trading_day(*d))
        .flat_map(|d| {
            let close = d.and_time(MARKET_CLOSE);
            if with_open {
                vec![d.and_time(MARKET_OPEN), close]
            } else {
                vec![close]
            }
        })
        .collect()
}

/// Closing prices from the `MAX_PRICE_AGE` days before `start_date`, so that every exchange
/// has a valid price at the first sampled point even without a quote inside the range.
fn load_preceding_closes(
    connection: &mut diesel::PgConnection,
    exchanges: &[i32],
    start_date: NaiveDate,
) -> MyResult<Vec<EitherPrice>> {
    Ok(historical_prices::table
        .filter(historical_prices::onvista_record_id.eq_any(exchanges))
        .filter(historical_prices::date.ge(start_date - MAX_PRICE_AGE))
        .filter(historical_prices::date.lt(start_date))
        .order(historical_prices::date.asc())
        .load::<HistoricalPrice>(connection)?
        .into_iter()
        .map(EitherPrice::HistoricalPrice)
        .collect())
}

fn choose_and_query_points(
    connection: &mut diesel::PgConnection,
    exchanges: &[i32],
    start_date: NaiveDate,
    end_date: NaiveDate,
    source_selection: DataSourceSelection,
) -> MyResult<(Vec<DateTime<Utc>>, Vec<EitherPrice>)> {
    if source_selection == DataSourceSelection::Historical
        || (end_date - start_date > INTRADAY_RANGE
            && source_selection == DataSourceSelection::Automatic)
    {
        let dates = historical_sample_times(start_date, end_date)
            .into_iter()
            .map(market_time)
            .collect::<Vec<_>>();

        let mut prices = load_preceding_closes(connection, exchanges, start_date)?;
        let range_prices = historical_prices::table
            .filter(historical_prices::onvista_record_id.eq_any(exchanges))
            .filter(historical_prices::date.ge(start_date))
            .filter(historical_prices::date.le(end_date))
            .order(historical_prices::date.asc())
            .load::<HistoricalPrice>(connection)?;
        debug!(
            "loaded {} historical prices for {} exchanges",
            range_prices.len(),
            exchanges.len()
        );
        prices.extend(range_prices.into_iter().flat_map(|p| {
            vec![
                EitherPrice::HistoricalPriceOpening(p.clone()),
                EitherPrice::HistoricalPrice(p),
            ]
        }));

        Ok((dates, prices))
    } else {
        let start_time = market_time(start_date.and_time(MARKET_OPEN));
        let end_time = min(market_time(end_date.and_time(MARKET_CLOSE)), Utc::now());

        // sample many dates between start and end, but at most once every 5min
        let interval = max((end_time - start_time) / 400, Duration::minutes(5));
        // and make sure that its a multiple of 5 minutes.
        let interval = Duration::minutes((interval.num_minutes() / 5) * 5);

        let dates = successors(Some(start_time), |x| x.checked_add_signed(interval))
            .take_while(|d| d <= &end_time)
            .filter(|d| {
                let t = to_market_time(*d);
                is_trading_day(t.date()) && t.time() >= MARKET_OPEN && t.time() <= MARKET_CLOSE
            })
            .collect::<Vec<_>>();

        // for these Exchanges, grab all realtime prices from start_date to end_date
        let realtime_prices = realtime_prices::table
            .filter(realtime_prices::onvista_record_id.eq_any(exchanges))
            .filter(realtime_prices::date.ge(start_time))
            .filter(realtime_prices::date.le(end_time))
            .order(realtime_prices::date.asc())
            .load::<RealtimePrice>(connection)?;
        debug!(
            "loaded {} realtime prices for {} exchanges",
            realtime_prices.len(),
            exchanges.len()
        );

        // failsafe if no realtime data is available and the user doesn't care about the source
        if source_selection == DataSourceSelection::Automatic
            && realtime_prices.len() < 2 * exchanges.len()
        {
            info!(
                "Falling back to historical data because realtime data does not contain many points"
            );
            return choose_and_query_points(
                connection,
                exchanges,
                start_date,
                end_date,
                DataSourceSelection::Historical,
            );
        }

        // A position without a quote in the range (e.g. an exchange that is only quoted
        // rarely) would otherwise void the value of the whole portfolio.
        let mut prices = load_preceding_closes(connection, exchanges, start_date)?;
        prices.extend(realtime_prices.into_iter().map(EitherPrice::RealtimePrice));

        Ok((dates, prices))
    }
}

pub fn compute_portfolio_plot(
    connection: &mut diesel::PgConnection,
    user_id: i32,
    start_date: NaiveDate,
    end_date: NaiveDate,
    source_selection: DataSourceSelection,
) -> Result<PortfolioPlot, Box<dyn Error>> {
    // read all transactions up to end_time from db
    let ts = transactions::table
        .inner_join(accounts::table)
        .filter(accounts::user_id.eq(user_id))
        .filter(
            transactions::date.le(Utc.from_utc_datetime(&end_date.and_hms_opt(18, 0, 0).unwrap())),
        )
        .order(transactions::date.asc())
        .load::<(Transaction, Account)>(connection)?
        .into_iter()
        .map(|(a, _)| a)
        .collect::<Vec<_>>();

    // collect ISINs in the transactions
    let isins = ts.iter().map(|t| &t.isin).cloned().collect::<HashSet<_>>();

    // for these ISINs, grab all exchanges and select the preferred one
    let mut exs = stock_exchanges::table
        .filter(stock_exchanges::isin.eq_any(isins.clone()))
        .order(stock_exchanges::isin.asc())
        .load::<StockExchange>(connection)?
        .into_iter()
        .chunk_by(|se| se.isin.clone())
        .into_iter()
        .filter_map(|(isin, es)| es.min_by(exchange_comparison).map(|e| (isin, Some(e))))
        .collect::<HashMap<_, _>>();

    for isin in isins {
        exs.entry(isin).or_insert(None);
    }

    let record_ids = exs
        .values()
        .filter_map(|e| e.as_ref().map(|ee| ee.onvista_record_id))
        .collect::<Vec<_>>();
    let (dates, prices) = choose_and_query_points(
        connection,
        &record_ids,
        start_date,
        end_date,
        source_selection,
    )?;

    let mut points = dates
        .into_iter()
        .map(|d| PortfolioPlotDataPoint {
            date: d,
            value: Some(0.0),
            invested: 0.0,
        })
        .collect::<Vec<_>>();

    for (isin, ex) in exs.iter() {
        let mut invested = 0.0;
        let mut units = 0.0;

        let mut t_idx = 0;
        let isin_ts = ts
            .iter()
            .filter(|t| &t.isin == isin)
            .collect::<Vec<&Transaction>>();

        let mut p_idx = 0;
        let isin_ps = if let Some(exx) = ex {
            prices
                .iter()
                .filter(|p| p.onvista_record_id() == exx.onvista_record_id)
                .collect::<Vec<&EitherPrice>>()
        } else {
            Vec::new()
        };

        let mut current_price = isin_ps.first();

        // go through all points, search for the nearest price,
        // calculate invested money and current value
        for p in points.iter_mut() {
            while t_idx < isin_ts.len() && isin_ts[t_idx].date <= p.date {
                let t = &isin_ts[t_idx];
                units += t.units;
                invested -= (t.amount + t.fees) as f64 / 100.0;

                t_idx += 1;
            }
            p.invested += invested;

            while p_idx < isin_ps.len() && isin_ps[p_idx].date() <= p.date {
                current_price = isin_ps.get(p_idx);
                p_idx += 1;
            }

            if let Some(c_price) = current_price {
                if (p.date - c_price.date()).abs() < MAX_PRICE_AGE {
                    p.value = p.value.map(|v| v + units * c_price.value());
                } else if units.abs() > 1e-8 {
                    p.value = None;
                }
            } else if units.abs() > 1e-8 {
                p.value = None;
            }
        }
    }

    Ok(PortfolioPlot {
        exchanges: exs
            .values()
            .filter_map(|x| x.as_ref())
            .cloned()
            .collect::<Vec<_>>(),
        points,
    })
}

pub fn compute_stock_plot(
    connection: &mut diesel::PgConnection,
    user_id: i32,
    isin: String,
    start_date: NaiveDate,
    end_date: NaiveDate,
    source_selection: DataSourceSelection,
) -> Result<StockPlot, Box<dyn Error>> {
    // for this ISIN, grab all exchanges and select the preferred one
    let exs = stock_exchanges::table
        .filter(stock_exchanges::isin.eq(isin.clone()))
        .load::<StockExchange>(connection)?
        .into_iter()
        .collect::<Vec<_>>();

    // .min_by(exchange_comparison)
    // .ok_or("No exchanges found for isin")?;

    // read all transactions up to end_time from db
    let ts = transactions::table
        .inner_join(accounts::table)
        .filter(accounts::user_id.eq(user_id))
        .filter(transactions::isin.eq(isin))
        .filter(
            transactions::date.le(Utc.from_utc_datetime(&end_date.and_hms_opt(18, 0, 0).unwrap())),
        )
        .order(transactions::date.asc())
        .load::<(Transaction, Account)>(connection)?
        .into_iter()
        .map(|(a, _)| a)
        .collect::<Vec<_>>();

    let ex_ids = exs
        .iter()
        .map(|ex| ex.onvista_record_id)
        .collect::<Vec<_>>();

    let (dates, prices) =
        choose_and_query_points(connection, &ex_ids, start_date, end_date, source_selection)?;

    let mut points = dates
        .into_iter()
        .map(|d| StockPlotDataPoint {
            date: d,
            value: Some(0.0),
            invested: 0.0,
            units: 0.0,
            price: None,
            price_date: None,
        })
        .collect::<Vec<_>>();

    let mut invested = 0.0;
    let mut units = 0.0;

    let mut t_idx = 0;
    let mut p_idx = 0;

    let mut current_price = prices.get(p_idx);

    // go through all points, search for the nearest price,
    // calculate invested money and current value
    for p in points.iter_mut() {
        while t_idx < ts.len() && ts[t_idx].date <= p.date {
            let t = &ts[t_idx];
            units += t.units;
            invested -= (t.amount + t.fees) as f64 / 100.0;

            t_idx += 1;
        }

        p.invested = invested;
        p.units = units;

        while p_idx < prices.len() && prices[p_idx].date() <= p.date {
            current_price = prices.get(p_idx);
            p_idx += 1;
        }

        if let Some(c_price) = current_price {
            if (p.date - c_price.date()).abs() < MAX_PRICE_AGE {
                p.value = Some(units * c_price.value());
                p.price = Some(c_price.value());
                p.price_date = Some(c_price.date());
            }
        } else if units.abs() > 1e-8 {
            p.value = None;
        }
    }

    Ok(StockPlot {
        exchanges: exs,
        points,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn date(y: i32, m: u32, d: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(y, m, d).unwrap()
    }

    #[test]
    fn long_ranges_are_sampled_at_every_close_skipping_weekends() {
        // Thursday 2026-10-01 to Thursday 2026-11-05
        let times = historical_sample_times(date(2026, 10, 1), date(2026, 11, 5));

        assert_eq!(times.len(), 26);
        assert!(times.iter().all(|t| t.time() == MARKET_CLOSE));
        assert!(times.iter().all(|t| is_trading_day(t.date())));
        assert_eq!(times.first().unwrap().date(), date(2026, 10, 1));
        assert_eq!(times.last().unwrap().date(), date(2026, 11, 5));
        assert!(times.windows(2).all(|w| w[0] < w[1]));
    }

    #[test]
    fn short_ranges_are_sampled_at_open_and_close() {
        // Friday 2026-10-30 to Tuesday 2026-11-03
        let times = historical_sample_times(date(2026, 10, 30), date(2026, 11, 3));

        assert_eq!(
            times,
            [date(2026, 10, 30), date(2026, 11, 2), date(2026, 11, 3)]
                .iter()
                .flat_map(|d| [d.and_time(MARKET_OPEN), d.and_time(MARKET_CLOSE)])
                .collect::<Vec<_>>()
        );
    }

    #[test]
    fn weekend_only_ranges_have_no_samples() {
        assert!(historical_sample_times(date(2026, 10, 31), date(2026, 11, 1)).is_empty());
    }
}
