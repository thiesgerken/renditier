pub mod etc;
pub mod etf;
mod json_utils;
pub mod stock;

use crate::models::*;
use crate::onvista::json_utils::*;

use chrono::{Date, Local, NaiveDate, NaiveDateTime};
use itertools::izip;
use log::debug;
use serde_json::Value;
use std::error::Error;

pub async fn get_info(needle: &str) -> Result<(StockInfo, Vec<StockExchange>), Box<dyn Error>> {
    let params = qstring::QString::new(vec![("searchValue", needle)]);
    let resp = reqwest::get(&format!("https://www.onvista.de/suche/?{}", params)).await?;

    if !resp.status().is_success() {
        return Err(format!("Data request unsuccessful: status {}", resp.status()).into());
    }

    let url = resp.url().as_str().to_owned();
    debug!("Search was redirected to {}", &url);
    if url.starts_with("https://www.onvista.de/etf/") {
        debug!("recognized {} as an ETF", needle);
        etf::parse_info(url, resp).await
    } else if url.starts_with("https://www.onvista.de/aktien/") {
        debug!("recognized {} as a stock", needle);
        stock::parse_info(resp).await
    } else if url.starts_with("https://www.onvista.de/derivate/etc-etn/") {
        debug!("recognized {} as an ETC or ETN", needle);
        etc::parse_info(resp).await
    } else {
        Err(format!("unrecognized url type: {}", url).into())
    }
}

pub async fn get_data_realtime(
    stock: &StockInfo,
    exchanges: &[StockExchange],
) -> Result<Vec<RealtimePrice>, Box<dyn Error>> {
    match stock.kind.as_str() {
        "ETF" => etf::get_data_realtime(stock).await,
        "ETC" | "ETN" => etc::get_data_realtime(exchanges).await,
        "Aktie" => stock::get_data_realtime(stock, exchanges).await,
        s => Err(format!("unrecognized stock type: {}", s).into()),
    }
}

pub async fn get_data_historical_new(
    stock: &StockInfo,
    onvista_record_id: i32,
    start: Date<Local>,
) -> Result<Vec<HistoricalPrice>, Box<dyn Error>> {
    let url = format!("https://api.onvista.de/api/v1/instruments/FUND/{}/eod_history?idNotation={}&range=Y5&startDate={}",
  stock.instrument_id.clone().ok_or("ETF without instrument id")?,   onvista_record_id, start.format("%Y-%m-%d"),
       );
    let resp = reqwest::get(&url).await?;

    if !resp.status().is_success() {
        return Err(format!("Data request unsuccessful: status {}", resp.status()).into());
    }

    let body = resp.text().await?;
    let json: Value = serde_json::from_str(&body).map_err(|e| e.to_string())?;

    let dates = get_array(&json["datetimeLast"])
        .ok_or("error obtaining datetimes")?
        .iter()
        .map(|s| {
            Ok(NaiveDateTime::from_timestamp(
                get_i64(s).ok_or_else(|| format!("error parsing {}", s))?,
                0,
            )
            .date())
        })
        .collect::<Result<Vec<_>, String>>()?;
    let openings = get_array(&json["first"])
        .ok_or("error obtaining first prices")?
        .iter()
        .map(|s| get_f64(s).ok_or_else(|| format!("error parsing {}", s)))
        .collect::<Result<Vec<_>, String>>()?;
    let closings = get_array(&json["first"])
        .ok_or("error obtaining first prices")?
        .iter()
        .map(|s| get_f64(s).ok_or_else(|| format!("error parsing {}", s)))
        .collect::<Result<Vec<_>, String>>()?;
    let lows = get_array(&json["low"])
        .ok_or("error obtaining low prices")?
        .iter()
        .map(|s| get_f64(s).ok_or_else(|| format!("error parsing {}", s)))
        .collect::<Result<Vec<_>, String>>()?;
    let highs = get_array(&json["high"])
        .ok_or("error obtaining high prices")?
        .iter()
        .map(|s| get_f64(s).ok_or_else(|| format!("error parsing {}", s)))
        .collect::<Result<Vec<_>, String>>()?;
    let volumes = get_array(&json["volume"])
        .ok_or("error obtaining volumes")?
        .iter()
        .map(|s| {
            get_f64(s)
                .ok_or_else(|| format!("error parsing {}", s))
                .map(|x| x as i32)
        })
        .collect::<Result<Vec<_>, String>>()?;

    Ok(izip!(dates, openings, closings, lows, highs, volumes)
        .map(
            |(date, opening, closing, low, high, volume)| HistoricalPrice {
                date,
                opening,
                closing,
                low,
                high,
                volume,
                onvista_record_id,
            },
        )
        .collect::<Vec<_>>())
}

pub async fn get_data_historical(
    stock: &StockInfo,
    onvista_record_id: i32,
    start: Date<Local>,
) -> Result<Vec<HistoricalPrice>, Box<dyn Error>> {
    if stock.kind == "ETF" {
        return get_data_historical_new(stock, onvista_record_id, start).await;
    }

    let url = if stock.kind == "Aktie" {
        format!("https://www.onvista.de/onvista/boxes/historicalquote/export.csv?interval=Y5&dateStart={}&notationId={}",
        start.format("%d.%m.%Y"),
        onvista_record_id)
    } else {
        format!("https://www.onvista.de/derivative/snapshotHistoryCSV?kag=false&timeSpan=5Y&datetimeTzStartRange={}&idNotation={}&codeResolution=1D",
        start.format("%d.%m.%Y"),
        onvista_record_id)
    };

    debug!("{}", url);
    let resp = reqwest::get(&url).await?;
    if !resp.status().is_success() {
        return Err(format!("Data request unsuccessful: status {}", resp.status()).into());
    }

    let body = resp.text().await?;

    let mut rdr = csv::ReaderBuilder::new()
        .delimiter(b';')
        .trim(csv::Trim::All)
        .from_reader(body.trim().as_bytes());

    let headers = rdr.headers()?;
    if headers == vec!["Datum", "Eröffnung", "Hoch", "Tief", "Schluss", "Volumen"]
        || headers == vec!["Datum", "Eroeffnung", "Hoch", "Tief", "Schluss", "Volumen"]
    {
        let mut res = Vec::new();
        for s in rdr.records() {
            let r = s?;

            if let Some(x) = parse_historical_row(onvista_record_id, &r) {
                res.push(x);
            } else {
                return Err(format!("Could not parse csv row '{:?}'", r).into());
            }
        }

        Ok(res)
    } else if headers == vec!["Datum", "Eröffnung", "Schluss", "Hoch", "Tief"] {
        let mut res = Vec::new();
        for s in rdr.records() {
            let r = s?;

            if let Some(x) = parse_historical_row_novol(onvista_record_id, &r) {
                res.push(x);
            } else {
                return Err(format!("Could not parse csv row '{:?}'", r).into());
            }
        }

        Ok(res)
    } else {
        debug!("{:?}", headers);
        return Err("Unexpected CSV headers".into());
    }
}

fn parse_historical_row(
    onvista_record_id: i32,
    record: &csv::StringRecord,
) -> Option<HistoricalPrice> {
    if record.len() != 6 {
        return None;
    }

    let date_splits = record.get(0)?.trim().split('.').collect::<Vec<_>>();
    let date = NaiveDate::from_ymd(
        date_splits[2].parse().ok()?,
        date_splits[1].parse().ok()?,
        date_splits[0].parse().ok()?,
    );

    let opening = record
        .get(1)?
        .replace(".", "")
        .replace(",", ".")
        .parse()
        .ok()?;
    let high = record
        .get(2)?
        .replace(".", "")
        .replace(",", ".")
        .parse()
        .ok()?;
    let low = record
        .get(3)?
        .replace(".", "")
        .replace(",", ".")
        .parse()
        .ok()?;
    let closing = record
        .get(4)?
        .replace(".", "")
        .replace(",", ".")
        .parse()
        .ok()?;
    let volume = record.get(5)?.replace(".", "").parse().ok()?;

    Some(HistoricalPrice {
        date,
        opening,
        closing,
        high,
        low,
        volume,
        onvista_record_id,
    })
}

fn parse_historical_row_novol(
    onvista_record_id: i32,
    record: &csv::StringRecord,
) -> Option<HistoricalPrice> {
    if record.len() != 5 {
        return None;
    }

    let date_splits = record.get(0)?.trim().split('.').collect::<Vec<_>>();
    let date = NaiveDate::from_ymd(
        date_splits[2].parse().ok()?,
        date_splits[1].parse().ok()?,
        date_splits[0].parse().ok()?,
    );

    let opening = record
        .get(1)?
        .replace(".", "")
        .replace(",", ".")
        .parse()
        .ok()?;
    let high = record
        .get(3)?
        .replace(".", "")
        .replace(",", ".")
        .parse()
        .ok()?;
    let low = record
        .get(4)?
        .replace(".", "")
        .replace(",", ".")
        .parse()
        .ok()?;
    let closing = record
        .get(2)?
        .replace(".", "")
        .replace(",", ".")
        .parse()
        .ok()?;

    Some(HistoricalPrice {
        date,
        opening,
        closing,
        high,
        low,
        volume: 0,
        onvista_record_id,
    })
}
