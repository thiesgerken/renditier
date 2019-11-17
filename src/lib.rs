pub mod models;
pub mod schema;

#[macro_use]
extern crate diesel;

#[macro_use]
extern crate diesel_migrations;

use diesel::pg::PgConnection;
use diesel::prelude::*;
use dotenv::dotenv;
use std::env;

pub fn establish_connection() -> PgConnection {
  dotenv().ok();

  let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
  PgConnection::establish(&database_url).expect(&format!("Error connecting to {}", database_url))
}

embed_migrations!();

pub fn run_migrations(
  connection: &PgConnection,
) -> Result<(), diesel_migrations::RunMigrationsError> {
  // embedded_migrations::run(&connection);
  embedded_migrations::run_with_output(connection, &mut std::io::stdout())
}
