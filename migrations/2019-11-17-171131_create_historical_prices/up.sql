CREATE TABLE historical_prices (
  date DATE NOT NULL,
  opening DOUBLE PRECISION NOT NULL,
  closing DOUBLE PRECISION NOT NULL,
  high DOUBLE PRECISION NOT NULL,
  low DOUBLE PRECISION NOT NULL,
  volume INTEGER NOT NULL,
  onvista_record_id INTEGER NOT NULL REFERENCES stock_exchanges(onvista_record_id) ON DELETE CASCADE,
  PRIMARY KEY (date, onvista_record_id)
)
