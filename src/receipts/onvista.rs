use super::{ParsedReceiptTransaction, parse_float};
use crate::models::NewTransaction;

use chrono::{Local, TimeZone, Utc};
use regex::Regex;
use std::error::Error;
use std::sync::LazyLock;

static ISIN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"ISIN\s+([A-Z]{2}[A-Z0-9]{10})\s").unwrap());
static RECEIPT_NUMBER: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"Abrechnungs-Nr\.\s+(\d+)\s").unwrap());
static UNITS: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"Nominal\s+STK ([\d\.]+,\d+)\s").unwrap());
static DIVIDEND_PER_UNIT: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"Dividenden-Betrag pro Stück\s+([A-Z]+ [\d\.]+,\d+)").unwrap());
static ACCOUNT_NUMBER: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"Konto-Nr\.\s+(\d+)\s").unwrap());
static CREDIT_AMOUNT: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"Betrag zu Ihren Gunsten\s+EUR ([\d\.]+,\d{2})").unwrap());
static VALUE_DATE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"Wert\s+(\d\d)\.(\d\d)\.(\d{4})\s").unwrap());
static PAYOUT_PER_UNIT: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"Ausschüttungsbetrag pro Stück\s+([A-Z]+ [\d\.]+,\d+)").unwrap());
static PAYOUT_PERIOD: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"Ausschüttung für\s+([\d\.]{10}\s-\s[\d\.]{10})").unwrap());
static UNITS_AND_PRICE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"Nominal\s+STK ([\d\.]+,\d+)\s+Kurs\s+EUR ([\d\.]+,\d+)").unwrap()
});
static MARKET_VALUE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"Kurswert\s+EUR ([\d\.]+,\d{2})").unwrap());
static DEBIT_AMOUNT: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"Betrag zu Ihren Lasten\s+EUR ([\d\.]+,\d{2})").unwrap());
static TRADE_DATE_AND_PLACE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"Handelstag\s+(\d\d)\.(\d\d)\.(\d{4})\s+Handelszeit\s+(\d\d):(\d\d)\s+Handelsplatz\s+(Börse|außerbörslich)\s+(.+?)\s*\n").unwrap()
});
static EXCHANGE_WITH_CURRENCY: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(\w+)/\w{3}").unwrap());

pub fn parse_dividends(s: &str) -> Result<ParsedReceiptTransaction, Box<dyn Error>> {
    let isin = ISIN.captures_iter(s).next().ok_or("no isin match")?[1].to_owned();

    let receipt_number = RECEIPT_NUMBER
        .captures_iter(s)
        .next()
        .ok_or("no receipt number match")?[1]
        .parse()?;

    let cpt = UNITS.captures_iter(s).next().ok_or("no units match")?;
    let units = parse_float(&cpt[1])?;

    let amount_per_unit = DIVIDEND_PER_UNIT
        .captures_iter(s)
        .next()
        .ok_or("no amount per unit match")?[1]
        .to_owned();

    let comments = format!(
        "Dividendenzahlung von {} pro Stück, {:.3} Stück im Besitz",
        amount_per_unit, units
    );

    let account_number = ACCOUNT_NUMBER
        .captures_iter(s)
        .next()
        .ok_or("no account match")?[1]
        .parse()?;

    let amount = (parse_float(
        &CREDIT_AMOUNT
            .captures_iter(s)
            .next()
            .ok_or("no amount match")?[1],
    )? * 100.0)
        .round() as i64;

    let cpt = VALUE_DATE.captures_iter(s).next().ok_or("no date match")?;
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

pub fn parse_payout(s: &str) -> Result<ParsedReceiptTransaction, Box<dyn Error>> {
    let isin = ISIN.captures_iter(s).next().ok_or("no isin match")?[1].to_owned();

    let receipt_number = RECEIPT_NUMBER
        .captures_iter(s)
        .next()
        .ok_or("no receipt number match")?[1]
        .parse()?;

    let cpt = UNITS.captures_iter(s).next().ok_or("no units match")?;
    let units = parse_float(&cpt[1])?;

    let amount_per_unit = PAYOUT_PER_UNIT
        .captures_iter(s)
        .next()
        .ok_or("no amount per unit match")?[1]
        .to_owned();

    let period = &PAYOUT_PERIOD
        .captures_iter(s)
        .next()
        .ok_or("no period match")?[1];

    let comments = format!(
        "Ausschüttung für {}, {} pro Stück, {:.3} Stück im Besitz",
        period, amount_per_unit, units
    );

    let account_number = ACCOUNT_NUMBER
        .captures_iter(s)
        .next()
        .ok_or("no account match")?[1]
        .parse()?;

    let amount = (parse_float(
        &CREDIT_AMOUNT
            .captures_iter(s)
            .next()
            .ok_or("no amount match")?[1],
    )? * 100.0)
        .round() as i64;

    let cpt = VALUE_DATE.captures_iter(s).next().ok_or("no date match")?;
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

pub fn parse_purchase(s: &str) -> Result<ParsedReceiptTransaction, Box<dyn Error>> {
    let isin = ISIN.captures_iter(s).next().ok_or("no isin match")?[1].to_owned();

    let receipt_number = RECEIPT_NUMBER
        .captures_iter(s)
        .next()
        .ok_or("no receipt number match")?[1]
        .parse()?;

    let cpt = UNITS_AND_PRICE
        .captures_iter(s)
        .next()
        .ok_or("no units/price match")?;
    let mut units = parse_float(&cpt[1])?;
    // let price = parse_float(&cpt[2])?;

    let mut amount_no_fees = (parse_float(
        &MARKET_VALUE
            .captures_iter(s)
            .next()
            .ok_or("no amount match")?[1],
    )? * 100.0)
        .round() as i64;

    let account_number = ACCOUNT_NUMBER
        .captures_iter(s)
        .next()
        .ok_or("no account match")?[1]
        .parse()?;

    let amount = if DEBIT_AMOUNT.is_match(s) {
        (parse_float(
            &DEBIT_AMOUNT
                .captures_iter(s)
                .next()
                .ok_or("no total amount match")?[1],
        )? * 100.0)
            .round() as i64
    } else {
        amount_no_fees *= -1;
        units *= -1.;

        (parse_float(
            &CREDIT_AMOUNT
                .captures_iter(s)
                .next()
                .ok_or("no total amount match")?[1],
        )? * -100.0)
            .round() as i64
    };

    let cpt = TRADE_DATE_AND_PLACE
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
    if let Some(m) = EXCHANGE_WITH_CURRENCY.captures(&ex) {
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
