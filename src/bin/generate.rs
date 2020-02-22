use stockdb::cli;

use clap::{crate_authors, crate_name, crate_version, App, Arg, ArgGroup, Shell};
use std::io;

fn main() {
    let matches = App::new(crate_name!())
        .version(crate_version!())
        .author(crate_authors!())
        .about("Generator of useful files for the distribution of stockdb")
        .arg(
            Arg::with_name("bash")
                .long("bash")
                .help("Outputs suitable completions for bash"),
        )
        .arg(
            Arg::with_name("zsh")
                .long("zsh")
                .help("Outputs suitable completions for zsh"),
        )
        .arg(
            Arg::with_name("config")
                .long("config")
                .help("Outputs the default config in toml format"),
        )
        .group(
            ArgGroup::with_name("req-flags")
                .required(true)
                .args(&["bash", "zsh", "config"]),
        )
        .get_matches();

    if matches.is_present("bash") {
        cli::build(false).gen_completions_to(crate_name!(), Shell::Bash, &mut io::stdout());
    } else if matches.is_present("zsh") {
        cli::build(false).gen_completions_to(crate_name!(), Shell::Zsh, &mut io::stdout());
    } else if matches.is_present("config") {
        let config: cli::Config = Default::default();

        println!(
            "{}",
            toml::to_string(&config).expect("unable to serialize default config")
        );

        println!("# [web]\n# secret_key = ")
    }
}
