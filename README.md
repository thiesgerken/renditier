# StockDB

## TODO

- systemd timer for backups, also do them prior to updates

### Web

- web interface
- transaction add/remove/update, account add/remove/update
- charting data (subsampled historic data in simple form)
- server vapid key as the result of an api call, not hardcoded.
- add/update/delete transactions
- remove all cached data when the user logs out
- invalidate user info as soon as a 401 is encountered
- colors in dashboard, show percentages
- do not register service worker for api requests?

## Ideas

- set alerts for high drops / increases in values
- push notifications [weekly summary, daily on huge sudden changes] (read private key only once!)
- REST interface
- plot price + units in portfolio in same axis

## Install

- `openssl rand -base64 32` to obtain secret key
- `openssl ecparam -genkey -name prime256v1 -out vapid.pem` to obtain private key for push
- `openssl ec -in vapid.pem -pubout -outform DER | tail -c 65|base64|tr '/+' '_-' | tr -d '\n'` to obtain base64 encoded public key for use in js
