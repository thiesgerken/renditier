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
| POST | `/api/keys` | — | `NewApiKey` | `CreatedApiKey` (session only; 422 on an empty name or past expiry, 409 on a taken name) |
| DELETE | `/api/keys/<id>` | — | — | none (200 / 404; session only) |
| GET | `/api/accounts` | `offset`, `count` (i64) | — | `Account[]` |
| GET | `/api/accounts/<id>` | — | — | `Account` (404 if not owned) |
| POST | `/api/accounts` | — | `NewAccount` | `Account` |
| PUT | `/api/accounts/<id>` | — | `Account` | none (200 / 404) |
| DELETE | `/api/accounts/<id>` | — | — | none (200 / 404) |
| GET | `/api/transactions` | `offset`, `count` (i64) | — | `Transaction[]` |
| GET | `/api/transactions/<id>` | — | — | `Transaction` (404 if not owned) |
| POST | `/api/transactions` | — | `NewTransaction` | `Transaction` (401 if `accountId` is not owned) |
| PUT | `/api/transactions/<id>` | — | `Transaction` | none (200 / 401 / 404) |
| DELETE | `/api/transactions/<id>` | — | — | none (200 / 404) |
| GET | `/api/stocks` | `offset`, `count` (i64) | — | `Stock[]` |
| GET | `/api/stocks/returns` | — | — | `Record<isin, StockReturns>`: `today`, `month`, `year` as fractions (0.05 = +5 %) of the current realtime price against the previous trading day's close and the closes a month and a year back; `null` where a price is missing |
| GET | `/api/stocks/<isin>` | — | — | `Stock` (ISIN is upper-cased server-side) |
| GET | `/api/stocks/prices/historical/<record>` | `offset`, `count` (i64), `from`, `to` (`YYYY-MM-DD`) | — | `HistoricalPrice[]` |
| GET | `/api/analysis/portfolio` | — | — | `Portfolio<RealtimePrice>` (`RealtimePortfolio`) |
| GET | `/api/analysis/portfolio` | `date` (`YYYY-MM-DD`, required for this variant) | — | `Portfolio<HistoricalPrice>` (`HistoricalPortfolio`); as of the market close (18:00 exchange time) on `date` |
| GET | `/api/analysis/performance` | — | — | `PortfolioPerformance[]` |
| GET | `/api/analysis/plots/portfolio` | `start`, `end` (`YYYY-MM-DD`, required), `source` (`DataSourceSelection`, default `automatic`) | — | `PortfolioPlot` |
| GET | `/api/analysis/plots/<isin>` | `start`, `end` (`YYYY-MM-DD`, required), `source` (`DataSourceSelection`, default `automatic`) | — | `StockPlot` |
| POST | `/api/receipts` | — | `FileContents[]` | `Transaction[]`, or `ErrString` on failure |

## Notes

- Handlers returning `Option<Json<T>>` respond `404 Not Found` when the value is `None`;
  there is no error body. Handlers returning `Result<_, Status>` respond with the bare
  status code. `POST /api/receipts` is the only route with a JSON error body (`ErrString`).
- `offset` / `count` are optional; they default to `0` and unlimited.
- Date query params are parsed as strings because Rocket cannot bind `NaiveDate` /
  `DateTime<Utc>` directly. An unparseable date yields `404`, not `400`, except for the
  historic `/api/analysis/portfolio`, which answers `400`.
- Both `/api/analysis/portfolio` variants share a path and are distinguished purely by the
  presence of the `date` query parameter.
- The `source` parameter is matched case-insensitively; an unrecognized value yields `404`.
  Under `automatic`, ranges longer than three weeks use historical data, and realtime data
  falls back to historical when too few realtime points exist.
- JSON request bodies are limited to 10 MiB (relevant for `POST /api/receipts`).
- Everything not under `/api/` is served by `src/web/static_files.rs`: embedded assets from
  `web/build/`, falling back to `index.html` for client-side routing.
