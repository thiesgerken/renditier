use crate::analysis::price::EitherPrice;
use crate::data::exchange_comparison;
use crate::models::*;
use crate::schema::*;

use chrono::offset::TimeZone;
use chrono::{DateTime, Duration, Local, NaiveDate, Timelike, Utc};
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
    exchange: StockExchange,
}

#[derive(PartialEq)]
pub enum DataSourceSelection {
    Realtime,
    Historical,
    Automatic,
}

fn option_almost_eq(a: Option<f64>, b: Option<f64>) -> bool {
    match (a, b) {
        (None, None) => true,
        (Some(a), Some(b)) => (b - a).abs() < 0.01,
        (_, _) => false,
    }
}

type MyResult<T> = Result<T, Box<dyn Error>>;

fn choose_and_query_points(
    connection: &diesel::PgConnection,
    exchanges: &[i32],
    start_date: NaiveDate,
    end_date: NaiveDate,
    source_selection: DataSourceSelection,
) -> MyResult<(Vec<DateTime<Utc>>, Vec<EitherPrice>)> {
    if source_selection == DataSourceSelection::Historical
        || (end_date - start_date > Duration::weeks(3)
            && source_selection == DataSourceSelection::Automatic)
    {
        // sample 200 dates between start and end, but at most once a day
        let interval = max((end_date - start_date) / 200, Duration::days(1));
        let mut dates = successors(
            Some(
                Local
                    .from_utc_date(&start_date)
                    .and_hms(9, 0, 0)
                    .with_timezone(&Utc),
            ),
            |x| x.checked_add_signed(interval),
        )
        .take_while(|d| d.date().naive_utc() <= end_date)
        // .filter(|d| d.date().weekday().number_from_monday() < 6)
        .collect::<Vec<_>>();

        dates = if dates.len() < 150 {
            dates
                .into_iter()
                .flat_map(|d| {
                    vec![
                        Local
                            .from_utc_date(&d.naive_utc().date())
                            .and_hms(9, 0, 0)
                            .with_timezone(&Utc),
                        Local
                            .from_utc_date(&d.naive_utc().date())
                            .and_hms(18, 0, 0)
                            .with_timezone(&Utc),
                    ]
                })
                .collect::<Vec<_>>()
        } else {
            dates
                .into_iter()
                .map(|d| {
                    Local
                        .from_utc_date(&d.naive_utc().date())
                        .and_hms(18, 0, 0)
                        .with_timezone(&Utc)
                })
                .collect::<Vec<_>>()
        };

        // for these Exchanges, grab all historical prices from start_date to end_date
        let prices = historical_prices::table
            .filter(historical_prices::onvista_record_id.eq_any(exchanges))
            .filter(historical_prices::date.ge(start_date))
            .filter(historical_prices::date.le(end_date))
            .order(historical_prices::date.asc())
            .load::<HistoricalPrice>(connection)?
            .into_iter()
            .flat_map(|p| {
                vec![
                    EitherPrice::HistoricalPriceOpening(p.clone()),
                    EitherPrice::HistoricalPrice(p),
                ]
            })
            .collect::<Vec<_>>();
        debug!(
            "loaded {} historical prices for {} exchanges",
            prices.len() / 2,
            exchanges.len()
        );

        Ok((dates, prices))
    } else {
        let start_time = Local
            .from_utc_date(&start_date)
            .and_hms(9, 0, 0)
            .with_timezone(&Utc);
        let end_time = min(
            Local
                .from_utc_date(&end_date)
                .and_hms(18, 0, 0)
                .with_timezone(&Utc),
            Utc::now(),
        );

        // sample many dates between start and end, but at most once every 5min
        let interval = max((end_time - start_time) / 400, Duration::minutes(5));
        // and make sure that its a multiple of 5 minutes.
        let interval = Duration::minutes((interval.num_minutes() / 5) * 5);

        let dates = successors(Some(start_time), |x| x.checked_add_signed(interval))
            .take_while(|d| d <= &end_time)
            .filter(|d| d.with_timezone(&Local).hour() >= 9 && d.with_timezone(&Local).hour() <= 18)
            .collect::<Vec<_>>();

        // for these Exchanges, grab all realtime prices from start_date to end_date
        let prices = realtime_prices::table
            .filter(realtime_prices::onvista_record_id.eq_any(exchanges))
            .filter(realtime_prices::date.ge(start_time))
            .filter(realtime_prices::date.le(end_time))
            .order(realtime_prices::date.asc())
            .load::<RealtimePrice>(connection)?
            .into_iter()
            .map(EitherPrice::RealtimePrice)
            .collect::<Vec<_>>();
        debug!(
            "loaded {} realtime prices for {} exchanges",
            prices.len(),
            exchanges.len()
        );

        // failsafe if no realtime data is available and the user doesn't care about the source
        if source_selection == DataSourceSelection::Automatic && prices.len() < 2 * exchanges.len()
        {
            info!("Falling back to historical data because realtime data does not contain many points");
            return choose_and_query_points(
                connection,
                exchanges,
                start_date,
                end_date,
                DataSourceSelection::Historical,
            );
        }

        Ok((dates, prices))
    }
}

pub fn compute_portfolio_plot(
    connection: &diesel::PgConnection,
    user_id: i32,
    start_date: NaiveDate,
    end_date: NaiveDate,
    source_selection: DataSourceSelection,
) -> Result<PortfolioPlot, Box<dyn Error>> {
    // read all transactions up to end_time from db
    let ts = transactions::table
        .inner_join(accounts::table)
        .filter(accounts::user_id.eq(user_id))
        .filter(transactions::date.le(Utc.from_utc_date(&end_date).and_hms(18, 0, 0)))
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
        .group_by(|se| se.isin.clone())
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

        let mut current_price = isin_ps.get(0);

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
                if (p.date - c_price.date()).num_days().abs() < 7 {
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
        points: points
            .into_iter()
            .dedup_by(|x, y| {
                option_almost_eq(x.value, y.value) && (x.invested - y.invested).abs() < 0.01
            })
            .collect::<Vec<_>>(),
    })
}

pub fn compute_stock_plot(
    connection: &diesel::PgConnection,
    user_id: i32,
    isin: String,
    start_date: NaiveDate,
    end_date: NaiveDate,
    source_selection: DataSourceSelection,
) -> Result<StockPlot, Box<dyn Error>> {
    // for this ISIN, grab all exchanges and select the preferred one
    let ex = stock_exchanges::table
        .filter(stock_exchanges::isin.eq(isin.clone()))
        .load::<StockExchange>(connection)?
        .into_iter()
        .min_by(exchange_comparison)
        .ok_or("No exchanges found for isin")?;

    // read all transactions up to end_time from db
    let ts = transactions::table
        .inner_join(accounts::table)
        .filter(accounts::user_id.eq(user_id))
        .filter(transactions::isin.eq(isin))
        .filter(transactions::date.le(Utc.from_utc_date(&end_date).and_hms(18, 0, 0)))
        .order(transactions::date.asc())
        .load::<(Transaction, Account)>(connection)?
        .into_iter()
        .map(|(a, _)| a)
        .collect::<Vec<_>>();

    let (dates, prices) = choose_and_query_points(
        connection,
        &[ex.onvista_record_id],
        start_date,
        end_date,
        source_selection,
    )?;

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
            if (p.date - c_price.date()).num_days().abs() < 7 {
                p.value = Some(units * c_price.value());
                p.price = Some(c_price.value());
                p.price_date = Some(c_price.date());
            }
        } else if units.abs() > 1e-8 {
            p.value = None;
        }
    }

    Ok(StockPlot {
        exchange: ex,
        points: points
            .into_iter()
            .dedup_by(|x, y| {
                option_almost_eq(x.value, y.value)
                    && (x.invested - y.invested).abs() < 0.01
                    && x.price == y.price
                    && x.price_date == y.price_date
            })
            .collect::<Vec<_>>(),
    })
}
