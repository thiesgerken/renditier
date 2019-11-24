pub mod models;
pub mod onvista;
pub mod schema;

#[macro_use]
extern crate diesel;

#[macro_use]
extern crate diesel_migrations;

use diesel::pg::PgConnection;
use diesel::prelude::*;
use std::error::Error;

embed_migrations!();

pub fn connect(database_url: &str) -> Result<PgConnection, Box<dyn Error>> {
    let conn = PgConnection::establish(&database_url)?;

    // embedded_migrations::run(&conn);
    embedded_migrations::run_with_output(&conn, &mut std::io::stdout())?;

    Ok(conn)
}
