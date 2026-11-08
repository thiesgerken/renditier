<p align="center">
  <img alt="Renditier" src="docs/brand/logo/renditier-lockup.png#gh-light-mode-only" width="360">
  <img alt="Renditier" src="docs/brand/logo/renditier-lockup-reversed.png#gh-dark-mode-only" width="360">
</p>
<p align="center"><strong>What your depots are worth, and what they really earned.</strong></p>

<p align="center">Stocks, ETFs and crypto with prices from onvista. Receipts straight from the bank's PDF.</p>

<p align="center">
  <a href="#-getting-started">🚀 Getting started</a>
  ·
  <a href="#-screenshots">📸 Screenshots</a>
  ·
  <a href="#-configuration">🔧 Configuration</a>
  ·
  <a href="docs/brand/styleguide.md">🎨 Brand</a>
</p>

Renditier keeps track of your securities accounts (depots): what you bought and sold, what it is
worth now and what it has earned, per position and for any period. It fetches realtime and
historical prices from onvista, reads the transactions from your bank's PDF receipts, and looks
through funds into what they hold. It runs on your own server, serves a household of users, and
installs on an Android phone as an app. The name is *Rendite* (return) plus *Rentier*: the
reindeer, and the person who lives off their investments.

## ✨ Highlights

- 📈 **The return that counts.** Depot value, invested amount, gain and the money-weighted return
  (IRR, % p.a.) for today, this week, month or year, any earlier year, or all time.
- 🔍 **Every position, every period.** Positions with value, gain and return, a table of periods,
  and the allocation by holding, sector, currency and country, looking through funds into what
  they hold.
- ⏱️ **Prices on their own.** Realtime quotes and full price history from onvista for stocks, ETFs,
  funds, Bitcoin and Ether, fetched in the background every minute. A security is added as soon as
  a transaction references it.
- 🧾 **Receipts instead of typing.** Upload the PDF receipts of comdirect and onvista bank, and the
  buy, sell or dividend is booked with its date, exchange and fees.
- 📊 **Charts that answer something.** Gain over time with every buy and sell marked, price and
  units held per security, several securities compared on a log scale, and drag to zoom.
- 👥 **For the household.** Several users with their own depots. Log in with a password, or behind
  a reverse proxy via its `Remote-User` header; scripts and other apps get read-only API tokens.
- 📱 **On the phone too.** Installable as a web app on Android, with a layout for small screens,
  German and English, light and dark following the system.
- 🐳 **Small to run.** One container next to Postgres, built with Nix, running as non-root on a
  read-only root filesystem.

## 💡 Motivation

<!-- Draft. Thies rewrites this in his own words. -->

Banks show what a depot is worth today, and little about what it earned once deposits,
withdrawals and fees are taken into account. Renditier answers that question for every position
and period, across all depots, with data that stays on my own server.

## 📸 Screenshots

<p align="center">
  <img alt="Dashboard" src="docs/screenshots/dashboard-light.png#gh-light-mode-only" width="1000">
  <img alt="Dashboard" src="docs/screenshots/dashboard-dark.png#gh-dark-mode-only" width="1000">
</p>

<p align="center"><em>The dashboard: depot value, invested amount, gain and IRR, and the gain over time with every buy and sell.</em></p>

<br>

<p align="center">
  <img alt="A security" src="docs/screenshots/stock-light.png#gh-light-mode-only" width="1000">
  <img alt="A security" src="docs/screenshots/stock-dark.png#gh-dark-mode-only" width="1000">
</p>

<p align="center"><em>A security: its facts from onvista, the price in brand orange and the units held in blue.</em></p>

<br>

<p align="center">
  <img alt="Transactions" src="docs/screenshots/transactions-light.png#gh-light-mode-only" width="1000">
  <img alt="Transactions" src="docs/screenshots/transactions-dark.png#gh-dark-mode-only" width="1000">
</p>

<p align="center"><em>Transactions: buys, sells and dividends with their fees, typed in or read from bank receipts.</em></p>

<br>

<p align="center">
  <img alt="Securities" src="docs/screenshots/stocks-light.png#gh-light-mode-only" width="1000">
  <img alt="Securities" src="docs/screenshots/stocks-dark.png#gh-dark-mode-only" width="1000">
</p>

<p align="center"><em>Securities compared over any period, and the list with their returns.</em></p>

All screenshots show the demo user Rudolph: his transactions are made up, the prices are real.

## 🚀 Getting started

[`docker-compose.yaml`](docker-compose.yaml) runs Renditier with a Postgres next to it:

```shell
docker compose up -d
docker compose exec renditier renditier user --add <name>   # asks for full name and password
```

Open <http://localhost:8484> and log in. Create a depot under *Depots*, then add transactions by
hand or upload receipts under *Transactions*. Prices arrive within a minute.

The compose file's secret key is a demo value: anyone could decrypt the session cookies with it.
Generate a real one with `openssl rand -base64 32` before using Renditier for real data. Running the
image elsewhere, Kubernetes included, is in [operations](docs/operations.md).

## 🔧 Configuration

Settings come from `/etc/renditier/config.*`, `./renditier.*` (any format the `config` crate reads,
e.g. TOML) or the file given with `--config`, and are overridden by `RENDITIER__*` environment
variables (`RENDITIER__WEB__PORT` for `[web] port`). `renditier --dump` prints the effective
configuration.

| Key | Default | Meaning |
|---|---|---|
| `database` | `postgres://localhost/stocks` | The Postgres connection URL. |
| `timezone` | `Europe/Berlin` | The users' time zone (IANA name). It decides where "today", weeks, months and years begin and on which day a transaction counts. An unknown name stops the program at startup. |
| `web.address` | `127.0.0.1` | The address to listen on; `0.0.0.0` in a container. |
| `web.port` | `8383` | The port to listen on. |
| `web.secret_key` | none | Encrypts the session cookies: 32 random bytes in base64 (`openssl rand -base64 32`). |
| `web.trusted_header_authentication` | `false` | Trust the user name in the `Remote-User` header. Only behind a reverse proxy that sets it. |
| `web.authentication_redirect` | none | Where the app sends a visitor who isn't logged in, e.g. the proxy's login page. |
| `receipts.prefer_pdftotext` | `false` | Read receipts with `pdftotext` (poppler) first and the built-in parser as the fallback, instead of the other way round. |

Exchange and receipt times are not affected by `timezone`: onvista quotes German exchanges and the
supported banks issue German receipts, so their times are always read as German local time. Crypto
currencies are the exception: onvista quotes them around the clock and in UTC, from sources such as
Bitstamp (Bitcoin) or CoinDesk (Ether). Renditier still files their daily prices under German market
hours and weekdays like all others.

## 🛠️ Development

With Nix, the dev shell (`direnv allow` or `nix develop`) brings Rust, node, npm and the openssl
and libpq the backend links against. The backend embeds the built frontend, so build it once
(`cd web && npm run build`), then start the backend with `cargo run -- serve` and the frontend with
hot reload with `npm start` in `web`.

The container image is built with Nix as well, for x86_64-linux only: `nix build .#image` yields a
script that streams the image as a tarball, e.g. `./result | docker load`.

[`docs/demo/rudolph.json`](docs/demo/rudolph.json) holds the made-up user Rudolph with three
depots and a few years of buys, sells, dividends and a custody fee. Import it into a local database,
never the production one, to try things out or to take screenshots:

```shell
renditier import < docs/demo/rudolph.json
renditier -v stock --fetch    # adds the securities the transactions reference
renditier -v data --fetch     # prices from onvista, takes a minute
```

[Screenshots](docs/screenshots/README.md) explains how to log in as Rudolph from the dev server.

The import test against a real database runs with
`RENDITIER_TEST_DATABASE=postgres://user@localhost/scratch cargo test -- --ignored` (it rolls back
everything it writes). CI starts a throwaway Postgres for it on every push.

To test the receipt parser on local PDFs without a database:
`cargo run --bin parse_receipt -- [--json] [-v] receipt.pdf…`.

## 📚 More

- [Operations](docs/operations.md): running the container hardened, Kubernetes, backups.
- [API](docs/api.md): read-only tokens for scripts and other apps.
- [Brand](docs/brand/styleguide.md): logo, colours, type.
