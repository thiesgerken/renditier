CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL,
  isin CHAR(12) NOT NULL, 
  date TIMESTAMPTZ NOT NULL,
  units DOUBLE PRECISION NOT NULL, 
  amount MONEY NOT NULL,
  fees MONEY NOT NULL,
  onvista_exchange_id INTEGER NOT NULL
)
