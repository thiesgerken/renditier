# Migration to Renditier

What it takes to move the app from StockDB/"Aktienverwaltung" with MUI teal to the Renditier brand in
the [style guide](styleguide.md). Tracked in #253.

Do this after the MUI to shadcn/ui migration has landed. `web/src/muiTheme.ts` and the MUI colour
imports go away with it, so they need no brand work.

## Open decisions

- **How deep the rename goes.** The user-visible name surely changes. The crate, binary, container
  image, Kubernetes namespace, config paths and the `STOCKDB__` environment prefix are technical
  names. Renaming them is a clean break for every deployment (no fallback to the old names), so it
  needs a cutover plan, or they stay as they are.
- **Gitea repository name.** `thies/StockDB` → `thies/Renditier`? Gitea redirects the old URL, but CI
  pushes to `gitea.gerken.haus/thies/stockdb` and would need the new image path.

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

The lockups are PNG for now because the wordmark is set in Fraunces. For the app, convert "Renditier"
to outlined paths and ship one SVG lockup (light and dark via `currentColor` for "Rendi"). That avoids
loading Fraunces just for one word.

## 5. Dev shell banner

`flake.nix`, `shellHook`: the banner prints "StockDB" with a yellow-to-orange gradient and 📈. Change it
to "Rendi" in bold default colour plus "tier" in the brand orange
(`\033[38;2;210;101;42m`). Don't use navy or cream for terminal text: one of them disappears on
either a light or a dark terminal. A 🦌 instead of 📈 would fit too.

## 6. Technical names (only if decided, see above)

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

## 7. Docs

- `README.md`: title and the lockup on top.
- Screenshots in PRs after the switch: use mock data, never real figures.
