#![feature(proc_macro_hygiene, decl_macro)]

pub mod analysis;
pub mod cli;
pub mod data;
pub mod models;
pub mod onvista;
pub mod schema;
pub mod serialization;
pub mod web;

#[macro_use]
extern crate diesel;

#[macro_use]
extern crate diesel_migrations;

#[macro_use]
extern crate rocket_contrib;

#[macro_use]
extern crate rocket;

#[macro_use]
extern crate rust_embed;

use argonautica::{Hasher, Verifier};
use diesel::pg::PgConnection;
use diesel::prelude::*;
use log::{error, info};
use std::error::Error;

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
        .unwrap_or(false)
}

pub fn hash_password(pw: &str) -> String {
    Hasher::default()
        .opt_out_of_secret_key(true)
        .configure_iterations(32)
        .with_password(pw)
        .hash()
        .unwrap()
}

#[derive(QueryableByName, Debug)]
struct StockDummy {
    #[sql_type = "diesel::sql_types::Text"]
    isin: String,
}

pub fn add_missing_stocks(connection: &PgConnection) {
    let isins = diesel::sql_query("SELECT isin FROM missing_stocks")
        .load::<StockDummy>(connection)
        .expect("Unable to find missing stocks")
        .into_iter()
        .map(|sd| sd.isin)
        .collect::<Vec<_>>();

    if isins.is_empty() {
        return;
    }

    info!("Trying to obtain stock infos for {} stocks", isins.len());

    for isin in isins.into_iter() {
        match onvista::get_info(&isin) {
            Ok((si, exs)) => {
                diesel::insert_into(crate::schema::stock_infos::table)
                    .values(&si)
                    .execute(connection)
                    .expect("Error saving stock info");

                diesel::insert_into(crate::schema::stock_exchanges::table)
                    .values(&exs)
                    .execute(connection)
                    .expect("Error saving exchanges");

                info!("Added stock {} and {} exchanges", &isin, exs.len());
            }
            Err(e) => error!("Error obtaining stock infos for {}: {}", &isin, e),
        }
    }
}
