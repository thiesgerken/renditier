# MCP for agents

Renditier serves MCP (Streamable HTTP) at `/mcp`, next to `/api`. An agent reads the portfolio,
its performance, the transactions and market data through it, computed by the same code as the
REST API and the UI.

## Credentials

`/mcp` takes [API keys](api.md#api-keys) only, sent as `Authorization: Bearer rk_...`. A session
cookie does not count there, so a browser that happens to be logged in cannot be talked into using
it. A missing, unknown or expired key answers 401.

Unlike `/api`, the read/write decision on `/mcp` is per tool, since every MCP call is a `POST`: a
read key does not see write tools in `tools/list`, and calling one anyway is a tool error. A tool
counts as reading only if it declares itself read-only (`readOnlyHint`).

```sh
claude mcp add --transport http renditier https://renditier.example.com/mcp \
  --header "Authorization: Bearer $RENDITIER_KEY"
```

The server is stateless: no session id, JSON responses, no server-sent events. `GET /mcp` answers
405.

## Units

- Money is in **euros as decimals**, in arguments and results (the REST API counts cents).
- Signs follow the user's pocket: **negative means money goes out** (a buy, a fee), positive means
  it comes in (a sale, a dividend). `invested` is negative while more was bought than sold, and the
  gain is `value + invested`.
- IRRs are decimals (0.05 is 5 %): `irr_annual` per year, `irr_period` over the period.
- Dates are `YYYY-MM-DD` days in the server's time zone (`timezone` in the configuration).
- Prices are per unit in the exchange's currency, which is euros on the German exchanges
  Renditier prefers.

The tool descriptions say the same, so an agent does not need this page.

## Tools

| Tool | Arguments | Result |
| --- | --- | --- |
| `list_accounts` | | the user's accounts with their ids |
| `portfolio` | optional `date`, `account` | each position's units, `invested`, `value`, `irr_annual` and the price used; now, or as of a day's market close |
| `performance` | optional `account` | total, today, week/month/year to date, each of the last 12 months and each past year: start and end snapshots, `irr_annual`, `irr_period`, per position too |
| `list_transactions` | optional `account`, `isin`, `from`, `to` (inclusive) | transactions, oldest first |
| `search_stocks` | `query`: ISIN, WKN or part of a name | up to 20 stocks and funds |
| `get_stock` | `isin` | details, the price on each exchange, and the newest of them |
| `price_history` | `isin`, `from`, `to` | daily closes from the most preferred exchange that has any |
| `create_transaction` | `account`, `isin`, `date` (RFC 3339), `units`, `amount`, `fees`; optional `comments`, `exchange`, `receipt_number` | the booked transaction |
| `update_transaction` | `id`; any of the fields of `create_transaction` | the changed transaction; fields left out keep their value |
| `delete_transaction` | `id` | `{"deleted": id}` |

The last three write and need a write key. `update_transaction` and `delete_transaction` carry
`destructiveHint`. They refuse amounts with fractions of a cent and the signs an agent most likely
gets wrong: positive fees, a buy (positive `units`) with a positive `amount`, a sale with a
negative one. They execute directly: when to call them ("only on the user's explicit
instruction") is the agent's to follow.

Receipts are not an MCP tool: a PDF would have to pass through the model as
base64. Upload them with `POST /api/receipts` and a write key instead, `?preview=true` first.

A tool error (an account of someone else, an unknown ISIN, a bad argument) comes back as a tool
result with `isError`, inside a successful HTTP response.

## Raw HTTP

```sh
curl --fail-with-body -sS "$RENDITIER_URL/mcp" \
  -H "Authorization: Bearer $RENDITIER_KEY" \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"portfolio","arguments":{}}}'
```

Implementation: [tools](../src/mcp.rs), [Rocket route](../src/web/mcp.rs),
[tests](../tests/mcp.rs).
