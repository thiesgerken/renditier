use clap::{App, Arg};
use config::{Config, ConfigError};
use std::path::Path;

/// set default settings and load overrides from config files
/// files that are considered: basenames /etc/stockdb/config and ./config
/// fails, if additional_file does not exist or cannot be read
pub fn initialize_settings(additional_file: Option<&str>) -> Result<Config, ConfigError> {
        // Gather all conf files from conf/ manually
        let mut settings = Config::default();

        //     settings.set_default("mqtt-host", "127.0.0.1")?;

        settings.merge(config::File::with_name("./config").required(false))
                .unwrap()
                .merge(config::File::with_name("/etc/stockdb/config").required(false))
                .unwrap();

        if let Some(p) = additional_file {
                settings.merge(config::File::from(Path::new(p)).required(true))
                        .expect("unable to read config file");
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
                .help("also read configuration from this file (after considering config.yaml in '/etc/stockdb' and '.')"))
        .arg(Arg::with_name("v")
                .short("v")
                .long("verbose")
                .multiple(multiple)
                .help("specify multiple times (up to three) to increase verbosity level"))
        .arg(Arg::with_name("generate-bash-completions")
                .long("generate-bash-completions")
                .help("Outputs suitable completions for bash"))
        .arg(Arg::with_name("generate-zsh-completions")
                .long("generate-zsh-completions")
                .help("Outputs suitable completions for zsh"))
        // .arg(Arg::with_name("mqtt-host")
        //         .long("mqtt-host")
        //         .help("Host of MQTT broker [default: localhost]")
        //         .value_name("host"))

        // TODO
}

/// parse the command line flags and add them as overrides to settings
pub fn merge_settings<'a>(
        opts: &clap::ArgMatches<'a>,
        settings: &mut Config,
) -> Result<(), ConfigError> {
        let ov = vec!["mqtt-host"]; // TODO

        for x in ov.iter() {
                if let Some(y) = opts.value_of(x) {
                        settings.set(x, y)?;
                }
        }

        Ok(())
}
