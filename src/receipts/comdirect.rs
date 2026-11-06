use super::{
    calculate_isin_checksum, parse_float, quick_and_dirty_checksum, ParsedReceiptTransaction,
};
use crate::models::NewTransaction;

use chrono::{Local, TimeZone, Utc};
use log::debug;
use regex::Regex;
use std::error::Error;
use std::sync::LazyLock;

static PURCHASE_ISIN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"WKN / ISIN: [A-Z0-9]+\s*/\s*([A-Z]{2}[A-Z0-9]{10})\s*").unwrap());
static PURCHASE_RECEIPT_NUMBER: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"Rechnungsnummer\s*:\s*([A-Z0-9]+)\s").unwrap());
static PURCHASE_UNITS_AND_PRICE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"Nennwert\s+Zum (?:Mischkurs|Kurs|Preis) von\s*St. ([\d\.]+(?:,\d+)?)\s+EUR\s+([\d\.]+,\d{2,})\s").unwrap()
});
static PURCHASE_MARKET_VALUE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"Kurswert\s+:\sEUR\s+([\d\.]+,\d{2})\s").unwrap());
static PURCHASE_IBAN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"IBAN[\s\S]+?\b(DE[0-9 ]{20,})\s+EUR\b").unwrap());
static PURCHASE_DEBIT_AMOUNT: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"Zu Ihren Lasten vor Steuern:\s+EUR\s+(-?[\d\.]+,\d{2})\s").unwrap()
});
static PURCHASE_CREDIT_AMOUNT: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"Zu Ihren Gunsten vor Steuern:\s+EUR\s+(-?[\d\.]+,\d{2})\s").unwrap()
});
static PURCHASE_DATE_AND_PLACE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"Geschäftstag\s+:\s(\d\d)\.(\d\d)\.(\d{4})\s+(?:Ausführungsplatz|Abwicklung)\s+:\s+(.+?)\s+(?:Handelszeit\s+:\s+(\d\d):(\d\d)\s)?").unwrap()
});
static FEES_WKN: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"WKN\s([A-Z0-9]{6}),").unwrap());
static FEES_AMOUNT: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"Die Buchung von ([\d\.]+,\d{2}) Euro").unwrap());
static FEES_DATE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\s+(\d\d)\.(\d\d)\.(\d{4})\s").unwrap());
static FEES_ACCOUNT_NUMBER: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"Kundennummer: \d+ (\d+)\s").unwrap());
static PAYOUT_ISIN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"WKN\/ISIN\n[^\n]+\nSTK\s+[0-9,]+\s+([^\s]+)\s").unwrap());
static PAYOUT_DATE_AND_AMOUNT: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"Zu Ihren Gunsten vor Steuern\s+\n[^\n]+EUR\s+(\d\d)\.(\d\d)\.(\d{4})\s+EUR\s+([\d\.]+,\d{2})\s+\n").unwrap()
});
static PAYOUT_ACCOUNT_NUMBER: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"Depotnr.:\s+(\d+)\s+\n").unwrap());
static ERTRAGSGUTSCHRIFT_ISIN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"STK\s+[\d\.,]+\s+([A-Z]{2}[A-Z0-9]{10})").unwrap());
static ERTRAGSGUTSCHRIFT_DATE_AND_AMOUNT: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"Zu Ihren Gunsten vor Steuern\s*\n[^\n]*EUR\s+(\d\d)\.(\d\d)\.(\d{4})\s+EUR\s+([\d\.]+,\d{2})").unwrap()
});
static ERTRAGSGUTSCHRIFT_ACCOUNT_NUMBER: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"Depotnr\.:\s*(\d+)").unwrap());

pub fn parse_comdirect_purchase(s: &str) -> Result<ParsedReceiptTransaction, Box<dyn Error>> {
    debug!("Parsing isin");
    let isin = PURCHASE_ISIN
        .captures_iter(s)
        .next()
        .ok_or("no isin match")?[1]
        .to_owned();

    // not only numeric, cannot store as-is
    let receipt_number_str = PURCHASE_RECEIPT_NUMBER
        .captures_iter(s)
        .next()
        .ok_or("no receipt number match")?[1]
        .to_owned();
    let receipt_number = quick_and_dirty_checksum(&receipt_number_str);

    debug!("Parsing units and price");
    let cpt = PURCHASE_UNITS_AND_PRICE
        .captures_iter(s)
        .next()
        .ok_or("no units/price match")?;
    let mut units = parse_float(&cpt[1])?;
    // let price = parse_float(&cpt[2])?;

    debug!("Parsing amount");
    let mut amount_no_fees = (parse_float(
        &PURCHASE_MARKET_VALUE
            .captures_iter(s)
            .next()
            .ok_or("no amount match")?[1],
    )? * 100.0)
        .round() as i64;

    debug!("Parsing account number");
    let account_number = PURCHASE_IBAN
        .captures_iter(s)
        .next()
        .ok_or("no account match")?[1]
        .replace(' ', "");

    debug!("Parsing total amount");
    let amount = if PURCHASE_DEBIT_AMOUNT.is_match(s) {
        amount_no_fees *= -1;
        (parse_float(
            &PURCHASE_DEBIT_AMOUNT
                .captures_iter(s)
                .next()
                .ok_or("no total amount match")?[1],
        )? * 100.0)
            .round() as i64
    } else {
        units *= -1.;

        (parse_float(
            &PURCHASE_CREDIT_AMOUNT
                .captures_iter(s)
                .next()
                .ok_or("no total amount match")?[1],
        )? * 100.0)
            .round() as i64
    };

    debug!("Parsing date and exchange");
    let cpt = PURCHASE_DATE_AND_PLACE
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

pub fn parse_comdirect_fees(s: &str) -> Result<ParsedReceiptTransaction, Box<dyn Error>> {
    debug!("Parsing isin");
    let wkn = FEES_WKN.captures_iter(s).next().ok_or("no wkn match")?[1].to_owned();
    let mut isin = format!("DE000{}", &wkn); // without check digit
    isin.push(calculate_isin_checksum(&isin)?);

    debug!("Parsing amount");
    let amount = (parse_float(
        &FEES_AMOUNT
            .captures_iter(s)
            .next()
            .ok_or("no amount match")?[1],
    )? * 100.0)
        .round() as i64;

    debug!("Parsing date and receipt number");
    let cpt = FEES_DATE.captures_iter(s).next().ok_or("no date match")?;
    let date = Local
        .with_ymd_and_hms(cpt[3].parse()?, cpt[2].parse()?, cpt[1].parse()?, 0, 0, 0)
        .unwrap()
        .with_timezone(&Utc);

    let receipt_number =
        quick_and_dirty_checksum(&format!("{}{}{}", wkn, date.format("%Y%m%d"), amount));

    debug!("Parsing account number");
    let account_number = FEES_ACCOUNT_NUMBER
        .captures_iter(s)
        .next()
        .ok_or("no account match")?[1]
        .to_owned();

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

pub fn parse_comdirect_payout(s: &str) -> Result<ParsedReceiptTransaction, Box<dyn Error>> {
    debug!("Parsing isin");
    let isin = PAYOUT_ISIN.captures_iter(s).next().ok_or("no isin match")?[1].to_owned();

    debug!("Parsing date & amount");
    let cpt = PAYOUT_DATE_AND_AMOUNT
        .captures_iter(s)
        .next()
        .ok_or("no amount+date match")?;
    let amount = (parse_float(&cpt[4])? * 100.0).round() as i64;

    let date = Local
        .with_ymd_and_hms(cpt[3].parse()?, cpt[2].parse()?, cpt[1].parse()?, 0, 0, 0)
        .unwrap()
        .with_timezone(&Utc);

    let receipt_number =
        quick_and_dirty_checksum(&format!("{}{}{}", isin, date.format("%Y%m%d"), amount));

    debug!("Parsing account number");
    let account_number = PAYOUT_ACCOUNT_NUMBER
        .captures_iter(s)
        .next()
        .ok_or("no account match")?[1]
        .to_owned();

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

pub fn parse_comdirect_ertragsgutschrift(
    s: &str,
) -> Result<ParsedReceiptTransaction, Box<dyn Error>> {
    debug!("Parsing isin");
    let isin = ERTRAGSGUTSCHRIFT_ISIN
        .captures_iter(s)
        .next()
        .ok_or("no isin match")?[1]
        .to_owned();

    debug!("Parsing date & amount");
    let cpt = ERTRAGSGUTSCHRIFT_DATE_AND_AMOUNT
        .captures_iter(s)
        .next()
        .ok_or("no amount+date match")?;
    let amount = (parse_float(&cpt[4])? * 100.0).round() as i64;

    let date = Local
        .with_ymd_and_hms(cpt[3].parse()?, cpt[2].parse()?, cpt[1].parse()?, 0, 0, 0)
        .unwrap()
        .with_timezone(&Utc);

    let receipt_number =
        quick_and_dirty_checksum(&format!("{}{}{}", isin, date.format("%Y%m%d"), amount));

    debug!("Parsing account number");
    let account_number = ERTRAGSGUTSCHRIFT_ACCOUNT_NUMBER
        .captures_iter(s)
        .next()
        .ok_or("no account match")?[1]
        .to_owned();

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

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;

    const COMDIRECT_PURCHASE_2026_05_15_FILENAME: &str =
        "Wertpapierabrechnung_Kauf_0,412_St._A2JRT5_(FIC-FICT.WORLD_EQ_UEA)_vom_15.05.2026_9F21B7.pdf";

    const COMDIRECT_PURCHASE_2026_05_15_TEXT: &str = r#"
GESCHÄFTSABRECHNUNG VOM 15.05.2026

Wertpapierkauf
Geschäftsnummer : 47 905613
418276035912 Rechnungsnummer : 382746150923A417
Geschäftstag : 15.05.2026 Ausführungsplatz : TRADEGATE
(Kommissionsgeschäft)

WKN / ISIN: A2JRT5 / LU2093847569
Wertpapier-Bezeichnung WPKNR/ISIN
FIC-Fictional World Equity A2JRT5 / LU2093847569

Nennwert Zum Kurs von
St. 0,412 EUR 84,37
Kurswert : EUR 34,76

IBAN Valuta Zu Ihren Lasten vor Steuern
DE00 0000 0000 0000 0000 00 EUR 19.05.2026 EUR 34,76
Zu Ihren Lasten vor Steuern: EUR -34,76

Verwahrungs-Art: GIROSAMMELDEPOT
"#;

    #[test]
    fn parses_comdirect_purchase_account_from_iban_block_for_2026_05_15_receipt() {
        let parsed =
            parse_comdirect_purchase(COMDIRECT_PURCHASE_2026_05_15_TEXT).unwrap_or_else(|_| {
                panic!(
                    "failed to parse receipt fixture {}",
                    COMDIRECT_PURCHASE_2026_05_15_FILENAME
                )
            });

        assert_eq!(
            parsed.account_number, "DE00000000000000000000",
            "fixture: {}",
            COMDIRECT_PURCHASE_2026_05_15_FILENAME
        );
        assert_eq!(parsed.content.isin, "LU2093847569");
        assert_eq!(parsed.content.units, 0.412);
        assert_eq!(parsed.content.amount, -3476);
        assert_eq!(parsed.content.fees, 0);
        assert_eq!(parsed.content.exchange.as_deref(), Some("TRADEGATE"));
        assert_eq!(
            parsed.content.date.with_timezone(&Local).date_naive(),
            NaiveDate::from_ymd_opt(2026, 5, 15).unwrap()
        );
        assert!(!parsed.over_the_counter);
        assert!(parsed.content.receipt_number.is_some());
    }

    const COMDIRECT_ERTRAGSGUTSCHRIFT_2026_05_29_FILENAME: &str =
        "Ertragsgutschrift_37_St._A3FX7Q_(FICSHS-GL.INFRA.TR._DLDIS)_vom_29.05.2026_2C5E91.pdf";

    const COMDIRECT_ERTRAGSGUTSCHRIFT_2026_05_29_TEXT: &str = "DD418/03/27\n\
25449 Quickborn\n\
\n\
 31207 010 Depotnr.: 718392650\n\
BLZ: 200 411 77\n\
\n\
Ertragsgutschrift\n\
\n\
Depotbestand Wertpapier-Bezeichnung WKN/ISIN\n\
per 20.05.2026 A3FX7QFicShs-Gl.Infra.Tra.U.ETF\n\
STK 37,000 IE000K7Q2W58Registered Shares o.N.\n\
Emissionsland: IRLAND\n\
USD 0,0192 Ausschüttung pro Stück für Geschäftsjahr 01.01.26 bis 31.12.26\n\
zahlbar ab 29.05.2026\n\
 Abrechnung Ertragsgutschrift\n\
\n\
Bruttobetrag: USD 0,71\n\
zum Devisenkurs: EUR/USD 1,167400 EUR 0,61\n\
Verrechnung über Konto (IBAN) Valuta Zu Ihren Gunsten vor Steuern\n\
DE45 2004 1177 0718 3926 50 EUR 02.06.2026 EUR 0,61\n\
\n\
Ihre comdirect\n";

    #[test]
    fn parses_comdirect_ertragsgutschrift_for_2026_05_29_receipt() {
        let parsed = parse_comdirect_ertragsgutschrift(COMDIRECT_ERTRAGSGUTSCHRIFT_2026_05_29_TEXT)
            .unwrap_or_else(|_| {
                panic!(
                    "failed to parse receipt fixture {}",
                    COMDIRECT_ERTRAGSGUTSCHRIFT_2026_05_29_FILENAME
                )
            });

        assert_eq!(parsed.content.isin, "IE000K7Q2W58");
        assert_eq!(parsed.content.amount, 61);
        assert_eq!(parsed.content.units, 0.0);
        assert_eq!(parsed.content.fees, 0);
        assert_eq!(parsed.account_number, "718392650");
        assert_eq!(parsed.content.exchange, None);
        assert_eq!(
            parsed.content.date.with_timezone(&Local).date_naive(),
            NaiveDate::from_ymd_opt(2026, 6, 2).unwrap()
        );
        assert!(parsed.over_the_counter);
        assert!(parsed.content.receipt_number.is_some());
    }
}
