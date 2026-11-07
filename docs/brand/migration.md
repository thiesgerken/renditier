# Migration to Renditier

What it takes to move the app from StockDB/"Aktienverwaltung" with MUI teal to the Renditier brand in
the [style guide](styleguide.md). Tracked in #253.

Do this after the MUI to shadcn/ui migration has landed. `web/src/muiTheme.ts` and the MUI colour
imports go away with it, so they need no brand work.

## Scope

Everything gets renamed: UI, crate and binary, container image, Kubernetes namespace and deployment,
config paths, the `STOCKDB__` environment prefix and the Gitea repository (`thies/StockDB` →
`thies/Renditier`). No fallback to the old names. The only deployment is our own, and
[the cutover](#8-cutover-for-our-deployment) below moves it over.

## 1. Name in the UI

| Where | Today | Change |
| --- | --- | --- |
| `web/index.html` | `<title>Aktienverwaltung</title>` | `Renditier` |
| `web/src/components/Login.tsx` | `<h1>Aktienverwaltung</h1>` | Lockup (mark plus wordmark) |
| `web/src/containers/AppLayout.tsx` | Header text "Aktienverwaltung" | Lockup, mark only where space is tight |
| `web/public/manifest.json` | `name`/`short_name` "StockDB" | "Renditier" |

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

No Apple touch icon: iOS isn't a target.

## 3. Colours

All in `web/src/index.css`. The shadcn token names don't line up one to one with the style guide
roles. In particular shadcn's `--accent` is a hover surface, not the brand accent.

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
portfolio chart line and its end dot. `--destructive` stays red, it marks dangerous actions, not losses.

Other places:

- `web/src/index.css`: the comment above `--gain`/`--loss` explains them as "the MUI theme's dark teal
  and pink". Rewrite it, or drop it once no MUI plot is left.
- `web/src/components/StockComparisonPlot.tsx`: the series colours start with MUI `teal` and include
  `deepOrange`/`orange`. Pick a series palette without the gain/loss colours and without the brand
  orange, or the comparison lines read as gains, losses or highlights. Likely solved when the plot
  moves off MUI.
- `web/src/containers/Transactions.tsx`: the comment about the transaction kind colours staying
  "clear of teal and pink" becomes green and berry. Check the kind colours against orange too.
- Look for hard-coded Tailwind colour classes (`teal-`, `emerald-`, `pink-`, `rose-`) once the
  migration is done.

## 4. Wordmark

The lockups are PNG for now because the wordmark is set in Outfit. For the app, convert "Renditier"
to outlined paths and ship one SVG lockup (light and dark via `currentColor` for "Rendi"). That avoids
loading Outfit just for one word.

## 5. Dev shell banner

`flake.nix`, `shellHook`: the banner prints "StockDB" with a yellow-to-orange gradient and 📈. Change it
to "Rendi" in bold default colour plus "tier" in the brand orange
(`\033[38;2;210;101;42m`). Don't use navy or cream for terminal text: one of them disappears on
either a light or a dark terminal. A 🦌 instead of 📈 would fit too.

## 6. Technical names

| Where | Name |
| --- | --- |
| `Cargo.toml`, `src/bin/stockdb.rs`, `use stockdb::…` in `src/bin/*` | crate and binary `stockdb` |
| `web/package.json` | `"name": "stockdb"` |
| `flake.nix` | `description`, `pname = "stockdb-web"`, package and image name `stockdb` |
| `.gitea/workflows/ci.yml` | image `gitea.gerken.haus/thies/stockdb`, namespace `apps-stockdb`, deployment `stockdb` |
| `src/cli/mod.rs` | `/etc/stockdb/config`, `./stockdb.*`, prefix `STOCKDB` |
| `src/web/mod.rs` | Rocket database name `stockdb` (internal) |
| `src/cli/import.rs`, `src/bin/generate.rs` | help texts mentioning `stockdb` |
| `README.md`, `docker-compose.yaml` | all of the above |
| `.gitignore`, `.vscode/cSpell.json` | `stockdb.toml`, binary name, dictionary word |

New names: crate and binary `renditier`, image `gitea.gerken.haus/thies/renditier`, namespace
`apps-renditier`, deployment `renditier`, config `/etc/renditier/config.*` and `./renditier.*`, prefix
`RENDITIER__`.

## 7. Docs

- `README.md`: title and the lockup on top.
- Screenshots in PRs after the switch: use mock data, never real figures.

## 8. Cutover for our deployment

The Kubernetes manifests live outside this repo. CI only pushes the image and restarts the
deployment, so the cluster has to be ready before the rename PR merges, or the first deploy job on
`main` fails.

1. **Prepare the cluster** (before the merge):
   - Create namespace `apps-renditier` with deployment `renditier` (image
     `gitea.gerken.haus/thies/renditier:main`, container name `renditier`), scaled to 0. The image
     tag only exists after the first CI push.
   - Copy the secrets and config, renaming every `STOCKDB__*` variable to `RENDITIER__*` and a
     mounted `/etc/stockdb/config.*` to `/etc/renditier/config.*`.
   - Give the CI token rights in the new namespace (role binding for its service account, or a new
     token in the `K8S_TOKEN` repo secret).
   - Postgres: if it runs in `apps-stockdb`, either point `RENDITIER__DATABASE` at it across
     namespaces (`…apps-stockdb.svc…`) and move it later, or dump and restore it into the new
     namespace now. Take a dump either way.
2. **Rename the Gitea repository** to `thies/Renditier`. Gitea redirects the old web and git URLs, and
   repo secrets stay. Point the local checkout at the new URL (`git remote set-url origin
   https://gitea.gerken.haus/thies/renditier.git`, one config for all worktrees).
3. **Merge the rename PR.** CI pushes `thies/renditier:main` and restarts `renditier` in
   `apps-renditier` (still 0 replicas, so nothing runs yet).
4. **Switch over:** scale `stockdb` in `apps-stockdb` to 0 first, then `renditier` to 1. Never both
   at once: both would run the scheduled fetch jobs against the same database. Move the ingress (and
   the hostname, if it contains `stockdb`) to the new service and check login, dashboard and a price
   fetch.
5. **Clean up** once it runs: delete `apps-stockdb` (after the database has moved), the old CI role
   binding and the `thies/stockdb` image in the package registry.
6. **Local setups:** rename `./stockdb.toml` to `./renditier.toml` and any `STOCKDB__` variables in
   your shell or `.env` files.
