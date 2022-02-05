use stockdb::cli;

use clap::{crate_authors, crate_name, crate_version, App, Arg, ArgGroup};
use clap_complete::{generate, Generator, Shell};
use std::io;

fn print_completions<G: Generator>(gen: G, app: &mut App) {
    generate(gen, app, app.get_name().to_string(), &mut io::stdout());
}

fn main() {
    let matches = App::new(crate_name!())
        .version(crate_version!())
        .author(crate_authors!())
        .about("Generator of useful files for the distribution of stockdb")
        .arg(
            Arg::new("generator")
                .long("shell")
                .help("Generate autocompletion files for the specified shell")
                .possible_values(Shell::possible_values()),
        )
        .arg(
            Arg::new("config")
                .long("config")
                .help("Outputs the default config in toml format"),
        )
        .group(
            ArgGroup::new("req-flags")
                .required(true)
                .args(&["generator", "config"]),
        )
        .get_matches();

    if matches.is_present("config") {
        let config: cli::Config = Default::default();

        println!(
            "{}",
            toml::to_string(&config).expect("unable to serialize default config")
        );
    } else if let Ok(generator) = matches.value_of_t::<Shell>("generator") {
        let mut app = cli::build();
        eprintln!("Generating completion file for {}...", generator);
        print_completions(generator, &mut app);
    }
}
