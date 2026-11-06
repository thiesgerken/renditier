pub mod account;
pub mod data;
pub mod export;
pub mod import;
pub mod serve;
pub mod stock;
pub mod transaction;
pub mod user;

use clap::{crate_authors, crate_name, crate_version, Arg, ArgAction, Command};
use config::ConfigError;
use serde::{Deserialize, Serialize};
use std::path::Path;

pub fn build() -> Command {
    Command::new(crate_name!())
        .version(crate_version!())
        .author(crate_authors!())
        .about("Stock database and analysis tool")
        .arg(Arg::new("config")
                .short('c')
                .long("config")
                .value_name("file")
                .help("read configuration from this file (instead of config.* in '/etc/stockdb' and stockdb.* in '.')"))
        .arg(Arg::new("dump")
                .long("dump")
                .action(ArgAction::SetTrue)
                .help("dump configuration and exit"))
        .arg(Arg::new("v")
                .short('v')
                .long("verbose")
                .action(ArgAction::Count)
                .help("specify multiple times (up to three) to increase verbosity level"))
        .arg(Arg::new("database")
                .long("database")
                .help("database url [default: 'postgres://localhost/stocks']")
                .value_name("url"))
        .subcommand(user::build())
        .subcommand(account::build())
        .subcommand(transaction::build())
        .subcommand(stock::build())
        .subcommand(data::build())
        .subcommand(import::build())
        .subcommand(export::build())
        .subcommand(serve::build())
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(default)]
pub struct Config {
    #[serde(skip)]
    pub verbosity: i64,
    pub database: String,
    pub web: serve::Config,
    pub receipts: crate::receipts::Config,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            database: "postgres://localhost/stocks".into(),
            verbosity: 0,
            web: Default::default(),
            receipts: Default::default(),
        }
    }
}

// set default settings and load overrides from config files
// files that are considered: basenames /etc/stockdb/config and ./stockdb
// fails, if additional_file does not exist or cannot be read
pub fn initialize_settings(
    additional_file: Option<&str>,
) -> config::ConfigBuilder<config::builder::DefaultState> {
    let mut settings = config::Config::builder();

    settings = if let Some(p) = additional_file {
        settings.add_source(config::File::from(Path::new(p)).required(true))
    } else {
        settings
            .add_source(config::File::with_name("/etc/stockdb/config").required(false))
            .add_source(config::File::with_name("./stockdb").required(false))
    };

    settings.add_source(
        config::Environment::with_prefix("STOCKDB")
            .prefix_separator("__")
            .separator("__"),
    )
}

// parse the command line flags and add them as overrides to settings
pub fn merge_settings(
    opts: &clap::ArgMatches,
    mut settings: config::ConfigBuilder<config::builder::DefaultState>,
) -> Result<config::ConfigBuilder<config::builder::DefaultState>, ConfigError> {
    let ov = ["database"];

    for x in ov.iter() {
        if let Some(y) = opts.get_one::<String>(x) {
            settings = settings.set_override(x, y.clone())?;
        }
    }

    settings = settings.set_override("verbosity", opts.get_count("v") as i64)?;

    Ok(settings)
}
