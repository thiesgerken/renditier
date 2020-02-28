use crate::connect;
use crate::data::*;
use crate::models::*;
use crate::schema::stock_infos::dsl::*;
use crate::{add_missing_stocks, web};

use chrono::{Duration, Utc};
use clap::ArgMatches;
use clap::{App, Arg, SubCommand};
use diesel::prelude::*;
use log::{error, info, warn};
use rocket::config::LoggingLevel;
use serde::{Deserialize, Serialize};
use std::error::Error;
use std::thread;

pub fn build() -> App<'static, 'static> {
  SubCommand::with_name("serve")
    .about("serve web interface")
    .arg(
      Arg::with_name("port")
        .long("port")
        .short("p")
        .value_name("port")
        .help("customize listening port [default: 'postgres://localhost/stocks']"),
    )
    .arg(
      Arg::with_name("address")
        .long("address")
        .value_name("address")
        .help("customize listening address [default: 'localhost']"),
    )
    .arg(
      Arg::with_name("secret")
        .long("secret")
        .value_name("key")
        .help("secret key for cookie encryption [default: randomly generated]; use `openssl rand -base64 32` to create one"),
    )
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(default)]
pub struct Config {
  pub secret_key: Option<String>,
  pub port: i64,
  pub address: String,
}

impl Default for Config {
  fn default() -> Self {
    Self {
      secret_key: None,
      port: 8383,
      address: "localhost".into(),
    }
  }
}

fn fetch_data(connection: &PgConnection) -> Result<(), Box<dyn Error>> {
  let now = Utc::now();
  let stocks = stock_infos.load::<StockInfo>(connection)?;

  let stocks_rt_update = stocks
    .iter()
    .filter(|x| match x.last_realtime_update {
      Some(t) => now.signed_duration_since(t) > Duration::hours(1),
      None => true,
    })
    .collect::<Vec<_>>();
  if !stocks_rt_update.is_empty() {
    info!(
      "Updating realtime data for {} stocks",
      stocks_rt_update.len()
    );
    if let Err(e) = fetch_realtime(connection, &stocks_rt_update) {
      error!("Could not update realtime data: {}", e)
    }
  }

  let stocks_hist_update = stocks
    .iter()
    .filter(|x| match x.last_historical_update {
      Some(t) => now.signed_duration_since(t) > Duration::hours(4),
      None => true,
    })
    .collect::<Vec<_>>();
  if !stocks_hist_update.is_empty() {
    info!(
      "Updating historical data for {} stocks",
      stocks_hist_update.len()
    );
    if let Err(e) = fetch_historical(connection, &stocks_hist_update) {
      error!("Could not update historical data: {}", e)
    }
  }

  Ok(())
}

pub fn handle(sub_matches: &ArgMatches<'_>, mut config: Config, database: String, verbosity: i64) {
  if let Some(y) = sub_matches.value_of("port") {
    config.port = y.parse().expect("cannot parse port");
  }

  if let Some(y) = sub_matches.value_of("secret") {
    if !y.is_empty() {
      config.secret_key = Some(y.into());
    }
  }

  if let Some(y) = sub_matches.value_of("address") {
    config.address = y.into();
  }

  let level = match verbosity {
    0 => LoggingLevel::Critical,
    1 => LoggingLevel::Normal,
    _ => LoggingLevel::Debug,
  };

  let db_str = database.clone();
  thread::spawn(move || {
    thread::sleep(std::time::Duration::from_secs(10));
    let connection = connect(&db_str).expect("error connecting to db");
    loop {
      add_missing_stocks(&connection);
      fetch_data(&connection).unwrap_or_else(|e| warn!("Error fetching new price data: {}", e));
      thread::sleep(std::time::Duration::from_secs(30));
    }
  });

  web::handle(web::Config {
    port: config.port as u16,
    address: config.address,
    secret_key: config.secret_key,
    log_level: level,
    database_url: database,
  });
}
