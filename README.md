# tools

## Japan trip tracker (`japan-trip/`)

A static GitHub Pages site for tracking the Okinawa / Osaka itinerary.

- **Data**: `japan-trip/data/trip.json`. All fields beyond `title` and `days[]` are optional;
  older files are normalised on load.
  - `fx` — `{ home: "SGD", jpyPerHome: 115, updatedAt }`, the rate used for S$ figures.
  - `info[]` — `{ title, lines[] }` read-only trip info sections on the home view.
  - `days[]` — `{ id, date, city, items[], spends[], notes, stay? }`; `stay` is
    `{ name, address, maps?, note? }`.
  - `days[].items[]` — `{ id, time, text, done, place?, note?, price? }`; array order is the
    timeline order. `place` is `{ name, address, maps? }` (maps link built from name + address
    when `maps` is absent). `price` is informational text, not a spend.
  - `days[].spends[]` — `{ id, yen, label, category, at }`; `yen` is an integer, S$ is derived.
- **Views**: `#/` (day strip, today, spend total, trip info), `#/day/<id>` (next up, timeline,
  spending, stay, notes), `#/money` (all spends by day).
- **Editing**: changes save instantly to the browser (localStorage).
- **Sync**: the *Sync* button commits `trip.json` back to this repo via the GitHub API.
  Needs a fine-grained token (Contents: read & write, this repo only) entered under
  *Sync settings*; it's stored only in that browser.
- **Local preview**: `python3 -m http.server -d . 8000` → http://localhost:8000/japan-trip/
- **Tests**: `npm test` (Node 22, no dependencies) covers `japan-trip/lib.js` and `views.js`.
