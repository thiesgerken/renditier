use crate::data::*;
use crate::models::*;
use crate::schema::stock_infos::dsl::*;

use chrono::{Duration, Utc};
use clap::ArgMatches;
use clap::{App, Arg, ArgGroup, SubCommand};
use diesel::prelude::*;
use log::{error, info};

pub fn build() -> App<'static, 'static> {
    SubCommand::with_name("data")
        .about("Data Management")
        .arg(
            Arg::with_name("clean")
                .long("clean")
                .help("delete old realtime prices, keeping only the latest data"),
        )
        .arg(
            Arg::with_name("fetch")
                .long("fetch")
                .help("update realtime and historic data for all stocks"),
        )
        .group(
            ArgGroup::with_name("action")
                .args(&["clean", "fetch"])
                .required(true),
        )
}

pub fn handle(connection: &PgConnection, sub_matches: &ArgMatches<'_>) {
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
        if let Err(e) = fetch_realtime(connection, &stocks_rt_update) {
            error!("Could not update realtime data: {}", e)
        }

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
        if let Err(e) = fetch_historical(connection, &stocks_hist_update) {
            error!("Could not update realtime data: {}", e)
        }
    } else if sub_matches.is_present("clean") {
        use crate::schema::realtime_prices::dsl::*;
        let now = Utc::now();

        let cnt = diesel::delete(
            realtime_prices.filter(
                crate::schema::realtime_prices::dsl::date
                    .lt(now.checked_sub_signed(Duration::weeks(1)).unwrap()),
            ),
        )
        .execute(connection)
        .expect("Unable to delete old realtime prices");

        info!(
            "found and deleted {} realtime prices older than 1 week",
            cnt
        );

        let cnt = diesel::sql_query("DELETE FROM superfluous_stocks")
            .execute(connection)
            .expect("Unable to delete superfluous stocks");
        info!("found and deleted {} superfluous stocks", cnt);
    } else {
        panic!("unexpected options for subcommand 'data'");
    }
}
