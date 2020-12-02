pub mod etc;
pub mod etf;
pub mod stock;

use crate::models::*;

use chrono::{Date, Local, NaiveDate};
use log::debug;
use std::error::Error;

pub async fn get_info(needle: &str) -> Result<(StockInfo, Vec<StockExchange>), Box<dyn Error>> {
    let params = qstring::QString::new(vec![("searchValue", needle)]);
    let resp = reqwest::get(&format!("https://www.onvista.de/suche/?{}", params)).await?;

    if !resp.status().is_success() {
        return Err("Data request unsuccessful".into());
    }

    let url = resp.url().as_str().to_owned();
    if url.starts_with("https://www.onvista.de/etf/") {
        debug!("recognized {} as an ETF", needle);
        etf::parse_info(resp).await
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
        "ETF" => etf::get_data_realtime(&stock.isin).await,
        "ETC" | "ETN" => etc::get_data_realtime(exchanges).await,
        "Aktie" => stock::get_data_realtime(stock, exchanges).await,
        s => Err(format!("unrecognized stock type: {}", s).into()),
    }
}

pub async fn get_data_historical(
    stock: &StockInfo,
    onvista_record_id: i32,
    start: Date<Local>,
) -> Result<Vec<HistoricalPrice>, Box<dyn Error>> {
    let url = if stock.kind == "Aktie" {
        format!("https://www.onvista.de/onvista/boxes/historicalquote/export.csv?interval=Y5&dateStart={}&notationId={}",
        start.format("%d.%m.%Y"),
        onvista_record_id)
    } else {
        format!("https://www.onvista.de/etf/snapshotHistoryCSV?kag=false&timeSpan=5Y&datetimeTzStartRange={}&idNotation={}",
        start.format("%d.%m.%Y"),
        onvista_record_id)
    };

    debug!("{}", url);
    let resp = reqwest::get(&url).await?;
    if !resp.status().is_success() {
        println!("{:?}", resp.status());
        return Err("Data request unsuccessful".into());
    }

    let body = resp.text().await?;

    let mut rdr = csv::ReaderBuilder::new()
        .delimiter(b';')
        .trim(csv::Trim::All)
        .from_reader(body.trim().as_bytes());

    let headers = rdr.headers()?;
    if headers != vec!["Datum", "Eröffnung", "Hoch", "Tief", "Schluss", "Volumen"]
        && headers != vec!["Datum", "Eroeffnung", "Hoch", "Tief", "Schluss", "Volumen"]
    {
        // println!("{:?}", headers);
        return Err("Unexpected CSV headers".into());
    }

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
