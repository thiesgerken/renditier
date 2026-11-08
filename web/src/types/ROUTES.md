# API routes

All routes are mounted under `/api/` (see `src/web/mod.rs`). Type names refer to
`web/src/types/api.ts`.

Authentication is via a Rocket private cookie `user_id`, set by `POST /api/user/login`
(or, if `trusted_header_authentication` is enabled, by `GET /api/user` reading the
`Remote-User` header). Every route except `POST /api/user/login` and `GET /api/user`
requires it and returns `401 Unauthorized` without it. An API key (`Authorization: Bearer rk_...`,
see `docs/api.md`) works in place of the cookie on every route except `/api/keys`; a read key on
anything but `GET` returns `403 Forbidden`.

| Method | Path | Query params | Request body | Response body |
| --- | --- | --- | --- | --- |
| POST | `/api/user/login` | — | `LoginData` | `UserInfo` (401, no body, on bad credentials) |
| GET | `/api/user/logout` | — | — | none (200) |
| GET | `/api/user` | — | — | `UserInfo` (200 logged in; 401 + all-null `UserInfo` carrying `redirect` otherwise; 403 + no body if the cookie names an unknown user) |
| GET | `/api/keys` | — | — | `ApiKey[]` (session only) |
| POST | `/api/keys` | — | `NewApiKey` | `CreatedApiKey` (session only; 400 + `ErrString` on an empty name, a past expiry or a taken name) |
| DELETE | `/api/keys/<id>` | — | — | none (200 / 404; session only) |
| GET | `/api/accounts` | `offset`, `count` (i64) | — | `Account[]` |
| GET | `/api/accounts/<id>` | — | — | `Account` (404 if not owned) |
| POST | `/api/accounts` | — | `NewAccount` | `Account` |
| PUT | `/api/accounts/<id>` | — | `Account` | none (200 / 404) |
| DELETE | `/api/accounts/<id>` | — | — | none (200 / 404) |
| GET | `/api/transactions` | `offset`, `count` (i64) | — | `Transaction[]` |
| GET | `/api/transactions/<id>` | — | — | `Transaction` (404 if not owned) |
| POST | `/api/transactions` | — | `NewTransaction` | `Transaction` (400 if `accountId` is not owned) |
| PUT | `/api/transactions/<id>` | — | `Transaction` | none (200; 400 if `accountId` is not owned; 404 if the transaction is not) |
| DELETE | `/api/transactions/<id>` | — | — | none (200 / 404) |
| GET | `/api/stocks` | `offset`, `count` (i64) | — | `Stock[]` |
| GET | `/api/stocks/returns` | — | — | `Record<isin, StockReturns>`: `today`, `month`, `year` as fractions (0.05 = +5 %) of the current realtime price against the previous trading day's close and the closes a month and a year back; `null` where a price is missing |
| GET | `/api/stocks/<isin>` | — | — | `Stock` (ISIN is upper-cased server-side) |
| GET | `/api/stocks/prices/historical/<record>` | `offset`, `count` (i64), `from`, `to` (`YYYY-MM-DD`) | — | `HistoricalPrice[]` |
| GET | `/api/analysis/portfolio` | — | — | `Portfolio<RealtimePrice>` (`RealtimePortfolio`) |
| GET | `/api/analysis/portfolio` | `date` (`YYYY-MM-DD`, required for this variant) | — | `Portfolio<HistoricalPrice>` (`HistoricalPortfolio`); as of the market close (18:00 exchange time) on `date` |
| GET | `/api/accounts/<id>/portfolio` | — | — | `Portfolio<RealtimePrice>` narrowed to one account (404 if not owned) |
| GET | `/api/analysis/performance` | — | — | `PortfolioPerformance[]` |
| GET | `/api/analysis/plots/portfolio` | `start`, `end` (`YYYY-MM-DD`, required), `source` (`DataSourceSelection`, default `automatic`) | — | `PortfolioPlot` |
| GET | `/api/analysis/plots/<isin>` | `start`, `end` (`YYYY-MM-DD`, required), `source` (`DataSourceSelection`, default `automatic`) | — | `StockPlot` |
| POST | `/api/receipts` | `preview` (bool, default `false`) | `FileContents[]` | `ReceiptImport`: the booked transactions and the skipped duplicates; with `preview`, nothing is booked and `transactions` holds what would be |

## Notes

- Errors: `400 Bad Request` with an `ErrString` body saying what is wrong with the request
  (an unparseable date or receipt, an account that is not the caller's); `404 Not Found`
  without a body for anything missing or owned by another user; `500` without a body,
  with the details in the server log.
- `offset` / `count` are optional; they default to `0` and unlimited.
- Date query params are parsed as strings because Rocket cannot bind `NaiveDate` /
  `DateTime<Utc>` directly. An unparseable date yields `400`.
- Both `/api/analysis/portfolio` variants share a path and are distinguished purely by the
  presence of the `date` query parameter.
- The `source` parameter is matched case-insensitively; an unrecognized value yields `400`.
  Under `automatic`, ranges longer than three weeks use historical data, and realtime data
  falls back to historical when too few realtime points exist.
- JSON request bodies are limited to 10 MiB (relevant for `POST /api/receipts`).
- Everything not under `/api/` is served by `src/web/static_files.rs`: embedded assets from
  `web/build/`, falling back to `index.html` for client-side routing.
