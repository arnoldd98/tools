# tools

## Japan trip tracker (`japan-trip/`)

A static GitHub Pages site for tracking the Okinawa / Osaka itinerary.

- **Data**: `japan-trip/data/trip.json` (days → items, notes).
- **Editing**: changes save instantly to the browser (localStorage).
- **Sync**: the *Sync* button commits `trip.json` back to this repo via the GitHub API.
  Needs a fine-grained token (Contents: read & write, this repo only) entered under
  *Sync settings*; it's stored only in that browser.
- **Local preview**: `python3 -m http.server -d . 8000` → http://localhost:8000/japan-trip/
