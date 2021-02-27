use crate::models::*;

use chrono::{Date, Datelike, Local, TimeZone, Utc};
use log::{debug, warn};
use reqwest::Response;
use std::error::Error;

pub async fn parse_info(resp: Response) -> Result<(StockInfo, Vec<StockExchange>), Box<dyn Error>> {
    let url = resp
        .url()
        .as_str()
        .to_owned()
        .strip_prefix("https://www.onvista.de")
        .ok_or("url wrong prefix")?
        .to_owned();

    use scraper::{Html, Selector};
    let body = resp.text().await?;
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
        .select(
            &Selector::parse(
                "#snapshot > div:nth-child(3) > div:nth-child(1) > table:nth-child(3) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(2)",
            )
            .unwrap(),
        )
        .next()
        .ok_or("error obtaining kind fragment")?
        .text()
        .next()
        .ok_or("error parsing kind")?
        .trim()
        .to_string();

    if kind.len() != 4 {
        return Err(format!("'{}' is not an ETC or ETN, it is {}", title, kind).into());
    }
    kind = kind[0..3].to_string();

    // exchanges
    let exchanges = fragment
        .select(&Selector::parse(".item > .selectExchange > option").unwrap())
        .map(|s| parse_exchange(&isin, &s))
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
            holdings: None,
            industry_breakdown: None,
            country_breakdown: None,
            currency_breakdown: None,
            instrument_breakdown: None,
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

fn parse_exchange(isin: &str, s: &scraper::element_ref::ElementRef) -> Option<StockExchange> {
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
    let resp = reqwest::get(&format!(
        "https://www.onvista.de/derivative/bond/snapshotTimesSalesCSV?idNotation={}&offset=-{}",
        onvista_record_id, offset
    ))
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
    let date = Local.ymd(
        date_splits[2].parse()?,
        date_splits[1].parse()?,
        date_splits[0].parse()?,
    );

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
    date: Date<Local>,
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
