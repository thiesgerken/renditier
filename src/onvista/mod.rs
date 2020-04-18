pub mod etc;
pub mod etf;

use crate::models::*;

use chrono::{Date, Local, NaiveDate};
use log::debug;
use std::error::Error;

pub fn get_info(needle: &str) -> Result<(StockInfo, Vec<StockExchange>), Box<dyn Error>> {
  let params = qstring::QString::new(vec![("searchValue", needle)]);
  let resp = reqwest::blocking::get(&format!("https://www.onvista.de/suche/?{}", params))?;

  if !resp.status().is_success() {
    return Err("Data request unsuccessful".into());
  }

  let url = resp.url().as_str().to_owned();
  if url.starts_with("https://www.onvista.de/etf/") {
    debug!("recognized {} as an ETF", needle);
    etf::parse_info(resp)
  } else if url.starts_with("https://www.onvista.de/derivate/etc-etn/") {
    debug!("recognized {} as an ETC or ETN", needle);
    etc::parse_info(resp)
  } else {
    Err(format!("unrecognized url type: {}", url).into())
  }
}

pub fn get_data_realtime(
  stock: &StockInfo,
  exchanges: &[StockExchange],
) -> Result<Vec<RealtimePrice>, Box<dyn Error>> {
  match stock.kind.as_str() {
    "ETF" => etf::get_data_realtime(&stock.isin),
    "ETC" | "ETN" => etc::get_data_realtime(exchanges),
    s => Err(format!("unrecognized stock type: {}", s).into()),
  }
}

pub fn get_data_historical(
  onvista_record_id: i32,
  start: Date<Local>,
) -> Result<Vec<HistoricalPrice>, Box<dyn Error>> {
  let resp = reqwest::blocking::get(&format!("https://www.onvista.de/etf/snapshotHistoryCSV?kag=false&timeSpan=5Y&datetimeTzStartRange={}&idNotation={}",
    start.format("%d.%m.%Y"), onvista_record_id))
  ?;

  if !resp.status().is_success() {
    return Err("Data request unsuccessful".into());
  }

  let body = resp.text()?;

  let mut rdr = csv::ReaderBuilder::new()
    .delimiter(b';')
    .from_reader(body.as_bytes());

  let headers = rdr.headers()?;
  if headers != vec!["Datum", "Eröffnung", "Hoch", "Tief", "Schluss", "Volumen"] {
    return Err("Unexpected CSV headers".into());
  }

  Ok(
    rdr
      .records()
      .filter_map(|s| parse_historical_row(onvista_record_id, s))
      .collect(),
  )
}

fn parse_historical_row(
  onvista_record_id: i32,
  s: std::result::Result<csv::StringRecord, csv::Error>,
) -> Option<HistoricalPrice> {
  let record = s.ok()?;

  let date_splits = record.get(0)?.split('.').collect::<Vec<_>>();
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
  let volume = record.get(5)?.parse().ok()?;

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
