use chrono::{DateTime, Duration, NaiveDate, Utc};
use clap::ArgMatches;
use diesel::prelude::*;
use log::{error, info};
use prettytable::{cell, row, Row, Table};
use std::error::Error;
use std::io;

use crate::models::*;
use crate::onvista;
use crate::schema::historical_prices::dsl::*;
use crate::schema::realtime_prices::dsl::*;
use crate::schema::stock_exchanges::dsl::*;
use crate::schema::stock_infos::dsl::*;

pub fn handle(connection: &PgConnection, sub_matches: &&ArgMatches<'_>) {
  if sub_matches.is_present("fetch") {
    let stocks = stock_infos
      .load::<StockInfo>(connection)
      .expect("Error loading stock infos");

    let now = Utc::now();

    let stocks_rt_update = stocks
      .iter()
      .filter(|x| match x.last_realtime_update {
        Some(t) => now.signed_duration_since(t) > Duration::hours(1),
        None => true,
      })
      .collect::<Vec<_>>();
    let stocks_hist_update = stocks
      .iter()
      .filter(|x| match x.last_historical_update {
        Some(t) => now.signed_duration_since(t) > Duration::hours(4),
        None => true,
      })
      .collect::<Vec<_>>();

    fetch_realtime(connection, &stocks_rt_update);
    fetch_historical(connection, &stocks_hist_update);
  } else if sub_matches.is_present("clean") {
    unimplemented!("clean not done") // TODO

  // TODO: delete all but the newest data point for each record id in realtime data
  } else {
    panic!("unexpected options for subcommand 'data'");
  }
}

fn fetch_realtime(connection: &PgConnection, stocks: &Vec<&StockInfo>) {
  // TODO

  let now = Utc::now();
  diesel::update(
    stock_infos.filter(
      crate::schema::stock_infos::isin.eq_any(
        stocks
          .iter()
          .map(|s| s.isin.to_string())
          .collect::<Vec<_>>(),
      ),
    ),
  )
  .set(crate::schema::stock_infos::last_realtime_update.eq(now))
  .execute(connection)
  .expect("Unable to update realtime last update fields");
}

fn fetch_historical(connection: &PgConnection, stocks: &Vec<&StockInfo>) {
  // TODO: for all data sets that do not have historical data for today: iteratively update in 5y intervals
  // TODO: if no data present for a stock: update from 20y ago

  let now = Utc::now();
  diesel::update(
    stock_infos.filter(
      crate::schema::stock_infos::isin.eq_any(
        stocks
          .iter()
          .map(|s| s.isin.to_string())
          .collect::<Vec<_>>(),
      ),
    ),
  )
  .set(crate::schema::stock_infos::last_historical_update.eq(now))
  .execute(connection)
  .expect("Unable to update historical last update fields");
}
