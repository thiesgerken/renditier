use crate::serialization::*;

use clap::ArgMatches;
use clap::{App, SubCommand};
use diesel::prelude::*;

pub fn build() -> App<'static, 'static> {
    SubCommand::with_name("export").about("exporting of data to stdout")
}

pub fn handle(connection: &PgConnection, _sub_matches: &ArgMatches<'_>) {
    let p = NativeFormat::new(connection);
    println!(
        "{}",
        serde_json::to_string(&p).expect("Could not serialize data")
    );
}
