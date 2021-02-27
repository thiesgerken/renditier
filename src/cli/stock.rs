use crate::add_missing_stocks;
use crate::models::*;
use crate::onvista;
use crate::schema::stock_infos::dsl::*;

use chrono::{DateTime, NaiveDate, Utc};
use clap::ArgMatches;
use clap::{App, Arg, ArgGroup, SubCommand};
use diesel::{
    prelude::*,
    r2d2::{ConnectionManager, Pool},
};
use log::{error, info};
use prettytable::{cell, row, Row, Table};
use std::error::Error;
use std::io;

pub fn build() -> App<'static, 'static> {
    SubCommand::with_name("stock")
        .about("Stock Management")
        .arg(
            Arg::with_name("list")
                .long("list")
                .help("overview over collected stock data"),
        )
        .arg(
            Arg::with_name("fetch")
                .long("fetch")
                .help("try to fetch missing stocks"),
        )
        .arg(
            Arg::with_name("add")
                .long("add")
                .value_name("isin")
                .help("add (persistent) stock"),
        )
        .arg(
            Arg::with_name("remove")
                .long("remove")
                .value_name("isin")
                .help("remove stock from watchlist (might be re-added automatically!)"),
        )
        .arg(
            Arg::with_name("update")
                .long("update")
                .help("update stock infos"),
        )
        .group(
            ArgGroup::with_name("action")
                .args(&["add", "update", "remove", "list", "fetch"])
                .required(true),
        )
}

pub async fn handle(pool: Pool<ConnectionManager<PgConnection>>, sub_matches: &ArgMatches<'_>) {
    let connection = pool.get().unwrap();

    if let Some(isin_) = sub_matches.value_of("add") {
        let isin_ = isin_.to_uppercase();
        assert!(isin_.len() == 12, "ISINs always have a length of 12");

        let exists = stock_infos
            .filter(crate::schema::stock_infos::dsl::isin.eq(&isin_))
            .load::<StockInfo>(&connection)
            .expect("Error loading stock infos")
            .iter()
            .next()
            .is_some();

        if exists {
            println!(
                "ISIN {} is already on the watch list, setting as persistent.",
                isin_
            );

            diesel::update(stock_infos.filter(crate::schema::stock_infos::dsl::isin.eq(&isin_)))
                .set(persistent.eq(true))
                .get_result::<StockInfo>(&connection)
                .unwrap_or_else(|_| panic!("Unable to find ISIN {}", &isin_));

            info!("Set stock {:?} as persistent", &isin_);
        } else {
            match onvista::get_info(&isin_).await {
                Ok((si, exs)) => {
                    let si = StockInfo {
                        persistent: true,
                        ..si
                    };

                    diesel::insert_into(crate::schema::stock_infos::table)
                        .values(&si)
                        .execute(&connection)
                        .expect("Error saving stock info");

                    diesel::insert_into(crate::schema::stock_exchanges::table)
                        .values(&exs)
                        .execute(&connection)
                        .expect("Error saving exchanges");

                    info!("Added stock {} and {} exchanges", &isin_, exs.len());
                }
                Err(e) => error!("Error obtaining stock infos for {}: {}", isin_, e),
            }
        }
    } else if sub_matches.is_present("update") {
        let infos = stock_infos
            .load::<StockInfo>(&connection)
            .expect("error querying infos");

        for info in infos.iter() {
            debug!("updating stock info for {}", &info.isin);

            let (new_info, _) = onvista::get_info(&info.isin)
                .await
                .expect("error obtaining stock info");
            diesel::update(stock_infos.filter(isin.eq(info.isin.clone())))
                .set(new_info.clone())
                .execute(&connection)
                .expect("error updating stock info");

            info!("updated stock info for {}", &info.isin);
            debug!("new info: {:?}", &new_info);
        }
    } else if let Some(isin_) = sub_matches.value_of("remove") {
        let isin_ = isin_.to_uppercase();
        assert!(isin_.len() == 12, "ISINs always have a length of 12");

        // check if this stock even exists in the database
        stock_infos
            .filter(crate::schema::stock_infos::dsl::isin.eq(&isin_))
            .load::<StockInfo>(&connection)
            .expect("Error loading stock infos")
            .iter()
            .next()
            .expect("Stock is not watched");

        let mut confirmation = String::new();
        println!(
        "Do you really want to delete this stock info? (It might appear again automatically!) If so, enter '{}'",
        &isin_
    );
        io::stdin().read_line(&mut confirmation).unwrap();
        let confirmation = confirmation.trim_end(); // Remove the trailing newline
        assert_eq!(confirmation, isin_, "Confirmation failed");

        // delete stock info, deletes prices and so on because of ON DELETE CASCADE
        diesel::delete(stock_infos.filter(crate::schema::stock_infos::dsl::isin.eq(&isin_)))
            .execute(&connection)
            .unwrap_or_else(|_| panic!("Unable to delete stock {}", &isin_));

        info!("deleted stock '{}', its exchanges and price data", isin_);
    } else if sub_matches.is_present("list") {
        let sis = stock_infos
            .load::<StockInfo>(&connection)
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
            let row = add_stock_infos(&connection, si).expect("could not load stock infos from db");
            table.add_row(row);
        }

        table.printstd();
    } else if sub_matches.is_present("fetch") {
        add_missing_stocks(pool).await;
    } else {
        panic!("unexpected options for subcommand 'stock'");
    }
}

fn add_stock_infos(connection: &PgConnection, si: StockInfo) -> Result<Row, Box<dyn Error>> {
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
