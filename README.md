# StockDB

## TODO

* CI (docker? which environments?)
* which exchanges to track for data? 
* commands:
  - add/remove/list stocks
  - add/remove/list accounts, transactions
  - add/remove stocks to watch (and flag them as force watched)
  - database cleanup (remove unneeded (no transactions, not force watched) stocks, old realtime data, prune exchange data) 
  - serve web interface 
  - update realtime / historic data (call via systemd-timer)

## Ideas 

* set alerts for high drops / increases in values 
* push notifications
* daily/weekly summary (as push)
* REST interface
* web UI (deploy to stocks.thiesgerken.de)
* analysis: IRR