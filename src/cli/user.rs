use crate::hash_password;
use crate::models::*;
use crate::schema::users::dsl::*;

use clap::ArgMatches;
use clap::{App, Arg, ArgGroup, SubCommand};
use diesel::prelude::*;
use log::info;
use prettytable::{cell, row, Table};
use std::io;

pub fn build() -> App<'static, 'static> {
    SubCommand::with_name("user")
        .about("User Management")
        .arg(
            Arg::with_name("add")
                .long("add")
                .value_name("name")
                .help("add user"),
        )
        .arg(
            Arg::with_name("remove")
                .long("remove")
                .value_name("name")
                .help("remove user"),
        )
        .arg(
            Arg::with_name("update")
                .long("update")
                .value_name("name")
                .help("update user name and password"),
        )
        .arg(Arg::with_name("list").long("list").help("list users"))
        .group(
            ArgGroup::with_name("action")
                .args(&["add", "update", "remove", "list"])
                .required(true),
        )
}

pub fn handle(connection: &PgConnection, sub_matches: &ArgMatches<'_>) {
    if let Some(uname) = sub_matches.value_of("add") {
        // check if this username is taken
        assert!(
            users
                .filter(name.eq(uname))
                .execute(connection)
                .expect("Error loading users")
                == 0,
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

        let u = NewUser {
            name: uname.to_string(),
            full_name: fname.to_string(),
            hash: hash_password(password),
        };

        let u: User = diesel::insert_into(crate::schema::users::table)
            .values(&u)
            .get_result(connection)
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

        let u = diesel::update(users.filter(name.eq(uname)))
            .set((full_name.eq(fname), hash.eq(hash_password(password))))
            .get_result::<User>(connection)
            .unwrap_or_else(|_| panic!("Unable to find user {}", uname));

        info!("Updated user {:?}", u);
    } else if let Some(uname) = sub_matches.value_of("remove") {
        // check if this user even exists
        assert!(
            users
                .filter(name.eq(uname))
                .execute(connection)
                .expect("Error loading users")
                > 0,
            "User does not exist"
        );

        let mut confirmation = String::new();
        println!(
          "Do you really want to delete this user? If so, enter '{}'.\n Note that this will also delete relevant accounts and transactions!",
          uname
      );
        io::stdin().read_line(&mut confirmation).unwrap();
        let confirmation = confirmation.trim_end(); // Remove the trailing newline
        assert_eq!(confirmation, uname, "Confirmation failed");

        // not needed because of ON DELETE CASCADE pragmas in accounts and transaction tables
        // delete relevant accounts and transactions
        // let accs = Account::belonging_to(&u)
        //   .get_results::<Account>(connection)
        //   .expect("Couldn't obtain associated accounts");

        // diesel::delete(Transaction::belonging_to(&accs))
        //   .execute(connection)
        //   .expect("Unable to delete associated transactions");

        // diesel::delete(Account::belonging_to(&u))
        //   .execute(connection)
        //   .expect("Unable to delete associated accounts");

        // delete user
        diesel::delete(users.filter(name.eq(uname)))
            .execute(connection)
            .unwrap_or_else(|_| panic!("Unable to delete user {}", uname));

        info!("deleted user '{}'", uname);
    } else if sub_matches.is_present("list") {
        let us = users.load::<User>(connection).expect("Error loading users");

        let mut table = Table::new();
        table.add_row(row![
            "ID",
            "Name",
            "Full Name",
            "# Accounts",
            "# Transactions"
        ]);

        let accs = Account::belonging_to(&us)
            // .select(diesel::dsl::count(crate::schema::accounts::dsl::id))
            .load::<Account>(connection)
            .expect("Couldn't obtain accounts")
            .grouped_by(&us);

        for (u, acs) in us.iter().zip(accs) {
            let transaction_count: i64 = Transaction::belonging_to(&acs)
                .select(diesel::dsl::count(crate::schema::transactions::dsl::id))
                .first(connection)
                .expect("Couldn't obtain associated transactions");

            table.add_row(row![
                u.id,
                u.name,
                u.full_name,
                acs.len(),
                transaction_count
            ]);
        }

        table.printstd();
    } else {
        panic!("unexpected options for subcommand 'user'");
    }
}
