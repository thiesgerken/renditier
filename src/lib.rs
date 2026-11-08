pub mod analysis;
pub mod api_keys;
pub mod cli;
pub mod data;
pub mod models;
pub mod onvista;
pub mod receipts;
pub mod schema;
pub mod serialization;
pub mod web;

#[macro_use]
extern crate diesel;

#[macro_use]
extern crate diesel_migrations;

#[macro_use]
extern crate rocket;

#[macro_use]
extern crate rust_embed;

use argon2::Argon2;
use argon2::password_hash::{PasswordHasher, PasswordVerifier, phc::PasswordHash};
use diesel::prelude::*;
use diesel::{
    pg::PgConnection,
    r2d2::{ConnectionManager, Pool},
};
use diesel_migrations::{EmbeddedMigrations, HarnessWithOutput, MigrationHarness};
use log::{error, info};
use simplelog::{
    ColorChoice, LevelFilter, SimpleLogger, TermLogger, TerminalMode, format_description,
};
use std::error::Error;

pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!();

pub fn connect(database_url: &str) -> Result<PgConnection, Box<dyn Error>> {
    let mut conn = PgConnection::establish(database_url)?;

    HarnessWithOutput::new(&mut conn, &mut std::io::stdout())
        .run_pending_migrations(MIGRATIONS)
        .unwrap();

    Ok(conn)
}

/// Verifies with the parameters encoded in `hash`, so hashes created with other parameters (or by
/// another argon2 implementation) keep working.
pub fn verify_password(pw: &str, hash: &str) -> bool {
    PasswordHash::new(hash).is_ok_and(|hash| {
        Argon2::default()
            .verify_password(pw.as_bytes(), &hash)
            .is_ok()
    })
}

pub fn hash_password(pw: &str) -> String {
    Argon2::default()
        .hash_password(pw.as_bytes())
        .expect("unable to hash password")
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn passwords_hashed_by_argonautica_still_verify() {
        // created by the argonautica-based hash_password (32 iterations, one lane per CPU)
        let hash = "$argon2id$v=19$m=4096,t=32,p=18$W0yj/DBbhPs1HXae6FDeGa8cIY9DzuUf8uJtH+II+AA$PbM6eIzL0BgQyQwnGcCpZlvRLUbirJR2cgs8Y/23rf0";

        assert!(verify_password("correct horse battery staple", hash));
        assert!(!verify_password("correct horse battery stapler", hash));
    }

    #[test]
    fn hashed_passwords_verify() {
        let hash = hash_password("hunter2");

        assert!(verify_password("hunter2", &hash));
        assert!(!verify_password("hunter3", &hash));
        assert_ne!(hash, hash_password("hunter2"));
    }

    #[test]
    fn malformed_hashes_do_not_verify() {
        assert!(!verify_password("hunter2", "not a hash"));
    }
}

#[derive(QueryableByName, Debug)]
struct StockDummy {
    #[diesel(sql_type = diesel::sql_types::Text)]
    isin: String,
}

pub async fn add_missing_stocks(pool: Pool<ConnectionManager<PgConnection>>) {
    let mut connection = pool.get().unwrap();

    let isins = diesel::sql_query("SELECT isin FROM missing_stocks")
        .load::<StockDummy>(&mut connection)
        .expect("Unable to find missing stocks")
        .into_iter()
        .map(|sd| sd.isin)
        .collect::<Vec<_>>();

    if isins.is_empty() {
        return;
    }

    info!("Trying to obtain stock infos for {} stocks", isins.len());

    for isin in isins.into_iter() {
        match onvista::get_info(&isin).await {
            Ok((si, exs)) => {
                diesel::insert_into(crate::schema::stock_infos::table)
                    .values(&si)
                    .execute(&mut connection)
                    .expect("Error saving stock info");

                diesel::insert_into(crate::schema::stock_exchanges::table)
                    .values(&exs)
                    .execute(&mut connection)
                    .expect("Error saving exchanges");

                info!("Added stock {} and {} exchanges", isin, exs.len());
            }
            Err(e) => error!("Error obtaining stock infos for {}: {}", isin, e),
        }
    }
}

pub fn initialize_logging(verbosity: u32) {
    let level = match verbosity {
        // 0 => LevelFilter::Warn,
        0 => LevelFilter::Info,
        1 => LevelFilter::Debug,
        _ => LevelFilter::Trace,
    };

    let mut log_config = simplelog::ConfigBuilder::new();
    log_config.set_time_format_custom(format_description!(""));

    log_config.add_filter_ignore_str("html5ever");
    log_config.add_filter_ignore_str("hyper");
    log_config.add_filter_ignore_str("reqwest");
    log_config.add_filter_ignore_str("selectors");

    // log_config.add_filter_allow_str("renditier");

    if let Err(e) = TermLogger::init(
        level,
        log_config.build(),
        TerminalMode::Mixed,
        ColorChoice::Auto,
    ) {
        SimpleLogger::init(level, log_config.build())
            .expect("TermLogger and SimpleLogger failed to init!?");
        info!(
            "Falling back to SimpleLogger because TermLogger init failed: {}",
            e
        );
    }
}
