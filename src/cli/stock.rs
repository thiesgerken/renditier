use crate::add_missing_stocks;
use crate::models::*;
use crate::onvista;
use crate::schema::stock_infos::dsl::{isin, persistent, stock_infos};

use chrono::{DateTime, NaiveDate, Utc};
use clap::ArgAction;
use clap::ArgMatches;
use clap::{Arg, ArgGroup, Command};
use diesel::{
    prelude::*,
    r2d2::{ConnectionManager, Pool},
};
use log::{error, info};
use prettytable::{row, Row, Table};
use std::error::Error;
use std::io;

pub fn build() -> Command {
    Command::new("stock")
        .about("Stock Management")
        .arg(
            Arg::new("list")
                .long("list")
                .action(ArgAction::SetTrue)
                .help("overview over collected stock data"),
        )
        .arg(
            Arg::new("fetch")
                .long("fetch")
                .action(ArgAction::SetTrue)
                .help("try to fetch missing stocks"),
        )
        .arg(
            Arg::new("add")
                .long("add")
                .value_name("isin")
                .help("add (persistent) stock"),
        )
        .arg(
            Arg::new("remove")
                .long("remove")
                .value_name("isin")
                .help("remove stock from watchlist (might be re-added automatically!)"),
        )
        .arg(
            Arg::new("update")
                .long("update")
                .action(ArgAction::SetTrue)
                .help("update stock infos"),
        )
        .group(
            ArgGroup::new("action")
                .args(["add", "update", "remove", "list", "fetch"])
                .required(true),
        )
}

pub async fn handle(pool: Pool<ConnectionManager<PgConnection>>, sub_matches: &ArgMatches) {
    let mut connection = pool.get().unwrap();

    if let Some(isin_) = sub_matches.get_one::<String>("add") {
        let isin_ = isin_.to_uppercase();
        assert!(isin_.len() == 12, "ISINs always have a length of 12");

        let exists = !stock_infos
            .filter(crate::schema::stock_infos::dsl::isin.eq(&isin_))
            .load::<StockInfo>(&mut connection)
            .expect("Error loading stock infos")
            .is_empty();

        if exists {
            println!(
                "ISIN {} is already on the watch list, setting as persistent.",
                isin_
            );

            diesel::update(stock_infos.filter(crate::schema::stock_infos::dsl::isin.eq(&isin_)))
                .set(persistent.eq(true))
                .get_result::<StockInfo>(&mut connection)
                .unwrap_or_else(|_| panic!("Unable to find ISIN {}", isin_));

            info!("Set stock {:?} as persistent", isin_);
        } else {
            match onvista::get_info(&isin_).await {
                Ok((si, exs)) => {
                    let si = StockInfo {
                        persistent: true,
                        ..si
                    };

                    diesel::insert_into(crate::schema::stock_infos::table)
                        .values(&si)
                        .execute(&mut connection)
                        .expect("Error saving stock info");

                    diesel::insert_into(crate::schema::stock_exchanges::table)
                        .values(&exs)
                        .execute(&mut connection)
                        .expect("Error saving exchanges");

                    info!("Added stock {} and {} exchanges", isin_, exs.len());
                }
                Err(e) => error!("Error obtaining stock infos for {}: {}", isin_, e),
            }
        }
    } else if *sub_matches.get_one::<bool>("update").unwrap() {
        let infos = stock_infos
            .load::<StockInfo>(&mut connection)
            .expect("error querying infos");

        let mut failed_isins = Vec::new();
        for info in infos.iter() {
            debug!("updating stock info for {}", &info.isin);

            let new_info = match onvista::get_info(&info.isin).await {
                Ok((new_info, _)) => new_info,
                Err(e) => {
                    error!("error obtaining stock info for {}: {}", info.isin, e);
                    failed_isins.push(info.isin.as_str());
                    continue;
                }
            };
            // onvista only provides the instrument data, the rest is our own bookkeeping
            let new_info = StockInfo {
                persistent: info.persistent,
                last_historical_update: info.last_historical_update,
                last_realtime_update: info.last_realtime_update,
                ..new_info
            };
            if let Err(e) = diesel::update(stock_infos.filter(isin.eq(info.isin.clone())))
                .set(new_info.clone())
                .execute(&mut connection)
            {
                error!("error saving stock info for {}: {}", info.isin, e);
                failed_isins.push(info.isin.as_str());
                continue;
            }

            info!("updated stock info for {}", info.isin);
            debug!("new info: {:?}", &new_info);
        }

        if !failed_isins.is_empty() {
            error!(
                "could not update {} stock info(s): {}",
                failed_isins.len(),
                failed_isins.join(", ")
            );
            std::process::exit(1);
        }
    } else if let Some(isin_) = sub_matches.get_one::<String>("remove") {
        let isin_ = isin_.to_uppercase();
        assert!(isin_.len() == 12, "ISINs always have a length of 12");

        // check if this stock even exists in the database
        stock_infos
            .filter(crate::schema::stock_infos::dsl::isin.eq(&isin_))
            .load::<StockInfo>(&mut connection)
            .expect("Error loading stock infos")
            .first()
            .expect("Stock is not watched");

        let mut confirmation = String::new();
        println!(
        "Do you really want to delete this stock info? (It might appear again automatically!) If so, enter '{}'",
        isin_
    );
        io::stdin().read_line(&mut confirmation).unwrap();
        let confirmation = confirmation.trim_end(); // Remove the trailing newline
        assert_eq!(confirmation, isin_, "Confirmation failed");

        // delete stock info, deletes prices and so on because of ON DELETE CASCADE
        diesel::delete(stock_infos.filter(crate::schema::stock_infos::dsl::isin.eq(&isin_)))
            .execute(&mut connection)
            .unwrap_or_else(|_| panic!("Unable to delete stock {}", isin_));

        info!("deleted stock '{}', its exchanges and price data", isin_);
    } else if *sub_matches.get_one::<bool>("list").unwrap() {
        let sis = stock_infos
            .load::<StockInfo>(&mut connection)
            .expect("Error loading stock infos");

        let mut table = Table::new();
        table.add_row(row![
            "ISIN",
            "Title",
            "WKN",
            "# Exchanges",
            "# Historical Prices",
            "# Realtime Prices"
        ]);

        for si in sis {
            let row =
                add_stock_infos(&mut connection, si).expect("could not load stock infos from db");
            table.add_row(row);
        }

        table.printstd();
    } else if *sub_matches.get_one::<bool>("fetch").unwrap() {
        add_missing_stocks(pool).await;
    } else {
        panic!("unexpected options for subcommand 'stock'");
    }
}

fn add_stock_infos(connection: &mut PgConnection, si: StockInfo) -> Result<Row, Box<dyn Error>> {
    use crate::schema::historical_prices::dsl::*;
    use crate::schema::realtime_prices::dsl::*;
    use crate::schema::stock_exchanges::dsl::*;

    let exs = stock_exchanges
        .filter(crate::schema::stock_exchanges::dsl::isin.eq(&si.isin))
        .load::<StockExchange>(connection)?
        .into_iter()
        .map(|e| e.onvista_record_id)
        .collect::<Vec<_>>();

    let num_hist: i64 = historical_prices
        .select(diesel::dsl::count(
            crate::schema::historical_prices::dsl::onvista_record_id,
        ))
        .filter(crate::schema::historical_prices::dsl::onvista_record_id.eq_any(exs.clone()))
        .first(connection)?;

    let first_hist: Option<NaiveDate> = historical_prices
        .select(diesel::dsl::min(
            crate::schema::historical_prices::dsl::date,
        ))
        .filter(crate::schema::historical_prices::dsl::onvista_record_id.eq_any(exs.clone()))
        .first(connection)?;

    let last_hist: Option<NaiveDate> = historical_prices
        .select(diesel::dsl::max(
            crate::schema::historical_prices::dsl::date,
        ))
        .filter(crate::schema::historical_prices::dsl::onvista_record_id.eq_any(exs.clone()))
        .first(connection)?;

    let num_realtime: i64 = realtime_prices
        .select(diesel::dsl::count(
            crate::schema::realtime_prices::dsl::onvista_record_id,
        ))
        .filter(crate::schema::realtime_prices::dsl::onvista_record_id.eq_any(exs.clone()))
        .first(connection)?;

    let first_realtime: Option<DateTime<Utc>> = realtime_prices
        .select(diesel::dsl::min(crate::schema::realtime_prices::dsl::date))
        .filter(crate::schema::realtime_prices::dsl::onvista_record_id.eq_any(exs.clone()))
        .first(connection)?;

    let last_realtime: Option<DateTime<Utc>> = realtime_prices
        .select(diesel::dsl::max(crate::schema::realtime_prices::dsl::date))
        .filter(crate::schema::realtime_prices::dsl::onvista_record_id.eq_any(exs.clone()))
        .first(connection)?;

    let hist_str = if num_hist == 0 {
        "   0".to_owned()
    } else {
        format!(
            "{:4}, from {:?}\n        to {:?}",
            num_hist,
            first_hist.unwrap(),
            last_hist.unwrap()
        )
    };

    let realtime_str = if num_realtime == 0 {
        "0".to_owned()
    } else {
        format!(
            "{:4}, from {:?}\n        to {:?}",
            num_realtime,
            first_realtime.unwrap(),
            last_realtime.unwrap()
        )
    };

    Ok(row![
        si.isin,
        si.title,
        si.wkn,
        exs.len().to_string(),
        hist_str,
        realtime_str
    ])
}
