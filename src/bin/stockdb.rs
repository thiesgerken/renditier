use log::{debug, info};
use std::collections::HashMap;

use stocks::*;

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

    if let Some(ref sub_matches) = matches.subcommand_matches("user") {
        cli::user::handle(&connection, sub_matches);
    } else if let Some(ref sub_matches) = matches.subcommand_matches("stock") {
        cli::stock::handle(&connection, sub_matches);
    } else if let Some(ref sub_matches) = matches.subcommand_matches("transaction") {
        cli::transaction::handle(&connection, sub_matches);
    } else if let Some(ref sub_matches) = matches.subcommand_matches("account") {
        cli::account::handle(&connection, sub_matches);
    } else if let Some(ref sub_matches) = matches.subcommand_matches("data") {
        cli::data::handle(&connection, sub_matches);
    } else if let Some(ref sub_matches) = matches.subcommand_matches("import") {
        cli::import::handle(&connection, sub_matches);
    } else if let Some(ref sub_matches) = matches.subcommand_matches("export") {
        cli::export::handle(&connection, sub_matches);
    } else if let Some(ref _sub_matches) = matches.subcommand_matches("serve") {
        unimplemented!("web UI not yet done!") // TODO web ui
    } else {
        cli::build(true)
            .print_long_help()
            .expect("unable to print help");
        println!();
    }
}
