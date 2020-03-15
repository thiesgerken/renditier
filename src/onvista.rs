use crate::models::*;

use chrono::{Date, Local, NaiveDate, TimeZone, Utc};
use log::{debug, warn};
use reqwest::blocking::Response;
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
        parse_etf(resp)
    } else if url.starts_with("https://www.onvista.de/derivate/etc-etn/") {
        debug!("recognized {} as an ETC or ETN", needle);
        parse_etc_etn(resp)
    } else {
        Err(format!("unrecognized url type: {}", url).into())
    }
}

fn parse_etf(resp: Response) -> Result<(StockInfo, Vec<StockExchange>), Box<dyn Error>> {
    use scraper::{Html, Selector};
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
        },
        exchanges,
    ))
}

fn parse_etc_etn(resp: Response) -> Result<(StockInfo, Vec<StockExchange>), Box<dyn Error>> {
    let url = resp
        .url()
        .as_str()
        .to_owned()
        .strip_prefix("https://www.onvista.de")
        .ok_or("url wrong prefix")?
        .to_owned();

    use scraper::{Html, Selector};
    let body = resp.text()?;
    let fragment = Html::parse_document(&body);

    // title
    let title_a = fragment
    .select(&Selector::parse("#snapshot-header > div:nth-child(1) > div:nth-child(2) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > a:nth-child(1)").unwrap()).next().ok_or("error obtaining title fragment")?.value();
    let title = title_a
        .attr("data-tooltip")
        .ok_or("error parsing title")?
        .to_string();

    let td_selector = Selector::parse(".very > tbody:nth-child(1) > tr > td").unwrap();
    let mut tds = fragment.select(&td_selector).skip(1).step_by(2);

    // wkn
    let td_wkn = tds.next().ok_or("error parsing wkn")?;
    let wkn = td_wkn
        .text()
        .next()
        .ok_or("error parsing wkn")?
        .trim()
        .to_uppercase();

    let td_isin = tds.next().ok_or("error parsing ISIN")?;
    let isin = td_isin
        .text()
        .next()
        .ok_or("error parsing ISIN")?
        .trim()
        .to_uppercase();

    // other infos
    let td_company = tds.next().ok_or("error parsing company")?;
    let company = td_company
        .text()
        .next()
        .ok_or("error parsing company")?
        .trim()
        .to_string();

    let mut kind = fragment
        .select(&Selector::parse("#snapshot > div:nth-child(3) > div:nth-child(1) > table:nth-child(3) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(2)").unwrap()).next().ok_or("error obtaining kind fragment")?.text().next() .ok_or("error parsing kind")?
        .trim().to_string();

    if kind.len() != 4 {
        return Err(format!("'{}' is not an ETC or ETN, it is {}", title, kind).into());
    }
    kind = kind[0..3].to_string();

    // exchanges
    let exchanges = fragment
        .select(&Selector::parse(".item > .selectExchange > option").unwrap())
        .map(|s| parse_etc_etn_exchange(&isin, &s))
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
            company,
            title,
            persistent: false,
            last_historical_update: None,
            last_realtime_update: None,
        },
        exchanges,
    ))
}

fn parse_etc_etn_exchange(
    isin: &str,
    s: &scraper::element_ref::ElementRef,
) -> Option<StockExchange> {
    let record_id = s.value().attr("data-idnotation")?.parse().ok()?;
    let code = s.value().attr("value")?.to_string();
    let name = s.text().next()?.trim().to_string();

    Some(StockExchange {
        isin: isin.to_string(),
        onvista_exchange_id: None,
        onvista_record_id: record_id,
        code,
        quality: None,
        name,
    })
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

    Ok(rdr
        .records()
        .filter_map(|s| parse_historical_row(onvista_record_id, s))
        .collect())
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

pub fn get_data_realtime(
    stock: &StockInfo,
    exchanges: &[StockExchange],
) -> Result<Vec<RealtimePrice>, Box<dyn Error>> {
    match stock.kind.as_str() {
        "ETF" => get_etf_data_realtime(&stock.isin),
        "ETC" | "ETN" => get_etc_etn_data_realtime(exchanges),
        s => Err(format!("unrecognized stock type: {}", s).into()),
    }
}

fn get_etc_etn_data_realtime(
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
            price = get_etc_etn_data_realtime_exchange(e.onvista_record_id, attempt)?;

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

fn get_etc_etn_data_realtime_exchange(
    onvista_record_id: i32,
    offset: i32,
) -> Result<Option<RealtimePrice>, Box<dyn Error>> {
    let resp = reqwest::blocking::get(&format!(
        "https://www.onvista.de/derivative/bond/snapshotTimesSalesCSV?idNotation={}&offset=-{}",
        onvista_record_id, offset
    ))?;

    if !resp.status().is_success() {
        return Err("Data request unsuccessful".into());
    }

    let body = resp.text()?;

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
    let date = Local.ymd(
        date_splits[2].parse()?,
        date_splits[1].parse()?,
        date_splits[0].parse()?,
    );

    Ok(rds
        .filter_map(|s| parse_etc_etn_realtime_row(onvista_record_id, &date, s))
        .next())
}

fn parse_etc_etn_realtime_row(
    onvista_record_id: i32,
    date: &Date<Local>,
    record: csv::StringRecord,
) -> Option<RealtimePrice> {
    if record.len() != 4 {
        return None;
    }

    let time_splits = record.get(0)?.split(':').collect::<Vec<_>>();
    let d = date.and_hms(
        time_splits[0].parse().ok()?,
        time_splits[1].parse().ok()?,
        time_splits[2].parse().ok()?,
    );

    let price = record
        .get(1)?
        .replace(".", "")
        .replace(",", ".")
        .parse()
        .ok()?;

    Some(RealtimePrice {
        date: d.with_timezone(&Utc),
        price,
        onvista_record_id,
    })
}

fn get_etf_data_realtime(isin: &str) -> Result<Vec<RealtimePrice>, Box<dyn Error>> {
    let resp = reqwest::blocking::get(&format!(
        "https://www.onvista.de/etf/handelsplaetze/{}",
        isin
    ))?;

    if !resp.status().is_success() {
        return Err("Data request unsuccessful".into());
    }

    use scraper::{Html, Selector};
    let body = resp.text()?;
    let fragment = Html::parse_document(&body);

    let tr_selector = Selector::parse("tr.stock-exchange-row").unwrap();
    let rows = fragment.select(&tr_selector);

    Ok(rows.filter_map(|s| parse_etf_realtime_row(&s)).collect())
}

fn parse_etf_realtime_row(s: &scraper::element_ref::ElementRef) -> Option<RealtimePrice> {
    use scraper::Selector;

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
