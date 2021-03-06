use crate::cli::push::Config as PushConfig;
use crate::data::*;
use crate::models::*;
use crate::push;
use crate::schema::stock_infos::dsl::*;
use crate::{add_missing_stocks, web};

use chrono::{Datelike, Duration, Local, Timelike, Utc};
use clap::ArgMatches;
use clap::{App, Arg, SubCommand};
use diesel::prelude::*;
use diesel::r2d2::{ConnectionManager, Pool};
use log::{error, info, warn};
use rocket::config::LogLevel;
use serde::{Deserialize, Serialize};
use std::error::Error;
use std::fs::File;
use std::io::Read;
use tokio;

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
    pub secret_key: String, // for cookie encryption
    pub port: i64,
    pub address: String,
    pub application_server_key: String, // for push notifications
}

impl Default for Config {
    fn default() -> Self {
        Self {
            secret_key: String::new(),
            port: 8383,
            address: "127.0.0.1".into(),
            application_server_key: String::new(),
        }
    }
}

async fn fetch_data(pool: Pool<ConnectionManager<PgConnection>>) -> Result<(), Box<dyn Error>> {
    let now = Utc::now();
    let now_local = now.with_timezone(&Local);

    let connection = pool.get()?;
    let stocks = stock_infos.load::<StockInfo>(&connection)?;

    // do not update data as often in the night and on weekends
    let rt_interval = if now.date().weekday().number_from_monday() >= 6
        || now_local.hour() > 19
        || now_local.hour() < 9
    {
        Duration::hours(6)
    } else {
        Duration::minutes(15)
    };

    let stocks_rt_update = stocks
        .iter()
        .filter(|x| match x.last_realtime_update {
            Some(t) => now.signed_duration_since(t) > rt_interval,
            None => true,
        })
        .collect::<Vec<_>>();
    if !stocks_rt_update.is_empty() {
        info!(
            "Updating realtime data for {} stocks",
            stocks_rt_update.len()
        );
        if let Err(e) = fetch_realtime(pool.clone(), &stocks_rt_update).await {
            error!("Could not update realtime data: {}", e)
        }
    }

    // do not update data as often in the night and on weekends
    let hist_interval = if now.date().weekday().number_from_monday() >= 6
        || now_local.hour() > 22
        || now_local.hour() < 18
    {
        Duration::hours(6)
    } else {
        Duration::hours(2)
    };

    let stocks_hist_update = stocks
        .iter()
        .filter(|x| match x.last_historical_update {
            Some(t) => now.signed_duration_since(t) > hist_interval,
            None => true,
        })
        .collect::<Vec<_>>();
    if !stocks_hist_update.is_empty() {
        info!(
            "Updating historical data for {} stocks",
            stocks_hist_update.len()
        );
        if let Err(e) = fetch_historical(pool.clone(), &stocks_hist_update).await {
            error!("Could not update historical data: {}", e)
        }
    }

    Ok(())
}

pub async fn handle(
    sub_matches: &ArgMatches<'_>,
    pool: Pool<ConnectionManager<PgConnection>>,
    mut config: Config,
    push_config: PushConfig,
    database: String,
    verbosity: i64,
) {
    if let Some(y) = sub_matches.value_of("port") {
        config.port = y.parse().expect("cannot parse port");
    }

    if let Some(y) = sub_matches.value_of("secret") {
        config.secret_key = y.into();
    }

    if let Some(y) = sub_matches.value_of("address") {
        config.address = y.into();
    }

    let level = match verbosity {
        0 => LogLevel::Critical,
        1 => LogLevel::Normal,
        _ => LogLevel::Debug,
    };

    let data_pool = pool.clone();
    tokio::spawn(async move {
        tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(60));

        loop {
            interval.tick().await;

            add_missing_stocks(data_pool.clone()).await;

            fetch_data(data_pool.clone())
                .await
                .unwrap_or_else(|e| error!("Error fetching new price data: {}", e));
        }
    });

    tokio::spawn(async move {
        tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(60));

        let private_key_file = File::open(push_config.key_file);
        let mut private_key = Vec::new();
        if let Err(e) = private_key_file.and_then(|mut f| f.read_to_end(&mut private_key)) {
            warn!(
                "Error loading private key: {:?}, will not attempt to send notifications.",
                e
            );

            private_key = Vec::new();
        }

        loop {
            interval.tick().await;

            if !private_key.is_empty() {
                push::send_daily_notifications(pool.clone(), &private_key)
                    .await
                    .unwrap_or_else(|e| error!("Error sending notifications: {}", e));
            }
        }
    });

    web::handle(web::Config {
        port: config.port as u16,
        address: config.address,
        secret_key: if config.secret_key.is_empty() {
            None
        } else {
            Some(config.secret_key)
        },
        log_level: level,
        database_url: database,
        application_server_key: config.application_server_key,
    })
    .await;
}
