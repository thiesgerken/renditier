#[macro_use]
extern crate log;

use std::collections::HashMap;
use std::io;

use stocks::models::*;
use stocks::schema::stock_infos::dsl::*;
use stocks::*;

use clap::{crate_name, Shell};
use diesel::prelude::*;

fn main() {
    let matches = cli::build(true).get_matches();

    // initialize logging
    let level = match matches.occurrences_of("v") {
        0 => simplelog::LevelFilter::Warn,
        1 => simplelog::LevelFilter::Info,
        2 => simplelog::LevelFilter::Debug,
        _ => simplelog::LevelFilter::Trace,
    };

    let mut log_config = simplelog::ConfigBuilder::new();
    log_config.set_time_format_str("");

    if let Err(e) =
        simplelog::TermLogger::init(level, log_config.build(), simplelog::TerminalMode::Mixed)
    {
        simplelog::SimpleLogger::init(level, log_config.build())
            .expect("TermLogger and SimpleLogger failed to init!?");
        info!(
            "Falling back to SimpleLogger because TermLogger init failed: {}",
            e
        );
    }

    // setup default settings and parse overrides from config files
    let mut settings = cli::initialize_settings(matches.value_of("config"))
        .expect("unable to initialize settings");

    // parse overrides from CLI and modify settings
    cli::merge_settings(&matches, &mut settings).expect("unable to merge flags from CLI");

    debug!(
        "settings={:?}",
        settings
            .clone()
            .try_into::<HashMap<String, String>>()
            .unwrap()
    );

    let database_url = settings.get_str("database").unwrap();
    let connection = connect(&database_url).expect("error connecting and migrating to db");

    // You can get the independent subcommand matches (which function exactly like App matches)
    if let Some(ref sub_matches) = matches.subcommand_matches("user") {
        if let Some(name) = sub_matches.value_of("add") {
            // TODO: check if user exists, ask for real name and password (salt+hash it, save random salt)
            unimplemented!();
        } else if let Some(name) = sub_matches.value_of("remove") {
            // TODO: check if user exists, ask for confirmation and possibly delete the user, his accounts and transactions
            unimplemented!();
        } else if sub_matches.is_present("list") {
            // TODO: print list of users (id, name, full name, #transactions, #accounts), use https://crates.io/crates/prettytable-rs
            unimplemented!();
        } else {
            panic!("unexpected flags for subcommand 'user'");
        }
    } else if let Some(ref sub_matches) = matches.subcommand_matches("stock") {
        // if let Some(name) = sub_matches.value_of("add") {
        //     // TODO: check if user exists, ask for real name and password (salt+hash it, save random salt)
        //     unimplemented!();
        // } else if let Some(name) = sub_matches.value_of("remove") {
        //     // TODO: check if user exists, ask for confirmation and possibly delete the user, his accounts and transactions
        //     unimplemented!();
        // } else
        if sub_matches.is_present("list") {
            let results = stock_infos
                // .filter(published.eq(true))
                // .limit(5)
                .load::<StockInfo>(&connection)
                .expect("Error loading stock infos");

            println!("Displaying {} stock infos", results.len());
            for stock in results {
                println!("{}", stock.title);
                println!("----------\n");
                // println!("{}", post.body);
            }

            // TODO: print list of stocks in database (id, name, wkn/isin, #prices, persistent), use https://crates.io/crates/prettytable-rs
            unimplemented!();
        } else {
            panic!("unexpected flags for subcommand 'stock'");
        }
    } else {
        cli::build(true)
            .print_long_help()
            .expect("unable to print help");
        println!();
    }
}
