# Screenshots

The README's screenshots, light and dark, always of the demo user Rudolph and never of real data.

To retake them, import `docs/demo/rudolph.json` into your local database, run the backend with
`[web] trusted_header_authentication = true`, and run the dev server with a proxy that logs in as
Rudolph, e.g. a Vite config that extends `web/vite.config.mjs` with

```js
server: { proxy: { '/api': { target: 'http://localhost:8383', headers: { 'Remote-User': 'Rudolph' } } } }
```

Then take each page (`/dashboard`, `/stocks/IE00B4L5Y983`, `/transactions`, `/stocks`) at 1280×800
with device scale factor 2, once with `prefers-color-scheme: light` and once with `dark`, for example
with headless Chrome's `--screenshot`, `--blink-settings=preferredColorScheme=1` (light) or `=0`
(dark), and `--virtual-time-budget=15000` so the charts have loaded.
