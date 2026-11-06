use crate::models::*;
use crate::onvista::json_utils::*;
use crate::onvista::USER_AGENT;

use chrono::Datelike;
use chrono::NaiveDate;
use reqwest::Response;
use scraper::{Html, Selector};
use serde_json::Value;
use std::error::Error;

pub async fn parse_info(
    url: String,
    resp: Response,
) -> Result<(StockInfo, Vec<StockExchange>), Box<dyn Error>> {
    // scope is needed to fix problems with async/.await and non-sendable borrows
    let body = resp.text().await?;
    let fragment = Html::parse_document(&body);

    let expected_prefix = "https://www.onvista.de";
    if !url.starts_with(expected_prefix) {
        return Err(format!("ETC url does not begin with '{}'", expected_prefix).into());
    }
    let url = url[expected_prefix.len()..].to_string();

    let redux_json = fragment
        .select(&Selector::parse("html.ov-client--web body script#__NEXT_DATA__").unwrap())
        .next()
        .ok_or("error obtaining json")?
        .text()
        .next()
        .ok_or("error obtaining json")?;
    debug!("{}", redux_json);
    let redux_json: Value = serde_json::from_str(redux_json).map_err(|e| e.to_string())?;

    let snapshot = &redux_json["props"]["pageProps"]["data"]["snapshot"];
    if let Value::Null = snapshot {
        return Err("Could not obtain snapshot from JSON".into());
    }
    debug!("{}", serde_json::to_string(snapshot).unwrap());

    let currency = get_string(&snapshot["derivativesDetails"]["isoCurrency"])
        .ok_or("error parsing currency")?;
    let isin = get_string(&snapshot["instrument"]["isin"]).ok_or("error parsing isin")?;
    let instrument_id =
        get_string(&snapshot["instrument"]["entityValue"]).ok_or("error parsing instrument id")?;
    let wkn = get_string(&snapshot["instrument"]["wkn"]).ok_or("error parsing wkn")?;
    let title = get_string(&snapshot["instrument"]["name"]).ok_or("error parsing title")?;
    let company =
        get_string(&snapshot["derivativesIssuer"]["name"]).ok_or("error parsing company")?;

    let exchanges = get_array(&snapshot["quoteList"]["list"])
        .ok_or("error parsing exchanges")?
        .iter()
        .map(|s| parse_exchange(&isin, s).ok_or_else(|| format!("error parsing {:?}", s)))
        .collect::<Result<Vec<_>, _>>()?;

    Ok((
        StockInfo {
            isin,
            wkn,
            onvista_url: url,
            kind: "ETF".to_string(),
            fonds_type: None,
            focus: None,
            company,
            title,
            persistent: false,
            last_historical_update: None,
            last_realtime_update: None,
            holdings: None,
            industry_breakdown: None,
            instrument_breakdown: None,
            country_breakdown: None,
            currency_breakdown: None,
            launch_date: None,
            currency: Some(currency),
            management_type: None,
            payout_type: None,
            ter: None,
            description: None,
            benchmark_index: None,
            instrument_id: Some(instrument_id),
        },
        exchanges,
    ))
}

fn parse_exchange(isin: &str, s: &Value) -> Option<StockExchange> {
    // let record_id = get_string(&s["idInstrument"])?.parse().ok()?;
    let record_id = get_i64(&s["market"]["idNotation"])? as i32;
    let quality = get_string(&s["codeQualityPrice"])?;
    let name = get_string(&s["market"]["name"])?;
    let code = get_string(&s["market"]["codeExchange"])?;

    Some(StockExchange {
        isin: isin.to_string(),
        onvista_exchange_id: None,
        onvista_record_id: record_id,
        code,
        quality: Some(quality),
        name,
    })
}

pub async fn get_data_realtime(
    exchanges: &[StockExchange],
) -> Result<Vec<RealtimePrice>, Box<dyn Error>> {
    let mut res = Vec::with_capacity(exchanges.len());

    for e in exchanges {
        let mut attempt = 0;
        let mut price = None;

        while price.is_none() && attempt < 10 {
            debug!(
                "fetching realtime data for exchange {}, attempt {}",
                e.onvista_record_id, attempt
            );
            price = get_data_realtime_exchange(e.onvista_record_id, attempt).await?;

            attempt += 1;
        }

        if let Some(p) = price {
            res.push(p);
        } else {
            warn!(
                "unable to obtain realtime data for exchange {}",
                e.onvista_record_id
            )
        }
    }

    Ok(res)
}

async fn get_data_realtime_exchange(
    onvista_record_id: i32,
    offset: i32,
) -> Result<Option<RealtimePrice>, Box<dyn Error>> {
    let url = &format!(
        "https://www.onvista.de/derivative/bond/snapshotTimesSalesCSV?idNotation={}&offset=-{}",
        onvista_record_id, offset
    );
    debug!("Querying realtime data from {url}");
    let client = reqwest::Client::new();
    let resp = client
        .get(url)
        .header("User-Agent", USER_AGENT)
        .send()
        .await?;

    if !resp.status().is_success() {
        return Err("Data request unsuccessful".into());
    }

    let body = resp.text().await?;

    let mut rdr = csv::ReaderBuilder::new()
        .delimiter(b';')
        .flexible(true)
        .from_reader(body.as_bytes());
    let mut rds = rdr.records().filter_map(|r| r.ok());

    let date_record = rds.find(|r| r.get(0) == Some("Datum")).ok_or("no date")?;
    let date_splits = date_record
        .get(1)
        .ok_or("no date")?
        .split('.')
        .collect::<Vec<_>>();
    let date = NaiveDate::from_ymd_opt(
        date_splits[2].parse()?,
        date_splits[1].parse()?,
        date_splits[0].parse()?,
    )
    .unwrap();

    if date.weekday().number_from_monday() >= 6 {
        // just ignore these
        warn!(
            "ETC/ETN parse realtime for {}: data is not from a weekday, ignoring.",
            onvista_record_id
        );
        return Ok(None);
    }

    Ok(rds
        .filter_map(|s| parse_realtime_row(onvista_record_id, date, s))
        .next())
}

fn parse_realtime_row(
    onvista_record_id: i32,
    date: NaiveDate,
    record: csv::StringRecord,
) -> Option<RealtimePrice> {
    if record.len() != 4 {
        return None;
    }

    let time_splits = record.get(0)?.split(':').collect::<Vec<_>>();
    let d = date
        .and_hms_opt(
            time_splits[0].parse().ok()?,
            time_splits[1].parse().ok()?,
            time_splits[2].parse().ok()?,
        )
        .unwrap();

    let price = record
        .get(1)?
        .replace('.', "")
        .replace(',', ".")
        .parse()
        .ok()?;

    Some(RealtimePrice {
        date: d.and_utc(),
        price,
        onvista_record_id,
    })
}
