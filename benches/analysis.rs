use stockdb::analysis::{performance, portfolio};
use stockdb::cli;
use stockdb::models::*;

use chrono::Utc;
use criterion::{black_box, criterion_group, criterion_main, Criterion};
use log::debug;
use simplelog::{LevelFilter, SimpleLogger, TermLogger, TerminalMode};

pub fn criterion_benchmark(c: &mut Criterion) {
    let mut log_config = simplelog::ConfigBuilder::new();
    log_config.set_time_format_str("");

    let level = LevelFilter::Info;
    TermLogger::init(level, log_config.build(), TerminalMode::Mixed)
        .ok()
        .or_else(|| SimpleLogger::init(level, log_config.build()).ok())
        .unwrap();

    let settings = cli::initialize_settings(Some("stockdb.toml")).unwrap();
    let config = settings.try_into::<cli::Config>().unwrap();
    let connection = stockdb::connect(&config.database).unwrap();
    debug!("config={:?}", &config);

    c.bench_function("performance::compute", |b| {
        b.iter(|| performance::compute(&connection, black_box(4), Utc::now()))
    });
    c.bench_function("portfolio::compute<RealtimePrice>", |b| {
        b.iter(|| portfolio::compute::<RealtimePrice>(&connection, black_box(4), Utc::now()))
    });
    c.bench_function("portfolio::compute<HistoricalPrice>", |b| {
        b.iter(|| portfolio::compute::<HistoricalPrice>(&connection, black_box(4), Utc::now()))
    });
}

criterion_group!(
  name = benches;
  config = Criterion::default().sample_size(20);
  targets = criterion_benchmark
);
criterion_main!(benches);
