# StockDB

## TODO

* install on thiesgerken.de and test deployment 
* systemd timer for backups, also do them prior to updates

### Web

* web interface 
* update realtime and historic data (every few minutes) via systemd-timer (or thread in `serve`?); check for missing stock infos as well (every few hours?)
* transaction add/remove/update, account add/remove/update
* on transaction modification: check for missing stock infos, if any start an update as well
* charting data (subsampled historic data in simple form)

## Ideas 

* set alerts for high drops / increases in values 
* push notifications [weekly summary, daily on huge sudden changes]
* REST interface
* web UI (deploy to stocks.thiesgerken.de)
* plot price + units in portfolio in same axis

## Install

* `openssl rand -base64 32` to obtain secret key