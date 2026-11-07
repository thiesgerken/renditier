use crate::models::*;
use crate::receipts;

use chrono::{DateTime, Utc};
use clap::ArgAction;
use clap::ArgMatches;
use clap::{Arg, ArgGroup, Command};
use diesel::prelude::*;
use log::info;
use prettytable::{row, Table};
use std::io;

pub fn build() -> Command {
    Command::new("transaction")
        .about("Transaction Management")
        .arg(
            Arg::new("add")
                .long("add")
                .action(ArgAction::SetTrue)
                .help("add transaction"),
        )
        .arg(
            Arg::new("remove")
                .long("remove")
                .value_name("id")
                .help("remove transaction"),
        )
        .arg(
            Arg::new("receipts")
                .long("receipts")
                .value_name("filename")
                .num_args(1..)
                .requires("user")
                .help("import onvista receipt(s)"),
        )
        .arg(
            Arg::new("account")
                .long("account")
                .value_name("id")
                .help("account id for --list")
                .conflicts_with_all(["add", "remove", "receipts"]),
        )
        .arg(
            Arg::new("user")
                .long("user")
                .value_name("id")
                .help("user id for --receipts")
                .conflicts_with_all(["add", "remove", "list"]),
        )
        .arg(
            Arg::new("list")
                .long("list")
                .action(ArgAction::SetTrue)
                .help("list transactions"),
        )
        .group(
            ArgGroup::new("action")
                .args(["add", "remove", "list", "receipts"])
                .required(true),
        )
}

pub fn handle(connection: &mut PgConnection, sub_matches: &ArgMatches) {
    if *sub_matches.get_one::<bool>("add").unwrap() {
        let mut s_aid = String::new();
        println!("Please enter the account id for the transaction");
        io::stdin().read_line(&mut s_aid).unwrap();
        let s_aid: i32 = s_aid
            .trim_end()
            .parse()
            .expect("Could not parse account id!");
        assert!(
            crate::schema::accounts::table
                .find(&s_aid)
                .execute(connection)
                .expect("Error loading accounts")
                >= 1,
            "there is no account with id '{}'!",
            s_aid
        );

        let mut s_isin = String::new();
        println!("Please enter the ISIN for the transaction");
        io::stdin().read_line(&mut s_isin).unwrap();
        let s_isin = s_isin.trim().to_uppercase();
        assert!(s_isin.len() == 12, "ISINs always have a length of 12!");

        let mut s_exchange = String::new();
        println!("Please enter the onvista exchange ID for the transaction (or leave blank)");
        io::stdin().read_line(&mut s_exchange).unwrap();
        let s_exchange: Option<i32> = s_exchange.trim_end().parse().ok();

        let mut s_exchange_str = String::new();
        println!("Please enter the exchange name for the transaction (or leave blank)");
        io::stdin().read_line(&mut s_exchange_str).unwrap();
        let s_exchange_str: Option<String> = if s_exchange_str.is_empty() {
            None
        } else {
            Some(s_exchange_str.trim().to_owned())
        };

        let mut s_date = String::new();
        println!("Please enter the date for the transaction");
        io::stdin().read_line(&mut s_date).unwrap();
        let s_date: DateTime<Utc> = s_date.parse().expect("Could not parse date");

        let mut s_units = String::new();
        println!("Please enter the amount of units purchased (negative value -> sale)");
        io::stdin().read_line(&mut s_units).unwrap();
        let s_units: f64 = s_units.trim_end().parse().expect("Could not parse units");

        let mut s_amount = String::new();
        println!("Please enter the total price (units*price, not including fees, negative value -> sale)");
        io::stdin().read_line(&mut s_amount).unwrap();
        let s_amount = (s_amount
            .trim_end()
            .parse::<f64>()
            .expect("Could not parse price")
            * 100.0)
            .round() as i64;

        let mut s_fees = String::new();
        println!("Please enter the fees paid for this transaction");
        io::stdin().read_line(&mut s_fees).unwrap();
        let s_fees = (s_fees
            .trim_end()
            .parse::<f64>()
            .expect("Could not parse fees")
            * 100.0)
            .round() as i64;

        let mut s_comments = String::new();
        println!("Any comments on this transaction?");
        io::stdin().read_line(&mut s_comments).unwrap();
        s_comments = s_comments.trim().to_string();

        let t = NewTransaction {
            account_id: s_aid,
            isin: s_isin,
            date: s_date,
            units: s_units,
            amount: s_amount,
            fees: s_fees,
            onvista_exchange_id: s_exchange,
            comments: s_comments,
            exchange: s_exchange_str,
            receipt_number: None,
        };

        let t: Transaction = diesel::insert_into(crate::schema::transactions::table)
            .values(&t)
            .get_result(connection)
            .expect("Error saving new transaction");

        info!("Created transaction {:?}", t);
    } else if let Some(s_tid) = sub_matches.get_one::<String>("remove") {
        let s_tid: i32 = s_tid.parse().expect("Could not parse transaction id!");

        assert!(
            crate::schema::transactions::table
                .find(&s_tid)
                .execute(connection)
                .expect("Error loading transaction")
                > 0,
            "there is no transaction with id '{}'!",
            s_tid
        );

        let mut confirmation = String::new();
        println!(
            "Do you really want to delete this transaction? If so, enter '{}'.",
            s_tid
        );
        io::stdin().read_line(&mut confirmation).unwrap();
        let confirmation = confirmation.trim_end(); // Remove the trailing newline
        assert_eq!(confirmation, s_tid.to_string(), "Confirmation failed");

        diesel::delete(crate::schema::transactions::table.find(&s_tid))
            .execute(connection)
            .unwrap_or_else(|_| panic!("Unable to delete transaction {}", s_tid));

        info!("deleted transaction '{}'", s_tid);
    } else if let Some(file_names) = sub_matches.get_many::<String>("receipts") {
        let file_names = file_names.map(|s| s.as_str()).collect::<Vec<_>>();
        let uid: i32 = sub_matches
            .get_one::<String>("user")
            .unwrap()
            .parse()
            .expect("Could not parse user id!");

        receipts::parse_files(connection, uid, &file_names)
            .unwrap_or_else(|e| panic!("Error adding receipts: {:?}", e));
    } else if *sub_matches.get_one::<bool>("list").unwrap() {
        let ts = if let Some(s_aid) = sub_matches.get_one::<String>("account") {
            let s_aid: i32 = s_aid.parse().expect("Could not parse account id!");

            crate::schema::transactions::table
                .filter(crate::schema::transactions::dsl::account_id.eq(s_aid))
                .order(crate::schema::transactions::dsl::date.desc())
                .load::<Transaction>(connection)
        } else {
            crate::schema::transactions::table
                .order(crate::schema::transactions::dsl::date.desc())
                .load::<Transaction>(connection)
        }
        .expect("Error loading transactions");

        let mut table = Table::new();
        table.add_row(row![
            "ID",
            "Acc ID",
            "Date",
            "ISIN",
            "Units",
            "Total Price",
            "Exchange ID",
            "Comments"
        ]);

        for t in ts.iter() {
            table.add_row(row![
                t.id,
                t.account_id,
                t.date,
                t.isin,
                t.units,
                if t.fees != 0 {
                    format!(
                        "{:+8.2}€ {} {:5.2}€",
                        t.amount as f64 / 100.0,
                        if t.fees >= 0 { "+" } else { "-" },
                        (t.fees as f64 / 100.0).abs()
                    )
                } else {
                    format!("{:+8.2}€", t.amount as f64 / 100.0)
                },
                t.onvista_exchange_id
                    .map(|i| i.to_string())
                    .unwrap_or_default(),
                t.comments
            ]);
        }

        table.printstd();
    } else {
        panic!("unexpected options for subcommand 'transaction'");
    }
}
