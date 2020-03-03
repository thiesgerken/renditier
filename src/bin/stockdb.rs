use stockdb::cli::Config;
use stockdb::*;

use log::{debug, info};
use simplelog::{LevelFilter, SimpleLogger, TermLogger, TerminalMode};

fn main() {
    let matches = cli::build(true).get_matches();

    // initialize logging
    let level = match matches.occurrences_of("v") {
        0 => LevelFilter::Warn,
        1 => LevelFilter::Info,
        2 => LevelFilter::Debug,
        _ => LevelFilter::Trace,
    };

    let mut log_config = simplelog::ConfigBuilder::new();
    log_config.set_time_format_str("");

    if let Err(e) = TermLogger::init(level, log_config.build(), TerminalMode::Mixed) {
        SimpleLogger::init(level, log_config.build())
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

    let config = settings
        .try_into::<Config>()
        .expect("unable to parse settings into Config struct");

    debug!("config={:?}", &config);

    let connection = connect(&config.database).expect("error connecting and migrating to db");

    if let Some(sub_matches) = matches.subcommand_matches("user") {
        cli::user::handle(&connection, sub_matches);
    } else if let Some(sub_matches) = matches.subcommand_matches("stock") {
        cli::stock::handle(&connection, sub_matches);
    } else if let Some(sub_matches) = matches.subcommand_matches("transaction") {
        cli::transaction::handle(&connection, sub_matches);
    } else if let Some(sub_matches) = matches.subcommand_matches("account") {
        cli::account::handle(&connection, sub_matches);
    } else if let Some(sub_matches) = matches.subcommand_matches("data") {
        cli::data::handle(&connection, sub_matches);
    } else if let Some(sub_matches) = matches.subcommand_matches("import") {
        cli::import::handle(&connection, sub_matches);
    } else if let Some(sub_matches) = matches.subcommand_matches("export") {
        cli::export::handle(&connection, sub_matches);
    } else if let Some(sub_matches) = matches.subcommand_matches("push") {
        cli::push::handle(&connection, sub_matches, config.push);
    } else if let Some(sub_matches) = matches.subcommand_matches("serve") {
        std::mem::drop(connection); // `serve::handle` creates its own connections
        cli::serve::handle(
            sub_matches,
            config.web,
            config.push,
            config.database,
            config.verbosity,
        );
    } else {
        cli::build(true)
            .print_long_help()
            .expect("unable to print help");
        println!();
    }
}
