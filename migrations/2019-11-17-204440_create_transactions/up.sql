CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  isin CHAR(12) NOT NULL, 
  date TIMESTAMPTZ NOT NULL,
  units DOUBLE PRECISION NOT NULL, 
  amount BIGINT NOT NULL,
  fees BIGINT NOT NULL,
  onvista_exchange_id INTEGER,
  comments TEXT NOT NULL
)
