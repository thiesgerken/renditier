use crate::serialization::*;

use clap::ArgMatches;
use clap::Command;
use diesel::prelude::*;

pub fn build() -> Command {
    Command::new("export").about("exporting of data to stdout")
}

pub fn handle(connection: &mut PgConnection, _sub_matches: &ArgMatches) {
    let p = NativeFormat::new(connection);
    println!(
        "{}",
        serde_json::to_string(&p).expect("Could not serialize data")
    );
}
