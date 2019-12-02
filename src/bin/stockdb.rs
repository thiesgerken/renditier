#[macro_use]
extern crate log;

use std::collections::HashMap;
use std::io;

use stocks::models::*;
use stocks::schema::stock_infos::dsl::*;
use stocks::*;

use diesel::prelude::*;

#[macro_use]
extern crate prettytable;
use prettytable::Table;

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
            let _ = users
                .filter(name.eq(uname))
                .load::<User>(&connection)
                .expect("Error loading users")
                .iter()
                .next()
                .expect("User does not exist");

            let mut confirmation = String::new();
            println!(
                "Do you really want to delete this user? If so, enter '{}'",
                uname
            );
            io::stdin().read_line(&mut confirmation).unwrap();
            let confirmation = confirmation.trim_end(); // Remove the trailing newline
            assert_eq!(confirmation, uname, "Confirmation failed");

            // TODO: also delete relevant accounts and transactions

            let cnt = diesel::delete(users.filter(name.eq(uname)))
                .execute(&connection)
                .expect(&format!("Unable to delete user {}", uname));

            info!("deleted {} user '{}'", cnt, uname);
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
            panic!("unexpected flags for subcommand 'user'");
        }
    } else if let Some(ref sub_matches) = matches.subcommand_matches("stock") {
        // if let Some(name) = sub_matches.value_of("add") {
        //     // TODO: check if user exists, ask for real name and password (salt+hash it, save random salt)
        //     unimplemented!();
        // } else if let Some(name) = sub_matches.value_of("remove") {
        //     // TODO: check if user exists, ask for confirmation and possibly delete the user, his accounts and transactions
        //     unimplemented!();
        // } else
        if sub_matches.is_present("list") {
            let results = stock_infos
                // .filter(published.eq(true))
                // .limit(5)
                .load::<StockInfo>(&connection)
                .expect("Error loading stock infos");

            println!("Displaying {} stock infos", results.len());
            for stock in results {
                println!("{}", stock.title);
                println!("----------\n");
                // println!("{}", post.body);
            }

            // TODO: print list of stocks in database (id, name, wkn/isin, #prices, persistent), use https://crates.io/crates/prettytable-rs
            unimplemented!();
        } else {
            panic!("unexpected flags for subcommand 'stock'");
        }
    } else {
        cli::build(true)
            .print_long_help()
            .expect("unable to print help");
        println!();
    }
}
