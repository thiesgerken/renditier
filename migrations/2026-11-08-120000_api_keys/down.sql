ALTER TABLE users
ADD COLUMN api_token_hash TEXT UNIQUE;

DROP TABLE api_keys;
