pub mod analysis;
pub mod cli;
pub mod data;
pub mod models;
pub mod onvista;
pub mod receipts;
pub mod schema;
pub mod serialization;
pub mod service;
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
use base64::Engine;
use base64::prelude::BASE64_URL_SAFE_NO_PAD;
use diesel::prelude::*;
use diesel::{
    pg::PgConnection,
    r2d2::{ConnectionManager, Pool},
};
use diesel_migrations::{EmbeddedMigrations, HarnessWithOutput, MigrationHarness};
use log::{error, info};
use sha2::{Digest, Sha256};
use simplelog::{
    ColorChoice, LevelFilter, SimpleLogger, TermLogger, TerminalMode, format_description,
};
use std::error::Error;
use std::fs::File;
use std::io::Read;

pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!();

pub fn connect(database_url: &str) -> Result<PgConnection, Box<dyn Error>> {
    let mut conn = PgConnection::establish(database_url)?;

    HarnessWithOutput::new(&mut conn, &mut std::io::stdout())
        .run_pending_migrations(MIGRATIONS)
        .unwrap();

    Ok(conn)
}

/// A connection to the scratch database in `RENDITIER_TEST_DATABASE`, for tests marked `#[ignore]`.
#[cfg(test)]
pub(crate) fn test_connection() -> PgConnection {
    // Tests run in parallel, and two of them migrating a fresh database at once collide in the
    // Postgres catalog.
    static MIGRATING: std::sync::Mutex<()> = std::sync::Mutex::new(());

    let url = std::env::var("RENDITIER_TEST_DATABASE").expect("RENDITIER_TEST_DATABASE not set");
    let _guard = MIGRATING.lock().unwrap();
    connect(&url).unwrap()
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

/// A fresh API token, url-safe so it survives a shell and a header untouched. Only its hash is
/// ever stored, so this is the one moment the caller can see it.
pub fn generate_token() -> String {
    let mut bytes = [0u8; 32];

    // ponytail: /dev/urandom rather than a rng crate. Unix only, which is where this runs; swap
    // in getrandom if that ever stops being true.
    File::open("/dev/urandom")
        .and_then(|mut f| f.read_exact(&mut bytes))
        .expect("Unable to read from /dev/urandom");

    BASE64_URL_SAFE_NO_PAD.encode(bytes)
}

/// SHA-256 rather than the password hasher, on purpose. A token is 32 bytes of randomness, so
/// there is no dictionary to walk and nothing for a slow hash to defend; argon2's cost exists to
/// make guessing human-chosen passwords expensive, and here it would be paid on every single API
/// request instead of once per login. A plain digest also means the lookup is an index hit rather
/// than a verify against every user's hash in turn.
pub fn hash_token(token: &str) -> String {
    // Written out byte by byte rather than through `{:x}`: sha2 0.10 handed back a
    // `GenericArray`, which implements `LowerHex`, and 0.11 hands back a `hybrid_array::Array`,
    // which does not. Both are a `[u8]`, so this survives the next such swap -- and the test
    // below is what catches it if the digest itself ever changes shape.
    Sha256::digest(token.as_bytes())
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
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

    #[test]
    fn tokens_are_random_and_long_enough() {
        let a = generate_token();
        let b = generate_token();

        assert_ne!(a, b);
        assert_eq!(BASE64_URL_SAFE_NO_PAD.decode(&a).unwrap().len(), 32);
    }

    #[test]
    fn token_hashing_is_sha256() {
        assert_eq!(
            hash_token("abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
        assert_ne!(hash_token("abc"), hash_token("abd"));
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
