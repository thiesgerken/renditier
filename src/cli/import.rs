use crate::schema::*;
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
        .arg(
            Arg::new("moneydb")
                .long("moneydb")
                .action(ArgAction::SetTrue)
                .help("import from moneydb json data"),
        )
        .arg(
            Arg::new("clean")
                .long("clean")
                .help("clean database contents before importing (use with caution!)"),
        )
}

pub fn handle(connection: &mut PgConnection, sub_matches: &ArgMatches) {
    if *sub_matches.get_one::<bool>("clean").unwrap() {
        // diesel::delete(stock_infos::table)
        //     .execute(connection)
        //     .expect("Unable to delete stocks!");

        diesel::delete(users::table)
            .execute(connection)
            .expect("Unable to delete users!");

        warn!("removed all users, accounts and transactions.");
    }

    if *sub_matches.get_one::<bool>("moneydb").unwrap() {
        let p: MoneyDBFormat =
            serde_json::from_reader(io::stdin()).expect("Could not parse moneydb input");
        // debug!("{:?}", p);

        p.write_to(connection);
        warn!(
            "Successfully imported moneydb data. \
                If the database was empty, you should run \
                `stockdb -v stock --fetch && stockdb -v data --fetch` \
                and run the import again in order to convert transaction exchanges."
        )
    } else {
        let p: NativeFormat =
            serde_json::from_reader(io::stdin()).expect("Could not parse native input");
        // debug!("{:?}", p);

        p.write_to(connection);
        warn!(
            "Imported from backup. You might want to run `stockdb -v stock --fetch && stockdb -v data --fetch` now."
        )
    }
}
