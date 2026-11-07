-- The primary key starts with the date; finding an exchange's newest price
-- needs the exchange first.
CREATE INDEX realtime_prices_by_record ON realtime_prices (onvista_record_id, date DESC);
