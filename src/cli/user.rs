use crate::models::*;
use crate::schema::users::dsl::*;
use crate::{generate_token, hash_password, hash_token};

use clap::ArgAction;
use clap::ArgMatches;
use clap::{Arg, ArgGroup, Command};
use diesel::prelude::*;
use log::info;
use prettytable::{Table, row};
use std::io;

pub fn build() -> Command {
    Command::new("user")
        .about("User Management")
        .arg(
            Arg::new("add")
                .long("add")
                .value_name("name")
                .help("add user"),
        )
        .arg(
            Arg::new("remove")
                .long("remove")
                .value_name("name")
                .help("remove user"),
        )
        .arg(
            Arg::new("update")
                .long("update")
                .value_name("name")
                .help("update user name and password"),
        )
        .arg(
            Arg::new("token")
                .long("token")
                .value_name("name")
                .help("issue an API token for a user, replacing any existing one"),
        )
        .arg(
            Arg::new("revoke-token")
                .long("revoke-token")
                .value_name("name")
                .help("revoke a user's API token"),
        )
        .arg(
            Arg::new("list")
                .long("list")
                .action(ArgAction::SetTrue)
                .help("list users"),
        )
        .group(
            ArgGroup::new("action")
                .args(["add", "update", "remove", "token", "revoke-token", "list"])
                .required(true),
        )
}

pub fn handle(connection: &mut PgConnection, sub_matches: &ArgMatches) {
    if let Some(uname) = sub_matches.get_one::<String>("add") {
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
    } else if let Some(uname) = sub_matches.get_one::<String>("update") {
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
    } else if let Some(uname) = sub_matches.get_one::<String>("token") {
        let token = generate_token();

        let u = diesel::update(users.filter(name.eq(uname)))
            .set(api_token_hash.eq(Some(hash_token(&token))))
            .get_result::<User>(connection)
            .unwrap_or_else(|_| panic!("Unable to find user {}", uname));

        // The token is stored as a hash, so this line is the only chance anyone has to read it.
        println!("{}", token);
        info!(
            "Issued an API token for user '{}'; it is shown here once and nowhere again. Issuing another one replaces it.",
            u.name
        );
    } else if let Some(uname) = sub_matches.get_one::<String>("revoke-token") {
        let u = diesel::update(users.filter(name.eq(uname)))
            .set(api_token_hash.eq(None::<String>))
            .get_result::<User>(connection)
            .unwrap_or_else(|_| panic!("Unable to find user {}", uname));

        info!("Revoked the API token of user '{}'", u.name);
    } else if let Some(uname) = sub_matches.get_one::<String>("remove") {
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
        assert_eq!(confirmation, *uname, "Confirmation failed");

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
    } else if *sub_matches.get_one::<bool>("list").unwrap() {
        let us = users.load::<User>(connection).expect("Error loading users");

        let mut table = Table::new();
        table.add_row(row![
            "ID",
            "Name",
            "Full Name",
            "API Token",
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
                if u.api_token_hash.is_some() {
                    "issued"
                } else {
                    "-"
                },
                acs.len(),
                transaction_count
            ]);
        }

        table.printstd();
    } else {
        panic!("unexpected options for subcommand 'user'");
    }
}
