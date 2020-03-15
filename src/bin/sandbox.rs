use stockdb::initialize_logging;
use stockdb::onvista;

use chrono::offset::TimeZone;
use chrono::Local;

fn main() {
    initialize_logging(2);

    // let mut x = Vec::new();
    // x.push("lsdldl".to_owned());
    // println!("{:?}", x[1..8].len());

    // println!("{:?}", onvista::get_info("IE00BYX7KM37"));

    let (s, exs) = onvista::get_info("DE000EWG2LD7").unwrap();
    println!("{:?}", (&s, &exs));

    println!(
        "{:?}",
        onvista::get_data_historical(244499774, Local.ymd(2020, 1, 1))
    );

    println!("{:?}", onvista::get_data_realtime(&s, &exs));
}
