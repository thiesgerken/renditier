CREATE TABLE stock_infos (
  isin CHAR(12) PRIMARY KEY,
  wkn CHAR(6) NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  company TEXT NOT NULL,
  fonds_type TEXT,
  focus TEXT,
  persistent BOOLEAN NOT NULL,
  onvista_url TEXT NOT NULL,
  last_historical_update TIMESTAMPTZ,
  last_realtime_update TIMESTAMPTZ 
)
