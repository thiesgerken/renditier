-- Crypto currencies have no issuer.
ALTER TABLE stock_infos ALTER COLUMN company DROP NOT NULL;
