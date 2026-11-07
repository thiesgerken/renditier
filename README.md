# StockDB

Tool to query and analyze stock, ETF and crypto currency investments using realtime and historical
price data.

## Development

With Nix, the dev shell (`direnv allow` or `nix develop`) brings Rust, node, npm and the openssl
and libpq the backend links against.

The container image is built with Nix as well, for x86_64-linux only: `nix build .#image` yields a
script that streams the image as a tarball, e.g. `./result | docker load`.

## Backups

`renditier export > backup.json` writes all users with their accounts and transactions as JSON,
`renditier import < backup.json` reads such a backup back in. The import replaces the users the backup
contains, matched by name: an existing user with the same name is deleted together with their
accounts and transactions, then recreated from the backup. Every other user stays untouched, so
importing one user's backup into a database shared with others is safe.

All rows get fresh ids from the database, the backup's ids only link its rows among each other.
Replacing a user therefore changes their id and ends their sessions. A backup whose ids are
ambiguous (a user name or id twice) or dangling (an account of a user that is not in the backup)
is rejected before anything is written, and any error rolls the whole import back.

## Demo data

[`docs/demo/rudolph.json`](docs/demo/rudolph.json) holds the made-up user `Rudolph` with three
accounts and a few years of buys, sells, dividends and a custody fee in well-known stocks, ETFs and
Bitcoin. Use it for screenshots and for trying things out without real data. To edit it, change the
JSON by hand: ids only need to be unique within the file.

Against a local database (never the production one):

```shell
export RENDITIER__DATABASE=postgres://user@localhost/stocks
renditier import < docs/demo/rudolph.json
renditier -v stock --fetch    # adds the stocks the transactions reference
renditier -v data --fetch     # prices from onvista, takes a minute
```

Then serve it with `RENDITIER__WEB__TRUSTED_HEADER_AUTHENTICATION=true renditier serve` and let the
Vite dev server (`npm start` in `web`) log you in as Rudolph by adding the header to its proxy in
`web/vite.config.mjs`:

```js
proxy: {
  '/api': { target: 'http://localhost:8383', headers: { 'Remote-User': 'Rudolph' } },
},
```

The import test against a real database runs with
`RENDITIER_TEST_DATABASE=postgres://user@localhost/scratch cargo test -- --ignored` (it rolls back
everything it writes). CI starts a throwaway Postgres for it and runs it on every push.

## Install

- `openssl rand -base64 32` to obtain secret key

## Configuration

Settings come from `/etc/renditier/config.*`, `./renditier.*` (any format the `config` crate reads,
e.g. TOML) or the file given with `--config`, and are overridden by `RENDITIER__*` environment
variables (`RENDITIER__WEB__PORT` for `[web] port`). `renditier --dump` prints the effective
configuration.

| Key | Default | Meaning |
|---|---|---|
| `timezone` | `Europe/Berlin` | The users' time zone (IANA name). It decides where "Heute", weeks, months and years begin and on which day a transaction counts. An unknown name stops the program at startup. |

Exchange and receipt times are not affected: onvista quotes German exchanges and the supported
banks issue German receipts, so their times are always read as German local time. Crypto currencies
are the exception: onvista quotes them around the clock and in UTC, from sources such as Bitstamp
(Bitcoin) or CoinDesk (Ether). renditier still files their daily prices under German market hours
and weekdays like all others.

## Running the container

The image runs `renditier serve` as UID and GID 65534 (`nobody`). The user is numeric because the
image has no `/etc/passwd`, and Kubernetes' `runAsNonRoot` can only check a numeric one.

The root filesystem can be read-only, and no path has to be writable: the server keeps no files,
request bodies are JSON held in memory, and receipts are parsed in memory or piped through
`pdftotext` via stdin and stdout. A future upload route using Rocket's `TempFile` would be the
first thing to need a writable `/tmp` (an `emptyDir` or tmpfs).

It listens on port 8383, the default of `RENDITIER__WEB__PORT`. A non-root process can't bind below
1024, so map ports outside the container instead of setting 80. Set
`RENDITIER__WEB__ADDRESS=0.0.0.0`; the default listens on localhost only.

In Kubernetes:

```yaml
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 65534
    runAsGroup: 65534
    seccompProfile:
      type: RuntimeDefault
  containers:
    - name: renditier
      securityContext:
        readOnlyRootFilesystem: true
        allowPrivilegeEscalation: false
        capabilities:
          drop: [ALL]
```

With plain Docker (the image's user applies by default):

```shell
docker run --read-only --cap-drop ALL --security-opt no-new-privileges -p 8484:8383 \
  -e RENDITIER__WEB__ADDRESS=0.0.0.0 -e RENDITIER__DATABASE=postgres://... \
  -e RENDITIER__WEB__SECRET_KEY=... gitea.gerken.haus/thies/renditier:main
```

## API tokens

The API otherwise expects a browser: a session cookie, or the `Remote-User` header from the
proxy. A program gets in with a token instead.

```shell
renditier user --token <name>          # issue one, replacing any existing token
renditier user --revoke-token <name>   # take it away again
```

The token is printed once at issue time and only its hash is stored, so a lost one is reissued
rather than looked up. Present it as `Authorization: Bearer <token>`.

**A token reads and never writes.** It sees exactly what its user sees, but only through `GET`;
anything that creates, changes or deletes answers 401 no matter how valid the token is, and wants
a session behind it instead. A token carries no second factor and cannot be asked to confirm
anything, so a leaked one is a leaked copy of the data rather than a leaked ability to destroy it.

`GET /api/accounts/<id>/portfolio` is the same computation as `/api/analysis/portfolio` narrowed
to one account, which is what a caller after the current value of a single depot wants.

## Testing receipt parsing

Use the dedicated parse-only binary to test receipt parsing on local PDF files without connecting to PostgreSQL or writing any transactions:

```shell
cargo run --bin parse_receipt -- path/to/receipt.pdf
```

For machine-readable output:

```shell
cargo run --bin parse_receipt -- --json path/to/receipt.pdf
```

You can pass multiple files and add `-v` for parser debug logging.

## Fixing sequences

Usually needed after a database dump was imported, cf. <https://wiki.postgresql.org/wiki/Fixing_Sequences>

```sql
SELECT 'SELECT SETVAL(' ||
       quote_literal(quote_ident(PGT.schemaname) || '.' || quote_ident(S.relname)) ||
       ', COALESCE(MAX(' ||quote_ident(C.attname)|| '), 1) ) FROM ' ||
       quote_ident(PGT.schemaname)|| '.'||quote_ident(T.relname)|| ';'
FROM pg_class AS S,
     pg_depend AS D,
     pg_class AS T,
     pg_attribute AS C,
     pg_tables AS PGT
WHERE S.relkind = 'S'
    AND S.oid = D.objid
    AND D.refobjid = T.oid
    AND D.refobjid = C.attrelid
    AND D.refobjsubid = C.attnum
    AND T.relname = PGT.tablename
ORDER BY S.relname;
```

Write to `reset.sql`, then run

```shell
psql -Atq -f reset.sql -o temp -d stocks -U postgres
psql -f temp -d stocks -U postgres
```
