use crate::models::*;
use crate::onvista;
use crate::schema::stock_exchanges::dsl::*;
use crate::schema::stock_infos::dsl::*;
use crate::schema::*;

use chrono::{Duration, TimeZone, Utc};
use diesel::{
    prelude::*,
    r2d2::{ConnectionManager, Pool},
};
use log::{error, info, warn};
use std::error::Error;
use std::iter::successors;

pub async fn fetch_realtime(
    pool: Pool<ConnectionManager<PgConnection>>,
    stocks: &[&StockInfo],
) -> Result<(), Box<dyn Error>> {
    let connection = pool.get()?;
    let exs = stock_exchanges
        .filter(crate::schema::stock_exchanges::dsl::isin.eq_any(stocks.iter().map(|s| &s.isin)))
        .load::<StockExchange>(&connection)?;

    for s in stocks {
        let s_exs = exs
            .iter()
            .filter(|e| e.isin == s.isin)
            .cloned()
            .collect::<Vec<_>>();

        match onvista::get_data_realtime(s, &s_exs).await {
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
                    warn!("Throwing away {} realtime data record(s) (of {}) for {} because they belong to unknown exchanges",
                        original_len - data.len(),
                        original_len,
                        &s.isin);
                }

                let row_count = diesel::insert_into(crate::schema::realtime_prices::table)
                    .values(&data)
                    .on_conflict_do_nothing()
                    .execute(&connection)?;

                info!(
                    "Inserted {} row(s) of realtime data (of {}) for {}",
                    row_count,
                    data.len(),
                    &s.isin
                );
            }
            Err(e) => {
                error!("Error obtaining realtime data for {}: {}", &s.isin, e);
            }
        }

        let now = Utc::now();
        diesel::update(stock_infos.filter(crate::schema::stock_infos::isin.eq(&s.isin)))
            .set(crate::schema::stock_infos::last_realtime_update.eq(now))
            .execute(&connection)?;
    }

    Ok(())
}

pub async fn fetch_historical(
    pool: Pool<ConnectionManager<PgConnection>>,
    stocks: &[&StockInfo],
) -> Result<(), Box<dyn Error>> {
    let connection = pool.get()?;

    let mut exs = stock_exchanges
        .filter(crate::schema::stock_exchanges::dsl::isin.eq_any(stocks.iter().map(|s| &s.isin)))
        .load::<StockExchange>(&connection)?;
    exs.sort_by(exchange_comparison);

    for s in stocks {
        let now = Utc::now();

        for ex in exs.iter().filter(|&e| e.isin == s.isin).take(5) {
            let latest_datum = historical_prices::table
                .filter(historical_prices::dsl::onvista_record_id.eq(ex.onvista_record_id))
                .order_by(historical_prices::dsl::date.asc())
                .first::<HistoricalPrice>(&connection)
                .optional()?
                .map(|x| Utc.from_utc_datetime(&x.date.and_hms(0, 0, 0)))
                .unwrap_or_else(|| now.checked_sub_signed(Duration::weeks(15 * 52)).unwrap());

            let grab_dates = successors(latest_datum.checked_sub_signed(Duration::weeks(2)), |t| {
                t.checked_add_signed(Duration::weeks(4 * 52))
            })
            .take_while(|&t| t < now);

            for t in grab_dates {
                info!(
                    "Requesting 5 years of data for {} @ {} starting from {}",
                    ex.isin, ex.code, t
                );

                match onvista::get_data_historical(
                    s,
                    ex.onvista_record_id,
                    t.with_timezone(&chrono::Local).date(),
                )
                .await
                {
                    Ok(batch) => {
                        let row_count =
                            diesel::insert_into(crate::schema::historical_prices::table)
                                .values(&batch)
                                .on_conflict_do_nothing()
                                .execute(&connection)?;

                        info!(
                            "Inserted {} row(s) of historical data (of {}) for {} @ {}",
                            row_count,
                            batch.len(),
                            &s.isin,
                            ex.code
                        );
                    }
                    Err(x) => {
                        error!("Error updating data for {} @ {}: {:?}", &s.isin, ex.code, x)
                    }
                }

                tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
            }
        }

        // note that this is set in any case, even if the request fails.
        diesel::update(stock_infos.filter(crate::schema::stock_infos::isin.eq(&s.isin)))
            .set(crate::schema::stock_infos::last_historical_update.eq(now))
            .execute(&connection)?;
    }

    Ok(())
}

pub fn exchange_comparison(a: &StockExchange, b: &StockExchange) -> std::cmp::Ordering {
    let exchange_favorites = [
        "GER", "QUO", "FRA", "LUSG", "STU", "HAM", "MUN", "BER", "GAT", "DUS",
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
