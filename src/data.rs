use crate::analysis::price::to_market_time;
use crate::models::*;
use crate::onvista;
use crate::schema::stock_exchanges::dsl::*;
use crate::schema::stock_infos::dsl::*;
use crate::schema::*;

use chrono::{Duration, NaiveDate, TimeZone, Utc};
use diesel::{
    prelude::*,
    r2d2::{ConnectionManager, Pool},
    upsert::excluded,
};
use log::{error, info, warn};
use std::error::Error;
use std::iter::successors;

/// Re-reads the instruments' master data from onvista and returns the ISINs that failed. onvista
/// reclassifies instruments over time (e.g. a fund that becomes an ETC), and the stored kind
/// picks the endpoints its prices come from, so a stale kind cuts an instrument off from prices.
pub async fn refresh_infos(
    pool: Pool<ConnectionManager<PgConnection>>,
    stocks: &[StockInfo],
) -> Result<Vec<String>, Box<dyn Error>> {
    let mut connection = pool.get()?;
    let mut failed_isins = Vec::new();

    for stock in stocks {
        let new_info = match onvista::get_info(&stock.isin).await {
            Ok((new_info, _)) => new_info,
            Err(e) => {
                error!("Error obtaining stock info for {}: {}", stock.isin, e);
                failed_isins.push(stock.isin.clone());
                continue;
            }
        };
        // onvista only provides the instrument data, the rest is our own bookkeeping
        let new_info = StockInfo {
            persistent: stock.persistent,
            last_historical_update: stock.last_historical_update,
            last_realtime_update: stock.last_realtime_update,
            ..new_info
        };
        if new_info.kind != stock.kind {
            warn!(
                "onvista reclassified {} from {} to {}",
                stock.isin, stock.kind, new_info.kind
            );
        }

        diesel::update(stock_infos.filter(crate::schema::stock_infos::isin.eq(&stock.isin)))
            .set(new_info)
            .execute(&mut connection)?;
        info!("Updated stock info for {}", stock.isin);
    }

    Ok(failed_isins)
}

pub async fn fetch_realtime(
    pool: Pool<ConnectionManager<PgConnection>>,
    stocks: &[&StockInfo],
) -> Result<(), Box<dyn Error>> {
    let mut connection = pool.get()?;
    let exs = stock_exchanges
        .filter(crate::schema::stock_exchanges::dsl::isin.eq_any(stocks.iter().map(|s| &s.isin)))
        .load::<StockExchange>(&mut connection)?;

    for s in stocks {
        match onvista::get_data_realtime(s).await {
            Ok(data) => {
                let original_len = data.len();
                let data = data
                    .into_iter()
                    .filter(|d| {
                        exs.iter()
                            .any(|e| e.onvista_record_id == d.onvista_record_id)
                    })
                    .collect::<Vec<_>>();

                if data.len() < original_len {
                    warn!(
                        "Throwing away {} realtime data record(s) (of {}) for {} because they belong to unknown exchanges",
                        original_len - data.len(),
                        original_len,
                        s.isin
                    );
                }

                let row_count = diesel::insert_into(crate::schema::realtime_prices::table)
                    .values(&data)
                    .on_conflict_do_nothing()
                    .execute(&mut connection)?;

                info!(
                    "Inserted {} row(s) of realtime data (of {}) for {}",
                    row_count,
                    data.len(),
                    s.isin
                );
            }
            Err(e) => {
                error!("Error obtaining realtime data for {}: {}", s.isin, e);
            }
        }

        let now = Utc::now();
        diesel::update(stock_infos.filter(crate::schema::stock_infos::isin.eq(&s.isin)))
            .set(crate::schema::stock_infos::last_realtime_update.eq(now))
            .execute(&mut connection)?;
    }

    Ok(())
}

pub async fn fetch_historical(
    pool: Pool<ConnectionManager<PgConnection>>,
    stocks: &[&StockInfo],
) -> Result<(), Box<dyn Error>> {
    let mut connection = pool.get()?;

    let mut exs = stock_exchanges
        .filter(crate::schema::stock_exchanges::dsl::isin.eq_any(stocks.iter().map(|s| &s.isin)))
        .load::<StockExchange>(&mut connection)?;
    exs.sort_by(exchange_comparison);

    for s in stocks {
        let now = Utc::now();

        for ex in exs.iter().filter(|&e| e.isin == s.isin).take(4) {
            let newest_stored_day = historical_prices::table
                .filter(historical_prices::dsl::onvista_record_id.eq(ex.onvista_record_id))
                .select(diesel::dsl::max(historical_prices::dsl::date))
                .first::<Option<NaiveDate>>(&mut connection)?
                .map(|d| Utc.from_utc_datetime(&d.and_hms_opt(0, 0, 0).unwrap()))
                .unwrap_or_else(|| now.checked_sub_signed(Duration::weeks(15 * 52)).unwrap());

            let grab_dates = successors(
                newest_stored_day.checked_sub_signed(Duration::weeks(2)),
                |t| t.checked_add_signed(Duration::weeks(4 * 52)),
            )
            .take_while(|&t| t < now);

            for t in grab_dates {
                info!(
                    "Requesting 5 years of data for {} @ {} starting from {}",
                    ex.isin, ex.code, t
                );

                match onvista::get_data_historical(
                    s,
                    ex.onvista_record_id,
                    to_market_time(t).date(),
                )
                .await
                {
                    Ok(batch) => {
                        // a re-fetch must overwrite already stored days, so that corrected
                        // prices actually reach the database
                        let row_count = diesel::insert_into(historical_prices::table)
                            .values(&batch)
                            .on_conflict((
                                historical_prices::date,
                                historical_prices::onvista_record_id,
                            ))
                            .do_update()
                            .set((
                                historical_prices::opening.eq(excluded(historical_prices::opening)),
                                historical_prices::closing.eq(excluded(historical_prices::closing)),
                                historical_prices::high.eq(excluded(historical_prices::high)),
                                historical_prices::low.eq(excluded(historical_prices::low)),
                                historical_prices::volume.eq(excluded(historical_prices::volume)),
                            ))
                            .execute(&mut connection)?;

                        info!(
                            "Upserted {} row(s) of historical data (of {}) for {} @ {}",
                            row_count,
                            batch.len(),
                            s.isin,
                            ex.code
                        );
                    }
                    Err(x) => {
                        error!("Error updating data for {} @ {}: {:?}", s.isin, ex.code, x)
                    }
                }

                tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
            }
        }

        // note that this is set in any case, even if the request fails.
        diesel::update(stock_infos.filter(crate::schema::stock_infos::isin.eq(&s.isin)))
            .set(crate::schema::stock_infos::last_historical_update.eq(now))
            .execute(&mut connection)?;
    }

    Ok(())
}

pub fn exchange_comparison(a: &StockExchange, b: &StockExchange) -> std::cmp::Ordering {
    let exchange_favorites = [
        "GER", "FRA", "GAT", "QUO", "LUSG", "STU", "HAM", "MUN", "BER", "DUS",
    ];

    let idx_a = exchange_favorites.iter().position(|&e| a.code == e);
    let idx_b = exchange_favorites.iter().position(|&e| b.code == e);

    match (idx_a, idx_b) {
        (None, None) => std::cmp::Ordering::Equal,
        (Some(_), None) => std::cmp::Ordering::Less,
        (Some(i_a), Some(i_b)) => i_a.cmp(&i_b),
        (_, _) => std::cmp::Ordering::Greater,
    }
}
