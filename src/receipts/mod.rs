mod comdirect;
mod onvista;

use crate::models::*;

use chrono::{DateTime, NaiveDate, TimeZone, Utc};
use chrono_tz::Tz;
use log::{debug, info, warn};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::error::Error;
use std::str::FromStr;
use std::sync::LazyLock;
use std::sync::atomic::{AtomicBool, Ordering};

#[derive(Serialize, Deserialize, Debug, Default)]
#[serde(default)]
pub struct Config {
    // extract text with pdftotext (poppler) instead of the built-in pdf-extract;
    // whichever is primary, the other one serves as fallback
    pub prefer_pdftotext: bool,
}

static PREFER_PDFTOTEXT: AtomicBool = AtomicBool::new(false);

// ponytail: process-wide flag instead of threading config through every parse call chain
pub fn configure(config: &Config) {
    PREFER_PDFTOTEXT.store(config.prefer_pdftotext, Ordering::Relaxed);
}

#[derive(Debug, Clone, Serialize)]
pub struct ParsedReceiptTransaction {
    pub content: NewTransaction,
    pub account_number: String,
    pub over_the_counter: bool,
}

/// The transactions on each file, in the order of `files`.
pub fn parse_mem_preview(
    files: &[(String, Vec<u8>)],
) -> Result<Vec<Vec<ParsedReceiptTransaction>>, Box<dyn Error>> {
    Ok(files
        .iter()
        .map(|(file_name, buf)| parse_receipt(buf).map_err(|e| format!("{}: {}", file_name, e)))
        .collect::<Result<_, String>>()?)
}

/// Reads the files into the `(name, contents)` pairs the parsers take.
pub fn read_files(file_names: &[&str]) -> std::io::Result<Vec<(String, Vec<u8>)>> {
    file_names
        .iter()
        .map(|file_name| Ok((file_name.to_string(), std::fs::read(file_name)?)))
        .collect()
}

pub fn parse_preview_files(
    file_names: &[&str],
) -> Result<Vec<ParsedReceiptTransaction>, Box<dyn Error>> {
    Ok(parse_mem_preview(&read_files(file_names)?)?
        .into_iter()
        .flatten()
        .collect())
}

fn extract_with_pdf_extract(buf: &[u8]) -> Result<String, Box<dyn Error>> {
    let mut buffer = Vec::<u8>::new();
    let doc = pdf_extract::Document::load_mem(buf)?;

    pdf_extract::output_doc(
        &doc,
        &mut pdf_extract::PlainTextOutput::new(&mut buffer as &mut dyn std::io::Write),
    )?;
    Ok(fix_broken_glyphs(std::str::from_utf8(&buffer)?))
}

fn extract_with_pdftotext(buf: &[u8]) -> Result<String, Box<dyn Error>> {
    use std::io::Write;
    use std::process::{Command, Stdio};

    let mut child = Command::new("pdftotext")
        .args(["-layout", "-", "-"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()?;
    // pdftotext needs the full file (xref at the end) before it writes output,
    // so writing all of stdin before reading stdout cannot deadlock
    child.stdin.take().unwrap().write_all(buf)?;
    let out = child.wait_with_output()?;
    if !out.status.success() {
        return Err(format!("pdftotext failed with {}", out.status).into());
    }
    Ok(String::from_utf8(out.stdout)?)
}

fn parse_receipt(buf: &[u8]) -> Result<Vec<ParsedReceiptTransaction>, Box<dyn Error>> {
    type Extractor = (&'static str, fn(&[u8]) -> Result<String, Box<dyn Error>>);
    const PDF_EXTRACT: Extractor = ("pdf-extract", extract_with_pdf_extract);
    const PDFTOTEXT: Extractor = ("pdftotext", extract_with_pdftotext);

    let (primary, fallback) = if PREFER_PDFTOTEXT.load(Ordering::Relaxed) {
        (PDFTOTEXT, PDF_EXTRACT)
    } else {
        (PDF_EXTRACT, PDFTOTEXT)
    };

    match primary.1(buf).and_then(|body| parse_body(&body)) {
        Ok(ts) => Ok(ts),
        Err(e) => {
            warn!(
                "parsing via {} failed ({}), retrying with {}",
                primary.0, e, fallback.0
            );
            fallback.1(buf)
                .and_then(|body| parse_body(&body))
                .map_err(|e2| format!("{}: {}; {}: {}", primary.0, e, fallback.0, e2).into())
        }
    }
}

// onvista receipts are split into pages at their "Depot-Nr." header, since the footer is broken
static ONVISTA_PAGE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"Depot-Nr\.[\s\S]+?(Depot-Nr\.|\z)").unwrap());
static ONVISTA_PURCHASE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"Wertpapierabrechnung\s+(Verkauf|Kauf|Kauf Sparplan)\s+Kommissionsgeschäft")
        .unwrap()
});

fn parse_body(body: &str) -> Result<Vec<ParsedReceiptTransaction>, Box<dyn Error>> {
    let body = body.replace("Depot-Nr.", "Depot-Nr.Depot-Nr."); // Look-ahead not supported by the regex engine
    debug!("body of PDF: {}", body);

    let mut ts = Vec::new();

    if body.contains("onvist") {
        for page in ONVISTA_PAGE.find_iter(&body) {
            let s = page.as_str();

            if s.contains("Dividendengutschrift") {
                debug!("Parsing as onvista dividends");
                ts.push(onvista::parse_dividends(s)?);
            } else if s.contains("Erträgnisgutschrift") {
                debug!("Parsing as onvista payout");
                ts.push(onvista::parse_payout(s)?);
            } else if ONVISTA_PURCHASE.is_match(s) {
                debug!("Parsing as onvista purchase");
                ts.push(onvista::parse_purchase(s)?);
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
            ts.push(comdirect::parse_purchase(&body)?);
        } else if body.contains("für die Verwahrung Ihres Wertpapieres") {
            debug!("Parsing as comdirect fees");
            ts.push(comdirect::parse_fees(&body)?);
        } else if body.contains("Ertragsgutschrift") {
            if body.contains("Verrechnung über Konto") {
                debug!("Parsing as comdirect payout (Ertragsgutschrift layout)");
                ts.push(comdirect::parse_ertragsgutschrift(&body)?);
            } else {
                debug!("Parsing as comdirect payout");
                ts.push(comdirect::parse_payout(&body)?);
            }
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

// comdirect PDFs since 2026-06 embed subset fonts without ToUnicode CMaps; pdf-extract's
// raw-code fallback then emits wrong characters for the parse-relevant glyphs below.
// ponytail: observed-substitution table, extend when new receipts garble other glyphs
fn fix_broken_glyphs(s: &str) -> String {
    s.replace('`', "-")
        .replace('è', "Y")
        .replace('ç', "X")
        .replace('×', "P")
        .replace('Ô', "M")
        .replace('Ñ', "J")
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

/// The banks issuing the supported receipts state their times in German local time.
const RECEIPT_TIMEZONE: Tz = chrono_tz::Europe::Berlin;

fn receipt_time(
    year: i32,
    month: u32,
    day: u32,
    hour: u32,
    minute: u32,
) -> Result<DateTime<Utc>, Box<dyn Error>> {
    let invalid = || format!("invalid receipt time {year}-{month}-{day} {hour}:{minute}");
    let time = NaiveDate::from_ymd_opt(year, month, day)
        .and_then(|d| d.and_hms_opt(hour, minute, 0))
        .ok_or_else(invalid)?;

    Ok(RECEIPT_TIMEZONE
        .from_local_datetime(&time)
        .earliest()
        .ok_or_else(invalid)?
        .with_timezone(&Utc))
}

fn parse_float(s: &str) -> Result<f64, <f64 as FromStr>::Err> {
    s.replace('.', "").replace(',', ".").parse()
}

/// Replaces the exchange's name with its id where it is known, unless traded over the counter.
pub fn replace_exchange(
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fixes_broken_glyphs_from_2026_06_comdirect_fonts() {
        assert_eq!(
            fix_broken_glyphs("Zu Ihren Lasten vor Steuern: EUR `199,95"),
            "Zu Ihren Lasten vor Steuern: EUR -199,95"
        );
        assert_eq!(
            fix_broken_glyphs("WKN / ISIN: A2QZT4 / IE00Bèç7KM37"),
            "WKN / ISIN: A2QZT4 / IE00BYX7KM37"
        );
        assert_eq!(
            fix_broken_glyphs("Stk. 2,318 FICSV-ÔSCI EM DL A , WKN / ISIN: A1KÔPR / IE00B7RT4Q87"),
            "Stk. 2,318 FICSV-MSCI EM DL A , WKN / ISIN: A1KMPR / IE00B7RT4Q87"
        );
        assert_eq!(
            fix_broken_glyphs("WKN / ISIN: A2ÑRT5 / LU2093847569"),
            "WKN / ISIN: A2JRT5 / LU2093847569"
        );
    }
}
