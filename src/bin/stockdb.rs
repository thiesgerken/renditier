#[macro_use]
extern crate log;

use chrono::{DateTime, NaiveDate, Utc};

use std::collections::HashMap;
use std::error::Error;
use std::io;

use stocks::models::*;
use stocks::*;

use diesel::prelude::*;

#[macro_use]
extern crate prettytable;
use prettytable::{Row, Table};

fn main() {
    let matches = cli::build(true).get_matches();

    // initialize logging
    let level = match matches.occurrences_of("v") {
        0 => simplelog::LevelFilter::Warn,
        1 => simplelog::LevelFilter::Info,
        2 => simplelog::LevelFilter::Debug,
        _ => simplelog::LevelFilter::Trace,
    };

    let mut log_config = simplelog::ConfigBuilder::new();
    log_config.set_time_format_str("");

    if let Err(e) =
        simplelog::TermLogger::init(level, log_config.build(), simplelog::TerminalMode::Mixed)
    {
        simplelog::SimpleLogger::init(level, log_config.build())
            .expect("TermLogger and SimpleLogger failed to init!?");
        info!(
            "Falling back to SimpleLogger because TermLogger init failed: {}",
            e
        );
    }

    // setup default settings and parse overrides from config files
    let mut settings = cli::initialize_settings(matches.value_of("config"))
        .expect("unable to initialize settings");

    // parse overrides from CLI and modify settings
    cli::merge_settings(&matches, &mut settings).expect("unable to merge flags from CLI");

    debug!(
        "settings={:?}",
        settings
            .clone()
            .try_into::<HashMap<String, String>>()
            .unwrap()
    );

    let database_url = settings.get_str("database").unwrap();
    let connection = connect(&database_url).expect("error connecting and migrating to db");

    // You can get the independent subcommand matches (which function exactly like App matches)
    if let Some(ref sub_matches) = matches.subcommand_matches("user") {
        // cli::user::handle(&connection, sub_matches);

        use stocks::schema::users::dsl::*;

        if let Some(uname) = sub_matches.value_of("add") {
            // check if this username is taken
            assert!(
                users
                    .filter(name.eq(uname))
                    .load::<User>(&connection)
                    .expect("Error loading users")
                    .iter()
                    .next()
                    .is_none(),
                "there is already a user with name '{}'!",
                uname
            );

            let mut fname = String::new();
            println!("Please enter the full name of the new user");
            io::stdin().read_line(&mut fname).unwrap();
            let fname = fname.trim_end(); // Remove the trailing newline

            let mut password = String::new();
            println!("Please enter a password for the new user");
            io::stdin().read_line(&mut password).unwrap();
            let password = password.trim_end(); // Remove the trailing newline

            assert!(
                password.len() >= 8,
                "Password has to be at least 8 characters long!"
            );

            let mut password_repeat = String::new();
            println!("Please repeat the password");
            io::stdin().read_line(&mut password_repeat).unwrap();
            let password_repeat = password_repeat.trim_end(); // Remove the trailing newline

            assert_eq!(password, password_repeat, "Passwords do not match!");

            let u = NewUser {
                name: uname.to_string(),
                full_name: fname.to_string(),
                hash: hash_password(password),
            };

            let u: User = diesel::insert_into(stocks::schema::users::table)
                .values(&u)
                .get_result(&connection)
                .expect("Error saving new user");

            info!("Created user {:?}", u);
        } else if let Some(uname) = sub_matches.value_of("update") {
            let mut fname = String::new();
            println!("Please enter a new full name of the user");
            io::stdin().read_line(&mut fname).unwrap();
            let fname = fname.trim_end(); // Remove the trailing newline

            let mut password = String::new();
            println!("Please enter a new password for the user");
            io::stdin().read_line(&mut password).unwrap();
            let password = password.trim_end(); // Remove the trailing newline

            assert!(
                password.len() >= 8,
                "Password has to be at least 8 characters long!"
            );

            let mut password_repeat = String::new();
            println!("Please repeat the password");
            io::stdin().read_line(&mut password_repeat).unwrap();
            let password_repeat = password_repeat.trim_end(); // Remove the trailing newline

            assert_eq!(password, password_repeat, "Passwords do not match!");

            let u = diesel::update(users.filter(name.eq(uname)))
                .set((full_name.eq(fname), hash.eq(hash_password(password))))
                .get_result::<User>(&connection)
                .expect(&format!("Unable to find user {}", uname));

            info!("Updated user {:?}", u);
        } else if let Some(uname) = sub_matches.value_of("remove") {
            // check if this user even exists
            users
                .filter(name.eq(uname))
                .load::<User>(&connection)
                .expect("Error loading users")
                .iter()
                .next()
                .expect("User does not exist");

            let mut confirmation = String::new();
            println!(
            "Do you really want to delete this user? If so, enter '{}'.\n Note that this will also delete relevant accounts and transactions!",
            uname
        );
            io::stdin().read_line(&mut confirmation).unwrap();
            let confirmation = confirmation.trim_end(); // Remove the trailing newline
            assert_eq!(confirmation, uname, "Confirmation failed");

            // TODO: also delete relevant accounts and transactions

            diesel::delete(users.filter(name.eq(uname)))
                .execute(&connection)
                .expect(&format!("Unable to delete user {}", uname));

            info!("deleted user '{}'", uname);
        } else if sub_matches.is_present("list") {
            let us = users
                .load::<User>(&connection)
                .expect("Error loading users");

            let mut table = Table::new();
            table.add_row(row!["ID", "Name", "Full Name"]);

            for u in us {
                // TODO: show more details like number of transactions / accounts
                table.add_row(row![u.id, u.name, u.full_name]);
            }

            table.printstd();
        } else {
            panic!("unexpected options for subcommand 'user'");
        }
    } else if let Some(ref sub_matches) = matches.subcommand_matches("stock") {
        use stocks::schema::historical_prices::dsl::*;
        use stocks::schema::realtime_prices::dsl::*;
        use stocks::schema::stock_exchanges::dsl::*;
        use stocks::schema::stock_infos::dsl::*;

        if let Some(isin_) = sub_matches.value_of("add") {
            let isin_ = isin_.to_uppercase();
            assert!(isin_.len() == 12, "ISINs always have a length of 12");

            let exists = stock_infos
                .filter(stocks::schema::stock_infos::dsl::isin.eq(&isin_))
                .load::<StockInfo>(&connection)
                .expect("Error loading stock infos")
                .iter()
                .next()
                .is_some();

            if exists {
                println!(
                    "ISIN {} is already on the watch list, setting as persistent.",
                    isin_
                );

                diesel::update(
                    stock_infos.filter(stocks::schema::stock_infos::dsl::isin.eq(&isin_)),
                )
                .set(persistent.eq(true))
                .get_result::<StockInfo>(&connection)
                .expect(&format!("Unable to find ISIN {}", &isin_));

                info!("Set stock {:?} as persistent", &isin_);
            } else {
                match onvista::get_info(&isin_) {
                    Ok((si, exs)) => {
                        let si = StockInfo {
                            persistent: true,
                            ..si
                        };

                        diesel::insert_into(stocks::schema::stock_infos::table)
                            .values(&si)
                            .execute(&connection)
                            .expect("Error saving stock info");

                        diesel::insert_into(stocks::schema::stock_exchanges::table)
                            .values(&exs)
                            .execute(&connection)
                            .expect("Error saving exchanges");

                        info!("Added stock {} and {} exchanges", &isin_, exs.len());
                    }
                    Err(e) => error!("Error obtaining stock infos: {}", e),
                }
            }
        } else if let Some(isin_) = sub_matches.value_of("update") {
            let isin_ = isin_.to_uppercase();
            assert!(isin_.len() == 12, "ISINs always have a length of 12");

            let exists = stock_infos
                .filter(stocks::schema::stock_infos::dsl::isin.eq(&isin_))
                .load::<StockInfo>(&connection)
                .expect("Error loading stock infos")
                .iter()
                .next()
                .is_some();

            assert!(exists, "Unknown ISINs!");

            match onvista::get_info(&isin_) {
                Ok((si, exs)) => {
                    diesel::delete(
                        stock_infos.filter(stocks::schema::stock_infos::dsl::isin.eq(&isin_)),
                    )
                    .execute(&connection)
                    .expect(&format!("Unable to delete old infos for {}", &isin_));

                    diesel::insert_into(stocks::schema::stock_infos::table)
                        .values(&si)
                        .execute(&connection)
                        .expect("Error saving new stock info");

                    let exs_old = stock_exchanges
                        .filter(stocks::schema::stock_exchanges::dsl::isin.eq(&isin_))
                        .load::<StockExchange>(&connection)
                        .expect("Error loading stock exchanges")
                        .into_iter()
                        .map(|e| e.onvista_record_id);

                    // find out which exchanges do not exist anymore
                    let deleted = exs_old
                        .filter(|e| exs.iter().any(|e_| e == &e_.onvista_record_id))
                        .collect::<Vec<_>>();

                    // .. and delete there price histories
                    diesel::delete(
                        historical_prices.filter(
                            stocks::schema::historical_prices::dsl::onvista_record_id
                                .eq_any(deleted.clone()),
                        ),
                    )
                    .execute(&connection)
                    .expect("Unable to delete price information of deleted exchanges");

                    diesel::delete(
                        realtime_prices.filter(
                            stocks::schema::realtime_prices::dsl::onvista_record_id
                                .eq_any(deleted.clone()),
                        ),
                    )
                    .execute(&connection)
                    .expect("Unable to delete price information of deleted exchanges");

                    // delete all exchange data
                    diesel::delete(
                        stock_exchanges
                            .filter(stocks::schema::stock_exchanges::dsl::isin.eq(&isin_)),
                    )
                    .execute(&connection)
                    .expect("Unable to delete old exchange data");

                    // and replace with the new data
                    diesel::insert_into(stocks::schema::stock_exchanges::table)
                        .values(&exs)
                        .execute(&connection)
                        .expect("Error saving new exchange data");

                    info!(
                        "Updated stock {} and {} exchanges, deleted {} exchanges",
                        &isin_,
                        exs.len(),
                        deleted.len()
                    );
                }
                Err(e) => error!("Error obtaining stock infos: {}", e),
            }
        } else if let Some(isin_) = sub_matches.value_of("remove") {
            let isin_ = isin_.to_uppercase();
            assert!(isin_.len() == 12, "ISINs always have a length of 12");

            // check if this stock even exists in the database
            stock_infos
                .filter(stocks::schema::stock_infos::dsl::isin.eq(&isin_))
                .load::<StockInfo>(&connection)
                .expect("Error loading stock infos")
                .iter()
                .next()
                .expect("Stock is not watched");

            let mut confirmation = String::new();
            println!(
                "Do you really want to delete this stock info? (It might appear again automatically!) If so, enter '{}'",
                &isin_
            );
            io::stdin().read_line(&mut confirmation).unwrap();
            let confirmation = confirmation.trim_end(); // Remove the trailing newline
            assert_eq!(confirmation, isin_, "Confirmation failed");

            // delete relevant prices and exchanges
            let exs = stock_exchanges
                .filter(stocks::schema::stock_exchanges::dsl::isin.eq(&isin_))
                .load::<StockExchange>(&connection)
                .expect("Error loading stock exchanges")
                .into_iter()
                .map(|e| e.onvista_record_id)
                .collect::<Vec<_>>();

            diesel::delete(historical_prices.filter(
                stocks::schema::historical_prices::dsl::onvista_record_id.eq_any(exs.clone()),
            ))
            .execute(&connection)
            .expect("Unable to delete price information");

            diesel::delete(realtime_prices.filter(
                stocks::schema::realtime_prices::dsl::onvista_record_id.eq_any(exs.clone()),
            ))
            .execute(&connection)
            .expect("Unable to delete price information");

            // delete all exchange data
            diesel::delete(
                stock_exchanges.filter(stocks::schema::stock_exchanges::dsl::isin.eq(&isin_)),
            )
            .execute(&connection)
            .expect("Unable to delete exchange data");

            // finally: delete stock info
            diesel::delete(stock_infos.filter(stocks::schema::stock_infos::dsl::isin.eq(&isin_)))
                .execute(&connection)
                .expect(&format!("Unable to delete stock {}", &isin_));

            info!("deleted stock '{}', its exchanges and price data", isin_);
        } else if sub_matches.is_present("list") {
            let sis = stock_infos
                .load::<StockInfo>(&connection)
                .expect("Error loading stock infos");

            let mut table = Table::new();
            table.add_row(row![
                "Title",
                "ISIN",
                "WKN",
                "# Exchanges",
                "# Historical",
                "# Realtime"
            ]);

            for si in sis {
                let row =
                    add_stock_infos(&connection, si).expect("could not load stock infos from db");
                table.add_row(row);
            }

            table.printstd();
        } else {
            panic!("unexpected options for subcommand 'stock'");
        }
    } else {
        cli::build(true)
            .print_long_help()
            .expect("unable to print help");
        println!();
    }
}

fn add_stock_infos(connection: &PgConnection, si: StockInfo) -> Result<Row, Box<dyn Error>> {
    use stocks::schema::historical_prices::dsl::*;
    use stocks::schema::realtime_prices::dsl::*;
    use stocks::schema::stock_exchanges::dsl::*;

    let exs = stock_exchanges
        .filter(stocks::schema::stock_exchanges::dsl::isin.eq(&si.isin))
        .load::<StockExchange>(connection)?
        .into_iter()
        .map(|e| e.onvista_record_id)
        .collect::<Vec<_>>();

    let num_hist: i64 = historical_prices
        .select(diesel::dsl::count(
            stocks::schema::historical_prices::dsl::onvista_record_id,
        ))
        .filter(stocks::schema::historical_prices::dsl::onvista_record_id.eq_any(exs.clone()))
        .first(connection)?;

    let first_hist: Option<NaiveDate> = historical_prices
        .select(diesel::dsl::min(
            stocks::schema::historical_prices::dsl::date,
        ))
        .filter(stocks::schema::historical_prices::dsl::onvista_record_id.eq_any(exs.clone()))
        .first(connection)?;

    let last_hist: Option<NaiveDate> = historical_prices
        .select(diesel::dsl::max(
            stocks::schema::historical_prices::dsl::date,
        ))
        .filter(stocks::schema::historical_prices::dsl::onvista_record_id.eq_any(exs.clone()))
        .first(connection)?;

    let num_realtime: i64 = realtime_prices
        .select(diesel::dsl::count(
            stocks::schema::realtime_prices::dsl::onvista_record_id,
        ))
        .filter(stocks::schema::realtime_prices::dsl::onvista_record_id.eq_any(exs.clone()))
        .first(connection)?;

    let first_realtime: Option<DateTime<Utc>> = realtime_prices
        .select(diesel::dsl::min(stocks::schema::realtime_prices::dsl::date))
        .filter(stocks::schema::realtime_prices::dsl::onvista_record_id.eq_any(exs.clone()))
        .first(connection)?;

    let last_realtime: Option<DateTime<Utc>> = realtime_prices
        .select(diesel::dsl::max(stocks::schema::realtime_prices::dsl::date))
        .filter(stocks::schema::realtime_prices::dsl::onvista_record_id.eq_any(exs.clone()))
        .first(connection)?;

    let hist_str = if num_hist == 0 {
        "0".to_owned()
    } else {
        format!(
            "{} from {:?} to {:?}",
            num_hist,
            first_hist.unwrap(),
            last_hist.unwrap()
        )
    };

    let realtime_str = if num_realtime == 0 {
        "0".to_owned()
    } else {
        format!(
            "{} from {:?} to {:?}",
            num_hist,
            first_realtime.unwrap(),
            last_realtime.unwrap()
        )
    };

    Ok(row![
        si.title,
        si.isin,
        si.wkn,
        exs.len().to_string(),
        hist_str,
        realtime_str
    ])
}
