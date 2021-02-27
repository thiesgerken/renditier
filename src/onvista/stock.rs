use crate::models::*;

use chrono::{Local, NaiveDate, NaiveTime, TimeZone, Utc};
use regex::Regex;
use reqwest::Response;
use scraper::{ElementRef, Html, Selector};
use std::error::Error;

pub async fn parse_info(resp: Response) -> Result<(StockInfo, Vec<StockExchange>), Box<dyn Error>> {
    let body = resp.text().await?;
    let fragment = Html::parse_document(&body);

    // title and url
    let title_a = fragment
        .select(&Selector::parse("a.INSTRUMENT").unwrap())
        .next()
        .ok_or("error obtaining title fragment")?
        .value();
    let title = title_a
        .attr("title")
        .ok_or("error parsing title")?
        .to_string();
    let url = title_a.attr("href").ok_or("error parsing url")?.to_string();

    let kind = fragment
        .select(&Selector::parse("span.INSTRUMENT").unwrap())
        .next()
        .ok_or("error parsing type")?
        .text()
        .next()
        .ok_or("error parsing type")?
        .to_string();

    if kind != "Aktie" {
        return Err(format!("'{}' is not an stock, it is '{}'", title, kind).into());
    }

    let wkn = fragment
        .select(&Selector::parse("#myInputWKN").unwrap())
        .next()
        .ok_or("error parsing wkn")?
        .value()
        .attr("value")
        .ok_or("error parsing wkn")?
        .to_string();

    let isin = fragment
        .select(&Selector::parse("#myInputISIN").unwrap())
        .next()
        .ok_or("error parsing isin")?
        .value()
        .attr("value")
        .ok_or("error parsing isin")?
        .to_string();

    // parse realtime data from this page and augment the list of exchanges with codes
    let exchange_names_and_codes = fragment
        .select(&Selector::parse(".HANDELSPLAETZE tbody > tr").unwrap())
        .map(|s| parse_exchange_name_and_code(&s))
        .filter_map(|x| x)
        .collect::<Vec<_>>();

    let exchanges = fragment
        .select(&Selector::parse("#chartExchangesLayer > ul:nth-child(2) > li > a").unwrap())
        .map(|s| parse_exchange(&isin, &exchange_names_and_codes, &s))
        .filter_map(|x| x)
        .collect::<Vec<_>>();

    Ok((
        StockInfo {
            isin,
            wkn,
            onvista_url: url,
            kind,
            fonds_type: None,
            focus: None,
            company: title.clone(),
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
            currency: None,
            management_type: None,
            payout_type: None,
            ter: None,
            description: None,
            benchmark_index: None,
            instrument_id: None,
        },
        exchanges,
    ))
}

fn parse_exchange(
    isin: &str,
    names_and_codes: &[(String, String)],
    s: &ElementRef,
) -> Option<StockExchange> {
    let name = s.text().next()?.trim().to_string();
    let url = s.value().attr("href")?;

    let re = Regex::new(r"^\?notation=(\d+)$").unwrap();
    let cap = re.captures_iter(url.trim()).next()?;
    let record_id = cap[1].to_owned().parse().ok()?;

    let code = names_and_codes
        .iter()
        .find(|(n, _)| n.to_lowercase() == name.to_lowercase())
        .map(|(_, c)| c.clone())
        .unwrap_or_default();

    Some(StockExchange {
        isin: isin.to_string(),
        onvista_exchange_id: None,
        onvista_record_id: record_id,
        code,
        quality: None,
        name,
    })
}

fn parse_exchange_name_and_code(s: &ElementRef) -> Option<(String, String)> {
    let code = s.value().attr("class")?.trim().to_string();
    let name = s
        .select(&Selector::parse("td:nth-child(1) > a").unwrap())
        .next()
        .or(s
            .select(&Selector::parse("td:nth-child(1) > span").unwrap())
            .next())?
        .text()
        .next()?
        .trim()
        .to_string();

    Some((name, code))
}

pub async fn get_data_realtime(
    stock: &StockInfo,
    exchanges: &[StockExchange],
) -> Result<Vec<RealtimePrice>, Box<dyn Error>> {
    let resp = reqwest::get(&format!("https://www.onvista.de{}", &stock.onvista_url)).await?;

    if !resp.status().is_success() {
        return Err("Data request unsuccessful".into());
    }

    let body = resp.text().await?;
    let fragment = Html::parse_document(&body);

    let tr_selector = Selector::parse(".HANDELSPLAETZE tbody > tr").unwrap();
    let rows = fragment.select(&tr_selector);

    Ok(rows
        .filter_map(|s| parse_realtime_row(exchanges, &s))
        .collect())
}

fn parse_realtime_row(
    exchanges: &[StockExchange],
    s: &scraper::element_ref::ElementRef,
) -> Option<RealtimePrice> {
    let code = s.value().attr("class")?.trim().to_string();

    if code.is_empty() {
        return None;
    }

    let onvista_record_id = exchanges
        .iter()
        .find(|se| se.code.to_lowercase() == code.to_lowercase())?
        .onvista_record_id;

    let price = s
        .select(&Selector::parse("td:nth-child(3)").unwrap())
        .next()?
        .text()
        .next()?
        .trim()
        .split(' ')
        .next()?
        .replace(".", "")
        .replace(",", ".")
        .parse()
        .ok()?;

    let date = s
        .select(&Selector::parse("td:nth-child(6) > time:nth-child(1)").unwrap())
        .next()?
        .value()
        .attr("datetime")?
        .trim();
    let date = NaiveDate::parse_from_str(date, "%Y-%m-%d").ok()?;

    let time = s
        .select(&Selector::parse("td:nth-child(7) > time:nth-child(1)").unwrap())
        .next()?
        .value()
        .attr("datetime")?
        .trim();
    let time = NaiveTime::parse_from_str(time, "%H:%M:%S").ok()?;

    let datetime = Local.from_local_datetime(&date.and_time(time)).earliest()?;

    Some(RealtimePrice {
        date: datetime.with_timezone(&Utc),
        price,
        onvista_record_id, // ID specific to exchange+stock
    })
}
