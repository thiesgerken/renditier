use crate::models::*;

use chrono::{Date, Local, NaiveDate, TimeZone, Utc};
use std::error::Error;

pub fn get_info(needle: &str) -> Result<(StockInfo, Vec<StockExchange>), Box<dyn Error>> {
    let params = qstring::QString::new(vec![("searchValue", needle)]);
    let mut resp = reqwest::get(&format!("https://www.onvista.de/suche?{}", params))?;

    if !resp.status().is_success() {
        Err("Data request unsuccessful")?;
    }

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
        .ok_or("error parsing type")?;

    if kind != "ETF" {
        Err(format!("'{}' is not an ETF", needle))?;
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
        .to_uppercase()
        .to_string();

    let country_code = td_wkn_country
        .select(&Selector::parse("i").unwrap())
        .next()
        .ok_or("error parsing country code")?
        .value()
        .attr("class")
        .ok_or("error parsing country code")?
        .to_string();

    // other infos
    let td_fonds_type = tds.next().ok_or("error parsing wkn and country code")?;
    let fonds_type = td_fonds_type
        .select(&Selector::parse("span").unwrap())
        .next()
        .ok_or("error parsing fonds type")?
        .value()
        .attr("title")
        .ok_or("error parsing fonds type")?
        .to_string();

    let td_isin = tds.next().ok_or("error parsing ISIN")?;
    let isin = td_isin
        .text()
        .next()
        .ok_or("error parsing ISIN")?
        .trim()
        .to_uppercase()
        .to_string();

    let td_focus = tds.next().ok_or("error parsing focus")?;
    let focus = td_focus
        .select(&Selector::parse("span").unwrap())
        .next()
        .ok_or("error parsing focus")?
        .value()
        .attr("title")
        .ok_or("error parsing focus")?
        .to_string();

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
            isin: isin,
            wkn: wkn,
            onvista_url: url,
            fonds_type: fonds_type,
            focus: focus,
            managing_company: company,
            title: title,
            country: country_code,
            last_historical_update: None,
            last_realtime_update: None,
        },
        exchanges,
    ))
}

fn parse_exchange(isin: &str, s: &scraper::node::Element) -> Option<StockExchange> {
    let ex_id = s.attr("data-id-exchange")?.parse().ok()?;
    let record_id = s.attr("data-value")?.parse().ok()?;
    let code = s.attr("data-exchange")?.to_string();
    let quality = s.attr("data-quality")?.to_string();
    let name = s.attr("data-contributor")?.to_string();

    Some(StockExchange {
        isin: isin.to_string(),
        onvista_exchange_id: ex_id,
        onvista_record_id: record_id,
        code: code,
        quality: quality,
        name: name,
    })
}

pub fn get_data_historical(
    onvista_record_id: i32,
    start: Date<Local>,
) -> Result<Vec<HistoricalPrice>, Box<dyn Error>> {
    let mut resp = reqwest::get(&format!("https://www.onvista.de/etf/snapshotHistoryCSV?kag=false&timeSpan=5Y&datetimeTzStartRange={}&idNotation={}",
      start.format("%d.%m.%Y"), onvista_record_id))
    ?;

    if !resp.status().is_success() {
        Err("Data request unsuccessful")?;
    }

    let body = resp.text()?;

    let mut rdr = csv::ReaderBuilder::new()
        .delimiter(b';')
        .from_reader(body.as_bytes());

    let headers = rdr.headers()?;
    if headers != vec!["Datum", "Eröffnung", "Hoch", "Tief", "Schluss", "Volumen"] {
        Err("Unexpected CSV headers")?;
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

    let date_splits = record.get(0)?.split(".").collect::<Vec<_>>();
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
        date: date,
        opening: opening,
        closing: closing,
        high: high,
        low: low,
        volume: volume,
        onvista_record_id: onvista_record_id,
    })
}

pub fn get_data_realtime(isin: &str) -> Result<Vec<RealtimePrice>, Box<dyn Error>> {
    let mut resp = reqwest::get(&format!(
        "https://www.onvista.de/etf/handelsplaetze/{}",
        isin
    ))?;

    if !resp.status().is_success() {
        Err("Data request unsuccessful")?;
    }

    use scraper::{Html, Selector};
    let body = resp.text()?;
    let fragment = Html::parse_document(&body);

    let tr_selector = Selector::parse("tr.stock-exchange-row").unwrap();
    let rows = fragment.select(&tr_selector);

    Ok(rows.filter_map(|s| parse_realtime_row(&s)).collect())
}

fn parse_realtime_row(s: &scraper::element_ref::ElementRef) -> Option<RealtimePrice> {
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
    let currency = s
        .select(&Selector::parse("span.price-currency").unwrap())
        .next()?
        .text()
        .next()?
        .trim();
    let date = s
        .select(&Selector::parse("span.price-datetime").unwrap())
        .next()?
        .text()
        .next()?
        .trim();
    let date = Local.datetime_from_str(date, "%d.%m.%Y, %H:%M:%S").ok()?;

    Some(RealtimePrice {
        date: date.with_timezone(&Utc),
        price: price,
        currency: currency.to_string(),
        onvista_record_id: id, // ID specific to exchange+stock
    })
}

// TODO

// use diesel::prelude::*;
// use stocks::*;

// fn main() {
//     use stocks::schema::stock_infos::dsl::*;

//     let connection = establish_connection();
//     run_migrations(&connection).expect("error running migrations");

//     let (info, exs) = get_info("IE00BK5BQT80").expect("error obtaining stock infos");

//     // TODO: add infos for all interesting isins, i.e. those that appear in transactions and that aren't in the db yet
//     // TODO: should also be able to do it manually from the command line
//     // TODO: cleanup command should also be available that simply deletes all infos

//     println!(
//         "{:?}",
//         diesel::insert_into(stocks::schema::stock_infos::table)
//             .values(&info)
//             .on_conflict_do_nothing()
//             .execute(&connection)
//             .expect("error inserting info")
//     );

//     println!(
//         "{:?}",
//         diesel::insert_into(stocks::schema::stock_exchanges::table)
//             .values(&exs)
//             .on_conflict_do_nothing()
//             .execute(&connection)
//             .expect("error inserting exchanges")
//     );

//     // TODO: use last update

//     let historical = get_data_historical(108344843, Local.ymd(2016, 1, 1))
//         .expect("error obtaining historical data");
//     println!(
//         "{:?}",
//         diesel::insert_into(stocks::schema::historical_prices::table)
//             .values(&historical)
//             .on_conflict_do_nothing()
//             .execute(&connection)
//             .expect("error inserting historical prices")
//     );

//     // TODO: use last update

//     let realtime = get_data_realtime("IE00BK5BQT80").expect("error obtaining realtime data");
//     println!(
//         "{:?}",
//         diesel::insert_into(stocks::schema::realtime_prices::table)
//             .values(&realtime)
//             .on_conflict_do_nothing()
//             .execute(&connection)
//             .expect("error inserting realtime prices")
//     );
// }
