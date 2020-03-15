CREATE TABLE stock_exchanges (
  isin CHAR(12) NOT NULL REFERENCES stock_infos(isin) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  quality TEXT,
  onvista_record_id INTEGER PRIMARY KEY,
  onvista_exchange_id INTEGER 
)
