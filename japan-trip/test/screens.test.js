import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalise } from '../lib.js';
import { renderHeader, renderTabs, renderDayScreen, renderSpendSheet } from '../views.js';

export const trip = normalise({ title: 'Trip <1>', fx: { jpyPerHome: 115 }, days: [
  { id: 'd1', date: '2026-12-01', city: 'Naha', stay: { name: 'Hotel <X>', address: 'Kumoji', note: 'in 15:00' },
    keyInfo: [{ icon: '🎫', label: 'Pass & go', lines: ['¥800'] }, { label: 'Dinner', place: { name: 'Yunangi', address: 'Naha' } }],
    items: [{ id: 'i1', time: '10:00', text: 'Land', done: true }, { id: 'i2', time: '15:00', text: 'Check in', done: false }],
    spends: [{ id: 's1', yen: 1200, label: 'lunch', category: 'food', at: '2026-12-01T12:40:00+09:00' }] },
  { id: 'd3', date: '2026-12-06', city: 'Kyoto' }] });

test('header per route', () => {
  assert.match(renderHeader({ view: 'home' }, trip, false, '2026-12-01'), /<b>Tue 1 Dec · Naha<\/b><span class="hanko" aria-label="Today">今日<\/span><\/div><span class="muted">Day 1 of 6<\/span>/);
  assert.match(renderHeader({ view: 'home' }, trip, false, '2026-12-03'), /<b>Thu 3 Dec<\/b><span class="hanko" aria-label="Today">今日<\/span><\/div><span class="muted">Day 3 of 6<\/span>/);
  assert.ok(!renderHeader({ view: 'day', id: 'd1' }, trip, false, '2026-12-01').includes('今日'), 'stamp only on Today');
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
test('day screen: order, spent, fab; no separate edit section', () => {
  const html = renderDayScreen(trip, trip.days[0], '2026-12-01', { page: false });
  const order = ['class="next-up"', "Today's plan", 'class="spent-card"', 'class="fab"'];
  assert.ok(!html.includes('Key info') && !html.includes('class="tag"'), 'no key info section');
  order.reduce((prev, s) => { const i = html.indexOf(s); assert.ok(i > prev, s); return i; }, -1);
  assert.ok(!html.includes('class="edit-day"'));
  assert.ok(!html.includes('class="strip'));
  assert.match(html, /<section class="spent-card">\s*<div class="spent-head"><h3>Spent today<\/h3><span class="spent-total">¥1,200<\/span>/);
  assert.ok(!html.includes('<details class="spent"'), 'not collapsible');
  assert.match(renderDayScreen(trip, trip.days[0], '2026-12-01', { cur: 'HOME' }), /<span class="spent-total">S\$10\.43<\/span>/);
  assert.match(html, /data-action="open-spend" data-day="d1"/);
  const page = renderDayScreen(trip, trip.days[0], '2026-12-02', { page: true });
  assert.match(page, /class="strip compact"/);
  assert.match(page, /<h3>Spent<\/h3>/);
});
test('plan has an Edit button; normal mode has no fields or deletes', () => {
  const day = { ...trip.days[0], notes: 'Bring <cash>' };
  const html = renderDayScreen(trip, day, '2026-12-01', { page: false });
  assert.match(html, /<button class="btn small" data-action="toggle-edit">✎ Edit<\/button>/);
  assert.ok(!html.includes('data-action="del-item"'));
  assert.ok(!html.includes('data-item-field'));
  assert.ok(!html.includes('class="add-item"'));
  assert.ok(!html.includes('data-action="del-day"'));
  assert.ok(!html.includes('data-field='));
  assert.match(html, /<p class="notes">Bring &lt;cash&gt;<\/p>/);
  assert.ok(!renderDayScreen(trip, trip.days[0], '2026-12-01', {}).includes('class="notes"'), 'no notes block when empty');
});
test('edit mode edits stops, date, city and notes in place', () => {
  const day = { ...trip.days[0], notes: 'n & m' };
  const html = renderDayScreen(trip, day, '2026-12-01', { page: false, editing: true });
  assert.match(html, /data-action="toggle-edit">Done<\/button>/);
  assert.match(html, /<ol class="timeline editing">/);
  assert.match(html, /data-item="i2"[\s\S]*?<input type="time" value="15:00" data-item-field="time"[\s\S]*?<input value="Check in" data-item-field="text"[\s\S]*?data-action="del-item"/);
  assert.ok(!/<ol class="timeline editing">[\s\S]*type="checkbox"[\s\S]*<\/ol>/.test(html), 'no tick boxes while editing');
  assert.match(html, /data-field="date"[\s\S]*data-field="city"[\s\S]*class="timeline editing"/);
  assert.match(html, /class="timeline editing"[\s\S]*class="add-item"/);
  assert.match(html, /<textarea[^>]*data-field="notes">n &amp; m<\/textarea>/);
  assert.match(html, /data-action="del-day"/);
});
test('renderView passes the editing day through', () => {
  assert.match(renderView({ view: 'day', id: 'd1' }, trip, '', { editingId: 'd1' }), /class="timeline editing"/);
  assert.ok(!renderView({ view: 'day', id: 'd1' }, trip, '', { editingId: 'd3' }).includes('editing'));
  assert.match(renderView({ view: 'home' }, trip, '2026-12-01', { editingId: 'd1' }), /class="timeline editing"/);
});
test('spend sheet', () => {
  const html = renderSpendSheet('d1', trip.fx);
  assert.match(html, /<form class="spend-sheet" data-day="d1">/);
  assert.ok(!renderSpendSheet(null, trip.fx).includes('data-day'));
  assert.match(html, /name="yen" inputmode="numeric"/);
  assert.ok(!html.includes('≈ S$'), 'no S$ preview when showing yen');
  assert.match(renderSpendSheet('d1', trip.fx, 'HOME'), /≈ S\$0\.00/);
  assert.match(html, /value="food" checked/);
  const cats = [...html.matchAll(/name="category" value="(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(cats, ['food', 'shopping', 'transport', 'tickets', 'misc']);
});
test('header prev/next links URL-encode ids', () => {
  const ds = normalise({ days: [{ id: 'a b', date: '2026-12-01' }, { id: '50%', date: '2026-12-02' }] });
  assert.match(renderHeader({ view: 'day', id: '50%' }, ds, false, ''), /href="#\/day\/a%20b"/);
});
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
  assert.match(after, /Trip complete[\s\S]*¥1,200/);
  assert.match(renderToday(trip, '2026-12-09', { cur: 'HOME' }), /Trip complete[\s\S]*S\$10\.43/);
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
  assert.match(html, /<p class="sum">¥1,200<\/p>[\s\S]*1 SGD = 115 JPY/);
  const home = renderTrip(trip, { cur: 'HOME' });
  assert.match(home, /<p class="sum">S\$10\.43<\/p>/);
  assert.match(home, /food<\/span><span class="amt">S\$10\.43<\/span>/);
  assert.ok(!home.includes('¥1,200'));
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
test('spend sheet puts Save right under the amount (iPhone keyboard covers the bottom)', () => {
  const html = renderSpendSheet('d1', trip.fx);
  assert.ok(html.indexOf('class="btn primary save"') < html.indexOf('class="chips"'));
});

test('fixed stops: 12-hour times, marked rows, next-fixed strip with countdown', () => {
  const day = normalise({ days: [{ id: 'f', date: '2026-11-13', city: 'Okinawa', items: [
    { id: 'a', time: '05:10', text: 'Shuttle bus', fixed: true, note: 'or 5:55 am' },
    { id: 'b', time: '', text: 'Breakfast' },
    { id: 'c', time: '07:40', text: 'Flight', fixed: true },
    { id: 'd', time: '14:00', text: 'Check in' }] }] }).days[0];
  const st = { ...trip, days: [day] };
  const html = renderDayScreen(st, day, '2026-11-13', { now: '04:30' });
  assert.match(html, /<div class="fixed-strip">⏱ Next fixed: <b>Shuttle bus · 5:10 am<\/b> · in 40 min<\/div>/);
  assert.match(html, /<li class="fixed[^"]*" data-item="a">[\s\S]*?<span class="time">5:10 am<\/span>[\s\S]*?<span class="ontime">⏱ be on time<\/span>/);
  assert.match(html, /<li class="[^"]*" data-item="d">[\s\S]*?<span class="time">2:00 pm<\/span>/);
  assert.ok(!/data-item="d">[\s\S]*?be on time[\s\S]*?<\/li>/.test(html.slice(html.indexOf('data-item="d"'))), 'flexible stop has no be-on-time');
  assert.match(html, /class="next-up fixed"[\s\S]*?5:10 am[\s\S]*?be on time/);
  // another day: no countdown
  assert.match(renderDayScreen(st, day, '2026-11-12', { page: true }), /⏱ Fixed: <b>Shuttle bus · 5:10 am<\/b><\/div>/);
  // edit mode has a fixed toggle per stop
  assert.match(renderDayScreen(st, day, '2026-11-13', { editing: true }), /data-item="a">[\s\S]*?<button class="icon fx-toggle on" data-action="toggle-fixed"/);
  // no fixed stops left → no strip
  const done = { ...day, items: day.items.map((i) => ({ ...i, done: !!i.fixed })) };
  assert.ok(!renderDayScreen(st, done, '2026-11-13', { now: '04:30' }).includes('fixed-strip'));
});

test('day summary: Days list, day screen, edit field; falls back to stops', () => {
  const withSum = { ...trip, days: trip.days.map((d) => (d.id === 'd1' ? { ...d, summary: 'Land & <explore>' } : d)) };
  const days = renderDays(withSum, '2026-12-01');
  assert.match(days, /<b>Tue 1 · Naha<\/b><span class="sum">Land &amp; &lt;explore&gt;<\/span>/);
  assert.match(renderDays(trip, '2026-12-01'), /<span class="sum">Land, Check in<\/span>/, 'fallback to first stops');
  const day = withSum.days[0];
  assert.match(renderDayScreen(withSum, day, '2026-12-01', {}), /<p class="day-summary">Land &amp; &lt;explore&gt;<\/p>/);
  assert.ok(!renderDayScreen(trip, trip.days[0], '2026-12-01', {}).includes('day-summary'), 'no empty summary line');
  assert.match(renderDayScreen(withSum, day, '2026-12-01', { editing: true }),
    /<input class="summary" value="Land &amp; &lt;explore&gt;" placeholder="One-line summary of the day" data-field="summary"/);
});
test('header has a ¥ | S$ switch showing the active currency', () => {
  for (const r of [{ view: 'home' }, { view: 'days' }, { view: 'day', id: 'd1' }, { view: 'trip' }]) {
    assert.match(renderHeader(r, trip, false, '2026-12-01', { cur: 'JPY' }),
      /<button class="cur-toggle" data-action="toggle-cur" aria-label="Show amounts in S\$"><span class="on">¥<\/span><span>S\$<\/span><\/button>/, r.view);
  }
  assert.match(renderHeader({ view: 'trip' }, trip, false, '', { cur: 'HOME' }), /aria-label="Show amounts in ¥"><span>¥<\/span><span class="on">S\$<\/span>/);
});

test('stop links: buttons in the plan and on Next up; edit mode adds/removes', () => {
  const day = normalise({ days: [{ id: 'L', date: '2026-11-13', items: [
    { id: 'f', time: '07:40', text: 'Flight', links: [{ label: 'Boarding <pass>', url: 'https://drive.google.com/a?x=1&y=2' }] },
    { id: 'g', text: 'Lunch' }] }] }).days[0];
  const st = { ...trip, days: [day] };
  const html = renderDayScreen(st, day, '2026-11-13', {});
  assert.match(html, /data-item="f">[\s\S]*?<a class="link-btn" href="https:\/\/drive\.google\.com\/a\?x=1&amp;y=2" target="_blank" rel="noopener">🔗 Boarding &lt;pass&gt;<\/a>/);
  assert.match(html, /class="next-up[^"]*"[\s\S]*?class="link-btn"[\s\S]*?Boarding &lt;pass&gt;[\s\S]*?Today's plan/);
  const edit = renderDayScreen(st, day, '2026-11-13', { editing: true });
  assert.match(edit, /data-item="f">[\s\S]*?Boarding &lt;pass&gt; <button class="icon" data-action="del-link" data-link="0"/);
  assert.match(edit, /data-item="g">[\s\S]*?<button class="btn small" data-action="show-link-form">＋ Link<\/button>/);
  const form = renderDayScreen(st, day, '2026-11-13', { editing: true, linkFormFor: 'g' });
  assert.match(form, /data-item="g">[\s\S]*?<form class="add-link"><input name="url" type="url" inputmode="url" placeholder="Paste link" required><input name="label" placeholder="Name, e.g\. Boarding pass"><button class="btn small" type="submit">Add<\/button><\/form>/);
});
test('Trip has no info sections, even for old data that still has them', () => {
  const old = { ...trip, info: [{ title: 'Flights', lines: ['x'] }] };
  assert.ok(!renderTrip(old).includes('info-sec'));
});
