# StockDB

Tool to query and analyze stock and ETF investments using realtime and historical price data.

## Development

With Nix, the dev shell (`direnv allow` or `nix develop`) brings Rust, node, npm and the openssl
and libpq the backend links against.

## Install

- `openssl rand -base64 32` to obtain secret key

## Configuration

Settings come from `/etc/stockdb/config.*`, `./stockdb.*` (any format the `config` crate reads,
e.g. TOML) or the file given with `--config`, and are overridden by `STOCKDB__*` environment
variables (`STOCKDB__WEB__PORT` for `[web] port`). `stockdb --dump` prints the effective
configuration.

| Key | Default | Meaning |
|---|---|---|
| `timezone` | `Europe/Berlin` | The users' time zone (IANA name). It decides where "Heute", weeks, months and years begin and on which day a transaction counts. An unknown name stops the program at startup. |

Exchange and receipt times are not affected: onvista quotes German exchanges and the supported
banks issue German receipts, so their times are always read as German local time.

## API tokens

The API otherwise expects a browser: a session cookie, or the `Remote-User` header from the
proxy. A program gets in with a token instead.

```shell
stockdb user --token <name>          # issue one, replacing any existing token
stockdb user --revoke-token <name>   # take it away again
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
