# StockDB

## TODO

* CI (docker? which environments?)
* which exchanges to track for data? 
* commands:
  - add/remove/list accounts, transactions
  - user delete/list should take accounts and transactions into account
  - database cleanup (remove unneeded (no transactions, not force watched) stocks, old realtime data) 
  - serve web interface 
  - update realtime / historic data (call via systemd-timer and/or thread in `serve` function)

## Ideas 

* set alerts for high drops / increases in values 
* push notifications [weekly summary, daily on huge sudden changes]
* REST interface
* web UI (deploy to stocks.thiesgerken.de)
* analysis: IRR