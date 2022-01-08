use crate::serialization::*;

use clap::App;
use clap::ArgMatches;
use diesel::prelude::*;

pub fn build() -> App<'static> {
    App::new("export").about("exporting of data to stdout")
}

pub fn handle(connection: &PgConnection, _sub_matches: &ArgMatches) {
    let p = NativeFormat::new(connection);
    println!(
        "{}",
        serde_json::to_string(&p).expect("Could not serialize data")
    );
}
