# StockDB

## TODO

* build package (arch? ubuntu?) and put it in CI config

### Web

* web interface 
* update realtime and historic data via systemd-timer (or thread in `serve`?) (every few minutes); check for missing stock infos as well (every few hours?)
* on transaction modification: check for missing stock infos


### CLI

* json input/output for transactions, accounts, users (for automation and backups)
* see if any stock infos need adding after transaction modifications 
* see if any stock infos need adding in new command `stock --fetch`

## Ideas 

* set alerts for high drops / increases in values 
* push notifications [weekly summary, daily on huge sudden changes]
* REST interface
* web UI (deploy to stocks.thiesgerken.de)
* analysis: IRR, performance in some time window (day, week, month, year, total)