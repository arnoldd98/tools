# tools

## Japan trip tracker (`japan-trip/`)

A static GitHub Pages site for tracking the Okinawa / Osaka itinerary. It installs on a
phone as an app (PWA) and works offline.

- **Data**: `japan-trip/data/trip.json`. All fields beyond `title` and `days[]` are optional;
  older files are normalised on load.
  - `fx` — `{ home: "SGD", jpyPerHome: 115, updatedAt }`, the rate used for S$ figures.
  - `info[]` — `{ title, lines[] }` read-only trip info sections on the Trip tab.
  - `days[]` — `{ id, date, city, items[], spends[], keyInfo[], notes, stay? }`; `stay` is
    `{ name, address, maps?, note? }` and shows as the first key info tag.
  - `days[].keyInfo[]` — `{ icon?, label, lines[], place? }`: passes, tickets, reservations
    shown as tags on that day (tap to expand).
  - `days[].items[]` — `{ id, time, text, done, place?, note?, price? }`; array order is the
    timeline order. `place` is `{ name, address, maps? }` (maps link built from name + address
    when `maps` is absent). `price` is informational text, not a spend.
  - `days[].spends[]` — `{ id, yen, label, category, at }`; `yen` is an integer, S$ is derived.
    `category` is one of `food`, `shopping`, `transport`, `tickets`, `misc`
    (older `stay`/`other` load as `misc`).
- **Screens** (bottom tabs): `#/` Today (next up, today's plan, key info, spent today,
  ＋ ¥ Spend; a countdown before the trip), `#/days` (all days) → `#/day/<id>`,
  `#/trip` (spending totals, categories, spends by day, trip info, settings).
- **Editing**: changes save instantly to the browser (localStorage).
- **Sync**: the *Sync* button commits `trip.json` back to this repo via the GitHub API.
  Needs a fine-grained token (Contents: read & write, this repo only) entered under
  *Trip → Settings → Sync settings*; it's stored only in that browser.
- **Install on your phone**: open the site in Safari (iPhone) or Chrome (Android) →
  Share → *Add to Home Screen*. On iPhone the installed app has its own storage,
  separate from Safari: install it, then use only the app (unsynced edits made in
  Safari don't carry over).
- **Offline**: after one visit the app and your data open with no signal; edits save to
  the phone and Sync when you're back online.
- **Deploying changes**: bump `VERSION` in `japan-trip/sw.js` whenever any app file
  (`index.html`, `*.js`, `style.css`, manifest, icons) changes. Phones then show
  *Updated, tap to reload*; without the bump they keep the old version.
  `data/trip.json` doesn't need a bump. Icons: `python3 japan-trip/icons/make_icons.py`.
- **Local preview**: `python3 -m http.server -d . 8000` → http://localhost:8000/japan-trip/
- **Tests**: `npm test` (Node 22, no dependencies) covers `japan-trip/lib.js` and `views.js`.
