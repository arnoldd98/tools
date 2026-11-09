# tools

## Japan trip tracker (`japan-trip/`)

A static GitHub Pages site for following a Japan trip itinerary day by day. It installs on a
phone as an app (PWA) and works offline.

- **Data**: `japan-trip/data/trip.json`. All fields beyond `title` and `days[]` are optional;
  older files are normalised on load.
  - `fx` — `{ home: "SGD", jpyPerHome, updatedAt }`, the rate used for S$ figures. Refreshed about
    daily from the free [currency API](https://github.com/fawazahmed0/exchange-api) when online.
  - `days[]` — `{ id, date, city, summary, items[], spends[], notes, stay?, links? }`; `summary` is a
    one-line description shown in the Days list and on the day; `stay` is
    `{ name, address, maps?, note? }` (the hotel for that night); `links` (same shape as a stop's)
    shows as the day's *Bookings & files*.
  - `days[].items[]` — `{ id, time, text, done, fixed?, place?, note?, price? }`; array order is the
    timeline order. `time` is `HH:MM` (shown as 12-hour); `links: [{ label, url }]` holds tickets/bookings (http(s) only: Google
    Drive files set to Restricted, Trip.com, Klook…; pasting an app's share text works, the link is
    picked out of it; known sites get an icon and, if left unnamed, a name like *Trip.com*); `fixed: true` marks a must-make time
    (flights, ferries) with a countdown on Today. `place` is `{ name, address, maps? }` (maps link built from name + address
    when `maps` is absent). `price` is informational text, not a spend.
  - `days[].spends[]` — `{ id, yen, label, category, at }`; `yen` is an integer, S$ is derived.
    `category` is one of `food`, `shopping`, `transport`, `tickets`, `misc`
    (older `stay`/`other` load as `misc`).
- **Screens** (bottom tabs): `#/` Today (next up, today's plan, spent today,
  ＋ ¥ Spend; a countdown before the trip), `#/days` (all days) → `#/day/<id>`,
  `#/trip` (spending totals, categories, spends by day, settings).
- **Language**: the **中 / EN** button in the header switches the app's own words, dates and
  times between English and Simplified Chinese (remembered per phone; a first visit follows the
  phone's language). Trip data shows as typed. Strings live in `japan-trip/i18n.js`.
- **Money**: spends are logged in yen; the **¥ | S$** switch in the header shows every amount in
  one currency (remembered per phone).
- **Motion**: screens slide/morph with the View Transitions API (Chrome, iOS 18+; off with
  Reduce Motion). Swipe left/right on a day page for the next/previous day. Logging or
  deleting a spend and deleting a stop show a toast with **Undo**.
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
- **Deploying changes**: bump `VERSION` in `japan-trip/sw.js` (and the matching `?v=` tags in
  `index.html`, `app.js`, `views.js`, `lib.js`; `npm test` fails if they disagree) whenever any app file
  (`index.html`, `*.js`, `style.css`, manifest, icons) changes. Phones then show
  *Updated, tap to reload*; without the bump they keep the old version.
  `data/trip.json` doesn't need a bump. Icons: `python3 japan-trip/icons/make_icons.py`.
- **Local preview**: `python3 -m http.server -d . 8000` → http://localhost:8000/japan-trip/
- **Tests**: `npm test` (Node 22, no dependencies) covers `japan-trip/lib.js`, `views.js` and the
  Chinese strings.
