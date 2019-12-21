CREATE VIEW superfluous_stocks AS
   select * from stock_infos where not exists (select * from transactions where transactions.isin = stock_infos.isin) and persistent = false