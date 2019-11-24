#[macro_use]
extern crate clap;

#[macro_use]
extern crate log;

mod cli;

use std::collections::HashMap;
use std::io;

use stocks::models::*;
use stocks::schema::stock_infos::dsl::*;
use stocks::*;

use clap::Shell;
use diesel::prelude::*;

fn main() {
    let opts = cli::build(true).get_matches();

    if opts.is_present("generate-bash-completions") {
        cli::build(false).gen_completions_to(crate_name!(), Shell::Bash, &mut io::stdout());
        return;
    }

    if opts.is_present("generate-zsh-completions") {
        cli::build(false).gen_completions_to(crate_name!(), Shell::Zsh, &mut io::stdout());
        return;
    }

    // initialize logging
    let level = match opts.occurrences_of("v") {
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
    let mut settings =
        cli::initialize_settings(opts.value_of("config")).expect("unable to initialize settings");

    // parse overrides from CLI and modify settings
    cli::merge_settings(&opts, &mut settings).expect("unable to merge flags from CLI");

    debug!(
        "settings={:?}",
        settings
            .clone()
            .try_into::<HashMap<String, String>>()
            .unwrap()
    );

    let database_url = settings.get_str("database").unwrap();
    let connection = connect(&database_url).expect("error connecting and migrating to db");

    if let Some(name) = opts.value_of("add-user") {
        // TODO: check if user exists, ask for real name and password (salt+hash it, save random salt)
        unimplemented!();
    } else if let Some(name) = opts.value_of("remove-user") {
        // TODO: check if user exists, ask for confirmation and possibly delete the user, his accounts and transactions
        unimplemented!();
    } else if opts.is_present("users") {
        // TODO: print list of users (id, name, full name, #transactions, #accounts), use https://crates.io/crates/prettytable-rs
        unimplemented!();
    } else if opts.is_present("stocks") {
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
        unimplemented!();
    }
}
