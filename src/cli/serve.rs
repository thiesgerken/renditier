use crate::web;

use clap::ArgMatches;
use clap::{App, SubCommand};

pub fn build() -> App<'static, 'static> {
  SubCommand::with_name("serve").about("serve web interface")
  // TODO: customize port, worker count, secret key ... via CLI and config file
  // .arg(
  //   Arg::with_name("port")
  //     .long("port")
  //     .short("p")
  //     .value_name("port")
  //     .help("customize listening port"),
  // )
}

pub fn handle(_sub_matches: &ArgMatches<'_>) {
  web::handle();
}
