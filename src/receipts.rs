use crate::models::*;

use chrono::{Local, TimeZone, Utc};
use diesel::prelude::*;
use log::{debug, info, warn};
use regex::Regex;
use serde::Serialize;
use std::error::Error;
use std::str::FromStr;

#[derive(Debug, Clone, Serialize)]
pub struct ParsedReceiptTransaction {
    pub content: NewTransaction,
    pub account_number: String,
    pub over_the_counter: bool,
}

pub fn parse_mem_preview(
    files: &[(String, Vec<u8>)],
) -> Result<Vec<ParsedReceiptTransaction>, Box<dyn Error>> {
    let ts = files
        .iter()
        .map(|(file_name, buf)| parse_receipt(buf).map_err(|e| format!("{}: {}", file_name, e)))
        .collect::<Result<Vec<Vec<ParsedReceiptTransaction>>, String>>()?;

    Ok(ts.into_iter().flatten().collect::<Vec<_>>())
}

pub fn parse_mem(
    connection: &mut PgConnection,
    uid: i32,
    files: &[(String, Vec<u8>)],
) -> Result<Vec<Transaction>, Box<dyn Error>> {
    let ts = parse_mem_preview(files)?;

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

    for t in ts.iter_mut() {
        let account = accs
            .iter()
            .find(|a| {
                a.iban
                    .as_ref()
                    .map(|iban| iban.contains(&t.account_number.to_string()))
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
    connection: &mut PgConnection,
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

pub fn parse_preview_files(
    file_names: &[&str],
) -> Result<Vec<ParsedReceiptTransaction>, Box<dyn Error>> {
    let files = file_names
        .iter()
        .map(|file_name| {
            let buf = std::fs::read(file_name)?;

            Ok((file_name.to_string(), buf))
        })
        .collect::<Result<Vec<(String, Vec<u8>)>, Box<dyn Error>>>()?;

    parse_mem_preview(&files)
}

fn parse_receipt(buf: &[u8]) -> Result<Vec<ParsedReceiptTransaction>, Box<dyn Error>> {
    let mut buffer = Vec::<u8>::new();
    let doc = lopdf::Document::load_mem(buf)?;

    pdf_extract::output_doc(
        &doc,
        &mut pdf_extract::PlainTextOutput::new(&mut buffer as &mut dyn std::io::Write),
    )?;
    let body = std::str::from_utf8(&buffer)?
        .to_owned()
        .replace("Depot-Nr.", "Depot-Nr.Depot-Nr."); // Look-ahead not supported by the regex engine
    debug!("body of PDF: {}", &body);

    let mut ts = Vec::new();

    if body.contains("onvist") {
        // footer is broken
        let re_page = Regex::new(r"Depot-Nr\.[\s\S]+?(Depot-Nr\.|\z)").unwrap();
        let re_purchase = Regex::new(
            r"Wertpapierabrechnung\s+(Verkauf|Kauf|Kauf Sparplan)\s+Kommissionsgeschäft",
        )
        .unwrap();

        for page in re_page.find_iter(&body) {
            let s = page.as_str();

            if s.contains("Dividendengutschrift") {
                debug!("Parsing as onvista dividends");
                ts.push(parse_onvista_dividends(s)?);
            } else if s.contains("Erträgnisgutschrift") {
                debug!("Parsing as onvista payout");
                ts.push(parse_onvista_payout(s)?);
            } else if re_purchase.is_match(s) {
                debug!("Parsing as onvista purchase");
                ts.push(parse_onvista_purchase(s)?);
            } else if s.contains("Steuerbelastung\naus Wertpapieren") {
                debug!("Ignoring page with tax information");
            } else if !s.contains("SEITENNUMMER=1\n") {
                debug!("Ignoring page that does not have page number 1");
            } else {
                info!("{}", s);
                return Err("unknown onvista receipt type".into());
            }
        }
    } else if body.contains("comdirect") {
        if body.contains("Wertpapierkauf") || body.contains("Wertpapierverkauf") {
            debug!("Parsing as comdirect purchase");
            ts.push(parse_comdirect_purchase(&body)?);
        } else if body.contains("für die Verwahrung Ihres Wertpapieres") {
            debug!("Parsing as comdirect fees");
            ts.push(parse_comdirect_fees(&body)?);
        } else if body.contains("Ertragsgutschrift") {
            debug!("Parsing as comdirect payout");
            ts.push(parse_comdirect_payout(&body)?);
        } else {
            info!("{}", body);
            return Err("unknown comdirect receipt type".into());
        }
    } else {
        info!("{}", body);
        return Err("unknown receipt type".into());
    }

    if ts.is_empty() {
        if body.contains("Steuerbelastung\naus Wertpapieren") {
            info!("file only contains tax information, ignoring.");
        } else {
            return Err("no transaction pages found".into());
        }
    }

    debug!("{:?}", ts);
    Ok(ts)
}

fn parse_onvista_dividends(s: &str) -> Result<ParsedReceiptTransaction, Box<dyn Error>> {
    let re = Regex::new(r"ISIN\s+([A-Z]{2}[A-Z0-9]{10})\s").unwrap();
    let isin = re.captures_iter(s).next().ok_or("no isin match")?[1].to_owned();

    let re = Regex::new(r"Abrechnungs-Nr\.\s+(\d+)\s").unwrap();
    let receipt_number = re
        .captures_iter(s)
        .next()
        .ok_or("no receipt number match")?[1]
        .parse()?;

    let re = Regex::new(r"Nominal\s+STK ([\d\.]+,\d+)\s").unwrap();
    let cpt = re.captures_iter(s).next().ok_or("no units match")?;
    let units = parse_float(&cpt[1])?;

    let re = Regex::new(r"Dividenden-Betrag pro Stück\s+([A-Z]+ [\d\.]+,\d+)").unwrap();
    let amount_per_unit = re
        .captures_iter(s)
        .next()
        .ok_or("no amount per unit match")?[1]
        .to_owned();

    let comments = format!(
        "Dividendenzahlung von {} pro Stück, {:.3} Stück im Besitz",
        amount_per_unit, units
    );

    let re = Regex::new(r"Konto-Nr\.\s+(\d+)\s").unwrap();
    let account_number = re.captures_iter(s).next().ok_or("no account match")?[1].parse()?;

    let re = Regex::new(r"Betrag zu Ihren Gunsten\s+EUR ([\d\.]+,\d{2})").unwrap();
    let amount = (parse_float(&re.captures_iter(s).next().ok_or("no amount match")?[1])? * 100.0)
        .round() as i64;

    let re = Regex::new(r"Wert\s+(\d\d)\.(\d\d)\.(\d{4})\s").unwrap();
    let cpt = re.captures_iter(s).next().ok_or("no date match")?;
    let date = Local
        .with_ymd_and_hms(cpt[3].parse()?, cpt[2].parse()?, cpt[1].parse()?, 0, 0, 0)
        .unwrap()
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

    Ok(ParsedReceiptTransaction {
        content: t,
        over_the_counter: true,
        account_number,
    })
}

fn parse_onvista_payout(s: &str) -> Result<ParsedReceiptTransaction, Box<dyn Error>> {
    let re = Regex::new(r"ISIN\s+([A-Z]{2}[A-Z0-9]{10})\s").unwrap();
    let isin = re.captures_iter(s).next().ok_or("no isin match")?[1].to_owned();

    let re = Regex::new(r"Abrechnungs-Nr\.\s+(\d+)\s").unwrap();
    let receipt_number = re
        .captures_iter(s)
        .next()
        .ok_or("no receipt number match")?[1]
        .parse()?;

    let re = Regex::new(r"Nominal\s+STK ([\d\.]+,\d+)\s").unwrap();
    let cpt = re.captures_iter(s).next().ok_or("no units match")?;
    let units = parse_float(&cpt[1])?;

    let re = Regex::new(r"Ausschüttungsbetrag pro Stück\s+([A-Z]+ [\d\.]+,\d+)").unwrap();
    let amount_per_unit = re
        .captures_iter(s)
        .next()
        .ok_or("no amount per unit match")?[1]
        .to_owned();

    let re = Regex::new(r"Ausschüttung für\s+([\d\.]{10}\s-\s[\d\.]{10})").unwrap();
    let period = &re.captures_iter(s).next().ok_or("no period match")?[1];

    let comments = format!(
        "Ausschüttung für {}, {} pro Stück, {:.3} Stück im Besitz",
        period, amount_per_unit, units
    );

    let re = Regex::new(r"Konto-Nr\.\s+(\d+)\s").unwrap();
    let account_number = re.captures_iter(s).next().ok_or("no account match")?[1].parse()?;

    let re = Regex::new(r"Betrag zu Ihren Gunsten\s+EUR ([\d\.]+,\d{2})").unwrap();
    let amount = (parse_float(&re.captures_iter(s).next().ok_or("no amount match")?[1])? * 100.0)
        .round() as i64;

    let re = Regex::new(r"Wert\s+(\d\d)\.(\d\d)\.(\d{4})\s").unwrap();
    let cpt = re.captures_iter(s).next().ok_or("no date match")?;
    let date = Local
        .with_ymd_and_hms(cpt[3].parse()?, cpt[2].parse()?, cpt[1].parse()?, 0, 0, 0)
        .unwrap()
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

    Ok(ParsedReceiptTransaction {
        content: t,
        over_the_counter: true,
        account_number,
    })
}

fn quick_and_dirty_checksum(input: &str) -> i64 {
    let mut sum: i64 = 0;
    for c in input.chars() {
        sum = sum.wrapping_mul(31);
        sum = sum.wrapping_add(c as i64);
        sum ^= sum.rotate_left(17);
        sum = sum.wrapping_mul(0x517cc1b727220a95);
    }
    sum ^ (sum >> 32)
}

fn parse_comdirect_purchase(s: &str) -> Result<ParsedReceiptTransaction, Box<dyn Error>> {
    debug!("Parsing isin");
    let re = Regex::new(r"WKN / ISIN: [A-Z0-9]+\s*/\s*([A-Z]{2}[A-Z0-9]{10})\s*").unwrap();
    let isin = re.captures_iter(s).next().ok_or("no isin match")?[1].to_owned();

    // not only numeric, cannot store as-is
    let re = Regex::new(r"Rechnungsnummer\s*:\s*([A-Z0-9]+)\s").unwrap();
    let receipt_number_str = re
        .captures_iter(s)
        .next()
        .ok_or("no receipt number match")?[1]
        .to_owned();
    let receipt_number = quick_and_dirty_checksum(&receipt_number_str);

    debug!("Parsing units and price");
    let re_units_price = Regex::new(
        r"Nennwert\s+Zum (?:Mischkurs|Kurs|Preis) von\s*St. ([\d\.]+(?:,\d+)?)\s+EUR\s+([\d\.]+,\d{2,})\s",
    )
    .unwrap();
    let cpt = re_units_price
        .captures_iter(s)
        .next()
        .ok_or("no units/price match")?;
    let mut units = parse_float(&cpt[1])?;
    // let price = parse_float(&cpt[2])?;

    debug!("Parsing amount");
    let re = Regex::new(r"Kurswert\s+:\sEUR\s+([\d\.]+,\d{2})\s").unwrap();
    let mut amount_no_fees =
        (parse_float(&re.captures_iter(s).next().ok_or("no amount match")?[1])? * 100.0).round()
            as i64;

    debug!("Parsing account number");
    let re = Regex::new(r"IBAN[a-zA-Z\s]+(DE[0-9 ]+)\s EUR").unwrap();
    let account_number = re.captures_iter(s).next().ok_or("no account match")?[1].replace(' ', "");

    debug!("Parsing total amount");
    let re_purchase =
        Regex::new(r"Zu Ihren Lasten vor Steuern:\s+EUR\s+(-?[\d\.]+,\d{2})\s").unwrap();
    let re_sale = Regex::new(r"Zu Ihren Gunsten vor Steuern:\s+EUR\s+(-?[\d\.]+,\d{2})\s").unwrap();
    let amount = if re_purchase.is_match(s) {
        amount_no_fees *= -1;
        (parse_float(
            &re_purchase
                .captures_iter(s)
                .next()
                .ok_or("no total amount match")?[1],
        )? * 100.0)
            .round() as i64
    } else {
        units *= -1.;

        (parse_float(
            &re_sale
                .captures_iter(s)
                .next()
                .ok_or("no total amount match")?[1],
        )? * 100.0)
            .round() as i64
    };

    debug!("Parsing date and exchange");
    let re = Regex::new(r"Geschäftstag\s+:\s(\d\d)\.(\d\d)\.(\d{4})\s+(?:Ausführungsplatz|Abwicklung)\s+:\s+(.+?)\s+(?:Handelszeit\s+:\s+(\d\d):(\d\d)\s)?").unwrap();
    let cpt = re
        .captures_iter(s)
        .next()
        .ok_or("no date and place match")?;

    let date = Local
        .with_ymd_and_hms(
            cpt[3].parse()?,
            cpt[2].parse()?,
            cpt[1].parse()?,
            cpt.get(5).map(|x| x.as_str().parse()).unwrap_or(Ok(0))?,
            cpt.get(6).map(|x| x.as_str().parse()).unwrap_or(Ok(0))?,
            0,
        )
        .unwrap()
        .with_timezone(&Utc);

    let ex = cpt[4].to_owned();

    let t = NewTransaction {
        account_id: -1,
        isin,
        date,
        units,
        amount: amount_no_fees, // -units*price in cents (or simply the amount in case of dividends); does not include fees; negative sign -> gave money away.
        fees: amount - amount_no_fees, // sign should be negative
        onvista_exchange_id: None,
        comments: String::new(),
        exchange: Some(ex),
        receipt_number: Some(receipt_number),
    };

    Ok(ParsedReceiptTransaction {
        content: t,
        over_the_counter: false,
        account_number,
    })
}

fn calculate_isin_checksum(isin_without_check: &str) -> Result<char, &'static str> {
    // Überprüfe die Länge (sollte 11 Zeichen sein, ohne Prüfziffer)
    if isin_without_check.len() != 11 {
        return Err("ISIN must be 11 characters long (without check digit)");
    }

    // Konvertiere Buchstaben in Zahlen (A=10, B=11, etc.)
    let mut expanded = String::with_capacity(24);
    for c in isin_without_check.chars() {
        if c.is_ascii_digit() {
            expanded.push(c);
        } else if c.is_ascii_alphabetic() {
            let num = (c.to_ascii_uppercase() as u8 - b'A' + 10).to_string();
            expanded.push_str(&num);
        } else {
            return Err("Invalid character in ISIN");
        }
    }

    // Berechne die Prüfziffer
    let mut sum = 0;
    let mut toggle = true;
    for c in expanded.chars().rev() {
        let mut digit = c.to_digit(10).unwrap();
        if toggle {
            digit *= 2;
            if digit > 9 {
                digit = (digit % 10) + 1;
            }
        }
        sum += digit;
        toggle = !toggle;
    }

    let check_digit = (10 - (sum % 10)) % 10;
    Ok(char::from_digit(check_digit, 10).unwrap())
}

fn parse_comdirect_fees(s: &str) -> Result<ParsedReceiptTransaction, Box<dyn Error>> {
    debug!("Parsing isin");
    let re = Regex::new(r"WKN\s([A-Z0-9]{6}),").unwrap();
    let wkn = re.captures_iter(s).next().ok_or("no wkn match")?[1].to_owned();
    let mut isin = format!("DE000{}", &wkn); // without check digit
    isin.push(calculate_isin_checksum(&isin)?);

    debug!("Parsing amount");
    let re = Regex::new(r"Die Buchung von ([\d\.]+,\d{2}) Euro").unwrap();
    let amount = (parse_float(&re.captures_iter(s).next().ok_or("no amount match")?[1])? * 100.0)
        .round() as i64;

    debug!("Parsing date and receipt number");
    let re = Regex::new(r"\s+(\d\d)\.(\d\d)\.(\d{4})\s").unwrap();
    let cpt = re.captures_iter(s).next().ok_or("no date match")?;
    let date = Local
        .with_ymd_and_hms(cpt[3].parse()?, cpt[2].parse()?, cpt[1].parse()?, 0, 0, 0)
        .unwrap()
        .with_timezone(&Utc);

    let receipt_number =
        quick_and_dirty_checksum(&format!("{}{}{}", wkn, date.format("%Y%m%d"), amount));

    debug!("Parsing account number");
    let re = Regex::new(r"Kundennummer: \d+ (\d+)\s").unwrap();
    let account_number = re.captures_iter(s).next().ok_or("no account match")?[1].to_owned();

    let t = NewTransaction {
        account_id: -1,
        isin,
        date,
        units: 0.0,
        amount: 0,
        fees: -amount,
        onvista_exchange_id: None,
        comments: String::new(),
        exchange: None,
        receipt_number: Some(receipt_number),
    };

    Ok(ParsedReceiptTransaction {
        content: t,
        over_the_counter: true,
        account_number,
    })
}

fn parse_comdirect_payout(s: &str) -> Result<ParsedReceiptTransaction, Box<dyn Error>> {
    debug!("Parsing isin");
    let re = Regex::new(r"WKN\/ISIN\n[^\n]+\nSTK\s+[0-9,]+\s+([^\s]+)\s").unwrap();
    let isin = re.captures_iter(s).next().ok_or("no isin match")?[1].to_owned();

    debug!("Parsing date & amount");
    let re = Regex::new(r"Zu Ihren Gunsten vor Steuern\s+\n[^\n]+EUR\s+(\d\d)\.(\d\d)\.(\d{4})\s+EUR\s+([\d\.]+,\d{2})\s+\n").unwrap();
    let cpt = re.captures_iter(s).next().ok_or("no amount+date match")?;
    let amount = (parse_float(&cpt[4])? * 100.0).round() as i64;

    let date = Local
        .with_ymd_and_hms(cpt[3].parse()?, cpt[2].parse()?, cpt[1].parse()?, 0, 0, 0)
        .unwrap()
        .with_timezone(&Utc);

    let receipt_number =
        quick_and_dirty_checksum(&format!("{}{}{}", isin, date.format("%Y%m%d"), amount));

    debug!("Parsing account number");
    let re = Regex::new(r"Depotnr.:\s+(\d+)\s+\n").unwrap();
    let account_number = re.captures_iter(s).next().ok_or("no account match")?[1].to_owned();

    let t = NewTransaction {
        account_id: -1,
        isin,
        date,
        units: 0.0,
        amount,
        fees: 0,
        onvista_exchange_id: None,
        comments: String::new(),
        exchange: None,
        receipt_number: Some(receipt_number),
    };

    Ok(ParsedReceiptTransaction {
        content: t,
        over_the_counter: true,
        account_number,
    })
}

fn parse_onvista_purchase(s: &str) -> Result<ParsedReceiptTransaction, Box<dyn Error>> {
    let re = Regex::new(r"ISIN\s+([A-Z]{2}[A-Z0-9]{10})\s").unwrap();
    let isin = re.captures_iter(s).next().ok_or("no isin match")?[1].to_owned();

    let re = Regex::new(r"Abrechnungs-Nr\.\s+(\d+)\s").unwrap();
    let receipt_number = re
        .captures_iter(s)
        .next()
        .ok_or("no receipt number match")?[1]
        .parse()?;

    let re_units_price =
        Regex::new(r"Nominal\s+STK ([\d\.]+,\d+)\s+Kurs\s+EUR ([\d\.]+,\d+)").unwrap();
    let cpt = re_units_price
        .captures_iter(s)
        .next()
        .ok_or("no units/price match")?;
    let mut units = parse_float(&cpt[1])?;
    // let price = parse_float(&cpt[2])?;

    let re = Regex::new(r"Kurswert\s+EUR ([\d\.]+,\d{2})").unwrap();
    let mut amount_no_fees =
        (parse_float(&re.captures_iter(s).next().ok_or("no amount match")?[1])? * 100.0).round()
            as i64;

    let re = Regex::new(r"Konto-Nr\.\s+(\d+)\s").unwrap();
    let account_number = re.captures_iter(s).next().ok_or("no account match")?[1].parse()?;

    let re_purchase = Regex::new(r"Betrag zu Ihren Lasten\s+EUR ([\d\.]+,\d{2})").unwrap();
    let re_sale = Regex::new(r"Betrag zu Ihren Gunsten\s+EUR ([\d\.]+,\d{2})").unwrap();
    let amount = if re_purchase.is_match(s) {
        (parse_float(
            &re_purchase
                .captures_iter(s)
                .next()
                .ok_or("no total amount match")?[1],
        )? * 100.0)
            .round() as i64
    } else {
        amount_no_fees *= -1;
        units *= -1.;

        (parse_float(
            &re_sale
                .captures_iter(s)
                .next()
                .ok_or("no total amount match")?[1],
        )? * -100.0)
            .round() as i64
    };

    let re = Regex::new(r"Handelstag\s+(\d\d)\.(\d\d)\.(\d{4})\s+Handelszeit\s+(\d\d):(\d\d)\s+Handelsplatz\s+(Börse|außerbörslich)\s+(.+?)\s*\n").unwrap();
    let cpt = re
        .captures_iter(s)
        .next()
        .ok_or("no date and place match")?;

    let date = Local
        .with_ymd_and_hms(
            cpt[3].parse()?,
            cpt[2].parse()?,
            cpt[1].parse()?,
            cpt[4].parse()?,
            cpt[5].parse()?,
            0,
        )
        .unwrap()
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

    Ok(ParsedReceiptTransaction {
        content: t,
        over_the_counter: ex_type == "außerbörslich",
        account_number,
    })
}

fn parse_float(s: &str) -> Result<f64, <f64 as FromStr>::Err> {
    s.replace('.', "").replace(',', ".").parse()
}

fn replace_exchange(
    exchanges: &[StockExchange],
    mut transaction: ParsedReceiptTransaction,
) -> ParsedReceiptTransaction {
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
