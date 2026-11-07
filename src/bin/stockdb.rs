use stockdb::cli::Config;
use stockdb::initialize_logging;
use stockdb::*;

use diesel::{
    PgConnection,
    r2d2::{ConnectionManager, Pool},
};
use log::debug;
use tokio::runtime::Builder;

fn main() {
    let runtime = Builder::new_multi_thread()
        .thread_name("stockdb-main")
        .enable_all()
        .build()
        .unwrap();

    runtime.block_on(async {
        let matches = cli::build().get_matches();
        initialize_logging(matches.get_count("v") as u32);

        // setup default settings and parse overrides from config files
        let mut settings =
            cli::initialize_settings(matches.get_one::<String>("config").cloned().as_deref());

        // parse overrides from CLI and modify settings
        settings = cli::merge_settings(&matches, settings).expect("unable to merge flags from CLI");

        let config: Config = settings
            .build()
            .expect("unable to initialize settings")
            .try_deserialize()
            .expect("unable to parse settings into Config struct");

        debug!("config={:?}", config);
        receipts::configure(&config.receipts);

        let mut connection =
            connect(&config.database).expect("error connecting and migrating to db");

        let manager = ConnectionManager::<PgConnection>::new(&config.database);
        let pool = Pool::builder().max_size(10).build(manager).unwrap();
        if *matches.get_one::<bool>("dump").unwrap() {
            println!(
                "{}",
                toml::to_string(&config).expect("unable to serialize config")
            );
        } else if let Some(sub_matches) = matches.subcommand_matches("user") {
            cli::user::handle(&mut connection, sub_matches);
        } else if let Some(sub_matches) = matches.subcommand_matches("stock") {
            cli::stock::handle(pool, sub_matches).await;
        } else if let Some(sub_matches) = matches.subcommand_matches("transaction") {
            cli::transaction::handle(&mut connection, sub_matches);
        } else if let Some(sub_matches) = matches.subcommand_matches("account") {
            cli::account::handle(&mut connection, sub_matches);
        } else if let Some(sub_matches) = matches.subcommand_matches("data") {
            cli::data::handle(pool, sub_matches).await;
        } else if let Some(sub_matches) = matches.subcommand_matches("import") {
            cli::import::handle(&mut connection, sub_matches);
        } else if let Some(sub_matches) = matches.subcommand_matches("export") {
            cli::export::handle(&mut connection, sub_matches);
        } else if let Some(sub_matches) = matches.subcommand_matches("serve") {
            std::mem::drop(connection); // `serve::handle` creates its own connections
            cli::serve::handle(
                sub_matches,
                pool,
                config.web,
                config.database,
                config.timezone,
                config.verbosity,
            )
            .await;
        } else {
            cli::build()
                .print_long_help()
                .expect("unable to print help");
            println!();
        }
    });
}
