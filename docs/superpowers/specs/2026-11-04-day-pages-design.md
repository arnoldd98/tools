# Japan trip tracker: day strip, day pages, and spending

Date: 2026-11-04
Status: draft, awaiting owner approval
Scope: `japan-trip/` static site in this repo (GitHub Pages, no build step)

## Intent

The tracker today is one long page of editable day cards. During the trip
the owner will open it on a phone, usually at the start of the day or right
after paying for something, and wants three things fast:

1. The schedule for the day.
2. Where the next destination is, with a way to navigate there.
3. How much has been spent, today and for the whole trip, in yen and SGD.

The itinerary itself (stops, addresses, map links, hotel, bookings) will be
authored by Claude into `trip.json` from an itinerary the owner supplies
before the trip. The page is therefore primarily a **viewer with light
editing**, not an itinerary editor.

## Goals

- A horizontally scrolling **day strip** on the home view: one card per day,
  tap to open that day. Today's card is highlighted and scrolled into view.
- A **day page** per day showing, in order: header (date, city), **Next up**
  (next unchecked stop with a one-tap maps link), the full **timeline** of
  stops with place details, the day's **spending**, and the day's **notes**.
- **Spend logging** in yen with the SGD equivalent shown beside it, a per-day
  total on the day page, and a trip total on the home view.
- Everything keeps saving instantly to localStorage and syncing via the
  existing GitHub Sync flow. `trip.json` stays the single source of truth.
- Existing `trip.json` files (current schema) keep working unchanged.

## Non-goals

- Structured editing of places/addresses/map links in the page. That is done
  in JSON. Free-text quick-add of a stop (time + text) stays.
- Offline-first install (service worker, PWA manifest). The localStorage
  draft already survives reloads; full offline is a possible follow-up.
- Live weather, embedded maps, multi-user or auth. Maps are deep links only.
- Receipt photos or split-bill logic.

## Anti-goals (would make it a failure even if it "works")

- Adding a build step or framework. It must stay plain HTML/CSS/JS served
  from GitHub Pages and previewable with `python3 -m http.server`.
- Breaking or forking the Sync/draft logic. Spends and new fields ride in the
  same `state` object and the same `trip.json`.
- Making the quick actions slower: checking off a stop and logging a spend
  must each be one tap plus (for spends) typing an amount.
- Layout that only works on desktop. Primary target is a phone in portrait.

## Constraints and existing code

- `japan-trip/app.js` is a single classic script: global `state`, `cfg`,
  `dirty`; `load()` pulls from GitHub API (if token) or `data/trip.json`;
  `render()` rebuilds `#days` innerHTML; delegated `click`/`change`/`submit`
  handlers; `commit()` marks dirty, saves draft, re-renders. Keep this shape.
- `style.css` defines light/dark tokens (`--bg`, `--card`, `--ink`,
  `--muted`, `--line`, `--accent`, `--ok`, `--today`). Reuse them.
- `index.html` has a sticky header (title, Sync button, progress bar,
  status line) and a footer (add day, export/import, reload, Sync settings).
- Today detection uses local date (`toLocaleDateString('en-CA')`). Keep it.
- Day ids are opaque strings (`d1`, or `uid()` output). Routes use them.

## Decided design

### Navigation

Single page with hash routes. The `hashchange` event drives `render()`.

| Route | View |
|---|---|
| `#/` (or empty) | Home: day strip, today's Next up, trip spend total, trip info, footer tools |
| `#/day/<dayId>` | Day page for that day |
| `#/money` | All spends across the trip, grouped by day, with totals |

Unknown day id falls back to `#/`. Browser back works between views.

### Day strip (shared component)

- Horizontal scroll container, `scroll-snap-type: x mandatory`, visible on
  the home view (full size) and at the top of the day page (compact).
- Each card: weekday (short), day-of-month, city, and a small progress hint
  (e.g. "3/7" or a thin bar). Days are sorted by date.
- Today's card gets the `today` styling. The card for the open day (on a day
  page) gets a selected style. On load, the relevant card is scrolled into
  view (today on home; the open day on a day page).
- Tapping a card navigates to `#/day/<id>`.
- Day page also has prev/next day arrows in the header.

### Home view (`#/`)

Top to bottom:

1. Sticky header: title, Sync button, overall progress bar, status line
   (as today).
2. Day strip.
3. **Now** block:
   - If today is a trip day: Next up for today (see below), a link to
     today's page, and the same spend quick-add row as the day page, so a
     spend can be logged from home without opening the day.
   - If the trip is in the future: "N days to go" and the first day's city.
   - If the trip is over: a short "Trip complete" line.
4. **Spending** tile: trip total as `¥N` with `≈ S$N` beneath, tap to open
   `#/money`.
5. **Trip info** sections (collapsible `<details>`): rendered from
   `state.info` (flights, stays, bookings, emergency numbers, phrases, or
   whatever the JSON contains). Read-only in the page.
6. Footer tools: Add day, Export/Import JSON, Reload, Sync settings, plus
   an **Exchange rate** control (see Money).

### Day page (`#/day/<id>`)

Top to bottom:

1. Sticky header: back arrow to `#/`, date + weekday, city (editable inputs
   as today), prev/next arrows, Sync button.
2. Compact day strip.
3. **Next up** card: the first stop in this day's timeline that is not done.
   Shows time, text, place name/address if present, a prominent **Open in
   Maps** button, and a **Done** button. When every stop is done, the card
   shows "All done for today" and, if the day has a `stay`, the hotel name
   with a maps button instead.
4. **Timeline**: list of stops in **array order**. The order of `items[]`
   in the JSON is authoritative; `time` is display only, so an untimed
   "walk to..." stop can sit between timed ones. Next up is the first
   not-done item in array order. Quick-add inserts a timed stop before the
   first later-timed stop and appends an untimed one; render never sorts.
   *(Designer's call; replaces the current re-sort on add.)* Each row: checkbox, time, text, and
   when present a second line with place name, address, a small maps link,
   `note`, and `price`. Done rows are struck through and dimmed. A thin
   vertical rail with dots connects rows visually (CSS only). Quick-add row
   (time + text) and per-row delete stay as today.
5. **Spending** section: day total (`¥` and `≈ S$`), quick-add row (amount
   in yen, label, category select), and the day's spend list, newest first,
   each with a delete button. Adding focuses the amount field again.
6. **Stay** card (if `day.stay` exists): hotel name, address, maps button,
   check-in/out note.
7. **Notes** textarea (as today).

### Money view (`#/money`)

- Trip total at the top (¥ and S$), then a per-category breakdown line.
- Spends grouped by day with day subtotals. Each row: label, category,
  `¥` and `S$`, time logged, delete.
- Exchange rate line with the current rate and when it was last updated.

### Money rules

- Spends are stored in **yen as integers**. SGD is always derived at display
  time; it is never stored per spend.
- Exchange rate lives in `state.fx`:
  `{ "home": "SGD", "jpyPerHome": 115, "updatedAt": "2026-11-04T..." }`.
  `sgd = yen / jpyPerHome`. Display rounds SGD to whole dollars when
  ≥ S$100, otherwise to 2 decimals. Yen is shown with thousands separators.
- The **Exchange rate** control (home footer and money view) shows the
  rate, allows typing a new value, and has a **Fetch latest** button. Fetch
  uses a free, keyless rate API (builder's choice; `api.frankfurter.app`
  with `from=SGD&to=JPY` is the suggested default). A fetched rate is
  written into `state.fx` and marked dirty like any other edit. Failure
  just shows a status message; the stored rate is kept.
- Default when `state.fx` is missing: `jpyPerHome: 115`, home `SGD`.
  The owner can overwrite it with the rate their card actually charges.
- Categories: `food`, `transport`, `shopping`, `tickets`, `stay`, `other`.
  Default `food`.
- Spends always belong to a day (`day.spends`). If a spend is logged from
  home on a date that has no day entry (a gap day or a travel day outside
  the itinerary), the page creates a day for today with an empty itinerary
  and puts the spend there. There is no trip-level spend bucket.
  *(Designer's call.)*

### Maps links

- If `place.maps` is present, use it as-is.
- Otherwise build
  `https://www.google.com/maps/search/?api=1&query=<urlencoded "name, address">`.
- Links open in a new tab/app (`target="_blank" rel="noopener"`).

### Data model (`trip.json`)

All new fields are optional. `load()` normalises missing fields so old files
render. Builder writes a `normalise(state)` step that fills defaults rather
than sprinkling `?.` everywhere.

```jsonc
{
  "title": "Japan Trip — Okinawa & Kansai",
  "updated": "ISO timestamp (set by sync)",
  "fx": { "home": "SGD", "jpyPerHome": 115, "updatedAt": "ISO" },
  "info": [
    { "title": "Flights", "lines": ["SQ 123 SIN→OKA 1 Dec 08:30", "..."] },
    { "title": "Emergency", "lines": ["Police 110", "Ambulance 119"] }
  ],
  "days": [
    {
      "id": "d1",
      "date": "2026-12-01",
      "city": "Naha (Okinawa)",
      "stay": { "name": "Hotel X", "address": "...", "maps": "https://...", "note": "Check-in 15:00" },
      "items": [
        {
          "id": "i1", "time": "10:00", "text": "Land at Naha Airport", "done": false,
          "place": { "name": "Naha Airport", "address": "...", "maps": "https://..." },
          "note": "Pick up Yui Rail pass at the counter",
          "price": "¥800 one-day pass"
        }
      ],
      "spends": [
        { "id": "s1", "yen": 1200, "label": "Lunch soba", "category": "food", "at": "2026-12-01T12:40:00+09:00" }
      ],
      "notes": ""
    }
  ]
}
```

- `items[].place`, `note`, `price`, `day.stay`, `day.spends`, `fx`, `info`
  are new. `price` is informational text, not a spend.
- `spends[].at` is set when logged (device local time, ISO with offset).

### Editing kept in the page

Check/uncheck stops, quick-add stop (time + text), delete stop, edit
date/city/notes, add/delete day, add/delete spend, edit exchange rate,
import/export JSON, settings. No in-page editing of `place`, `stay`, `info`.

### Code structure

- Keep `index.html`, `app.js`, `style.css`. The builder may move pure
  helpers (yen→home conversion and formatting, next-up selection, totals,
  normalise, maps URL builder) into `japan-trip/lib.js` as an ES module so
  they can be unit tested with `node --test` without a browser; `app.js`
  then becomes `<script type="module">`. This is recommended, not required.
- `render()` switches on the current route and renders into `<main>`.
  Existing delegated event handlers keep working across views because they
  look up `[data-day]` / `[data-item]` ancestors.
- Text inputs must not re-render on every keystroke (current `change`-only
  behaviour). The spend quick-add form submits on Enter.

### Seed data

Update `data/trip.json` so the sample days exercise every new field (at
least one `place`, one `stay`, one `spend`, an `fx`, and one `info`
section). The real itinerary will replace this later.

## Left to the builder

- Exact card dimensions, spacing, and the timeline rail styling, within the
  existing tokens and the light/dark scheme.
- Which rate API to call and how to parse it.
- Whether to extract `lib.js` and how much to unit test (totals, conversion,
  next-up, normalise are the valuable ones).
- How prev/next arrows behave at the ends (disable or wrap; disable is fine).
- Empty states (day with no stops, no spends yet, no info sections).

## Acceptance checklist

- Opening `/japan-trip/` shows the day strip with today highlighted (or the
  countdown if before the trip) and the trip spend total.
- Tapping a day card opens `#/day/<id>`; back returns home; refresh keeps
  the day open.
- On a day page, checking the Next up stop moves Next up to the following
  undone stop; the maps button opens the right place.
- Logging `1200` yen with label "lunch" shows `¥1,200 ≈ S$10.43` (at rate
  115), updates the day total and the home total, marks Sync dirty, and
  survives a reload.
- Changing the exchange rate changes every S$ figure; Fetch latest updates
  the rate and the "updated" time.
- The pre-change `trip.json` loads with no console errors and renders all
  days.
- Sync still commits the full state, including spends and fx, to GitHub.
