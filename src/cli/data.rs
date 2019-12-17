use chrono::{Duration, Utc};
use clap::ArgMatches;
use diesel::prelude::*;
use log::{debug, info};
use std::iter::successors;

use crate::models::*;
use crate::onvista;
use crate::schema::stock_exchanges::dsl::*;
use crate::schema::stock_infos::dsl::*;

pub fn handle(connection: &PgConnection, sub_matches: &&ArgMatches<'_>) {
  if sub_matches.is_present("fetch") {
    let now = Utc::now();
    let stocks = stock_infos
      .load::<StockInfo>(connection)
      .expect("Error loading stock infos");

    let stocks_rt_update = stocks
      .iter()
      .filter(|x| match x.last_realtime_update {
        Some(t) => now.signed_duration_since(t) > Duration::hours(1),
        None => true,
      })
      .collect::<Vec<_>>();
    info!(
      "Updating realtime data for {} stocks",
      stocks_rt_update.len()
    );
    fetch_realtime(connection, &stocks_rt_update);

    let stocks_hist_update = stocks
      .iter()
      .filter(|x| match x.last_historical_update {
        Some(t) => now.signed_duration_since(t) > Duration::hours(4),
        None => true,
      })
      .collect::<Vec<_>>();
    info!(
      "Updating historical data for {} stocks",
      stocks_hist_update.len()
    );
    fetch_historical(connection, &stocks_hist_update);
  } else if sub_matches.is_present("clean") {
    unimplemented!("clean not done") // TODO
                                     // TODO: delete all but the newest data point for each record id in realtime data
  } else {
    panic!("unexpected options for subcommand 'data'");
  }
}

fn fetch_realtime(connection: &PgConnection, stocks: &Vec<&StockInfo>) {
  for s in stocks {
    let data = onvista::get_data_realtime(&s.isin)
      .expect(&format!("Unable to obtain realtime data for {}", &s.isin));
    let row_count = diesel::insert_into(crate::schema::realtime_prices::table)
      .values(&data)
      .on_conflict_do_nothing()
      .execute(connection)
      .expect(&format!("Unable to write realtime data for {}", &s.isin));

    info!(
      "inserted {} rows of realtime data (of {}) for {}",
      row_count,
      data.len(),
      &s.isin
    );

    let now = Utc::now();
    diesel::update(stock_infos.filter(crate::schema::stock_infos::isin.eq(&s.isin)))
      .set(crate::schema::stock_infos::last_realtime_update.eq(now))
      .execute(connection)
      .expect(&format!(
        "Unable to update last realtime update field for {}",
        &s.isin
      ));
  }
}

fn fetch_historical(connection: &PgConnection, stocks: &Vec<&StockInfo>) {
  let mut exs = stock_exchanges
    .filter(crate::schema::stock_exchanges::dsl::isin.eq_any(stocks.iter().map(|s| &s.isin)))
    .load::<StockExchange>(connection)
    .expect("Unable to query database for stock exchanges");
  exs.sort_by(exchange_comparison);

  for s in stocks {
    let now = Utc::now();

    for ex in exs.iter().filter(|&e| e.isin == s.isin).take(5) {
      let grab_dates = successors(
        s.last_historical_update
          .unwrap_or(now.checked_sub_signed(Duration::weeks(15 * 52)).unwrap())
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
        )
        .expect(&format!(
          "data request for exchange {} from {} failed",
          ex.onvista_record_id, t
        ));

        let row_count = diesel::insert_into(crate::schema::historical_prices::table)
          .values(&batch)
          .on_conflict_do_nothing()
          .execute(connection)
          .expect(&format!("Unable to write historical data for {}", &s.isin));

        info!(
          "inserted {} rows of historical data (of {}) for {} @ {}",
          row_count,
          batch.len(),
          &s.isin,
          ex.code
        );
      }
    }

    diesel::update(stock_infos.filter(crate::schema::stock_infos::isin.eq(&s.isin)))
      .set(crate::schema::stock_infos::last_historical_update.eq(now))
      .execute(connection)
      .expect(&format!(
        "Unable to update last historical update field for {}",
        &s.isin
      ));
  }
}

fn exchange_comparison(a: &StockExchange, b: &StockExchange) -> std::cmp::Ordering {
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
