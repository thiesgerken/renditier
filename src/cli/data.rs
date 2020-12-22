use crate::data::*;
use crate::models::*;
use crate::schema::stock_infos::dsl::*;
use crate::serialization::*;

use chrono::{Duration, Utc};
use clap::ArgMatches;
use clap::{App, Arg, ArgGroup, SubCommand};
use diesel::{
    prelude::*,
    r2d2::{ConnectionManager, Pool},
};
use log::{error, info};
use std::io;

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
        .arg(
            Arg::with_name("export")
                .long("export")
                .help("write realtime and historic data for all stocks to stdout"),
        )
        .arg(
            Arg::with_name("import")
                .long("import")
                .help("read realtime and historic data from stdin"),
        )
        .group(
            ArgGroup::with_name("action")
                .args(&["clean", "fetch", "export", "import"])
                .required(true),
        )
}

pub async fn handle(pool: Pool<ConnectionManager<PgConnection>>, sub_matches: &ArgMatches<'_>) {
    let connection = pool.get().unwrap();

    if sub_matches.is_present("fetch") {
        let now = Utc::now();
        let stocks = stock_infos
            .load::<StockInfo>(&connection)
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
        if let Err(e) = fetch_realtime(pool.clone(), &stocks_rt_update).await {
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
        if let Err(e) = fetch_historical(pool.clone(), &stocks_hist_update).await {
            error!("Could not update historical data: {}", e)
        }
    } else if sub_matches.is_present("export") {
        let p = DataFormat::new(&connection);
        println!(
            "{}",
            serde_json::to_string(&p).expect("Could not serialize data")
        );
    } else if sub_matches.is_present("import") {
        let p: DataFormat =
            serde_json::from_reader(io::stdin()).expect("Could not parse data input");

        p.write_to(&connection);
    } else if sub_matches.is_present("clean") {
        use crate::schema::realtime_prices::dsl::*;
        let now = Utc::now();

        let cnt = diesel::delete(
            realtime_prices.filter(
                crate::schema::realtime_prices::dsl::date
                    .lt(now.checked_sub_signed(Duration::weeks(1)).unwrap()),
            ),
        )
        .execute(&connection)
        .expect("Unable to delete old realtime prices");

        info!(
            "found and deleted {} realtime prices older than 1 week",
            cnt
        );

        let cnt = diesel::sql_query("DELETE FROM superfluous_stocks")
            .execute(&connection)
            .expect("Unable to delete superfluous stocks");
        info!("found and deleted {} superfluous stocks", cnt);
    } else {
        panic!("unexpected options for subcommand 'data'");
    }
}
