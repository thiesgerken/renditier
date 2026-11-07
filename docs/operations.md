# Operations

## Running the container

The image runs `renditier serve` as UID and GID 65534 (`nobody`). The user is numeric because the
image has no `/etc/passwd`, and Kubernetes' `runAsNonRoot` can only check a numeric one.

The root filesystem can be read-only, and no path has to be writable: the server keeps no files,
request bodies are JSON held in memory, and receipts are parsed in memory or piped through
`pdftotext` via stdin and stdout.

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

Prices are not part of the backup; the server fetches them again from onvista.
