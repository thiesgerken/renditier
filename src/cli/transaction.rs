use crate::models::*;

use chrono::{DateTime, Local, TimeZone, Utc};
use clap::ArgMatches;
use clap::{App, Arg, ArgGroup, SubCommand};
use diesel::prelude::*;
use log::info;
use prettytable::{cell, row, Table};
use regex::Regex;
use std::error::Error;
use std::io;
use std::path::Path;
use std::str::FromStr;

pub fn build() -> App<'static, 'static> {
    SubCommand::with_name("transaction")
        .about("Transaction Management")
        .arg(Arg::with_name("add").long("add").help("add transaction"))
        .arg(
            Arg::with_name("remove")
                .long("remove")
                .value_name("id")
                .help("remove transaction"),
        )
        .arg(
            Arg::with_name("receipt")
                .long("receipt")
                .value_name("filename")
                .requires("account")
                .min_values(1)
                .help("import an onvista receipt"),
        )
        .arg(
            Arg::with_name("account")
                .long("account")
                .value_name("id")
                .help("account id for --list and --receipt")
                .conflicts_with_all(&["add", "remove"]),
        )
        .arg(
            Arg::with_name("list")
                .long("list")
                .help("list transactions"),
        )
        .group(
            ArgGroup::with_name("action")
                .args(&["add", "remove", "list", "receipt"])
                .required(true),
        )
}

pub fn handle(connection: &PgConnection, sub_matches: &ArgMatches<'_>) {
    if sub_matches.is_present("add") {
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
            &s_aid
        );

        let mut s_isin = String::new();
        println!("Please enter the ISIN for the transaction");
        io::stdin().read_line(&mut s_isin).unwrap();
        let s_isin = s_isin.trim().to_uppercase();
        assert!(s_isin.len() == 12, "ISINs always have a length of 12!");

        let mut s_exchange = String::new();
        println!("Please enter the onvista exchange ID for the transaction (or leave blank)");
        io::stdin().read_line(&mut s_exchange).unwrap();
        let s_exchange: Option<i32> = s_exchange.parse().ok();

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
        let s_units: f64 = s_units.parse().expect("Could not parse units");

        let mut s_amount = String::new();
        println!("Please enter the total price (units*price, not including fees, negative value -> sale)");
        io::stdin().read_line(&mut s_amount).unwrap();
        let s_amount =
            (s_amount.parse::<f64>().expect("Could not parse price") * 100.0).round() as i64;

        let mut s_fees = String::new();
        println!("Please enter the fees paid for this transaction");
        io::stdin().read_line(&mut s_fees).unwrap();
        let s_fees = (s_fees.parse::<f64>().expect("Could not parse fees") * 100.0).round() as i64;

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
    } else if let Some(s_tid) = sub_matches.value_of("remove") {
        let s_tid: i32 = s_tid.parse().expect("Could not parse transaction id!");

        assert!(
            crate::schema::transactions::table
                .find(&s_tid)
                .execute(connection)
                .expect("Error loading transaction")
                > 0,
            "there is no transaction with id '{}'!",
            &s_tid
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
            .unwrap_or_else(|_| panic!("Unable to delete transaction {}", &s_tid));

        info!("deleted transaction '{}'", s_tid);
    } else if let Some(file_names) = sub_matches.values_of("receipt") {
        let account_id = sub_matches
            .value_of("account")
            .expect("no account id")
            .parse()
            .expect("unable to parse account id");

        let mut ts = file_names
            .flat_map(|file_name| {
                let xs = parse_receipt(Path::new(&file_name), account_id)
                    .unwrap_or_else(|e| panic!("error parsing file {}: {:?}", file_name, e));

                info!(
                    "found {} transaction(s) in pdf file {}",
                    xs.len(),
                    file_name
                );
                xs
            })
            .collect::<Vec<_>>();

        for t in ts {
            info!("{:?}", t);
        }

    // let isins = ts
    //     .iter()
    //     .map(|t| t.content.isin.clone())
    //     .collect::<Vec<_>>();
    // let exs = crate::schema::stock_exchanges::table
    //     .filter(crate::schema::stock_exchanges::dsl::isin.eq_any(&isins))
    //     .load::<StockExchange>(connection)
    //     .expect("Error loading stock exchanges");

    // TODO: find out if one of the receipt ids already exists, warn the user about them and remove them from the list

    // for t in ts.iter_mut() {}

    // TODO: be able to parse Erträgnisgutschriften

    // TODO: try to replace the exchange with an exchange id (unless over the counter)

    // TODO: insert stuff into db
    } else if sub_matches.is_present("list") {
        let ts = if let Some(s_aid) = sub_matches.value_of("account") {
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

#[derive(Debug)]
pub struct ParsedTransaction {
    pub content: NewTransaction,
    pub account_number: u64,
    pub over_the_counter: bool,
}

pub fn parse_receipt(
    path: &Path,
    account_id: i32,
) -> Result<Vec<ParsedTransaction>, Box<dyn Error>> {
    let mut buffer = Vec::<u8>::new();
    let doc = lopdf::Document::load(path)?;
    pdf_extract::output_doc(
        &doc,
        Box::new(pdf_extract::PlainTextOutput::new(
            &mut buffer as &mut dyn std::io::Write,
        ))
        .as_mut(),
    )?;
    let body = std::str::from_utf8(&buffer)?.to_owned();

    let mut ts = Vec::new();
    let re_page =
        Regex::new(r"Abrechnungs-Nr.[\s\S]+?onvista bank ist eine Marke der comdirect bank AG")
            .unwrap();

    for page in re_page.find_iter(&body) {
        let s = page.as_str();

        let re_type =
            Regex::new(r"Wertpapierabrechnung\s+(Kauf|Kauf Sparplan)\s+Kommissionsgeschäft")
                .unwrap();
        re_type
            .captures_iter(&s)
            .next()
            .ok_or("no receipt type match")?;

        let re = Regex::new(r"ISIN\s+([A-Z]{2}[A-Z0-9]{10})\s").unwrap();
        let isin = re.captures_iter(&s).next().ok_or("no isin match")?[1].to_owned();

        let re = Regex::new(r"Abrechnungs-Nr\.\s+(\d+)\s").unwrap();
        let receipt_number = re
            .captures_iter(&s)
            .next()
            .ok_or("no receipt number match")?[1]
            // .to_owned()
            .parse()?;

        let re_units_price =
            Regex::new(r"Nominal\s+STK ([\d\.]+,\d+)\s+Kurs\s+EUR ([\d\.]+,\d+)").unwrap();
        let cpt = re_units_price
            .captures_iter(&s)
            .next()
            .ok_or("no units/price match")?;
        let units = parse_float(&cpt[1])?;
        // let price = parse_float(&cpt[2])?;

        let re = Regex::new(r"Kurswert\sEUR ([\d\.]+,\d{2})").unwrap();
        let amount_no_fees =
            (parse_float(&re.captures_iter(&s).next().ok_or("no amount match")?[1])? * 100.0)
                .round() as i64;

        let re = Regex::new(r"Konto-Nr\.\s+(\d+)\s").unwrap();
        let account_number = re.captures_iter(&s).next().ok_or("no account match")?[1].parse()?;

        let re = Regex::new(r"Betrag zu Ihren Lasten\s+EUR ([\d\.]+,\d{2})").unwrap();
        let amount = (parse_float(&re.captures_iter(&s).next().ok_or("no amount match")?[1])?
            * 100.0)
            .round() as i64;

        let re =
    Regex::new(r"Handelstag\s(\d\d)\.(\d\d)\.(\d{4})\s+Handelszeit\s(\d\d):(\d\d)\s+Handelsplatz\s(Börse|außerbörslich)\s(.+?)\s*\n").unwrap();
        let cpt = re
            .captures_iter(&s)
            .next()
            .ok_or("no date and place match")?;

        let date = Local
            .ymd(cpt[3].parse()?, cpt[2].parse()?, cpt[1].parse()?)
            .and_hms(cpt[4].parse()?, cpt[5].parse()?, 0)
            .with_timezone(&Utc);

        let ex_type = cpt[6].to_owned();
        let mut ex = cpt[7].to_owned();
        let re = Regex::new(r"(\w+)/\w{3}").unwrap();
        if let Some(m) = re.captures(&ex) {
            ex = m[1].to_owned();
        }

        let t = NewTransaction {
            account_id,
            isin,
            date,
            units,
            amount: -amount_no_fees, // -units*price in cents (or simply the amount in case of dividends); does not include fees; negative sign -> gave money away.
            fees: amount_no_fees - amount, // sign should be negative
            onvista_exchange_id: None,
            comments: String::new(),
            exchange: Some(ex),
            receipt_number: Some(receipt_number),
        };

        ts.push(ParsedTransaction {
            content: t,
            over_the_counter: ex_type == "außerbörslich",
            account_number,
        });
    }

    Ok(ts)
}

fn parse_float(s: &str) -> Result<f64, <f64 as FromStr>::Err> {
    s.replace(".", "").replace(",", ".").parse()
}
