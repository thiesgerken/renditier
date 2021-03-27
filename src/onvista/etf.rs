use crate::models::*;
use crate::onvista::json_utils::*;

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

    let redux_json = fragment
        .select(&Selector::parse("html.ov-client--web body script#__NEXT_DATA__").unwrap())
        .next()
        .ok_or("error obtaining json")?
        .text()
        .next()
        .ok_or("error obtaining json")?;
    let redux_json: Value = serde_json::from_str(redux_json).map_err(|e| e.to_string())?;

    let snapshot = &redux_json["props"]["pageProps"]["snapshot"];
    debug!("{:?}", snapshot);
    if let Value::Null = snapshot {
        return Err("Could not obtain snapshot from JSON".into());
    }

    let launch_date =
        get_timestamp(&snapshot["fundsBaseData"]["dateEmission"]).ok_or_else(|| {
            format!(
                "error parsing launch date {}",
                &snapshot["fundsBaseData"]["dateEmission"]
            )
        })?;
    let currency = get_string(&snapshot["fundsBaseData"]["isoCurrencyFund"])
        .ok_or("error parsing currency")?;
    let ter = get_f64(&snapshot["fundsBaseData"]["ongoingCharges"]).ok_or("error parsing TER")?;
    let isin = get_string(&snapshot["instrument"]["isin"]).ok_or("error parsing isin")?;
    let instrument_id =
        get_string(&snapshot["instrument"]["entityValue"]).ok_or("error parsing instrument id")?;
    let wkn = get_string(&snapshot["instrument"]["wkn"]).ok_or("error parsing wkn")?;
    let title =
        get_string(&snapshot["fundsDetails"]["officialName"]).ok_or("error parsing title")?;
    let fonds_type =
        get_string(&snapshot["fundsDetails"]["nameTypeFund"]).ok_or("error parsing fonds_type")?;
    let focus = get_string(&snapshot["fundsDetails"]["nameInvestmentFocus"])
        .ok_or("error parsing focus")?;
    let company =
        get_string(&snapshot["fundsIssuer"]["nameGroupIssuer"]).ok_or("error parsing company")?;
    let payout_type = get_string(&snapshot["fundsDetails"]["fundsTypeCapitalisation"]["name"])
        .ok_or("error parsing payout_type")?;
    let description =
        get_string(&snapshot["background"][0]["value"]).ok_or("error parsing description")?;
    let benchmark = get_string(&snapshot["fundsBenchmarkList"]["list"][0]["instrument"]["name"])
        .ok_or("error parsing benchmark")?;

    let exchanges = get_array(&snapshot["quoteList"]["list"])
        .ok_or("error parsing exchanges")?
        .iter()
        .map(|s| parse_exchange(&isin, s).ok_or_else(|| format!("error parsing {:?}", s)))
        .collect::<Result<Vec<_>, _>>()?;

    let breakdowns = &redux_json["props"]["pageProps"]["breakdowns"];
    debug!("{:?}", breakdowns);
    if let Value::Null = breakdowns {
        return Err("Could not obtain breakdowns from JSON".into());
    }
    let holdings = breakdowns["fundsHoldingList"]["list"].to_string();
    let country_breakdown = breakdowns["countryBreakdown"]["list"].to_string();
    let industry_breakdown = breakdowns["branchBreakdown"]["list"].to_string();
    let currency_breakdown = breakdowns["currencyBreakdown"]["list"].to_string();
    let instrument_breakdown = breakdowns["instrumentBreakdown"]["list"].to_string();

    Ok((
        StockInfo {
            isin,
            wkn,
            onvista_url: url,
            kind: "ETF".to_string(),
            fonds_type: Some(fonds_type),
            focus: Some(focus),
            company,
            title,
            persistent: false,
            last_historical_update: None,
            last_realtime_update: None,
            holdings: Some(holdings),
            industry_breakdown: Some(industry_breakdown),
            instrument_breakdown: Some(instrument_breakdown),
            country_breakdown: Some(country_breakdown),
            currency_breakdown: Some(currency_breakdown),
            launch_date: Some(launch_date),
            currency: Some(currency),
            management_type: None,
            payout_type: Some(payout_type),
            ter: Some(ter / 100.),
            description: Some(description),
            benchmark_index: Some(benchmark),
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
    let resp = reqwest::get(&stock.onvista_url).await?;

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
    let redux_json: Value = serde_json::from_str(redux_json).map_err(|e| e.to_string())?;

    let snapshot = &redux_json["props"]["pageProps"]["snapshot"];
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
