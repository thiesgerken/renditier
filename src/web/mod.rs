pub mod accounts;
pub mod analysis;
pub mod prices;
pub mod push;
pub mod receipts;
pub mod static_files;
pub mod stocks;
pub mod transactions;
pub mod user;
mod util;

use rocket::config::LogLevel;
use rocket::data::{Limits, ToByteUnit};
use rocket::figment::util::map;
use rocket_contrib::databases::diesel;

pub struct Config {
    pub port: u16,
    pub address: String,
    pub secret_key: Option<String>,
    pub log_level: LogLevel,
    pub database_url: String,
    pub application_server_key: String,
}

pub async fn handle(config: Config) {
    let database_config = map! {"url" => config.database_url.clone()};

    let limits = Limits::new()
        .limit("forms", 64.kibibytes())
        .limit("json", 10.mebibytes());

    let mut rocket_config = rocket::config::Config::figment()
        .merge(("databases", map!["stockdb" => database_config]))
        .merge(("port", config.port))
        .merge(("address", config.address.clone()))
        .merge(("limits", limits))
        .merge(("log_level", config.log_level));

    if let Some(key) = config.secret_key.clone() {
        rocket_config = rocket_config.merge(("secret_key", key));
    }

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
                accounts::delete,
                accounts::update,
                accounts::create,
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
                receipts::upload
            ],
        )
        .mount("/", routes![static_files::serve, static_files::index])
        .launch()
        .await
        .expect("server died");
}

#[database("stockdb")]
pub struct DbConn(diesel::PgConnection);
