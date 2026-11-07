# Today-first Redesign and PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Japan trip tracker into a three-tab, Today-first phone app (Today / Days / Trip) with a one-tap spend pad, five spend categories and per-day key info, installable as an offline PWA that opens fast and offers updates with a tap.

**Architecture:** Keep the existing split. `lib.js` (pure logic) gains category migration, `keyInfo` normalisation, trip calendar helpers and new routes. `views.js` (pure HTML strings) gets new screen renderers that replace `renderHome`/`renderMoney`/`renderDay`/`renderTopRow`/`renderSpendForm`. `app.js` owns DOM, state, routing, the spend sheet, the device-first `load()`, and service-worker registration. A new `sw.js` serves a versioned app-shell cache (cache first) and `data/trip.json` network first.

**Tech Stack:** Plain HTML/CSS/JS ES modules, no build, no npm runtime deps; `node --test` (Node 22); service worker + web app manifest; headless Chromium (Playwright, installed in a scratch dir, never in the repo) for browser checks.

**Spec:** `docs/superpowers/specs/2026-11-07-today-first-pwa-design.md` (builds on `docs/superpowers/specs/2026-11-04-day-pages-design.md`)

## Global Constraints

- No framework, no build step, no npm runtime dependencies. `package.json` stays dependency-free; `npm test` stays the single test command.
- Site works from `python3 -m http.server -d . 8000` → `http://localhost:8000/japan-trip/` and from GitHub Pages under `/tools/japan-trip/` (all paths relative).
- Routes: `#/` Today, `#/days` Days, `#/day/<id>` day page, `#/trip` Trip. `#/money` → `#/trip`; unknown day id → `#/days`; both via `location.replace` (no Back trap). Anything else → Today.
- `CATEGORIES = ['food','shopping','transport','tickets','misc']`, in that order; default `food`; `misc` displays as "miscellaneous" where space allows. `normalise` maps `other`, `stay` and unknown → `misc`.
- "Day N of M" and the overview's day count are **calendar days** from the first to the last dated day, inclusive.
- Spend sheet: amount input focused inside the tap handler (iPhone keyboard); Enter or Save logs; Back, backdrop or ✕ closes; closing never leaves an extra history entry.
- Unsynced device edits always win over remote data on load (existing rule). `sync()` and the draft format (`jt.draft` = `{ dirty, data }`) are unchanged.
- Service worker: shell cache name `jt-shell-<VERSION>`, data cache `jt-data`; shell cache-first, `data/trip.json` network-first; cross-origin requests untouched; new worker waits until the user taps "Updated, tap to reload". `VERSION` in `sw.js` is bumped by every commit that changes a shell file.
- All user text through `esc()`; ids in hrefs through `encodeURIComponent` then `esc()` (existing `dayHref`). Text inputs never re-render on keystroke.
- Reuse CSS tokens (`--bg --card --ink --muted --line --accent --ok --today`); light and dark; phone portrait first; iPhone safe-area insets respected.
- Commit trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Back after saving or closing the spend sheet goes to the previous screen, never to a "sheet open" ghost entry and never out of the app early. → Task 4 browser check (sheet history).
2. A draft saved by the previous version (categories `stay`/`other`, no `keyInfo`, `stay` object with no name) loads and renders all four routes with no thrown error, those spends shown as misc. → Task 1 `normalise` tests, Task 3 legacy-render test.
3. Device has unsynced edits and the background remote fetch then succeeds: the edits stay on screen and in the draft. → Task 4 browser check (device-first load).
4. Remote fetch hangs (weak signal): the screen is already drawn from the device copy, and a status message appears after the timeout rather than a blank page. → Task 4 browser check (hanging fetch).
5. A service-worker update while the user is mid-trip: old and new shell files are never mixed, and the update note appears only when a new worker is actually waiting. → Task 6 browser check (update flow).

---

## File structure

- Modify `japan-trip/lib.js` — categories, `keyInfo`, calendar helpers, routes.
- Modify `japan-trip/views.js` — new renderers: `renderHeader`, `renderTabs`, `renderKeyInfo`, `renderDayScreen`, `renderSpendSheet`, `renderToday`, `renderDays`, `renderTrip`, `renderView`; keep `esc`, `renderStrip`, `renderSpendList`; delete `renderTopRow`, `renderSpendForm`, `renderDay`, `renderHome`, `renderMoney`.
- Modify `japan-trip/app.js` — shell wiring, spend sheet, device-first load, SW registration and update note.
- Modify `japan-trip/index.html` — header, tabs, tools section, sheet container, manifest/icon/meta tags.
- Modify `japan-trip/style.css` — tab bar, FAB, sheet, tags, Today/Days/Trip layouts.
- Create `japan-trip/sw.js`, `japan-trip/manifest.webmanifest`, `japan-trip/icons/make_icons.py` (stdlib only) and the PNGs it writes: `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-maskable-512.png`, `icons/apple-touch-icon.png` (180).
- Modify `japan-trip/data/trip.json`, `README.md`.
- Tests: `japan-trip/test/lib.test.js`, `japan-trip/test/views.test.js` (pruned), new `japan-trip/test/screens.test.js`.

---

### Task 1: lib.js — categories, keyInfo, trip calendar, routes

**Files:**
- Modify: `japan-trip/lib.js`
- Test: `japan-trip/test/lib.test.js`

**Interfaces:**
- Produces:
  - `CATEGORIES = ['food','shopping','transport','tickets','misc']`
  - `CATEGORY_LABEL = { food:'food', shopping:'shopping', transport:'transport', tickets:'tickets', misc:'miscellaneous' }`
  - `CATEGORY_ICON = { food:'🍜', shopping:'🛍', transport:'🚃', tickets:'🎫', misc:'•' }`
  - `normalise` additionally: spend category ∉ `CATEGORIES` → `'misc'`; every day gets `keyInfo: KeyInfo[]` where `KeyInfo = { icon: string, label: string, lines: string[], place?: Place }`; entries with empty `label` dropped; `lines` non-array → `[]`, entries coerced to strings; `place` normalised like item places.
  - `tripSpan(days) → { start: string, end: string, length: number } | null` — over days with a non-empty `date`; `length` = calendar days inclusive.
  - `dayNumber(days, date) → { n: number, of: number } | null` — `null` when `date` outside the span or no dated days.
  - `tripOverview(days) → { start, end, length, cities: string[] } | null` — `cities` = non-empty `city` values in date order, de-duplicated keeping first occurrence.
  - `fmtRange(start, end) → string` — `'1–6 Dec 2026'` (same month), `'28 Nov – 3 Dec 2026'` (same year), `'28 Dec 2026 – 2 Jan 2027'`; single day `'1 Dec 2026'`. En dash `–`.
  - `parseRoute` additionally: `'#/days'` → `{ view: 'days' }`, `'#/trip'` → `{ view: 'trip' }`, `'#/money'` → `{ view: 'redirect', to: '#/trip' }`.

- [ ] **Step 1: Update existing tests for the new categories.** In `'totals and categories'` the expected `byCategory` becomes `{ food: 6200, shopping: 0, transport: 300, tickets: 0, misc: 0 }`. In `'normalise tolerates null and garbage'` the unknown category expectation becomes `'misc'`. Add `CATEGORY_LABEL, CATEGORY_ICON, tripSpan, dayNumber, tripOverview, fmtRange` to the imports.

- [ ] **Step 2: Append new failing tests**

```js
test('categories are the five, old ones migrate to misc', () => {
  assert.deepEqual(CATEGORIES, ['food', 'shopping', 'transport', 'tickets', 'misc']);
  assert.equal(CATEGORY_LABEL.misc, 'miscellaneous');
  const s = normalise({ days: [{ id: 'd', spends: [
    { id: 'a', yen: 1, category: 'stay' }, { id: 'b', yen: 1, category: 'other' }, { id: 'c', yen: 1, category: 'tickets' }] }] });
  assert.deepEqual(s.days[0].spends.map((x) => x.category), ['misc', 'misc', 'tickets']);
});
test('normalise keyInfo', () => {
  const s = normalise({ days: [{ id: 'd', keyInfo: [
    { icon: '🎫', label: 'Pass', lines: ['¥800', 3] },
    { label: '' }, { icon: 'x' }, 'junk',
    { label: 'Dinner', lines: 'nope', place: { name: 'Yunangi' } }] }, { id: 'e' }] });
  assert.deepEqual(s.days[0].keyInfo, [
    { icon: '🎫', label: 'Pass', lines: ['¥800', '3'] },
    { icon: '', label: 'Dinner', lines: [], place: { name: 'Yunangi', address: '' } }]);
  assert.deepEqual(s.days[1].keyInfo, []);
});
// Regression pin: already passes after Task 1's predecessor; keeps Review Focus 2 covered.
test('legacy draft with nameless stay still normalises', () => {
  const s = normalise({ days: [{ id: 'd', stay: {}, items: [{ id: 'i', text: 'x' }] }] });
  assert.equal(s.days[0].stay.name, '');
});
test('trip calendar helpers count calendar days', () => {
  const days = [{ date: '2026-12-04', city: 'Osaka' }, { date: '2026-12-01', city: 'Naha' },
    { date: '2026-12-02', city: 'Okinawa' }, { date: '2026-12-06', city: 'Kyoto' },
    { date: '2026-12-05', city: 'Osaka' }, { date: '', city: 'TBD' }];
  assert.deepEqual(tripSpan(days), { start: '2026-12-01', end: '2026-12-06', length: 6 });
  assert.deepEqual(dayNumber(days, '2026-12-03'), { n: 3, of: 6 });
  assert.equal(dayNumber(days, '2026-11-30'), null);
  assert.equal(dayNumber([], '2026-12-01'), null);
  assert.deepEqual(tripOverview(days).cities, ['Naha', 'Okinawa', 'Osaka', 'Kyoto']);
  assert.equal(tripSpan([{ date: '' }]), null);
});
test('fmtRange', () => {
  assert.equal(fmtRange('2026-12-01', '2026-12-06'), '1–6 Dec 2026');
  assert.equal(fmtRange('2026-11-28', '2026-12-03'), '28 Nov – 3 Dec 2026');
  assert.equal(fmtRange('2026-12-28', '2027-01-02'), '28 Dec 2026 – 2 Jan 2027');
  assert.equal(fmtRange('2026-12-01', '2026-12-01'), '1 Dec 2026');
});
test('new routes', () => {
  assert.deepEqual(parseRoute('#/days'), { view: 'days' });
  assert.deepEqual(parseRoute('#/trip'), { view: 'trip' });
  assert.deepEqual(parseRoute('#/money'), { view: 'redirect', to: '#/trip' });
});
```

- [ ] **Step 3: Run `npm test`.** Expected: FAIL — missing exports (`CATEGORY_LABEL` etc.).

- [ ] **Step 4: Implement the Interfaces in `lib.js`.** Calendar math with UTC on the `YYYY-MM-DD` parts (reuse the existing `utcDay`). Month names in `fmtRange` are the English three-letter abbreviations.

- [ ] **Step 5: Run `npm test`.** Expected: lib tests PASS. Views tests that assert old categories or old renderers may fail; that is Task 2/3's job — record which ones and continue. (The seed test still passes until Task 7 only if the seed already has `keyInfo`; it does not, so `'shipped trip.json normalises without change'` is expected to FAIL until Task 7 — note it in the ledger.)

- [ ] **Step 6: Commit** `japan-trip/lib.js japan-trip/test/lib.test.js` — `feat: five spend categories, keyInfo and trip calendar helpers`.

---

### Task 2: views.js — header, tabs, key info, day screen, spend sheet

**Files:**
- Modify: `japan-trip/views.js`
- Modify: `japan-trip/test/views.test.js` (prune)
- Create: `japan-trip/test/screens.test.js`

**Interfaces:**
- Consumes: Task 1 exports; existing `esc`, `dayHref`, `renderStrip`, `renderSpendList`, `nextUp`, `mapsUrl`, `dayTotal`, `fmtBoth`, `fmtHome`, `toHome`.
- Produces:
  - `renderHeader(route, state, dirty, today) → string` (replaces `renderTopRow`). Always ends with the existing sync button `<button class="btn[ dirty]" data-action="sync">Sync[ •]</button>`.
    - `home`: during trip → `<div class="hdr"><b>Tue 1 Dec · Naha</b><span class="muted">Day 1 of 6</span></div>` (city part omitted when no day entry or empty city); otherwise `<h1>` with `state.title`.
    - `days`: `<h1>Days</h1>` + `<span class="muted">` with `fmtRange` of the span (omitted when no span).
    - `day`: `<a class="back" href="#/days">‹</a>`, `<span class="when">Tue 1 Dec</span>`, prev/next exactly as the old `renderTopRow` (`<a class="nav" href>` / `<span class="nav disabled">`).
    - `trip`: `<h1>Trip</h1>`.
  - `renderTabs(route) → string`: `<nav class="tabs">` with `<a class="tab[ on]" href="#/">Today</a>`, `#/days` Days, `#/trip` Trip; `day` route marks Days on.
  - `renderKeyInfo(day) → string`: `''` when no stay and no keyInfo; else `<section class="keyinfo"><p class="eyebrow">Key info</p>` + one `<details class="tag">` per entry: hotel first when `day.stay` (`<summary>🏨 <name>[ · <note>]</summary>`, body: address line + maps button), then each keyInfo (`<summary>[icon ]label</summary>`, body: `<p>` per line + maps button when `place`).
  - `renderDayScreen(state, day, today, { page: boolean }) → string`: `<section class="day-screen" data-day="<id>">` containing, in order: compact strip (only when `page`), the Next up card (as the old one), `<h3>Today's plan</h3>` (or `Plan` when `page`) + `<ol class="timeline">` rows (as the old ones **without** delete buttons), `renderKeyInfo(day)`, `<details class="spent"><summary>Spent today|Spent <b>¥… ≈ S$…</b></summary>renderSpendList(...)</details>`, `<details class="edit-day"><summary>Edit day</summary>` with the date/city inputs (`data-field`), `<ul class="edit-items">` of stops each with `data-item` and a `data-action="del-item"` button, the existing `form.add-item`, the notes textarea, and the `del-day` button `</details>`, then `<button class="fab" data-action="open-spend" data-day="<id>">＋ ¥ Spend</button>`. "Spent today" wording when `day.date === today`, else "Spent".
  - `renderSpendSheet(dayId: string|null, fx) → string`: `<form class="spend-sheet"[ data-day="<id>"]>` with `<button type="button" class="icon close" data-action="close-spend">✕</button>`, `<p class="eyebrow">Log a spend</p>`, `<input name="yen" inputmode="numeric" autocomplete="off" placeholder="¥0" enterkeyhint="done">`, `<p class="live muted">≈ S$0.00</p>` (uses `fmtHome(0, fx.home)`), a `<div class="chips">` of `<label class="chip"><input type="radio" name="category" value="<c>"[ checked]> <icon> <c></label>` for each category (`food` checked; label text uses `CATEGORY_LABEL` except `misc` shows `misc`), `<input name="label" placeholder="What for? (optional)">`, `<button class="btn primary save" type="submit">Save</button>`.

- [ ] **Step 1: Prune `views.test.js`.** Keep `esc`, `renderStrip`, `'spend form and list'` (drop its three `renderSpendForm` asserts) and, from `'day links URL-encode ids'`, only the `renderStrip` assert. Delete the `renderTopRow`, `renderDay`, `renderHome`, `renderMoney` and `renderView` tests and their imports.

- [ ] **Step 2: Write failing tests in `japan-trip/test/screens.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalise } from '../lib.js';
import { renderHeader, renderTabs, renderKeyInfo, renderDayScreen, renderSpendSheet } from '../views.js';

export const trip = normalise({ title: 'Trip <1>', fx: { jpyPerHome: 115 }, days: [
  { id: 'd1', date: '2026-12-01', city: 'Naha', stay: { name: 'Hotel <X>', address: 'Kumoji', note: 'in 15:00' },
    keyInfo: [{ icon: '🎫', label: 'Pass & go', lines: ['¥800'] }, { label: 'Dinner', place: { name: 'Yunangi', address: 'Naha' } }],
    items: [{ id: 'i1', time: '10:00', text: 'Land', done: true }, { id: 'i2', time: '15:00', text: 'Check in', done: false }],
    spends: [{ id: 's1', yen: 1200, label: 'lunch', category: 'food', at: '2026-12-01T12:40:00+09:00' }] },
  { id: 'd3', date: '2026-12-06', city: 'Kyoto' }] });

test('header per route', () => {
  assert.match(renderHeader({ view: 'home' }, trip, false, '2026-12-01'), /<b>Tue 1 Dec · Naha<\/b><span class="muted">Day 1 of 6<\/span>/);
  assert.match(renderHeader({ view: 'home' }, trip, false, '2026-12-03'), /<b>Thu 3 Dec<\/b><span class="muted">Day 3 of 6<\/span>/);
  assert.match(renderHeader({ view: 'home' }, trip, true, '2026-11-07'), /<h1>Trip &lt;1&gt;<\/h1>[\s\S]*Sync •/);
  assert.match(renderHeader({ view: 'days' }, trip, false, ''), /<h1>Days<\/h1><span class="muted">1–6 Dec 2026<\/span>/);
  const day = renderHeader({ view: 'day', id: 'd1' }, trip, false, '');
  assert.match(day, /<a class="back" href="#\/days">/);
  assert.match(day, /<span class="nav disabled">/);
  assert.match(day, /<a class="nav" href="#\/day\/d3">/);
  assert.match(renderHeader({ view: 'trip' }, trip, false, ''), /<h1>Trip<\/h1>/);
});
test('tabs mark the active one; day page marks Days', () => {
  assert.match(renderTabs({ view: 'home' }), /<a class="tab on" href="#\/">Today<\/a>/);
  assert.match(renderTabs({ view: 'day', id: 'x' }), /<a class="tab on" href="#\/days">Days<\/a>/);
  assert.match(renderTabs({ view: 'trip' }), /<a class="tab on" href="#\/trip">Trip<\/a>/);
});
test('key info: hotel first, escaped, maps for places', () => {
  const html = renderKeyInfo(trip.days[0]);
  assert.ok(html.indexOf('Hotel &lt;X&gt;') < html.indexOf('Pass &amp; go'));
  assert.match(html, /<summary>🏨 Hotel &lt;X&gt; · in 15:00<\/summary>/);
  assert.match(html, /<summary>🎫 Pass &amp; go<\/summary>[\s\S]*<p>¥800<\/p>/);
  assert.match(html, /<summary>Dinner<\/summary>[\s\S]*query=Yunangi%2C%20Naha/);
  assert.equal(renderKeyInfo(trip.days[1]), '');
});
test('day screen: order, spent, edit tucked away, fab', () => {
  const html = renderDayScreen(trip, trip.days[0], '2026-12-01', { page: false });
  const order = ['class="next-up"', "Today's plan", 'class="keyinfo"', 'class="spent"', 'class="edit-day"', 'class="fab"'];
  order.reduce((prev, s) => { const i = html.indexOf(s); assert.ok(i > prev, s); return i; }, -1);
  assert.ok(!html.includes('class="strip'));
  assert.match(html, /Spent today <b>¥1,200 ≈ S\$10\.43<\/b>/);
  assert.match(html, /data-action="open-spend" data-day="d1"/);
  assert.ok(!/<ol class="timeline">[\s\S]*del-item[\s\S]*<\/ol>/.test(html), 'no delete in the plan list');
  assert.match(html, /class="edit-day"[\s\S]*data-item="i1"[\s\S]*data-action="del-item"/);
  const page = renderDayScreen(trip, trip.days[0], '2026-12-02', { page: true });
  assert.match(page, /class="strip compact"/);
  assert.match(page, /<summary>Spent <b>/);
});
test('spend sheet', () => {
  const html = renderSpendSheet('d1', trip.fx);
  assert.match(html, /<form class="spend-sheet" data-day="d1">/);
  assert.ok(!renderSpendSheet(null, trip.fx).includes('data-day'));
  assert.match(html, /name="yen" inputmode="numeric"/);
  assert.match(html, /≈ S\$0\.00/);
  assert.match(html, /value="food" checked/);
  const cats = [...html.matchAll(/name="category" value="(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(cats, ['food', 'shopping', 'transport', 'tickets', 'misc']);
});
```

- [ ] **Step 3: Run `npm test`.** Expected: `screens.test.js` FAILS (missing exports).

- [ ] **Step 4: Implement the Interfaces in `views.js`.** Delete `renderTopRow`, `renderSpendForm`, `renderDay`. `renderHome`, `renderMoney`, `renderView` may stay temporarily for Task 3 to replace; nothing new imports them.

- [ ] **Step 5: Run `npm test`.** Expected: views and screens tests PASS (only the seed test may still fail; see Task 1 Step 5).

- [ ] **Step 6: Commit** — `feat: header, tabs, key info, day screen and spend sheet renderers`.

---

### Task 3: views.js — Today, Days, Trip, renderView

**Files:**
- Modify: `japan-trip/views.js`
- Test: `japan-trip/test/screens.test.js`

**Interfaces:**
- Consumes: Task 1 and Task 2 exports; `tripPhase`, `tripTotal`, `byCategory`, `sortDays`, `nextUp`.
- Produces:
  - `renderToday(state, today) → string` by `tripPhase`:
    - `during` with day → `renderDayScreen(state, day, today, { page: false })`.
    - `during` without day → `<section class="day-screen">` with `<p class="what">No plans today</p>`, `<details class="spent"><summary>Spent today <b>¥0 ≈ S$0.00</b></summary>…</details>` and `<button class="fab" data-action="open-spend">＋ ¥ Spend</button>` (no `data-day`).
    - `before` → `<section class="countdown"><p class="big">N days to go</p><p>fmtRange · L days</p><p class="route">Naha → Okinawa → …</p><a class="btn" href="#/days">See the days</a></section>`; `1 day to go` singular. No fab.
    - `after` → `<section class="countdown"><p class="big">Trip complete</p><p>fmtBoth(total)</p><a class="btn" href="#/trip">Trip summary</a></section>`. No fab.
    - `none` → `Add a day to get started` + `<button class="btn" data-action="add-day">+ Add day</button>`.
  - `renderDays(state, today) → string`: `renderStrip(state.days, { today })`, then `<ul class="day-list">` of `<li><a class="day-row" href="<dayHref>"><b>Wed 2 · Okinawa</b><span class="sum">first three item texts joined ', '</span><span class="prog">0/4 ›</span></a></li>` in `sortDays` order (undated: `Undated · city`), then `<button class="btn" data-action="add-day">+ Add day</button>`.
  - `renderTrip(state) → string`: `<section class="total">` (`Spent so far`, `<p class="sum">¥…</p>`, `<p class="muted">≈ S$… · 1 SGD = 115 JPY</p>`); `<section class="cats">` one `<div class="cat-row[ zero]">` per category in order with icon, label, `¥` total and `<div class="bar"><i style="width:P%"></i></div>` (P = round(100 × cat / total), 0 when total 0); `<details class="by-day"><summary>Spends by day</summary>` groups as the old money view (`<section class="money-day" data-day>` + `renderSpendList`) or "No spends yet."; trip info `<details>` per `state.info` entry (as old home); `<p class="muted">Plans done: D of T</p>` + `<div class="progress"><div style="width:P%"></div></div>`.
  - `renderView(route, state, today) → string`: `home` → `renderToday`; `days` → `renderDays`; `day` → `renderDayScreen(..., { page: true })` or `renderDays` when not found; `trip` → `renderTrip`. Delete `renderHome` and `renderMoney`.

- [ ] **Step 1: Append failing tests to `screens.test.js`**

```js
import { renderToday, renderDays, renderTrip, renderView } from '../views.js';

test('today by phase', () => {
  assert.match(renderToday(trip, '2026-12-01'), /class="next-up"[\s\S]*class="fab"/);
  const gap = renderToday(trip, '2026-12-03');
  assert.match(gap, /No plans today[\s\S]*data-action="open-spend">/);
  const before = renderToday(trip, '2026-11-07');
  assert.match(before, /24 days to go/);
  assert.match(before, /1–6 Dec 2026 · 6 days/);
  assert.match(before, /Naha → Kyoto/);
  assert.ok(!before.includes('class="fab"'));
  assert.match(renderToday(trip, '2026-11-30'), /1 day to go/);
  const after = renderToday(trip, '2026-12-09');
  assert.match(after, /Trip complete[\s\S]*¥1,200 ≈ S\$10\.43/);
  assert.ok(!after.includes('class="fab"'));
  assert.match(renderToday(normalise({}), '2026-12-01'), /Add a day to get started/);
});
test('days list', () => {
  const html = renderDays(trip, '2026-12-01');
  assert.match(html, /class="strip"/);
  assert.match(html, /<b>Tue 1 · Naha<\/b><span class="sum">Land, Check in<\/span><span class="prog">1\/2 ›<\/span>/);
  assert.ok(html.indexOf('d1') < html.indexOf('d3'));
  assert.match(html, /data-action="add-day"/);
});
test('trip summary', () => {
  const html = renderTrip(trip);
  assert.match(html, /¥1,200[\s\S]*≈ S\$10\.43 · 1 SGD = 115 JPY/);
  const cats = [...html.matchAll(/class="cat-row( zero)?"/g)].map((m) => !m[1]);
  assert.deepEqual(cats, [true, false, false, false, false]);
  assert.match(html, /style="width:100%"/);
  assert.match(html, /Spends by day[\s\S]*data-day="d1"[\s\S]*lunch/);
  assert.match(html, /Plans done: 1 of 2/);
});
test('renderView dispatch and fallbacks', () => {
  assert.equal(renderView({ view: 'day', id: 'nope' }, trip, ''), renderView({ view: 'days' }, trip, ''));
  assert.match(renderView({ view: 'trip' }, trip, ''), /Spent so far/);
  assert.match(renderView({ view: 'day', id: 'd1' }, trip, ''), /class="strip compact"/);
});
test('legacy file renders every route', () => {
  const legacy = normalise({ title: 'Old', days: [{ id: 'd1', date: '2026-12-01', city: 'Naha', stay: {},
    items: [{ id: 'i1', time: '', text: 'x', done: false }],
    spends: [{ id: 's', yen: 300, category: 'stay', at: '' }], notes: '' }] });
  for (const r of [{ view: 'home' }, { view: 'days' }, { view: 'day', id: 'd1' }, { view: 'trip' }]) {
    assert.ok(renderView(r, legacy, '2026-12-01').length > 0, r.view);
  }
  assert.match(renderTrip(legacy), /miscellaneous[\s\S]*¥300/);
});
```

- [ ] **Step 2: Run `npm test`.** Expected: FAIL — missing exports.

- [ ] **Step 3: Implement the Interfaces.** Remove `renderHome`, `renderMoney`.

- [ ] **Step 4: Run `npm test`.** Expected: all PASS except the seed test (until Task 7).

- [ ] **Step 5: Commit** — `feat: Today, Days and Trip screens`.

---

### Task 4: App shell — index.html and app.js

**Files:**
- Modify: `japan-trip/index.html`, `japan-trip/app.js`

**Interfaces:**
- Consumes: `renderHeader`, `renderTabs`, `renderView`, `renderSpendSheet` from `views.js`; `parseRoute`, `parseYen`, `toHome`, `fmtHome`, `ensureDay`, existing lib exports.
- Produces: DOM ids used by Tasks 5–6: `#top`, `#status`, `#update` (button, hidden), `#view`, `#tools` (`<details>`, hidden except on Trip; placed after `#view` so it renders as Trip's last section), `#tabs`, `#sheet` (container with `.backdrop` and `#sheet-body`), `#fx`, `#fx-updated`, `#import`, `#settings`.

- [ ] **Step 1: Restructure `index.html`.**
  - Header: `<header class="top"><div id="top" class="top-row"></div><p id="status" class="muted"></p><button id="update" class="btn update" hidden>Updated, tap to reload</button></header>`. The header progress bar is removed.
  - `<main id="view"></main>`.
  - `<details id="tools" class="tools" hidden><summary>Settings</summary>` holding, unchanged, the exchange-rate form `#fx`, Export / Import / Reload buttons and the Sync settings `<details class="settings">`. (The old `<footer>` and its "+ Add day" button go away; Add day lives on Days.)
  - `<nav id="tabs"></nav>`.
  - `<div id="sheet" class="sheet" hidden><div class="backdrop" data-action="close-spend"></div><div id="sheet-body"></div></div>`.

- [ ] **Step 2: Rewrite `render()` in `app.js`.**
  - `route.view === 'redirect'` → `location.replace(route.to)`; return.
  - `day` route whose id is missing → `location.replace('#/days')`; return.
  - Fill `#top` (`renderHeader(route, state, dirty, todayISO())`), `#view`, `#tabs`; `#tools.hidden = route.view !== 'trip'`; fill `#fx` rate and `#fx-updated` as now. Keep the strip scroll preservation and `lastRouteKey` logic.
  - `markDirty()` keeps targeting `#top [data-action=sync]`.

- [ ] **Step 3: Spend sheet in `app.js`.**
  - `openSheet(dayId|null)`: set `#sheet-body` to `renderSpendSheet(dayId, state.fx)`, unhide `#sheet`, focus `[name=yen]` **synchronously** (still inside the click handler), `history.pushState({ sheet: true }, '')`.
  - `closeSheet({ fromPop })`: hide `#sheet`, clear body; when not `fromPop`, call `history.back()` to drop the entry. A module flag prevents the resulting `popstate` from double-closing.
  - `window.addEventListener('popstate', …)`: if the sheet is open, `closeSheet({ fromPop: true })`.
  - Click actions: `open-spend` → `openSheet(el.dataset.day || null)`; `close-spend` → `closeSheet()`.
  - `input` on `.spend-sheet [name=yen]` → update `.spend-sheet .live` text to `'≈ ' + fmtHome(toHome(parseYen(v) || 0, state.fx), state.fx.home)` and the `.save` button text to `Save ¥1,200` (`Save` when empty/invalid) — no re-render.
  - Submit `.spend-sheet`: existing `add-spend` logic (validation message, `ensureDay` when no `data-day`, push spend with `localISO()`), then `commit()`, `closeSheet()`, `setStatus('Logged ¥N.')`. On invalid amount the sheet stays open and refocuses the input.
  - Remove the old `.add-spend` submit branch and its refocus code.

- [ ] **Step 4: Device-first `load()`.**
  - `fetchRemote(signal)` / `apiGet(signal)` accept an `AbortSignal` passed to `fetch`. `sync()`'s own `apiGet()` call passes none.
  - `load({ force })`: when not forced and a draft exists → `state = normalise(draft.data); dirty = !!draft.dirty; render()` immediately. Then fetch remote with an 8 s `AbortController` timeout. On success: if `force || !dirty` → replace state, `dirty = false`, `saveDraft()`, `render()`, status as now; if dirty → keep device state, status "Unsynced changes on this device. Tap Sync to save to GitHub." On failure/timeout: status `Couldn't reach GitHub (<msg>). Showing this phone's copy.` (or, offline, `Offline. Showing the copy on this phone.`). With no draft, it awaits the same fetch before the first render, then falls back to an empty `normalise(null)` on failure.
  - `sync()` with no token: `location.hash = '#/trip'`, open `.settings`, existing message.
  - `add-day`: navigate to the new day (as now). `del-day`: `location.replace('#/days')`.

- [ ] **Step 5: Unit tests unchanged.** Run `npm test`. Expected: PASS except the seed test.

- [ ] **Step 6: Browser checks** (Playwright in a scratch dir, `python3 -m http.server` on a free port, 390×844 viewport, clock fixed to `2026-12-01T10:00:00`). Each must print PASS:
  1. Today shows Next up, plan, key info, `Spent today`; tabs switch routes; `#/money` lands on `#/trip`; `#/day/nope` lands on `#/days`.
  2. **Sheet history:** start at `#/days` then go to `#/`; tap ＋ ¥ Spend → the yen input is focused; type `1200`, Enter → sheet closed, `Spent today ¥2,400 …`, `Sync •`; `history.back()` → URL is `#/days`. Repeat with ✕ and with browser Back to close: same result, and no spend added.
  3. Invalid `-5` → message, sheet still open.
  4. Day page `#/day/d2` → Spend logs to d2 (check its Spent line).
  5. **Device-first load:** seed a dirty draft with an extra spend, route `**/data/trip.json` to a fulfilled seed response → reload → the extra spend still shows and `Sync •`.
  6. **Hanging fetch:** with a clean draft present, route `**/data/trip.json` to never respond → the Today screen is visible within 1 s; after ~8 s the status shows `Couldn't reach GitHub`.
  7. No console errors; no horizontal overflow.

- [ ] **Step 7: Commit** — `feat: tabbed app shell, spend sheet and device-first loading`.

---

### Task 5: Styles

**Files:**
- Modify: `japan-trip/style.css`

**Interfaces:**
- Consumes: class names from Tasks 2–4: `.hdr`, `.tabs`, `.tab`, `.tab.on`, `.fab`, `.sheet`, `.backdrop`, `.spend-sheet`, `.live`, `.chips`, `.chip`, `.save`, `.close`, `.keyinfo`, `.tag`, `.spent`, `.edit-day`, `.edit-items`, `.day-screen`, `.countdown`, `.big`, `.route`, `.day-list`, `.day-row`, `.sum`, `.total`, `.cats`, `.cat-row`, `.cat-row.zero`, `.bar`, `.by-day`, `.tools`, `.update`.

- [ ] **Step 1: Add styles.**
  - `body`: `padding-bottom: calc(72px + env(safe-area-inset-bottom))`.
  - `.tabs`: `position:fixed; left:0; right:0; bottom:0; display:flex; background:var(--card); border-top:1px solid var(--line); padding-bottom:env(safe-area-inset-bottom); z-index:2`; `.tab`: `flex:1; text-align:center; padding:10px 0; min-height:48px; color:var(--muted); text-decoration:none; font-weight:600`; `.tab.on`: `color:var(--accent)`. Constrain to `max-width:720px; margin-inline:auto` with the body.
  - `.fab`: `position:fixed; right:16px; bottom:calc(64px + env(safe-area-inset-bottom)); background:var(--accent); color:#fff; border:0; border-radius:28px; padding:14px 18px; font-weight:700; box-shadow:0 4px 14px #0003; z-index:2`.
  - `.sheet`: fixed full-screen, `z-index:3`; `.backdrop`: `position:absolute; inset:0; background:#0006`; `.spend-sheet`: `position:absolute; left:0; right:0; bottom:0; background:var(--card); border-radius:16px 16px 0 0; padding:16px 16px calc(16px + env(safe-area-inset-bottom))`, max-width 720 centred; `[name=yen]`: 32px, bold, centred, borderless; `.chip` input visually hidden, checked chip uses accent fill; `.save` full width.
  - `.tag`: card pill; `summary` one line with ellipsis; open shows lines under it.
  - `.countdown .big`: 32px bold; `.route`: muted.
  - `.day-row`: card row, `display:grid; grid-template-columns:1fr auto`, `.sum` muted single line with ellipsis spanning column 1.
  - `.cat-row`: grid `auto 1fr auto` + `.bar` full width under; `.cat-row.zero { opacity:.45 }`; `.bar` 6px track `var(--line)` with `i` filled `var(--accent)`.
  - `.update`: accent outline button under the status line.
  - Remove rules for removed markup (`.bottom`, old `.now`, `.tile`, `.next-up .actions` duplicates if unused).

- [ ] **Step 2: Verify** with headless screenshots at 390×844 light and dark (`colorScheme: 'dark'`) of Today (during), Today (before), sheet open, Days, Trip; and 1200px desktop of Trip. Check: no horizontal overflow; the FAB doesn't cover the last row when scrolled to the bottom; tab bar sits above the safe area. Look at each screenshot.

- [ ] **Step 3: Commit** — `style: tab bar, spend sheet, key info tags, Today/Days/Trip`.

---

### Task 6: PWA — icons, manifest, service worker, update note

**Files:**
- Create: `japan-trip/icons/make_icons.py`, `japan-trip/icons/*.png`, `japan-trip/manifest.webmanifest`, `japan-trip/sw.js`
- Modify: `japan-trip/index.html`, `japan-trip/app.js`

**Interfaces:**
- Consumes: `#update`, `#status` from Task 4.
- Produces: `sw.js` with `const VERSION = '1'`, `SHELL` list, caches `jt-shell-${VERSION}` / `jt-data`; message `'skip-waiting'`.

- [ ] **Step 1: Icons.** `make_icons.py` (Python stdlib: `zlib`, `struct`) writes RGBA PNGs: background `#c8492f`, centred white disc of radius 0.30×size (maskable: 0.22×size). Outputs `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` (180). Run it; commit the PNGs. Expected: `file japan-trip/icons/*.png` reports PNG images of the right sizes.

- [ ] **Step 2: Manifest** `manifest.webmanifest`: `name` and `short_name` "Japan Trip", `start_url "./"`, `scope "./"`, `display "standalone"`, `background_color "#f7f4ef"`, `theme_color "#c8492f"`, icons 192/512 (`purpose "any"`) and maskable 512 (`purpose "maskable"`).

- [ ] **Step 3: `index.html` head:** `<link rel="manifest" href="manifest.webmanifest">`, `<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">`, `<meta name="theme-color" content="#c8492f">`, `<meta name="apple-mobile-web-app-capable" content="yes">`, `<meta name="mobile-web-app-capable" content="yes">`, `<meta name="apple-mobile-web-app-status-bar-style" content="default">`, `<meta name="apple-mobile-web-app-title" content="Japan Trip">`.

- [ ] **Step 4: `sw.js`.**
  - `SHELL = ['./', 'index.html', 'app.js', 'lib.js', 'views.js', 'style.css', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png']`.
  - `install`: open `jt-shell-${VERSION}`, `addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))`; also try to cache `data/trip.json` into `jt-data` (ignore failure). **No `skipWaiting` here.**
  - `message`: `'skip-waiting'` → `self.skipWaiting()`.
  - `activate`: delete caches whose name is neither the current shell nor `jt-data`; `clients.claim()`.
  - `fetch`: ignore non-GET and cross-origin. Path ending `data/trip.json` → network first (`fetch(req, { cache: 'no-store' })`), on success put a clone in `jt-data`, on failure `caches.match` from `jt-data`. `request.mode === 'navigate'` → shell `index.html` from the current shell cache, falling back to network. Other same-origin → current shell cache match (`ignoreSearch: true`), falling back to network.

- [ ] **Step 5: Registration and update note in `app.js`.**
  - If `'serviceWorker' in navigator`: `register('./sw.js', { updateViaCache: 'none' })`.
  - Show `#update` when `reg.waiting` exists and `navigator.serviceWorker.controller` is set, at registration time and after `updatefound` → the installing worker reaches `installed`.
  - `#update` click → `reg.waiting.postMessage('skip-waiting')`; on `controllerchange` → `location.reload()` once (guard flag).
  - At load, if `!navigator.onLine`, status `Offline. Showing the copy on this phone.`

- [ ] **Step 6: Browser checks** (scratch Playwright, Chromium; service workers work on `localhost`):
  1. Load once online, wait for `navigator.serviceWorker.ready`; `context.setOffline(true)`; reload → Today renders, status says Offline; open `#/trip` → renders.
  2. **Update flow:** with the page open and controlled, edit the served `sw.js` `VERSION` to `'test-2'` and append a comment to `app.js` (in a temporary copy of the site, not the repo); call `reg.update()` → `#update` becomes visible; click it → page reloads once and `caches.keys()` contains only `jt-shell-test-2` and `jt-data`.
  3. Before any update is waiting, `#update` stays hidden (check after a plain reload).
  4. `curl` the manifest and icons: 200 with `application/manifest+json` (or `application/octet-stream` from the dev server — acceptable) and `image/png`.

- [ ] **Step 7: Run `npm test`.** Expected: PASS except the seed test.

- [ ] **Step 8: Commit** — `feat: installable offline PWA with update note`.

---

### Task 7: Seed data, README, acceptance pass

**Files:**
- Modify: `japan-trip/data/trip.json`, `README.md`, `japan-trip/sw.js` (VERSION bump only if a shell file changed in this task)
- Test: `japan-trip/test/lib.test.js`

- [ ] **Step 1: Extend the seed test** in `lib.test.js` (`'shipped trip.json normalises without change…'`) with:

```js
  assert.ok(s.days.some((d) => d.keyInfo.length >= 2));
  assert.ok(s.days.some((d) => d.keyInfo.some((k) => k.place)));
  assert.ok(s.days.every((d) => d.spends.every((x) => CATEGORIES.includes(x.category))));
```

- [ ] **Step 2: Run `npm test`.** Expected: the seed test FAILS (no `keyInfo`).

- [ ] **Step 3: Update `data/trip.json`.** Every day gets `"keyInfo"` (empty array where none). `d1` gets at least `🎫 Yui Rail 1-day pass` (lines: `¥800, buy at the airport station`) and `🍜 Dinner 19:00` with a `place` (name + address). Add a second `d1` spend in `transport` and an `info` "Hotels" section. Keep every field in normalised shape (the deep-equal assert).

- [ ] **Step 4: Run `npm test`.** Expected: all PASS.

- [ ] **Step 5: README.** Update the data model (categories, `keyInfo`), views (`#/`, `#/days`, `#/day/<id>`, `#/trip`), and add: **Install on your phone** (open in Safari/Chrome → Share → Add to Home Screen; on iPhone use only the installed app, its storage is separate from Safari); **Deploying changes** (bump `VERSION` in `japan-trip/sw.js` whenever any shell file changes, otherwise phones keep the old version).

- [ ] **Step 6: Acceptance** — run each spec acceptance item in headless Chromium at 390×844 and record the results in the commit message; mark anything not checkable headless (real iPhone install, real GitHub, real rate API) as "for the owner".

- [ ] **Step 7: Commit** — `feat: seed key info and categories; document install and deploy`.
