# API

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
