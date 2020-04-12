pub mod accounts;
pub mod analysis;
pub mod prices;
pub mod push;
pub mod static_files;
pub mod stocks;
pub mod transactions;
pub mod user;

use rocket::config::{Environment, LoggingLevel, Value};
use rocket_contrib::databases::diesel;
use std::collections::HashMap;

pub struct Config {
    pub port: u16,
    pub address: String,
    pub secret_key: Option<String>,
    pub log_level: LoggingLevel,
    pub database_url: String,
    pub application_server_key: String,
}

pub fn handle(config: Config) {
    let mut database_config = HashMap::new();
    let mut databases = HashMap::new();

    database_config.insert("url", Value::from(config.database_url.clone()));
    databases.insert("stockdb", Value::from(database_config));

    let mut rocket_config = rocket::config::Config::build(Environment::Production)
        .extra("databases", databases)
        .port(config.port)
        .address(config.address.clone())
        .log_level(config.log_level);

    if let Some(key) = config.secret_key.clone() {
        rocket_config = rocket_config.secret_key(key);
    }

    let rocket_config = rocket_config
        .finalize()
        .expect("Cannot create web server config");

    rocket::custom(rocket_config)
        .attach(DbConn::fairing())
        .manage(config)
        .mount(
            "/api/",
            routes![
                user::login,
                user::logout,
                user::info,
                accounts::list,
                accounts::get,
                transactions::list,
                transactions::get,
                transactions::delete,
                transactions::update,
                transactions::create,
                stocks::list,
                stocks::get,
                prices::list,
                analysis::compute_historic_portfolio,
                analysis::compute_realtime_portfolio,
                analysis::compute_performance,
                analysis::compute_stock_plot,
                analysis::compute_portfolio_plot,
                push::subscribe,
                push::unsubscribe,
            ],
        )
        .mount("/", routes![static_files::serve, static_files::index])
        .launch();
}

#[database("stockdb")]
pub struct DbConn(diesel::PgConnection);
