# StockDB

## TODO

- systemd timer for backups, also do them prior to updates
- import from stockdb:
  - do not clean stock infos and prices,
  - import exchanges properly

### Web

- transaction add/remove/update, account add/remove/update
- server vapid key as the result of an api call, not hard-coded.
- remove all cached data when the user logs out
- invalidate user info as soon as a 401 is encountered
- do not register service worker for api requests?
- unify formatting and querying functions, subdirectories for components folder
- Use new daterange component as soon as it works better https://github.com/mui-org/material-ui-pickers

## Ideas

- set alerts for high drops / increases in values
- push notifications [weekly summary, daily only on huge sudden changes]
- REST interface
- watchlist of isins for each user, so that they can be analyzed (and so that notifications can be set for them?)
- send a test notification as soon as a new device registers
- StockAnalysis: List of exchanges and current prices (+ dates)

## Install

- `openssl rand -base64 32` to obtain secret key
- `openssl ecparam -genkey -name prime256v1 -out vapid.pem` to obtain private key for push
- `openssl ec -in vapid.pem -pubout -outform DER | tail -c 65|base64|tr '/+' '_-' | tr -d '\n'` to obtain base64 encoded public key for use in js
