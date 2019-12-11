#[macro_use]
extern crate diesel;

#[macro_use]
extern crate diesel_migrations;

#[macro_use]
extern crate log;

#[macro_use]
extern crate prettytable;

use argonautica::{Hasher, Verifier};
use diesel::pg::PgConnection;
use diesel::prelude::*;
use std::error::Error;

pub mod cli;
pub mod models;
pub mod onvista;
pub mod schema;

embed_migrations!();

pub fn connect(database_url: &str) -> Result<PgConnection, Box<dyn Error>> {
        let conn = PgConnection::establish(&database_url)?;

        // embedded_migrations::run(&conn);
        embedded_migrations::run_with_output(&conn, &mut std::io::stdout())?;

        Ok(conn)
}

pub fn verify_password(pw: &str, hash: &str) -> bool {
        Verifier::default()
                .with_hash(hash)
                .with_password(pw)
                .verify()
                .unwrap()
}

pub fn hash_password(pw: &str) -> String {
        Hasher::default()
                .opt_out_of_secret_key(true)
                .with_password(pw)
                .hash()
                .unwrap()
}
