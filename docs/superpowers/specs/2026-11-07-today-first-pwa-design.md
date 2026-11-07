# Japan trip tracker: Today-first redesign and PWA

Date: 2026-11-07
Status: draft, awaiting owner approval
Scope: `japan-trip/` static site (GitHub Pages, no build step)
Builds on: `docs/superpowers/specs/2026-11-04-day-pages-design.md` (shipped on branch `japan-trip-base`). Anything not changed here stays as that spec and the current code have it.
Mockups: design A, as shown during brainstorming (Today, spend pad, Days, Trip).

## Intent

The owner will use this on a phone while out in Japan. When they open it on the
street they want, without navigating:

1. What's on today: the plan and the next stop, with directions.
2. Key info for today: hotel, passes and tickets, reservations.
3. A fast way to log what they just spent.

Trip-wide statistics (total spent, breakdowns, trip info) move off the home screen
into a separate Trip tab. The app must install to the home screen and keep working
with no signal.

## Decisions made by the owner

- **No framework.** Stay plain HTML/CSS/JS ES modules, no build step, no npm runtime deps.
- **It becomes a PWA** (installable, works offline).
- **Layout A:** the app opens on Today; a floating **＋ ¥ Spend** button opens a spend pad.
- **Five spend categories, in this order:** `food`, `shopping`, `transport`, `tickets`, `misc` (shown as "miscellaneous" where space allows). Default `food`.
- **Before the trip,** Today shows the countdown and a brief overview only.

## Goals

- Today opens instantly on launch and shows today's day without any tap.
- Logging a spend: tap ＋ ¥ Spend, type the amount, Save. Category is one optional tap; label is optional.
- Three bottom tabs: Today, Days, Trip.
- Offline: after one online visit, the app, and the last itinerary and edits on this device, all load with no network.
- **Opens fast, even on weak signal** (owner's choice over "always newest"). The app
  starts from the copy on the phone; a newer deployed version is fetched in the
  background and offered with an "Updated, tap to reload" note. The owner has been
  bitten by a stale service worker on another app, so an update must never be stuck:
  it is always detected on the next online open and applied on one tap or the next launch.

## Non-goals

- Push notifications, background sync, live weather, embedded maps.
- Editing places, stays or key info in the page (still authored in `trip.json`).
- Changing the GitHub Sync/draft logic (the known sync-in-flight race stays as is; out of scope).

## Anti-goals

- A build step, a framework, or npm runtime dependencies.
- A service worker that can get stuck on an old app version: one that never notices a new deploy, or serves a mix of old and new files.
- Making spend logging slower than: one tap, type, one tap.
- Desktop-only layout. Primary target: phone in portrait, including iPhone home-screen mode.

## Screens

### Bottom tab bar (all screens)

Fixed at the bottom, three tabs: **Today** (`#/`), **Days** (`#/days`), **Trip** (`#/trip`).
The active tab is highlighted. A day page (`#/day/<id>`) highlights Days. The bar
respects the iPhone safe-area inset.

The header of every screen carries a small **Sync** button showing the dirty
marker (`Sync •`) as now, and the status line stays available for messages.

### Today (`#/`)

Content depends on the trip phase (existing `tripPhase` logic):

**During the trip, today has a day entry** (design A):
1. Header: `Tue 1 Dec · Naha` and `Day 1 of 6`. *(Builder's call, settled in review:)*
   counts **calendar days** from the first to the last dated day, so a date with no
   entry inside the trip still reads e.g. `Day 3 of 6`.
2. **Next up** card: as now (time, text, place, Open in Maps, Done). All done →
   "All done for today" plus tonight's hotel with a maps button if `day.stay`.
3. **Today's plan:** every stop in array order with a tick box; done stops struck
   through; the next-up stop highlighted. Place/note/price detail lines as now.
4. **Key info** tags for the day (see Data). Tapping a tag expands its detail lines
   inline (and a maps button when it has a place). Section hidden when empty.
5. **Spent today** card: `¥2,400 ≈ S$20.87`. Tapping it expands today's spend
   list (newest first, each with delete).
6. **Edit day** (collapsed by default): date, city, add-stop form, per-stop delete,
   notes, delete day. These are the existing editing features, tucked away.
7. Floating **＋ ¥ Spend** button above the tab bar.

**During the trip, no entry for today:** header with the date and `Day N of M`, "No plans today",
Spent today card, and the ＋ ¥ Spend button (logging creates the day, as now).

**Before the trip:** countdown and a brief overview only:
"24 days to go", trip dates ("1–6 Dec 2026"), the route of distinct cities in date
order ("Naha → Okinawa → Osaka → Kyoto"), and "6 days" (calendar days, as above). No Spend button.

**After the trip:** "Trip complete", the trip total, and a link to Trip. No Spend button.

**No days at all:** "Add a day to get started" with an Add day button.

### Spend pad (sheet)

Opened by ＋ ¥ Spend. A bottom sheet over the current screen with a dimmed backdrop.

- Big amount display; the amount input is focused immediately so the phone's
  number keyboard opens (`inputmode="numeric"`). On iPhone the focus must happen
  inside the tap handler or the keyboard won't open.
- Live `≈ S$…` under the amount as it is typed.
- Category chips, one row: food (selected), shopping, transport, tickets, misc.
- Optional "What for?" label.
- **Save ¥N** button; Enter in the amount field also saves.
- Logs to: today's day when opened from Today; that day when opened from a day page.
- Invalid amount: existing `parseYen` rules and message; sheet stays open.
- Save closes the sheet and shows "Logged ¥1,200" in the status line.
- Closes on backdrop tap, a close button, or browser Back.

### Days (`#/days`)

- The day strip (as now, today highlighted), then a list of every day in date order:
  `Wed 2 · Okinawa`, a one-line summary (the first 2–3 stop texts, comma-joined),
  and progress `0/4 ›`. Tapping a strip card or row opens `#/day/<id>`.
- **Add day** button at the bottom.

### Day page (`#/day/<id>`)

Same layout as Today-with-a-day, for that date, plus: back to Days, prev/next day
arrows, compact strip. Its ＋ ¥ Spend logs to that day. Unknown id → Days.

### Trip (`#/trip`)

Top to bottom:
1. **Spent so far:** `¥48,300`, `≈ S$420`, rate line `1 SGD = 115 JPY`.
2. **By category:** one row per category with its ¥ total and a bar proportional
   to share of the trip total. Zero categories are shown dimmed.
3. **Spends by day** (collapsible): grouped by day with subtotals, each spend with
   delete. This replaces the old `#/money` view.
4. **Trip info** sections from `state.info`, each collapsible (as now).
5. **Plans done:** `2 of 18` with the progress bar.
6. **Settings** (collapsible): exchange-rate control (save, Fetch latest, updated
   time), Export JSON, Import JSON, Reload from GitHub, Sync settings.

The global footer and the always-visible header progress bar go away; their
contents live in Trip.

### Routes

| Route | Screen |
|---|---|
| `#/`, empty, unknown | Today |
| `#/days` | Days |
| `#/day/<id>` | Day page (unknown id → `#/days`, via `location.replace`) |
| `#/trip` | Trip |
| `#/money` | Redirect to `#/trip` (old link) |

## Data (`trip.json`)

Additive; old files keep loading through `normalise`.

- **Categories:** `CATEGORIES = ['food','shopping','transport','tickets','misc']`.
  `normalise` maps `other`, `stay` and any unknown category to `misc`.
- **New optional `days[].keyInfo[]`:**
  ```jsonc
  "keyInfo": [
    { "icon": "🎫", "label": "Yui Rail 1-day pass", "lines": ["¥800, buy at the airport station"] },
    { "icon": "🍜", "label": "Yunangi 19:00 · ref 4821", "lines": ["Party of 2", "Cash only"],
      "place": { "name": "Yunangi", "address": "3-3-3 Kumoji, Naha" } }
  ]
  ```
  `icon` optional, `label` required (entries without it are dropped by `normalise`),
  `lines` defaults to `[]`, `place` optional (same shape as item places).
- **Hotel tag:** when the day has `stay`, Today shows a hotel tag first, generated
  from `stay` (`🏨 <name> · <note>`), expanding to address and a maps button. It is
  not duplicated into `keyInfo`.
- Seed `data/trip.json` updated to exercise `keyInfo` and the new categories.

## PWA

- `japan-trip/manifest.webmanifest`: name "Japan Trip", short_name "Japan Trip",
  `start_url: "./"`, `scope: "./"`, `display: "standalone"`, theme and background
  colours from the existing tokens, icons 192 and 512 PNG plus a maskable variant.
  `index.html` links the manifest, an `apple-touch-icon` (180 PNG), and the iOS
  `apple-mobile-web-app-*` meta tags.
- `japan-trip/sw.js`, scope `japan-trip/` (registered from `app.js` as `./sw.js`).
  **Open fast, update in the background** (owner's choice):
  - The app shell (index.html, `app.js`, `lib.js`, `views.js`, `style.css`,
    manifest, icons) is cached as **one versioned set**. `sw.js` holds a
    `VERSION` constant; the cache name includes it. Bumping `VERSION` is part of
    every deploy that changes a shell file (put this in the README and the plan's
    commit steps). Serving the shell always comes from one set, never a mix.
  - Shell requests: **cache first** from the current set → instant open on any signal.
  - The browser checks `sw.js` on every online open (register with
    `updateViaCache: 'none'`; the worker fetches the new set with `cache: 'reload'`
    so the HTTP cache can't hand back old files). A new worker installs the full new
    set in the background, then waits.
  - When a new worker is waiting, the page shows **"Updated, tap to reload"** in the
    status area. Tap → the waiting worker activates (`skipWaiting` via message) →
    the page reloads once. If not tapped, the new version is used on the next launch
    after all tabs close. Old caches are deleted on activate.
  - `data/trip.json`: **network first, cache fallback** (it is data, not shell),
    so the no-token path stays fresh when online and works offline.
  - Cross-origin requests (GitHub API, rate API, maps links) are not intercepted.
- **Loading data** *(builder's call, settled in review)*: `load()` draws immediately
  from the device copy (the localStorage draft) when one exists, then fetches remote
  in the background with a ~8 s timeout. When remote arrives and the device has no
  unsynced edits, state is replaced and re-rendered (same rule as now: unsynced
  edits on the device win). With no device copy (first run), it waits for remote as
  now. `sync()` and the draft format are unchanged.
- Offline behaviour of the data is unchanged: edits live in the localStorage draft;
  Sync fails with its existing message when offline.
- Status line shows "Offline. Showing the copy on this phone." when `navigator.onLine`
  is false at load.

**iPhone note for the owner (put in README):** an app added to the home screen
has its own storage, separate from Safari. Install it, then use only the installed
app; unsynced edits made in Safari do not carry over.

## Constraints

- Keep `lib.js` (pure, tested) / `views.js` (pure HTML strings, tested) / `app.js`
  (DOM, state, sync) split. New pure logic goes in `lib.js`/`views.js` with tests.
- All user text through `esc()`; ids in hrefs through `encodeURIComponent` (as now).
- Text inputs never re-render on keystroke.
- Reuse the CSS tokens; light and dark.
- `npm test` stays the single test command.

## Left to the builder

- Icon artwork (a simple generated glyph on the accent colour is fine) and how the
  PNGs are produced (committed as files; no build step).
- Exact sheet animation, spacing, tag styling, bar styling.
- Whether Today and the day page share one renderer with flags (recommended).
- Testing approach for the service worker (a headless-browser check of offline
  load and of the update note is enough; unit tests not required).
- *(Settled in review, builder's call)* Back closes the spend pad without leaving a
  stray history entry; Sync with no token opens Trip → Settings with the existing
  message.

## Acceptance checklist

- During the trip, opening the app shows today's Next up, plan, key info tags and
  Spent today with no tap.
- ＋ ¥ Spend → type `1200` → Save logs ¥1,200 food to today, updates Spent today
  and the Trip total, marks Sync dirty; it takes 3 taps or fewer including Save.
- Before the trip, Today shows only the countdown and overview.
- Days lists every day; tapping one opens its page; its Spend logs to that day.
- Trip shows total, five category rows, spends by day, trip info, settings.
- An old spend with category `other` or `stay` shows as misc.
- After one online load, turning the network off and reloading shows the app and
  the itinerary; edits still save to the device.
- On weak or no signal the app opens from the phone without waiting for the network.
- After deploying a changed `app.js` (with `VERSION` bumped), opening the app online
  shows "Updated, tap to reload"; tapping it shows the new version. Closing and
  reopening the app also lands on the new version.
- Installed on iPhone home screen, it opens full-screen with the tab bar clear of
  the home indicator.
- `#/money` and `#/day/<unknown>` redirect without trapping Back.
