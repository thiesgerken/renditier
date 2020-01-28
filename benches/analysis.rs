use chrono::Utc;
use criterion::{black_box, criterion_group, criterion_main, Criterion};
use log::debug;
use simplelog::{LevelFilter, SimpleLogger, TermLogger, TerminalMode};
use stocks::analysis::{performance, portfolio};
use stocks::cli::Config;
use stocks::models::*;
use stocks::*;

pub fn criterion_benchmark(c: &mut Criterion) {
  let level = LevelFilter::Info;

  let mut log_config = simplelog::ConfigBuilder::new();
  log_config.set_time_format_str("");

  TermLogger::init(level, log_config.build(), TerminalMode::Mixed)
    .ok()
    .or_else(|| SimpleLogger::init(level, log_config.build()).ok())
    .unwrap();

  let settings = cli::initialize_settings(Some("stockdb.toml")).unwrap();

  let config = settings.try_into::<Config>().unwrap();

  debug!("config={:?}", &config);

  let connection = connect(&config.database).unwrap();

  c.bench_function("performance::compute", |b| {
    b.iter(|| performance::compute(&connection, black_box(4), Utc::now()))
  });
  c.bench_function("portfolio::compute<RealtimePrice>", |b| {
    b.iter(|| portfolio::compute::<RealtimePrice>(&connection, black_box(4), Utc::now()))
  });
}

criterion_group!(
  name = benches;
  config = Criterion::default().sample_size(20);
  targets = criterion_benchmark
);
criterion_main!(benches);
