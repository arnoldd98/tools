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
test('spend sheet puts Save right under the amount (iPhone keyboard covers the bottom)', () => {
  const html = renderSpendSheet('d1', trip.fx);
  assert.ok(html.indexOf('class="btn primary save"') < html.indexOf('class="chips"'));
});
