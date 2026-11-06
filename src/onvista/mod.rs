pub mod etc;
pub mod etf;
mod json_utils;
pub mod stock;

use crate::models::*;
use crate::onvista::json_utils::*;

use chrono::{DateTime, NaiveDate, Utc};
use itertools::izip;
use log::debug;
use serde_json::Value;
use std::error::Error;

pub const USER_AGENT: &str = "Mozilla/5.0 (X11; Linux x86_64; rv:97.0) Gecko/20100101 Firefox/97.0";

pub async fn get_info(needle: &str) -> Result<(StockInfo, Vec<StockExchange>), Box<dyn Error>> {
    let params = qstring::QString::new(vec![("searchValue", needle)]);
    let client = reqwest::Client::new();
    let resp = client
        .get(format!("https://www.onvista.de/suche/?{}", params))
        .header("User-Agent", USER_AGENT)
        .send()
        .await?;

    if !resp.status().is_success() {
        return Err(format!("Data request unsuccessful: status {}", resp.status()).into());
    }

    let url = resp.url().as_str().to_owned();
    debug!("Search was redirected to {}", url);
    if url.starts_with("https://www.onvista.de/etf/") {
        debug!("recognized {} as an ETF", needle);
        etf::parse_info(url, resp).await
    } else if url.starts_with("https://www.onvista.de/aktien/") {
        debug!("recognized {} as a stock", needle);
        stock::parse_info(url, resp).await
    } else if url.starts_with("https://www.onvista.de/derivate/ETCs/") {
        debug!("recognized {} as an ETC or ETN", needle);
        etc::parse_info(url, resp).await
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
        "Aktie" => stock::get_data_realtime(stock).await,
        s => Err(format!("unrecognized stock type: {}", s).into()),
    }
}

pub async fn get_data_historical_new(
    stock: &StockInfo,
    onvista_record_id: i32,
    start: NaiveDate,
) -> Result<Vec<HistoricalPrice>, Box<dyn Error>> {
    let url = format!("https://api.onvista.de/api/v1/instruments/FUND/{}/eod_history?idNotation={}&range=Y5&startDate={}",
  stock.instrument_id.clone().ok_or("ETF without instrument id")?,   onvista_record_id, start.format("%Y-%m-%d"),
       );
    debug!("Making request to {url:?}");
    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .header("User-Agent", USER_AGENT)
        .send()
        .await?;

    if !resp.status().is_success() {
        return Err(format!("Data request unsuccessful: status {}", resp.status()).into());
    }

    let body = resp.text().await?;
    let json: Value = serde_json::from_str(&body).map_err(|e| e.to_string())?;

    let dates = get_array(&json["datetimeLast"])
        .ok_or("error obtaining datetimes")?
        .iter()
        .map(|s| {
            Ok(DateTime::<Utc>::from_timestamp(
                get_i64(s).ok_or_else(|| format!("error parsing {}", s))?,
                0,
            )
            .unwrap()
            .naive_local()
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
    start: NaiveDate,
) -> Result<Vec<HistoricalPrice>, Box<dyn Error>> {
    if stock.kind == "ETF" || stock.kind == "Aktie" {
        return get_data_historical_new(stock, onvista_record_id, start).await;
    }

    let url =        format!("https://www.onvista.de/derivative/snapshotHistoryCSV?kag=false&timeSpan=5Y&datetimeTzStartRange={}&idNotation={}&codeResolution=1D",
        start.format("%d.%m.%Y"),
        onvista_record_id);

    debug!("{}", url);
    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .header("User-Agent", USER_AGENT)
        .send()
        .await?;
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
    // cSpell: disable-line
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
        Err("Unexpected CSV headers".into())
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
    let date = NaiveDate::from_ymd_opt(
        date_splits[2].parse().ok()?,
        date_splits[1].parse().ok()?,
        date_splits[0].parse().ok()?,
    )
    .unwrap();

    let opening = record
        .get(1)?
        .replace('.', "")
        .replace(',', ".")
        .parse()
        .ok()?;
    let high = record
        .get(2)?
        .replace('.', "")
        .replace(',', ".")
        .parse()
        .ok()?;
    let low = record
        .get(3)?
        .replace('.', "")
        .replace(',', ".")
        .parse()
        .ok()?;
    let closing = record
        .get(4)?
        .replace('.', "")
        .replace(',', ".")
        .parse()
        .ok()?;
    let volume = record.get(5)?.replace('.', "").parse().ok()?;

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
    let date = NaiveDate::from_ymd_opt(
        date_splits[2].parse().ok()?,
        date_splits[1].parse().ok()?,
        date_splits[0].parse().ok()?,
    )
    .unwrap();

    let opening = record
        .get(1)?
        .replace('.', "")
        .replace(',', ".")
        .parse()
        .ok()?;
    let high = record
        .get(3)?
        .replace('.', "")
        .replace(',', ".")
        .parse()
        .ok()?;
    let low = record
        .get(4)?
        .replace('.', "")
        .replace(',', ".")
        .parse()
        .ok()?;
    let closing = record
        .get(2)?
        .replace('.', "")
        .replace(',', ".")
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

#[cfg(test)]
mod tests {
    use super::*;

    use chrono::{Duration, Local};
    use test_log::test;

    #[test(tokio::test)]
    async fn test_stock_info() {
        let (info, exs) = get_info("DE0007164600").await.unwrap();

        log::info!("{info:?}");
        log::info!("{exs:?}");

        assert_eq!(info.isin, "DE0007164600");
        assert_ne!(exs.len(), 0);
    }

    #[test(tokio::test)]
    async fn test_stock_realtime() {
        let (info, exs) = get_info("DE0007164600").await.unwrap();

        let data = get_data_realtime(&info, &exs).await.unwrap();
        assert_ne!(data.len(), 0)
    }

    #[test(tokio::test)]
    async fn test_stock_historical() {
        let (info, exs) = get_info("DE0007164600").await.unwrap();

        let data = get_data_historical(
            &info,
            exs[0].onvista_record_id,
            Local::now()
                .naive_local()
                .date()
                .checked_sub_signed(Duration::weeks(2))
                .unwrap(),
        )
        .await
        .unwrap();

        // (this might actually fail, the exchange could be inactive for the stock)
        assert_ne!(data.len(), 0);
    }

    #[test(tokio::test)]
    async fn test_etf_info() {
        let (info, exs) = get_info("IE00BK5BQT80").await.unwrap();

        log::info!("{info:?}");
        log::info!("{exs:?}");

        assert_eq!(info.isin, "IE00BK5BQT80");
        assert_ne!(exs.len(), 0);
    }

    #[test(tokio::test)]
    async fn test_etf_realtime() {
        let (info, exs) = get_info("IE00BK5BQT80").await.unwrap();

        let data = get_data_realtime(&info, &exs).await.unwrap();
        assert_ne!(data.len(), 0)
    }

    #[test(tokio::test)]
    async fn test_etf_historical() {
        let (info, exs) = get_info("IE00BK5BQT80").await.unwrap();

        let data = get_data_historical(
            &info,
            exs[0].onvista_record_id,
            Local::now()
                .naive_local()
                .date()
                .checked_sub_signed(Duration::weeks(2))
                .unwrap(),
        )
        .await
        .unwrap();

        // (this might actually fail, the exchange could be inactive for the stock)
        assert_ne!(data.len(), 0);
    }

    #[test(tokio::test)]
    async fn test_etc_info() {
        let (info, exs) = get_info("DE000EWG2LD7").await.unwrap();

        log::info!("{info:?}");
        log::info!("{exs:?}");

        assert_eq!(info.isin, "DE000EWG2LD7");
        assert_ne!(exs.len(), 0);
    }

    #[test(tokio::test)]
    async fn test_etc_realtime() {
        let (info, exs) = get_info("DE000EWG2LD7").await.unwrap();

        let data = get_data_realtime(&info, &exs).await.unwrap();
        assert_ne!(data.len(), 0)
    }

    #[test(tokio::test)]
    async fn test_etc_historical() {
        let (info, exs) = get_info("DE000EWG2LD7").await.unwrap();

        let data = get_data_historical(
            &info,
            exs[0].onvista_record_id,
            Local::now()
                .naive_local()
                .date()
                .checked_sub_signed(Duration::weeks(2))
                .unwrap(),
        )
        .await
        .unwrap();

        // (this might actually fail, the exchange could be inactive for the stock)
        assert_ne!(data.len(), 0);
    }
}
