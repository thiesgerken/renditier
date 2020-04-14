use crate::models::*;

use chrono::{DateTime, Local, TimeZone, Utc};
use regex::Regex;
use reqwest::blocking::Response;
use scraper::{ElementRef, Html, Selector};
use std::collections::HashMap;
use std::error::Error;

pub fn parse_info(resp: Response) -> Result<(StockInfo, Vec<StockExchange>), Box<dyn Error>> {
    let body = resp.text()?;
    let fragment = Html::parse_document(&body);

    // title and url
    let title_a = fragment
    .select(&Selector::parse("#snapshot-header > div:nth-child(1) > div:nth-child(2) > div:nth-child(1) > a:nth-child(1)").unwrap()).next().ok_or("error obtaining title fragment")?.value();
    let title = title_a
        .attr("title")
        .ok_or("error parsing title")?
        .to_string();
    let url = title_a.attr("href").ok_or("error parsing url")?.to_string();

    // type
    let kind = fragment
        .select(&Selector::parse("div.ui.mini.label").unwrap())
        .next()
        .ok_or("error parsing type")?
        .text()
        .next()
        .ok_or("error parsing type")?
        .to_string();

    if kind != "ETF" {
        return Err(format!("'{}' is not an ETF, it is {}", title, kind).into());
    }

    let td_selector = Selector::parse(".very > tbody:nth-child(1) > tr > td").unwrap();
    let mut tds = fragment.select(&td_selector).skip(1).step_by(2);

    // wkn and country code
    let td_wkn_country = tds.next().ok_or("error parsing wkn and country code")?;
    let wkn = td_wkn_country
        .text()
        .next()
        .ok_or("error parsing wkn")?
        .trim()
        .to_uppercase();

    // other infos
    let td_fonds_type = tds.next().ok_or("fonds type")?;
    let fonds_type = Some(
        td_fonds_type
            .select(&Selector::parse("span").unwrap())
            .next()
            .ok_or("error parsing fonds type")?
            .value()
            .attr("title")
            .ok_or("error parsing fonds type")?
            .to_string(),
    );

    let td_isin = tds.next().ok_or("error parsing ISIN")?;
    let isin = td_isin
        .text()
        .next()
        .ok_or("error parsing ISIN")?
        .trim()
        .to_uppercase();

    let td_focus = tds.next().ok_or("error parsing focus")?;
    let focus = Some(
        td_focus
            .select(&Selector::parse("span").unwrap())
            .next()
            .ok_or("error parsing focus")?
            .value()
            .attr("title")
            .ok_or("error parsing focus")?
            .to_string(),
    );

    let td_company = tds.next().ok_or("error parsing company")?;
    let company = td_company
        .select(&Selector::parse("a").unwrap())
        .next()
        .ok_or("error parsing company")?
        .value()
        .attr("title")
        .ok_or("error parsing company")?
        .to_string();

    // exchanges
    let exchanges = fragment
        .select(&Selector::parse("#select-exchange div.item").unwrap())
        .map(|s| s.value())
        .map(|s| parse_exchange(&isin, s))
        .filter_map(|x| x)
        .collect::<Vec<_>>();

    // other infos
    let td_selector =
        Selector::parse("table.ui:nth-child(2) > tbody:nth-child(1) > tr > td").unwrap();
    let mut tds = fragment.select(&td_selector).skip(1).step_by(2);

    let launch_date = parse_launch_date(tds.next());
    let currency = get_td_text(tds.next());
    let management_type = get_td_text(tds.next());
    let payout_type = get_td_text(tds.next());

    let ter_selector = Selector::parse(
        "table.ui:nth-child(4) > tbody:nth-child(1) > tr:nth-child(3) > td:nth-child(2)",
    )
    .unwrap();
    let ter = parse_percentage(fragment.select(&ter_selector).next());

    let holdings_selector =
        Selector::parse("html body.body-seiteLinksbuendig1400ODEV-1068.removeSuperBannerODEV-964.full-width div#ONVISTA.ui.raised.segment.container-seiteLinksbuendig1400ODEV-1068.full-width.no-margin div.container-wrapper main#etf-snapshot.snapshot div.ui.grid div.six.wide.column table.ui.compact.table > tbody > tr").unwrap();
    let holdings = fragment
        .select(&holdings_selector)
        .flat_map(parse_holding)
        .collect::<Vec<Holding>>();
    let holdings = serde_json::to_string(&holdings).ok();

    let industry_breakdown = get_breakdown(isin.clone(), "industries").ok();
    let instrument_breakdown = get_breakdown(isin.clone(), "instruments").ok();
    let country_breakdown = get_breakdown(isin.clone(), "countries").ok();
    let currency_breakdown = get_breakdown(isin.clone(), "currencies").ok();

    Ok((
        StockInfo {
            isin,
            wkn,
            onvista_url: url,
            kind,
            fonds_type,
            focus,
            company,
            title,
            persistent: false,
            last_historical_update: None,
            last_realtime_update: None,
            holdings,
            industry_breakdown,
            instrument_breakdown,
            country_breakdown,
            currency_breakdown,
            launch_date,
            currency,
            management_type,
            payout_type,
            ter,
        },
        exchanges,
    ))
}

pub fn get_breakdown(isin: String, kind: &str) -> Result<String, Box<dyn Error>> {
    let client = reqwest::blocking::Client::new();

    let mut params = HashMap::new();
    params.insert("type".to_owned(), kind.to_owned());
    params.insert("isin".to_owned(), isin);

    let resp = client
        .post("https://www.onvista.de/etf/ajax/etfBreakdownList")
        .form(&params)
        .send()?;

    if !resp.status().is_success() {
        return Err("Data request unsuccessful".into());
    }

    let body = resp.text()?;

    Ok(body)
}

fn get_td_text(td: Option<ElementRef>) -> Option<String> {
    Some(td?.text().next()?.trim().to_string())
}

fn parse_holding(tr: ElementRef) -> Option<Holding> {
    let td_selector = Selector::parse("td").unwrap();
    let mut tds = tr.select(&td_selector);
    let share = parse_percentage(tds.next())?;

    let a_selector = Selector::parse("a").unwrap();
    let a = tr.select(&a_selector).next();

    match a {
        Some(a) => {
            let name = a.inner_html();
            let name = name.trim().to_owned();

            let url = a.value().attr("href")?;
            let url = Some(format!("https:{}", url));

            let a_title = a.value().attr("title")?;
            let re = Regex::new(r"^WKN: (\d+), Wertpapiertyp: (.+)$").unwrap();
            let cap = re.captures_iter(a_title.trim()).next()?;
            let wkn = Some(cap[1].to_owned());
            let kind = Some(cap[2].to_owned());

            Some(Holding {
                wkn,
                kind,
                url,
                name,
                share,
            })
        }
        None => {
            let name = tds.next()?.inner_html();
            let name = name.trim().to_owned();

            Some(Holding {
                wkn: None,
                kind: None,
                url: None,
                name,
                share,
            })
        }
    }
}

fn parse_percentage(td: Option<ElementRef>) -> Option<f64> {
    let t = td?.text().next()?.trim().replace(",", ".");
    let f = t[0..(t.len() - 2)].parse::<f64>().ok()?;
    Some(f / 100.0)
}

fn parse_launch_date(td: Option<ElementRef>) -> Option<DateTime<Utc>> {
    let date_splits = td?.text().next()?.trim().split('.').collect::<Vec<_>>();

    Some(
        Local
            .ymd(
                date_splits[2].parse().ok()?,
                date_splits[1].parse().ok()?,
                date_splits[0].parse().ok()?,
            )
            .and_hms(9, 0, 0)
            .with_timezone(&Utc),
    )
}

fn parse_exchange(isin: &str, s: &scraper::node::Element) -> Option<StockExchange> {
    let ex_id = Some(s.attr("data-id-exchange")?.parse().ok()?);
    let record_id = s.attr("data-value")?.parse().ok()?;
    let code = s.attr("data-exchange")?.to_string();
    let quality = Some(s.attr("data-quality")?.to_string());
    let name = s.attr("data-contributor")?.to_string();

    Some(StockExchange {
        isin: isin.to_string(),
        onvista_exchange_id: ex_id,
        onvista_record_id: record_id,
        code,
        quality,
        name,
    })
}

pub fn get_data_realtime(isin: &str) -> Result<Vec<RealtimePrice>, Box<dyn Error>> {
    let resp = reqwest::blocking::get(&format!(
        "https://www.onvista.de/etf/handelsplaetze/{}",
        isin
    ))?;

    if !resp.status().is_success() {
        return Err("Data request unsuccessful".into());
    }

    let body = resp.text()?;
    let fragment = Html::parse_document(&body);

    let tr_selector = Selector::parse("tr.stock-exchange-row").unwrap();
    let rows = fragment.select(&tr_selector);

    Ok(rows.filter_map(|s| parse_realtime_row(&s)).collect())
}

fn parse_realtime_row(s: &scraper::element_ref::ElementRef) -> Option<RealtimePrice> {
    let id: i32 = s.value().attr("data-id-notation")?.parse().ok()?;
    let price: f64 = s
        .select(&Selector::parse("span.price").unwrap())
        .next()?
        .text()
        .next()?
        .trim()
        .replace(".", "")
        .replace(",", ".")
        .parse()
        .ok()?;
    let date = s
        .select(&Selector::parse("span.price-datetime").unwrap())
        .next()?
        .text()
        .next()?
        .trim();
    let date = Local.datetime_from_str(date, "%d.%m.%Y, %H:%M:%S").ok()?;

    Some(RealtimePrice {
        date: date.with_timezone(&Utc),
        price,
        onvista_record_id: id, // ID specific to exchange+stock
    })
}
