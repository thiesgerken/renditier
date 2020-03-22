# StockDB

## TODO

- systemd timer for backups, also do them prior to updates

### Web

- web interface
- transaction add/remove/update, account add/remove/update
- server vapid key as the result of an api call, not hardcoded.
- remove all cached data when the user logs out
- invalidate user info as soon as a 401 is encountered
- do not register service worker for api requests?
- chart: invested money by ISIN as pie
- analysis for each isin, price chart with buys/sales => dedicated page for each stock; navigation?)
- comboboxes for positions table to set timespan
- portfolio plot: option to show invested+value instead of earnings
- Bug: Dashboard is a few pixels too wide (every screen size)

## Ideas

- set alerts for high drops / increases in values
- push notifications [weekly summary, daily on huge sudden changes] (read private key only once!)
- REST interface
- plot price + units in portfolio in same axis
- watchlist of isins for each user, so that they can be analyzed (and so that notifications can be set for them?)
- send a test notification as soon as a new device registers
- plots: switch to realtime prices with higher resolution as soon as < 10 days are requested

## Install

- `openssl rand -base64 32` to obtain secret key
- `openssl ecparam -genkey -name prime256v1 -out vapid.pem` to obtain private key for push
- `openssl ec -in vapid.pem -pubout -outform DER | tail -c 65|base64|tr '/+' '_-' | tr -d '\n'` to obtain base64 encoded public key for use in js
