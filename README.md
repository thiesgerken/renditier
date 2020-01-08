# StockDB

## TODO

* build package (arch? ubuntu?) and put it in CI config. include completions and default config

### Web

* web interface 
* update realtime and historic data (every few minutes) via systemd-timer (or thread in `serve`?); check for missing stock infos as well (every few hours?)
* on transaction modification: check for missing stock infos
* charting data (subsampled historic data in simple form)

### CLI

* basic calculations?

## Ideas 

* set alerts for high drops / increases in values 
* push notifications [weekly summary, daily on huge sudden changes]
* REST interface
* web UI (deploy to stocks.thiesgerken.de)
* analysis: IRR, performance in some time window (day, week, month, year, total)
* plot price + units in portfolio in same axis