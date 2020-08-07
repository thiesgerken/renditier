use crate::models::*;

use chrono::{Local, TimeZone, Utc};
use diesel::prelude::*;
use log::{debug, info, warn};
use regex::Regex;
use std::error::Error;
use std::str::FromStr;

#[derive(Debug)]
struct ParsedTransaction {
    content: NewTransaction,
    account_number: u64,
    over_the_counter: bool,
}

pub fn parse_mem(
    connection: &PgConnection,
    uid: i32,
    files: &[(String, Vec<u8>)],
) -> Result<Vec<Transaction>, Box<dyn Error>> {
    let ts = files
        .iter()
        .map(|(file_name, buf)| parse_receipt(buf).map_err(|e| format!("{}: {}", file_name, e)))
        .collect::<Result<Vec<Vec<ParsedTransaction>>, String>>()?;
    let ts = ts.into_iter().flatten().collect::<Vec<_>>();

    let accs = crate::schema::accounts::table
        .filter(crate::schema::accounts::user_id.eq(uid))
        .load::<Account>(connection)?;
    let account_ids = accs.iter().map(|a| a.id).collect::<Vec<_>>();

    // find out if one of the receipt ids already exists,
    // warn the user about them and remove them from the list
    let orig_len = ts.len();
    let receipt_numbers = ts
        .iter()
        .flat_map(|t| t.content.receipt_number)
        .collect::<Vec<_>>();
    let ex_receipt_numbers = crate::schema::transactions::table
        .filter(crate::schema::transactions::dsl::receipt_number.eq_any(&receipt_numbers))
        .filter(crate::schema::transactions::dsl::account_id.eq_any(&account_ids))
        .load::<Transaction>(connection)?
        .iter()
        .flat_map(|t| t.receipt_number)
        .map(Some)
        .collect::<Vec<_>>();
    let ts = ts
        .into_iter()
        .filter(|t| !ex_receipt_numbers.contains(&t.content.receipt_number))
        .collect::<Vec<_>>();

    if ts.len() < orig_len {
        warn!("Removed {} of the parsed transactions from the list because they already exist in the database", orig_len - ts.len());
    }

    // try to replace the exchange names with an id (unless they were traded over the counter)
    let isins = ts
        .iter()
        .map(|t| t.content.isin.clone())
        .collect::<Vec<_>>();
    let exs = crate::schema::stock_exchanges::table
        .filter(crate::schema::stock_exchanges::dsl::isin.eq_any(&isins))
        .load::<StockExchange>(connection)?;
    let mut ts = ts
        .into_iter()
        .map(|t| replace_exchange(&exs, t))
        .collect::<Vec<_>>();

    for mut t in ts.iter_mut() {
        let account = accs
            .iter()
            .find(|a| {
                a.iban
                    .as_ref()
                    .map(|iban| iban.ends_with(&format!("{}", t.account_number)))
                    .unwrap_or(false)
            })
            .ok_or_else(|| {
                format!(
                    "Cannot find account for account number {}",
                    t.account_number
                )
            })?;

        t.content.account_id = account.id;
    }

    let ts = ts.into_iter().map(|t| t.content).collect::<Vec<_>>();
    let inserted = diesel::insert_into(crate::schema::transactions::table)
        .values(&ts)
        .load::<Transaction>(connection)?;
    info!("Inserted {} transactions into the database", inserted.len());

    Ok(inserted)
}

pub fn parse_files(
    connection: &PgConnection,
    uid: i32,
    file_names: &[&str],
) -> Result<Vec<Transaction>, Box<dyn Error>> {
    let files = file_names
        .iter()
        .map(|file_name| {
            let buf = std::fs::read(file_name)?;

            Ok((file_name.to_string(), buf))
        })
        .collect::<Result<Vec<(String, Vec<u8>)>, Box<dyn Error>>>()?;

    parse_mem(connection, uid, &files)
}

fn parse_receipt(buf: &[u8]) -> Result<Vec<ParsedTransaction>, Box<dyn Error>> {
    let mut buffer = Vec::<u8>::new();
    let doc = lopdf::Document::load_mem(buf)?;

    pdf_extract::output_doc(
        &doc,
        Box::new(pdf_extract::PlainTextOutput::new(
            &mut buffer as &mut dyn std::io::Write,
        ))
        .as_mut(),
    )?;
    let body = std::str::from_utf8(&buffer)?
        .to_owned()
        .replace("Depot-Nr.", "Depot-Nr.Depot-Nr."); // Lookaheads are not supported by the regex engine

    let mut ts = Vec::new();
    let re_page = Regex::new(r"Depot-Nr\.[\s\S]+?(Depot-Nr\.|\z)").unwrap();

    for page in re_page.find_iter(&body) {
        let s = page.as_str();

        let re_purchase =
            Regex::new(r"Wertpapierabrechnung\s+(Kauf|Kauf Sparplan)\s+Kommissionsgeschäft")
                .unwrap();
        if s.contains("Erträgnisgutschrift") {
            debug!("Parsing as dividends");
            ts.push(parse_dividends(&s)?);
        } else if re_purchase.is_match(&s) {
            debug!("Parsing as purchase");
            ts.push(parse_purchase(&s)?);
        } else if s.contains("Steuerbelastung\naus Wertpapieren") {
            debug!("Ignoring page with tax information");
        } else if !s.contains("SEITENNUMMER=1\n") {
            debug!("Ignoring page that does not have page number 1");
        } else {
            return Err("unknown receipt type".into());
        }
    }

    if ts.is_empty() {
        if body.contains("Steuerbelastung\naus Wertpapieren") {
            info!("file only contains tax information, ignoring.");
        } else {
            return Err("no transaction pages found".into());
        }
    }

    Ok(ts)
}

fn parse_dividends(s: &str) -> Result<ParsedTransaction, Box<dyn Error>> {
    let re = Regex::new(r"ISIN\s+([A-Z]{2}[A-Z0-9]{10})\s").unwrap();
    let isin = re.captures_iter(&s).next().ok_or("no isin match")?[1].to_owned();

    let re = Regex::new(r"Abrechnungs-Nr\.\s+(\d+)\s").unwrap();
    let receipt_number = re
        .captures_iter(&s)
        .next()
        .ok_or("no receipt number match")?[1]
        .parse()?;

    let re = Regex::new(r"Nominal\s+STK ([\d\.]+,\d+)\s").unwrap();
    let cpt = re.captures_iter(&s).next().ok_or("no units match")?;
    let units = parse_float(&cpt[1])?;

    let re = Regex::new(r"Ausschüttungsbetrag pro Stück\s+((EUR|USD) [\d\.]+,\d+)").unwrap();
    let amount_per_unit = re
        .captures_iter(&s)
        .next()
        .ok_or("no amount per unit match")?[1]
        .to_owned();

    let re = Regex::new(r"Ausschüttung für\s+([\d\.]{10}\s-\s[\d\.]{10})").unwrap();
    let period = &re.captures_iter(&s).next().ok_or("no period match")?[1];

    let comments = format!(
        "Ausschüttung für {}, {} pro Stück, {:.3} Stück im Besitz",
        period, amount_per_unit, units
    );

    let re = Regex::new(r"Konto-Nr\.\s+(\d+)\s").unwrap();
    let account_number = re.captures_iter(&s).next().ok_or("no account match")?[1].parse()?;

    let re = Regex::new(r"Betrag zu Ihren Gunsten\s+EUR ([\d\.]+,\d{2})").unwrap();
    let amount = (parse_float(&re.captures_iter(&s).next().ok_or("no amount match")?[1])? * 100.0)
        .round() as i64;

    let re = Regex::new(r"Wert\s+(\d\d)\.(\d\d)\.(\d{4})\s").unwrap();
    let cpt = re.captures_iter(&s).next().ok_or("no date match")?;
    let date = Local
        .ymd(cpt[3].parse()?, cpt[2].parse()?, cpt[1].parse()?)
        .and_hms(0, 0, 0)
        .with_timezone(&Utc);

    let t = NewTransaction {
        account_id: -1,
        isin,
        date,
        units: 0.0,
        amount,
        fees: 0,
        onvista_exchange_id: None,
        comments,
        exchange: None,
        receipt_number: Some(receipt_number),
    };

    Ok(ParsedTransaction {
        content: t,
        over_the_counter: true,
        account_number,
    })
}

fn parse_purchase(s: &str) -> Result<ParsedTransaction, Box<dyn Error>> {
    let re = Regex::new(r"ISIN\s+([A-Z]{2}[A-Z0-9]{10})\s").unwrap();
    let isin = re.captures_iter(&s).next().ok_or("no isin match")?[1].to_owned();

    let re = Regex::new(r"Abrechnungs-Nr\.\s+(\d+)\s").unwrap();
    let receipt_number = re
        .captures_iter(&s)
        .next()
        .ok_or("no receipt number match")?[1]
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
    let amount_no_fees = (parse_float(&re.captures_iter(&s).next().ok_or("no amount match")?[1])?
        * 100.0)
        .round() as i64;

    let re = Regex::new(r"Konto-Nr\.\s+(\d+)\s").unwrap();
    let account_number = re.captures_iter(&s).next().ok_or("no account match")?[1].parse()?;

    let re = Regex::new(r"Betrag zu Ihren Lasten\s+EUR ([\d\.]+,\d{2})").unwrap();
    let amount = (parse_float(&re.captures_iter(&s).next().ok_or("no amount match")?[1])? * 100.0)
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
        account_id: -1,
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

    Ok(ParsedTransaction {
        content: t,
        over_the_counter: ex_type == "außerbörslich",
        account_number,
    })
}

fn parse_float(s: &str) -> Result<f64, <f64 as FromStr>::Err> {
    s.replace(".", "").replace(",", ".").parse()
}

fn replace_exchange(
    exchanges: &[StockExchange],
    mut transaction: ParsedTransaction,
) -> ParsedTransaction {
    if transaction.over_the_counter {
        transaction
    } else {
        let ex = exchanges.iter().find(|e| {
            e.isin == transaction.content.isin
                && Some(e.name.clone()) == transaction.content.exchange
        });

        if let Some(ex) = ex {
            transaction.content.exchange = None;
            transaction.content.onvista_exchange_id = ex.onvista_exchange_id;
        }
        transaction
    }
}
