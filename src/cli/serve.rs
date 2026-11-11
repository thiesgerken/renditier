use crate::analysis::price::to_market_time;
use crate::data::*;
use crate::models::*;
use crate::schema::stock_infos::dsl::*;
use crate::{add_missing_stocks, web};

use chrono::{Datelike, Duration, Timelike, Utc};
use chrono_tz::Tz;
use clap::ArgMatches;
use clap::{Arg, Command};
use diesel::prelude::*;
use diesel::r2d2::{ConnectionManager, Pool};
use log::{error, info};
use rocket::config::LogLevel;
use serde::{Deserialize, Serialize};
use std::error::Error;
use std::time::Instant;
use tokio;

pub fn build() -> Command {
    Command::new("serve")
    .about("serve web interface")
    .arg(
      Arg::new("port")
        .long("port")
        .short('p')
        .value_name("port")
        .help("customize listening port [default: 8383]"),
    )
    .arg(
      Arg::new("address")
        .long("address")
        .value_name("address")
        .help("customize listening address [default: 'localhost']"),
    )
    .arg(
      Arg::new("secret")
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
    // if this is set to Some value, then the client will be instructed to redirect to this page.
    // should be used with trusted_header_authentication
    pub authentication_redirect: Option<String>,
    // server will trust the username that is present in the HTTP header.
    // only use this behind a reverse proxy that properly manages this header!
    pub trusted_header_authentication: bool,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            secret_key: String::new(),
            port: 8383,
            address: "127.0.0.1".into(),
            authentication_redirect: None,
            trusted_header_authentication: false,
        }
    }
}

const INFO_REFRESH_INTERVAL: std::time::Duration = std::time::Duration::from_secs(24 * 60 * 60);

async fn refresh_all_infos(
    pool: Pool<ConnectionManager<PgConnection>>,
) -> Result<(), Box<dyn Error>> {
    let stocks = stock_infos.load::<StockInfo>(&mut pool.get()?)?;
    let failed_isins = refresh_infos(pool, &stocks).await?;
    if !failed_isins.is_empty() {
        error!(
            "Could not refresh {} stock info(s): {}",
            failed_isins.len(),
            failed_isins.join(", ")
        );
    }
    Ok(())
}

async fn fetch_data(pool: Pool<ConnectionManager<PgConnection>>) -> Result<(), Box<dyn Error>> {
    let now = Utc::now();
    let now_market = to_market_time(now);

    let mut connection = pool.get()?;
    let stocks = stock_infos.load::<StockInfo>(&mut connection)?;

    // do not update data as often in the night and on weekends
    let rt_interval = if now_market.weekday().number_from_monday() >= 6
        || now_market.hour() > 19
        || now_market.hour() < 9
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
    let hist_interval = if now_market.weekday().number_from_monday() >= 6
        || now_market.hour() > 22
        || now_market.hour() < 18
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
    sub_matches: &ArgMatches,
    pool: Pool<ConnectionManager<PgConnection>>,
    mut config: Config,
    database: String,
    timezone: Tz,
    verbosity: i64,
) {
    if let Some(y) = sub_matches.get_one::<String>("port") {
        config.port = y.parse().expect("cannot parse port");
    }

    if let Some(y) = sub_matches.get_one::<String>("secret") {
        config.secret_key = y.into();
    }

    if let Some(y) = sub_matches.get_one::<String>("address") {
        config.address = y.into();
    }

    let level = match verbosity {
        0 => LogLevel::Critical,
        1 => LogLevel::Normal,
        _ => LogLevel::Debug,
    };

    tokio::spawn(async move {
        tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(60));
        let mut last_info_refresh: Option<Instant> = None;

        loop {
            interval.tick().await;

            add_missing_stocks(pool.clone()).await;

            // ponytail: kept in memory, so every restart refreshes too; that is cheap enough
            if last_info_refresh.is_none_or(|t| t.elapsed() >= INFO_REFRESH_INTERVAL) {
                last_info_refresh = Some(Instant::now());
                refresh_all_infos(pool.clone())
                    .await
                    .unwrap_or_else(|e| error!("Error refreshing stock infos: {}", e));
            }

            fetch_data(pool.clone())
                .await
                .unwrap_or_else(|e| error!("Error fetching new price data: {}", e));
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
        trusted_header_authentication: config.trusted_header_authentication,
        timezone,
        authentication_redirect: config.authentication_redirect,
    })
    .await;
}
