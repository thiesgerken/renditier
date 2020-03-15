CREATE TABLE realtime_prices (
  date TIMESTAMPTZ NOT NULL,
  price DOUBLE PRECISION NOT NULL,
  onvista_record_id INTEGER NOT NULL REFERENCES stock_exchanges(onvista_record_id) ON DELETE CASCADE,
  PRIMARY KEY (date, onvista_record_id)
)
