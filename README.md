# StockDB

## TODO

- systemd timer for backups, also do them prior to updates

### Web

- account add/remove/update (invalidate afterwards)
- remove all cached data when the user logs out
- invalidate user info as soon as a 401 is encountered anywhere
- unify formatting and querying functions
- Use new daterange component as soon as it works better https://github.com/mui-org/material-ui-pickers

## Ideas

- set alerts for high drops / increases in values
- push notifications [weekly summary, daily only on huge sudden changes]
- watchlist of isins for each user, so that they can be analyzed (and so that notifications can be set for them?)
- StockAnalysis: List of exchanges and current prices (+ dates)
- compare stock performances
- proper maintenance of stock data (renew every week, do not delete old prices!)
- also grab and show ETF description, distribution of countries, corporations and sectors
- try to find out which index links to each ETF, grab data for those as well

## Install

- `openssl rand -base64 32` to obtain secret key
- `openssl ecparam -genkey -name prime256v1 -out vapid.pem` to obtain private key for push
- `openssl ec -in vapid.pem -pubout -outform DER | tail -c 65|base64|tr '/+' '_-' | tr -d '\n'` to obtain base64 encoded public key for use in js
