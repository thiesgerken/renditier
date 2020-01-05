use crate::models::*;
use crate::schema::accounts::dsl::*;

use clap::ArgMatches;
use clap::{App, Arg, ArgGroup, SubCommand};
use diesel::prelude::*;
use log::info;
use prettytable::{cell, row, Table};
use std::io;

pub fn build() -> App<'static, 'static> {
    SubCommand::with_name("account")
        .about("Account Management")
        .arg(Arg::with_name("add").long("add").help("add account"))
        .arg(
            Arg::with_name("remove")
                .long("remove")
                .value_name("id")
                .help("remove account"),
        )
        .arg(
            Arg::with_name("update")
                .long("update")
                .value_name("id")
                .help("update account details"),
        )
        .arg(Arg::with_name("list").long("list").help("list accounts"))
        .group(
            ArgGroup::with_name("action")
                .args(&["add", "update", "remove", "list"])
                .required(true),
        )
}

pub fn handle(connection: &PgConnection, sub_matches: &ArgMatches<'_>) {
    if sub_matches.is_present("add") {
        let mut s_uid = String::new();
        println!("Please enter the user id for the new account");
        io::stdin().read_line(&mut s_uid).unwrap();
        let s_uid = s_uid.trim_end().parse().expect("Could not parse user id!");

        assert!(
            crate::schema::users::table
                .find(s_uid)
                .execute(connection)
                .expect("Error loading users")
                == 0,
            "there is no user with id '{}'!",
            s_uid
        );

        let mut s_name = String::new();
        println!("Please enter the name of the new account");
        io::stdin().read_line(&mut s_name).unwrap();
        let s_name = s_name.trim_end();

        let mut s_iban = String::new();
        println!("Please enter the IBAN of the new account");
        io::stdin().read_line(&mut s_iban).unwrap();
        let s_iban = s_iban.trim_end().to_uppercase();

        assert!(
            s_iban.len() == 22 || s_iban.is_empty(),
            "IBAN can only be empty or exactly 22 characters long!"
        );

        let a = NewAccount {
            name: s_name.to_string(),
            iban: if s_iban.is_empty() {
                None
            } else {
                Some(s_iban)
            },
            user_id: s_uid,
        };

        let a: Account = diesel::insert_into(crate::schema::accounts::table)
            .values(&a)
            .get_result(connection)
            .expect("Error saving new account");

        info!("Created account {:?}", a);
    } else if let Some(s_aid) = sub_matches.value_of("update") {
        let s_aid: i32 = s_aid.parse().expect("Could not parse account id!");
        assert!(
            crate::schema::accounts::table
                .find(s_aid)
                .execute(connection)
                .expect("Error loading accounts")
                > 0,
            "there is no account with id '{}'!",
            s_aid
        );

        let mut s_name = String::new();
        println!("Please enter a new name for the account");
        io::stdin().read_line(&mut s_name).unwrap();
        let s_name = s_name.trim_end();

        let mut s_iban = String::new();
        println!("Please enter a new IBAN for the account");
        io::stdin().read_line(&mut s_iban).unwrap();
        let s_iban = s_iban.trim_end().to_uppercase(); // Remove the trailing newline

        assert!(
            s_iban.len() == 22 || s_iban.is_empty(),
            "IBAN can only be empty or exactly 22 characters long!"
        );

        let a = diesel::update(accounts.find(s_aid))
            .set((
                name.eq(s_name),
                iban.eq(if s_iban.is_empty() {
                    None
                } else {
                    Some(s_iban)
                }),
            ))
            .get_result::<Account>(connection)
            .unwrap_or_else(|_| panic!("Unable to update account {}", s_aid));

        info!("Updated account {:?}", a);
    } else if let Some(s_aid) = sub_matches.value_of("remove") {
        let s_aid: i32 = s_aid.parse().expect("Could not parse account id!");
        let a = crate::schema::accounts::table
            .find(&s_aid)
            .load::<Account>(connection)
            .expect("Error loading accounts")
            .into_iter()
            .next()
            .unwrap_or_else(|| panic!("there is no account with id '{}'!", &s_aid));

        let mut confirmation = String::new();
        println!(
          "Do you really want to delete this account? If so, enter '{}'.\n Note that this will also delete relevant transactions!",
          a.name
      );
        io::stdin().read_line(&mut confirmation).unwrap();
        let confirmation = confirmation.trim_end(); // Remove the trailing newline
        assert_eq!(confirmation, a.name, "Confirmation failed");

        // not needed because of ON DELETE CASCADE pragmas in accounts and transaction tables
        // diesel::delete(Transaction::belonging_to(&a))
        //   .execute(connection)
        //   .expect("Unable to delete associated transactions");

        // delete account
        diesel::delete(accounts.find(&s_aid))
            .execute(connection)
            .unwrap_or_else(|_| panic!("Unable to delete account {}", &s_aid));

        info!("deleted account '{}'", s_aid);
    } else if sub_matches.is_present("list") {
        let accs = accounts
            .load::<Account>(connection)
            .expect("Error loading accounts");

        let mut table = Table::new();
        table.add_row(row!["ID", "User ID", "IBAN", "Name", "# Transactions"]);

        for a in accs.iter() {
            let transaction_count: i64 = Transaction::belonging_to(a)
                .select(diesel::dsl::count(crate::schema::transactions::dsl::id))
                .first(connection)
                .expect("Couldn't obtain associated transactions");

            table.add_row(row![
                a.id,
                a.user_id,
                a.iban.as_ref().unwrap_or(&String::new()),
                a.name,
                transaction_count
            ]);
        }

        table.printstd();
    } else {
        panic!("unexpected options for subcommand 'account'");
    }
}
