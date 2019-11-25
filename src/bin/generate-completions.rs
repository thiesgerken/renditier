use clap::{crate_authors, crate_name, crate_version, App, Arg, ArgGroup, Shell};
use std::collections::HashMap;
use std::io;

use stocks::cli;

fn main() {
    let matches = App::new(crate_name!())
        .version(crate_version!())
        .author(crate_authors!())
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
        .group(
            ArgGroup::with_name("req-flags")
                .required(true)
                .args(&["bash", "zsh"]),
        )
        .get_matches();

    if matches.is_present("bash") {
        cli::build(false).gen_completions_to(crate_name!(), Shell::Bash, &mut io::stdout());
    } else if matches.is_present("zsh") {
        cli::build(false).gen_completions_to(crate_name!(), Shell::Zsh, &mut io::stdout());
    }
}
