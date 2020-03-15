use crate::data::exchange_comparison;
use crate::models::*;
use crate::schema::*;

use chrono::offset::TimeZone;
use chrono::{Duration, NaiveDate, Utc};
use diesel::prelude::*;
use itertools::Itertools;
use log::debug;
use serde::{Deserialize, Serialize};
use std::cmp::max;
use std::collections::HashMap;
use std::collections::HashSet;
use std::error::Error;
use std::iter::successors;

#[derive(Deserialize, Serialize)]
pub struct PlotDataPoint {
    date: NaiveDate,
    invested: f64,
    value: Option<f64>,
}

#[derive(Deserialize, Serialize)]
pub struct PortfolioPlot {
    points: Vec<PlotDataPoint>,
    exchanges: Vec<StockExchange>,
}

pub fn compute_portfolio_plot(
    connection: &diesel::PgConnection,
    user_id: i32,
    start_date: NaiveDate,
    end_date: NaiveDate,
) -> Result<PortfolioPlot, Box<dyn Error>> {
    // read all transactions up to end_time from db
    let ts = transactions::table
        .inner_join(accounts::table)
        .filter(accounts::user_id.eq(user_id))
        .filter(transactions::date.le(Utc.from_utc_date(&end_date).and_hms(17, 30, 0)))
        .order(transactions::date.asc())
        .load::<(Transaction, Account)>(&*connection)?
        .into_iter()
        .map(|(a, _)| a)
        .collect::<Vec<_>>();

    // collect ISINs in the transactions
    let isins = ts.iter().map(|t| &t.isin).cloned().collect::<HashSet<_>>();

    // for these ISINs, grab all exchanges and select the preferred one
    let mut exs = stock_exchanges::table
        .filter(stock_exchanges::isin.eq_any(isins.clone()))
        .order(stock_exchanges::isin.asc())
        .load::<StockExchange>(&*connection)?
        .into_iter()
        .group_by(|se| se.isin.clone())
        .into_iter()
        .filter_map(|(isin, es)| es.min_by(exchange_comparison).map(|e| (isin, Some(e))))
        .collect::<HashMap<_, _>>();

    for isin in isins {
        exs.entry(isin).or_insert(None);
    }

    // for these Exchanges, grab all historical prices from start_date to end_date
    let prices = historical_prices::table
        .filter(
            historical_prices::onvista_record_id.eq_any(
                exs.values()
                    .filter_map(|e| e.as_ref().map(|ee| ee.onvista_record_id)),
            ),
        )
        .filter(historical_prices::date.ge(start_date))
        .filter(historical_prices::date.le(end_date))
        .order(historical_prices::date.asc())
        .load::<HistoricalPrice>(&*connection)?;
    debug!(
        "loaded {} historical prices for {} exchanges",
        prices.len(),
        exs.len()
    );

    // sample 200 days between start and end, but at most once a day
    let interval = max((end_date - start_date) / 200, Duration::days(1));
    let dates = successors(Some(Utc.from_utc_date(&start_date).and_hms(1, 0, 0)), |x| {
        x.checked_add_signed(interval)
    })
    .map(|d| d.date().naive_utc())
    .take_while(|d| d <= &end_date)
    .collect::<Vec<_>>();

    let mut points = dates
        .into_iter()
        .map(|d| PlotDataPoint {
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
                .filter(|p| p.onvista_record_id == exx.onvista_record_id)
                .collect::<Vec<&HistoricalPrice>>()
        } else {
            Vec::new()
        };

        let mut current_price = isin_ps.get(0);

        for p in points.iter_mut() {
            let d = Utc.from_utc_date(&p.date).and_hms(17, 30, 0);
            while t_idx < isin_ts.len() && isin_ts[t_idx].date <= d {
                let t = &isin_ts[t_idx];
                units += t.units;
                invested -= (t.amount + t.fees) as f64 / 100.0;

                t_idx += 1;
            }
            p.invested += invested;

            while p_idx < isin_ps.len() && isin_ps[p_idx].date <= p.date {
                current_price = isin_ps.get(p_idx);
                p_idx += 1;
            }

            if let Some(c_price) = current_price {
                if (p.date - c_price.date).num_days().abs() < 7 {
                    p.value = p.value.map(|v| v + units * c_price.closing)
                } else {
                    p.value = None
                }
            } else {
                p.value = None
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
