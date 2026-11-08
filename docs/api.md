# API

The API otherwise expects a browser: a session cookie, or the `Remote-User` header from the
proxy. A program or an agent gets in with an API key instead.

## API keys

Each user manages their own keys under **Settings → API keys**: a name, read or write access, and
an expiry (never, or in 30, 90 or 365 days). The key is shown once, when it is created, and only a
hash of its secret is stored, so a lost key is replaced rather than looked up. Deleting a key
revokes it immediately.

A key looks like `rk_<8 hex>.<secret>` and is sent as `Authorization: Bearer rk_...`.

- **Read** keys work on every `GET`. Anything that creates, changes or deletes answers **403**.
  This is decided before any handler runs, so it covers every route the same way.
- **Write** keys may do everything their user may, except managing keys.
- A missing, unknown or expired key answers **401**.

**Managing keys takes a session** (password login or `Remote-User`). `/api/keys` ignores the
`Authorization` header and answers 401 without a session, so a leaked key cannot mint new ones or
delete the others.

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| `GET` | `/api/keys` | | the user's keys, newest first, without secrets |
| `POST` | `/api/keys` | `{"name", "access": "read" \| "write", "expiresAt": ISO 8601 \| null}` | `{"apiKey", "token"}`; 400 with `{"error"}` on an empty name, a past expiry or a name the user already has |
| `DELETE` | `/api/keys/<id>` | | 200, or 404 if the user has no such key |

The `token` in the response to `POST` is the whole key and is never returned again.

Keys are credentials, not data, so they are not part of `renditier export`.

## Routes

`GET /api/accounts/<id>/portfolio` is the same computation as `/api/analysis/portfolio` narrowed
to one account, which is what a caller after the current value of a single depot wants.
