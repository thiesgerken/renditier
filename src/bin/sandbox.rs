use diesel::prelude::*;
use regex::Regex;
use stockdb::models::StockInfo;
use stockdb::onvista;
use stockdb::schema::stock_infos::dsl::*;
use stockdb::{connect, initialize_logging};

fn main() {
    initialize_logging(2);

    // println!("{:?}", onvista::get_info("IE00BYX7KM37"));
    // println!("{:?}", onvista::get_info("IE00BK5BQT80"));

    let connection =
        connect("postgres://localhost/stocks").expect("error connecting and migrating to db");

    let infos = stock_infos
        .load::<StockInfo>(&connection)
        .expect("error querying infos");

    let re = Regex::new(r"(MSCI|iSTOXX|STOXX|S&P|Dow Jones)[^ ]*(:? [^a-z(][\w]*)+").unwrap();

    for info in infos.iter() {
        println!("{}: {:?}", info.isin, info.description);

        if let Some(desc) = &info.description {
            println!(
                "{}: {:?}",
                info.isin,
                re.find_iter(&desc)
                    .map(|m| m.as_str())
                    .find(|m| !m.contains("ETF"))
            );
        }
    }
}
