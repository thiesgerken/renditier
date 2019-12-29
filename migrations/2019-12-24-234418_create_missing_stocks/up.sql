CREATE VIEW missing_stocks AS
   select distinct isin from transactions where not exists (select * from stock_infos where transactions.isin = stock_infos.isin)