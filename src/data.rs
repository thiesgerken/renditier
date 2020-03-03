use crate::models::*;
use crate::onvista;
use crate::schema::stock_exchanges::dsl::*;
use crate::schema::stock_infos::dsl::*;

use chrono::{Duration, Utc};
use diesel::prelude::*;
use log::{debug, info, warn};
use std::error::Error;
use std::iter::successors;

pub fn fetch_realtime(
    connection: &PgConnection,
    stocks: &[&StockInfo],
) -> Result<(), Box<dyn Error>> {
    let exs = stock_exchanges
        .filter(crate::schema::stock_exchanges::dsl::isin.eq_any(stocks.iter().map(|s| &s.isin)))
        .load::<StockExchange>(connection)?;

    for s in stocks {
        let data = onvista::get_data_realtime(&s.isin)?;
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
                &s.isin
            );
        }

        let row_count = diesel::insert_into(crate::schema::realtime_prices::table)
            .values(&data)
            .on_conflict_do_nothing()
            .execute(connection)?;

        info!(
            "Inserted {} row(s) of realtime data (of {}) for {}",
            row_count,
            data.len(),
            &s.isin
        );

        let now = Utc::now();
        diesel::update(stock_infos.filter(crate::schema::stock_infos::isin.eq(&s.isin)))
            .set(crate::schema::stock_infos::last_realtime_update.eq(now))
            .execute(connection)?;
    }

    Ok(())
}

pub fn fetch_historical(
    connection: &PgConnection,
    stocks: &[&StockInfo],
) -> Result<(), Box<dyn Error>> {
    let mut exs = stock_exchanges
        .filter(crate::schema::stock_exchanges::dsl::isin.eq_any(stocks.iter().map(|s| &s.isin)))
        .load::<StockExchange>(connection)?;
    exs.sort_by(exchange_comparison);

    for s in stocks {
        let now = Utc::now();

        for ex in exs.iter().filter(|&e| e.isin == s.isin).take(5) {
            let grab_dates = successors(
                s.last_historical_update
                    .unwrap_or_else(|| now.checked_sub_signed(Duration::weeks(15 * 52)).unwrap())
                    .checked_sub_signed(Duration::weeks(2)),
                |t| t.checked_add_signed(Duration::weeks(4 * 52)),
            )
            .take_while(|&t| t < now);

            for t in grab_dates {
                debug!(
                    "Requesting 5 years of data for exchange {} for {} starting from {}",
                    ex.code, ex.isin, t
                );

                let batch = onvista::get_data_historical(
                    ex.onvista_record_id,
                    t.with_timezone(&chrono::Local).date(),
                )?;

                let row_count = diesel::insert_into(crate::schema::historical_prices::table)
                    .values(&batch)
                    .on_conflict_do_nothing()
                    .execute(connection)?;

                info!(
                    "inserted {} row(s) of historical data (of {}) for {} @ {}",
                    row_count,
                    batch.len(),
                    &s.isin,
                    ex.code
                );
            }
        }

        diesel::update(stock_infos.filter(crate::schema::stock_infos::isin.eq(&s.isin)))
            .set(crate::schema::stock_infos::last_historical_update.eq(now))
            .execute(connection)?;
    }

    Ok(())
}

pub fn exchange_comparison(a: &StockExchange, b: &StockExchange) -> std::cmp::Ordering {
    let exchange_favorites = [
        "GER", "QUO", "GAT", "FRA", "LUSG", "STU", "HAM", "MUN", "BER", "DUS",
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
