pub mod account;
pub mod data;
pub mod export;
pub mod import;
pub mod push;
pub mod serve;
pub mod stock;
pub mod transaction;
pub mod user;

use clap::{crate_authors, crate_name, crate_version, App, Arg};
use config::ConfigError;
use serde::{Deserialize, Serialize};
use std::path::Path;

// build a clap::App interface
// multiple: -v can be used multiple times, but this seems to hinder generation of completions for zsh
pub fn build(multiple: bool) -> App<'static, 'static> {
    App::new(crate_name!())
        .version(crate_version!())
        .author(crate_authors!())
        .about("Stock database and analysis tool")
        .arg(Arg::with_name("config")
                .short("c")
                .long("config")
                .value_name("file")
                .help("read configuration from this file (instead of config.* in '/etc/stockdb' and stockdb.* in '.')"))
        .arg(Arg::with_name("v")
                .short("v")
                .long("verbose")
                .multiple(multiple)
                .help("specify multiple times (up to three) to increase verbosity level"))
        .arg(Arg::with_name("database")
                .long("database")
                .help("database url [default: 'postgres://localhost/stocks']")
                .value_name("url")) 
        .subcommand(user::build())
        .subcommand(account::build())
        .subcommand(transaction::build())
        .subcommand(push::build())
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
    pub push: push::Config,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            database: "postgres://localhost/stocks".into(),
            verbosity: 0,
            web: Default::default(),
            push: Default::default(),
        }
    }
}

// set default settings and load overrides from config files
// files that are considered: basenames /etc/stockdb/config and ./stockdb
// fails, if additional_file does not exist or cannot be read
pub fn initialize_settings(additional_file: Option<&str>) -> Result<config::Config, ConfigError> {
    // let default: Config = Default::default();
    // let mut settings = config::Config::try_from(&default)?;
    let mut settings = config::Config::new();

    if let Some(p) = additional_file {
        settings
            .merge(config::File::from(Path::new(p)).required(true))
            .expect("unable to read config file");
    } else {
        settings
            .merge(config::File::with_name("/etc/stockdb/config").required(false))
            .unwrap()
            .merge(config::File::with_name("./stockdb").required(false))
            .unwrap();
    }

    Ok(settings)
}

// parse the command line flags and add them as overrides to settings
pub fn merge_settings<'a>(
    opts: &clap::ArgMatches<'a>,
    settings: &mut config::Config,
) -> Result<(), ConfigError> {
    let ov = vec!["database"];

    for x in ov.iter() {
        if let Some(y) = opts.value_of(x) {
            settings.set(x, y)?;
        }
    }

    settings.set("verbosity", opts.occurrences_of("v") as i64)?;

    Ok(())
}
