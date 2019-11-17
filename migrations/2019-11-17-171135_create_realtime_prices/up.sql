CREATE TABLE realtime_prices (
  date TIMESTAMPTZ NOT NULL,
  price DOUBLE PRECISION NOT NULL,
  currency TEXT, 
  onvista_record_id INTEGER NOT NULL,
  PRIMARY KEY (date, onvista_record_id)
)