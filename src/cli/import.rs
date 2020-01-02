use crate::schema::*;
use crate::serialization::*;

use clap::ArgMatches;
use clap::{App, Arg, SubCommand};
use diesel::prelude::*;
use log::{debug, warn};
use serde_json;
use std::io;

pub fn build() -> App<'static, 'static> {
    SubCommand::with_name("import")
        .about("Importing of data via stdin")
        .arg(
            Arg::with_name("moneydb")
                .long("moneydb")
                .help("import from moneydb json data"),
        )
        .arg(
            Arg::with_name("clean")
                .long("clean")
                .help("clean database contents before importing (use with caution!)"),
        )
}

pub fn handle(connection: &PgConnection, sub_matches: &ArgMatches<'_>) {
    if sub_matches.is_present("clean") {
        diesel::delete(stock_infos::table)
            .execute(connection)
            .expect("Unable to delete stocks!");

        diesel::delete(users::table)
            .execute(connection)
            .expect("Unable to delete users!");

        warn!("removed all users, accounts and transactions.");
    }

    if sub_matches.is_present("moneydb") {
        let p: MoneyDBFormat = serde_json::from_reader(io::stdin()).expect("Could not parse input");
        debug!("{:?}", p);

        p.write_to(connection);
    } else {
        let p: NativeFormat = serde_json::from_reader(io::stdin()).expect("Could not parse input");
        debug!("{:?}", p);

        p.write_to(connection);
    }

    warn!("you might want to run `stockdb -v stock --fetch && stockdb -v data --fetch`")
}
