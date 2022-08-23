use crate::models::*;
use crate::onvista::json_utils::*;
use crate::onvista::USER_AGENT;

use reqwest::Response;
use scraper::{Html, Selector};
use serde_json::Value;
use std::error::Error;

pub async fn parse_info(
    url: String,
    resp: Response,
) -> Result<(StockInfo, Vec<StockExchange>), Box<dyn Error>> {
    let body = resp.text().await?;
    let fragment = Html::parse_document(&body);

    let expected_prefix = "https://www.onvista.de";
    if !url.starts_with(expected_prefix) {
        return Err(format!("Stock url does not begin with '{}'", &expected_prefix).into());
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
    debug!("{:?}", snapshot);
    if let Value::Null = snapshot {
        return Err("Could not obtain snapshot from JSON".into());
    }

    let company_json = &redux_json["props"]["pageProps"]["data"]["company"];
    debug!("{:?}", company_json);
    if let Value::Null = company_json {
        return Err("Could not obtain snapshot from JSON".into());
    }

    let currency =
        get_string(&snapshot["stocksFigure"]["isoCurrency"]).ok_or("error parsing currency")?;
    let isin = get_string(&snapshot["instrument"]["isin"]).ok_or("error parsing isin")?;
    let instrument_id =
        get_string(&snapshot["instrument"]["entityValue"]).ok_or("error parsing instrument id")?;
    let wkn = get_string(&snapshot["instrument"]["wkn"]).ok_or("error parsing wkn")?;
    let title = get_string(&snapshot["stocksDetails"]["shortName"]).ok_or("error parsing title")?;
    let company = get_string(&snapshot["company"]["name"]).ok_or("error parsing company")?;
    let description =
        get_string(&company_json["profile"][0]["value"]).ok_or("error parsing description")?;

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
            kind: "Aktie".to_string(),
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
            description: Some(description),
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

pub async fn get_data_realtime(stock: &StockInfo) -> Result<Vec<RealtimePrice>, Box<dyn Error>> {
    let expected_prefix = "https://www.onvista.de";
    let url = if stock.onvista_url.starts_with(expected_prefix) {
        stock.onvista_url.clone()
    } else {
        format!("https://www.onvista.de/{}", &stock.onvista_url)
    };
    debug!("Querying realtime data from {}", url);
    let client = reqwest::Client::new();
    let resp = client
        .get(url)
        .header("User-Agent", USER_AGENT)
        .send()
        .await?;

    if !resp.status().is_success() {
        return Err(format!("Data request unsuccessful: status {}", resp.status()).into());
    }

    let body = resp.text().await?;
    let fragment = Html::parse_document(&body);

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
    debug!("{:?}", snapshot);
    if let Value::Null = snapshot {
        return Err("Could not obtain snapshot from JSON".into());
    }

    get_array(&snapshot["quoteList"]["list"])
        .ok_or("error parsing exchanges")?
        .iter()
        .map(|s| parse_exchange_price(s).ok_or_else(|| format!("error parsing {:?}", s).into()))
        .collect::<Result<Vec<_>, _>>()
}

fn parse_exchange_price(s: &Value) -> Option<RealtimePrice> {
    // let record_id = get_string(&s["idInstrument"])?.parse().ok()?;
    let record_id = get_i64(&s["market"]["idNotation"])? as i32;
    let price = get_f64(&s["last"])?;
    let date = get_timestamp(&s["datetimeLast"])?;

    Some(RealtimePrice {
        onvista_record_id: record_id,
        price,
        date,
    })
}
