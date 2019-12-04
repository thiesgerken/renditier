use clap::{crate_authors, crate_name, crate_version, App, Arg, ArgGroup, SubCommand};
use config::{Config, ConfigError};
use std::path::Path;

/// set default settings and load overrides from config files
/// files that are considered: basenames /etc/stockdb/config and ./config
/// fails, if additional_file does not exist or cannot be read
pub fn initialize_settings(additional_file: Option<&str>) -> Result<Config, ConfigError> {
    // Gather all conf files from conf/ manually
    let mut settings = Config::default();

    settings.set_default("database", "postgres://localhost/stocks")?;

    if let Some(p) = additional_file {
        settings
            .merge(config::File::from(Path::new(p)).required(true))
            .expect("unable to read config file");
    } else {
        settings
            .merge(config::File::with_name("/etc/stockdb/config").required(false))
            .unwrap()
            .merge(config::File::with_name("./config").required(false))
            .unwrap();
    }

    Ok(settings)
}

/// build a clap::App interface
/// multiple: -v can be used multiple times, but this seems to hinder generation of completions for zsh
pub fn build(multiple: bool) -> App<'static, 'static> {
    App::new(crate_name!())
        .version(crate_version!())
        .author(crate_authors!())
        .about("Stock database and analysis tool")
        .arg(Arg::with_name("config")
                .short("c")
                .long("config")
                .value_name("file")
                .help("read configuration from this file (instead of config.yaml in '/etc/stockdb' and '.')"))
        .arg(Arg::with_name("v")
                .short("v")
                .long("verbose")
                .multiple(multiple)
                .help("specify multiple times (up to three) to increase verbosity level"))
        .arg(Arg::with_name("database")
                .long("database")
                .help("database url [default: 'postgres://localhost/stocks']")
                .value_name("url")) 
        .subcommand(SubCommand::with_name("user")
                .about("User Management")
                .arg(Arg::with_name("add")
                        .long("add")
                        .value_name("name")
                        .help("add user"))
                .arg(Arg::with_name("remove")
                        .long("remove")
                        .value_name("name")
                        .help("remove user"))
                .arg(Arg::with_name("update")
                        .long("update")
                        .value_name("name")
                        .help("update user's full name and password"))
                .arg(Arg::with_name("list")
                        .long("list") 
                        .help("list users"))
                .group(ArgGroup::with_name("action")
                        .args(&["add", "update", "remove", "list"])
                        .required(true)))
        .subcommand(SubCommand::with_name("stock")
                .about("Stock Management")
                .arg(Arg::with_name("list")
                        .long("list") 
                        .help("overview over collected stock data"))      
                .arg(Arg::with_name("add")
                        .long("add")
                        .value_name("isin")
                        .help("add (persistent) stock"))
                .arg(Arg::with_name("remove")
                        .long("remove")
                        .value_name("isin")
                        .help("remove stock from watchlist (might be re-added automatically)"))
                .arg(Arg::with_name("update")
                        .long("update")
                        .value_name("isin")
                        .help("update stock infos"))         
                .group(ArgGroup::with_name("action")
                        .args(&["add", "update", "remove", "list"])
                        .required(true)))
}

/// parse the command line flags and add them as overrides to settings
pub fn merge_settings<'a>(
    opts: &clap::ArgMatches<'a>,
    settings: &mut Config,
) -> Result<(), ConfigError> {
    let ov = vec!["database"];

    for x in ov.iter() {
        if let Some(y) = opts.value_of(x) {
            settings.set(x, y)?;
        }
    }

    Ok(())
}
