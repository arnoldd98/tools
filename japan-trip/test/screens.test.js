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
