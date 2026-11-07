use crate::serialization::*;

use clap::ArgAction;
use clap::ArgMatches;
use clap::{Arg, Command};
use diesel::prelude::*;
use log::warn;
use std::io;

pub fn build() -> Command {
    Command::new("import")
        .about("Importing of data via stdin")
        .long_about(
            "Importing of data via stdin.\n\n\
            A backup (as written by `export`) replaces the users it contains, matched by name: \
            an existing user with the same name loses all their accounts and transactions, \
            which are replaced by the ones from the backup. All other users stay untouched. \
            Rows get fresh ids, the ones in the backup only link its rows among each other. \
            A backup whose ids are ambiguous or dangling is rejected before anything is written, \
            and any error rolls the whole import back.",
        )
        .arg(
            Arg::new("moneydb")
                .long("moneydb")
                .action(ArgAction::SetTrue)
                .help("import from moneydb json data"),
        )
}

pub fn handle(connection: &mut PgConnection, sub_matches: &ArgMatches) {
    if *sub_matches.get_one::<bool>("moneydb").unwrap() {
        let p: MoneyDBFormat =
            serde_json::from_reader(io::stdin()).expect("Could not parse moneydb input");

        p.write_to(connection);
        warn!(
            "Successfully imported moneydb data. \
                If the database was empty, you should run \
                `renditier -v stock --fetch && renditier -v data --fetch` \
                and run the import again in order to convert transaction exchanges."
        )
    } else {
        let p: NativeFormat =
            serde_json::from_reader(io::stdin()).expect("Could not parse native input");

        if let Err(e) = p.write_to(connection) {
            panic!("Could not import backup, nothing was written: {e}");
        }
        warn!(
            "Imported from backup. You might want to run `renditier -v stock --fetch && renditier -v data --fetch` now."
        )
    }
}
