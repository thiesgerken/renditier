# Migration to Renditier

What it takes to move the app from StockDB/"Aktienverwaltung" with teal to the Renditier brand in the
[style guide](styleguide.md), as of `main` in November 2026. Tracked in #253. The last PR of the
migration deletes this file; its cutover checklist moves to #253 first.

## Scope

Everything gets renamed: UI, crate and binary, container image, Kubernetes namespace and deployment,
database, config paths, the `STOCKDB__` environment prefix, the domain (`stocks.gerken.haus` →
`renditier.gerken.haus`, the old one redirects) and the Gitea repository (`thies/StockDB` →
`thies/Renditier`). No fallback to the old names. The only deployment is our own, and
[the cutover](#8-cutover-for-our-deployment) moves it over.

Not renamed: moneta's own config keys `MONETA__STOCKDB__URL` and `MONETA__STOCKDB__PUBLIC_URL`. They
belong to moneta; only their values change.

## 1. Name in the UI

| Where | Today | Change |
| --- | --- | --- |
| `web/index.html` | `<title>Aktienverwaltung</title>` | `Renditier` |
| `web/src/components/Login.tsx` | `<h1>Aktienverwaltung</h1>` | Lockup (mark plus wordmark) |
| `web/src/containers/AppLayout.tsx` | Header text "Aktienverwaltung" | Lockup, mark only where space is tight |
| `web/public/manifest.json` | `name`/`short_name` "StockDB" | "Renditier" |

The three "Aktienverwaltung" strings are still literals next to the i18n keys in
`web/src/locales/de.ts` and `en.ts`. "Renditier" is a name and stays the same in both languages; it
needs a key only where it sits in a sentence or a label (e.g. the lockup's `aria-label`).

## 2. Icons

Copy from `docs/brand/icons` to `web/public`:

- `favicon.ico`, `icon.svg`, `icon-96.png`, `icon-512.png` replace the current files.
- New: `favicon.svg` and `icon-192.png` (Chrome on Android wants 192 and 512 for installing).

Then:

- `web/index.html`: add `<link rel="icon" href="/favicon.svg" type="image/svg+xml">` next to the ICO.
- `web/public/manifest.json`: add `icon-192.png`, set `theme_color` to `#1B2A41` (was teal `#00695f`)
  and `background_color` to `#F8F9FB`.
- `web/index.html`: `<meta name="theme-color">` with `#F8F9FB` (light) and `#0E1522` (dark) via
  `media="(prefers-color-scheme: …)"`.

No Apple touch icon: iOS isn't a target. Whether the manifest also gets a `maskable` icon is decided
in the logo PR: the antler tip of the full-bleed icon leaves Android's maskable safe zone.

## 3. Colours

All tokens live in `web/src/index.css`. The shadcn token names don't line up one to one with the
style guide roles. In particular shadcn's `--accent` is a hover surface, not the brand accent.

| Token | Light | Dark |
| --- | --- | --- |
| `--background` | `#F8F9FB` | `#0E1522` |
| `--foreground`, `--card-foreground`, `--popover-foreground` | `#1B2A41` | `#EEF1F5` |
| `--card`, `--popover` | `#FFFFFF` | `#172238` |
| `--primary` | `#1B2A41` | `#EEF1F5` |
| `--primary-foreground` | `#F8F9FB` | `#1B2A41` |
| `--secondary`, `--muted`, `--accent` | `#EDF0F4` | `#1F2D45` |
| `--secondary-foreground`, `--accent-foreground` | `#1B2A41` | `#EEF1F5` |
| `--muted-foreground` | `#5F6B7E` | `#9AA6B8` |
| `--border`, `--input` | `#E3E7ED` | `#26344D` |
| `--ring` | `#D2652A` | `#E07A40` |
| `--sidebar` | `#F1F3F7` | `#121B2B` |
| `--sidebar-primary` | `#1B2A41` | `#EEF1F5` |
| `--sidebar-accent` (active item) | `#E5E9F0` | `#1F2D45` |
| `--sidebar-border`, `--sidebar-ring` | as `--border`, `--ring` | as `--border`, `--ring` |
| `--gain` | `#1E7A46` | `#4CC38A` |
| `--loss` | `#B0245E` | `#F06AA0` |
| new `--brand` | `#D2652A` | `#E07A40` |

`--brand` is for the orange accent outside the focus ring: the active navigation marker, the
portfolio chart line and its end dot. `--destructive` stays red: it marks dangerous actions, not
losses. Check it next to the berry loss colour.

Colours on `main` that clash with the brand and still need a design decision (one board for Thies in
the look PR):

- `--chart-units` (`#ed6c02`, dark `#ffa726`) is practically the brand orange. A units line would read
  as a highlight or as the "new high" dot. `--chart-price` (`#0288d1`) needs a check against navy and
  the orange accent. Both are used in `web/src/components/stockAnalysis/StockPlot.tsx`.
- `web/src/components/StockComparisonPlot.tsx`: `LINE_COLORS` are nine hard-coded hexes (teal, deep
  orange, blue, orange, pink, green, lime, deep purple, red) with no dark variant. They collide with
  gain, loss and the brand. Replace them with series tokens in `index.css`, light and dark, none of
  them near green, berry or orange.
- `web/src/components/TransactionKind.tsx`: dividends are `amber-600`/`amber-400`, right next to the
  brand orange. Buy (sky), sell (violet) and fee (slate) need a look against the new palette. The
  comment there and the one above `--gain`/`--loss` in `index.css` still say "teal and pink".

No other hard-coded teal, pink, rose, emerald, orange or amber classes are left in `web/src`.

## 4. Font and wordmark

The app font changes from Geist to Outfit (see [Typography](styleguide.md#typography)).

- `web/package.json`: replace `@fontsource-variable/geist` with `@fontsource-variable/outfit`.
- `web/src/index.css`: import it and set `--font-sans: 'Outfit Variable', …`. Give `body`
  `font-weight: 300`.
- Go through the font weight classes (`font-medium`, `font-semibold`, `font-bold`, 29 in `web/src`
  today): titles and emphasis become `font-medium` (500), amounts and percentages `font-normal`
  (400). Nothing above 500.
- Check muted 12 px text in dark mode. If 300 looks too thin there, use 350 for small text (Outfit is a
  variable font).

The app loads Outfit anyway, so the lockup in the header and on the login page is the SVG mark plus
"Rendi<span>tier</span>" as text in Outfit 700. The PNG lockups in `logo/` are for everything outside
the app.

## 5. Dev shell banner

`flake.nix`, `shellHook`: the banner prints "StockDB" with a yellow-to-orange gradient and 📈. Change it
to "Rendi" in bold default colour plus "tier" in the brand orange (`\033[38;2;210;101;42m`). Don't use
navy or cream for terminal text: one of them disappears on either a light or a dark terminal. A 🦌
instead of 📈 would fit too. Part of the technical rename, which touches `flake.nix` anyway.

## 6. Technical names

| Where | Name |
| --- | --- |
| `Cargo.toml`, `src/bin/stockdb.rs`, `use stockdb::…` in `src/bin/*` | crate and binary `stockdb` |
| `web/package.json` | `"name": "stockdb"` |
| `flake.nix` | `description`, `pname = "stockdb-web"`, package and image name `stockdb` |
| `.gitea/workflows/ci.yml` | image `gitea.gerken.haus/thies/stockdb`, namespace `apps-stockdb`, deployment `stockdb` |
| `renovate.json` | package rule for `gitea.gerken.haus/thies/stockdb` |
| `src/cli/mod.rs` | `/etc/stockdb/config`, `./stockdb.*`, prefix `STOCKDB` |
| `src/web/mod.rs` | Rocket database name `stockdb` (internal) |
| `src/cli/import.rs`, `src/bin/generate.rs`, `src/onvista/crypto.rs` | messages and help texts mentioning `stockdb` |
| `src/lib.rs`, `src/onvista/mod.rs`, `web/src/types/api.ts` | comments |
| `README.md`, `docker-compose.yaml` | all of the above |
| `.gitignore`, `.vscode/cSpell.json` | `stockdb.toml`, binary name, dictionary word |

New names: crate and binary `renditier`, image `gitea.gerken.haus/thies/renditier`, namespace
`apps-renditier`, deployment `renditier`, config `/etc/renditier/config.*` and `./renditier.*`, prefix
`RENDITIER__`.

## 7. Docs

- `README.md`: title, the lockup on top, light and dark screenshots. `<picture>` with
  `<source media="(prefers-color-scheme: dark)">` survives Gitea's sanitizer (checked) and works on
  GitHub, so it also suits the planned GitHub mirror. It follows the browser's colour scheme, not
  Gitea's theme setting. GitHub's `#gh-dark-mode-only` fragment does nothing on Gitea.
- Screenshots in the README and in PRs come from the demo user "Rudolph" (a committed, made-up backup
  imported next to the real data) and never show real figures.

## 8. Cutover for our deployment

### Facts

- The deployment is GitOps: `apps/stockdb` in `infrastructure/k3s`, Argo CD Application
  `apps-stockdb` (`app-of-apps/apps/stockdb.yaml`) with automated `prune` and `selfHeal`. A
  `kubectl scale` gets reverted. Every change, scaling included, is a commit there.
- A namespace can't be renamed and a PVC can't move to another namespace. The new namespace gets its
  own Postgres, and the data moves by dump and restore.
- The Postgres PVC `postgres` carries the finalizer `gerken.haus/prevent-deletion`. Removing the app
  from Git doesn't delete the data: PVC and namespace stay `Terminating` until someone removes the
  finalizer by hand.
- Database today: `POSTGRES_DB=stocks`, user `stockdb`, connection string in secret `stockdb`
  (`database_conn`). New: database and user `renditier`.
- CI deploys with the service account `gitea-ci` (`apps/stockdb/ci.yaml`). The repo secrets
  `K8S_TOKEN` and `K8S_CA_CERT` come from its token secret `gitea-ci-token`.
- Dead settings in `apps/stockdb/app.yaml`: `STOCKDB__WEB__SERVER_KEY`, `STOCKDB__PUSH__KEY_FILE` and
  the `vapid-key` mount. Push notifications are gone and the app no longer reads them. Drop them,
  don't rename them.
- References outside the app:
  - `apps/authelia/configuration.acl.yaml`: `stocks.gerken.haus`.
  - `apps/gatus/config/services.yaml`: check "StockDB" on `https://stocks.gerken.haus/`.
  - `apps/homepage/config/services.yaml`: tile "StockDB" with `href` and favicon URL.
  - `apps/moneta/app.yaml`: values of `MONETA__STOCKDB__URL`
    (`http://stockdb.apps-stockdb.svc.cluster.local`) and `MONETA__STOCKDB__PUBLIC_URL`.
  - `apps/moneta/network.yaml`: egress to namespace `apps-stockdb`, pods `app: stockdb`.
  - `apps/stockdb/network.yaml`: ingress from `apps-moneta`, carried over to the new app.
- Redirect: `apps/moneydb/ingress.yaml` already redirects a retired host with an `HTTPRoute`
  `RequestRedirect` (301). For `stocks.gerken.haus`, leave out its `ReplaceFullPath`, so deep links
  keep their path.

### Steps

1. **Add the new app next to the old one** (k3s PR): `apps/renditier` and its Application in
   `app-of-apps`, namespace `apps-renditier`:
   - Postgres with a new PVC (with the finalizer), database and user `renditier`.
   - Secrets under `RENDITIER__` names, without the dead keys.
   - Deployment `renditier`, image `gitea.gerken.haus/thies/renditier:main`, `replicas: 0`. The tag
     only exists after the first CI run.
   - Network policy including the moneta ingress, `ci.yaml`, `HTTPRoute` for
     `renditier.gerken.haus`.
   - Authelia ACL: add `renditier.gerken.haus`.

   Nothing points at it yet.
2. **Rename the Gitea repository** to `thies/Renditier`. Gitea redirects the old web and git URLs,
   and repo secrets stay. Replace `K8S_TOKEN` and `K8S_CA_CERT` with the token from
   `apps-renditier`. Point the local checkout at the new URL (`git remote set-url origin
   https://gitea.gerken.haus/thies/renditier.git`, one config for all worktrees).
3. **Merge the technical rename.** CI pushes `thies/renditier:main` and restarts `renditier`, still at 0
   replicas.
4. **Switch over** (a few minutes of downtime):
   1. k3s commit: `apps/stockdb` to `replicas: 0`. Old and new must never run at the same time: both
      would run the minutely fetch loop against their database, and the old one would keep writing
      after the dump.
   2. `pg_dump -Fc` from the old Postgres, `pg_restore --no-owner --role=renditier` into the new one.
      Keep the dump.
   3. k3s PR:
      - `renditier` to `replicas: 1`.
      - Move the `stocks.gerken.haus` route from `apps/stockdb` into `apps/renditier` as the
        redirect. Same commit: two routes matching the same host and path conflict, and the
        older one wins.
      - moneta's URL values and egress policy.
      - gatus and homepage (name "Renditier", new URL and favicon).
      - Keep `stocks.gerken.haus` in the Authelia ACL as long as the redirect lives, unless forward
        auth doesn't apply to the redirect route.
   4. Check: login, dashboard, a price fetch within a minute, moneta's depot values, and that
      `stocks.gerken.haus/<path>` lands on the same path on the new host.
5. **Clean up** after a few days without trouble:
   - k3s PR: remove `apps/stockdb` and its Application. Argo prunes everything except the PVC, which
     hangs on its finalizer.
   - Remove the finalizer by hand, keeping the dump.
   - Delete the `thies/stockdb` image in the package registry.
6. **Local setups:** rename `./stockdb.toml` to `./renditier.toml` and any `STOCKDB__` variables in
   your shell or `.env` files.
