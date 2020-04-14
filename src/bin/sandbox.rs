use stockdb::initialize_logging;
use stockdb::onvista;

fn main() {
    initialize_logging(2);

    println!("{:?}", onvista::get_info("IE00BYX7KM37"));
    println!("{:?}", onvista::get_info("IE00BK5BQT80"));
}
