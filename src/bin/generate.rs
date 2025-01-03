use stockdb::cli;

use clap::{crate_authors, crate_name, crate_version, Arg, ArgAction, ArgGroup, Command};
use clap_complete::{generate, Generator, Shell};
use std::io;

fn print_completions<G: Generator>(gen: G, app: &mut Command) {
    generate(gen, app, app.get_name().to_string(), &mut io::stdout());
}

fn main() {
    let matches = Command::new(crate_name!())
        .version(crate_version!())
        .author(crate_authors!())
        .about("Generator of useful files for the distribution of stockdb")
        .arg(
            Arg::new("generator")
                .long("shell")
                .help("Generate autocompletion files for the specified shell")
                .value_parser(clap::value_parser!(Shell)),
        )
        .arg(
            Arg::new("config")
                .long("config")
                .action(ArgAction::SetTrue)
                .help("Outputs the default config in toml format"),
        )
        .group(
            ArgGroup::new("req-flags")
                .required(true)
                .args(["generator", "config"]),
        )
        .get_matches();

    if *matches.get_one::<bool>("config").unwrap() {
        let config: cli::Config = Default::default();

        println!(
            "{}",
            toml::to_string(&config).expect("unable to serialize default config")
        );
    } else if let Some(generator) = matches.get_one::<Shell>("generator") {
        let mut app = cli::build();
        eprintln!("Generating completion file for {}...", generator);
        print_completions(*generator, &mut app);
    }
}
