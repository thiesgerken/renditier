CREATE TABLE stock_exchanges (
  isin CHAR(12) NOT NULL REFERENCES stock_infos(isin),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  quality TEXT NOT NULL,
  onvista_record_id INTEGER PRIMARY KEY,
  onvista_exchange_id INTEGER NOT NULL
)
