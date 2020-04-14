ALTER TABLE stock_infos
ADD launch_date TIMESTAMPTZ,
ADD currency TEXT,
ADD management_type TEXT,
ADD payout_type TEXT,
ADD ter DOUBLE PRECISION;
