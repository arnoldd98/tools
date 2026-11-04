import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esc, renderStrip, renderTopRow } from '../views.js';

const days = [
  { id: 'd2', date: '2026-12-02', city: 'Okinawa', items: [], spends: [], notes: '' },
  { id: 'd1', date: '2026-12-01', city: 'Naha', items: [{ done: true }, { done: false }, { done: false }], spends: [], notes: '' },
  { id: 'dx', date: '', city: 'TBD', items: [], spends: [], notes: '' },
];

test('esc escapes html', () => assert.equal(esc('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;'));

test('renderStrip sorts, marks today and selected, shows progress', () => {
  const html = renderStrip(days, { today: '2026-12-02', selectedId: 'd1' });
  assert.ok(html.indexOf('data-strip="d1"') < html.indexOf('data-strip="d2"'));
  assert.ok(html.indexOf('data-strip="d2"') < html.indexOf('data-strip="dx"'));
  assert.match(html, /class="card selected"[^>]*data-strip="d1"/);
  assert.match(html, /class="card today"[^>]*data-strip="d2"/);
  assert.match(html, /href="#\/day\/d1"/);
  assert.match(html, /<span class="wd">Tue<\/span><span class="dom">1<\/span>/);
  assert.match(html, /<span class="prog">1\/3<\/span>/);
  assert.match(html, /<span class="wd">—<\/span><span class="dom">\?<\/span>/);
  assert.ok(!html.includes('class="strip compact"'));
  assert.ok(renderStrip(days, { today: '', compact: true }).includes('class="strip compact"'));
});

test('renderTopRow per route', () => {
  const state = { title: 'Trip <1>', days };
  assert.match(renderTopRow({ view: 'home' }, state, true), /<h1>Trip &lt;1&gt;<\/h1>/);
  assert.match(renderTopRow({ view: 'home' }, state, true), /class="btn dirty" data-action="sync">Sync •</);
  const day = renderTopRow({ view: 'day', id: 'd1' }, state, false);
  assert.match(day, /href="#\/"/);
  assert.match(day, /Tue 1 Dec/);
  assert.match(day, /<span class="nav disabled">/);          // no previous day
  assert.match(day, /<a class="nav" href="#\/day\/d2">/);     // next day
  assert.match(renderTopRow({ view: 'money' }, state, false), /<h1>Spending<\/h1>/);
});
import { renderDay, renderSpendForm, renderSpendList } from '../views.js';
const fx = { home: 'SGD', jpyPerHome: 115, updatedAt: null };
const rich = { id: 'd1', date: '2026-12-01', city: 'Naha', notes: 'n',
  stay: { name: 'Hotel <Z>', address: 'Addr', maps: 'https://m/h' },
  items: [
    { id: 'i1', time: '10:00', text: 'Land', done: true },
    { id: 'i2', time: '', text: 'Walk & eat', done: false, place: { name: 'Kokusai-dori', address: 'Naha' }, note: 'closes 5pm', price: '¥800' },
  ],
  spends: [
    { id: 's1', yen: 1200, label: 'lunch', category: 'food', at: '2026-12-01T12:40:00+09:00' },
    { id: 's2', yen: 300, label: 'bus <x>', category: 'transport', at: '2026-12-01T14:00:00+09:00' },
  ] };

test('renderDay shows next up with maps link and escapes text', () => {
  const html = renderDay({ title: 'T', days: [rich], fx, info: [] }, rich, '2026-12-01');
  assert.match(html, /class="next-up"[\s\S]*Walk &amp; eat/);
  assert.match(html, /href="https:\/\/www\.google\.com\/maps\/search\/\?api=1&amp;query=Kokusai-dori%2C%20Naha"/);
  assert.match(html, /data-action="toggle" data-item="i2"/);
  assert.match(html, /class="strip compact"/);
  assert.match(html, /<li class="done" data-item="i1"/);
  assert.match(html, /closes 5pm[\s\S]*¥800/);
  assert.match(html, /Hotel &lt;Z&gt;/);
  assert.ok(!html.includes('<Z>'));
  assert.match(html, /¥1,500 ≈ S\$13\.04/);
});
test('renderDay with everything done shows stay as destination', () => {
  const day = { ...rich, items: rich.items.map((i) => ({ ...i, done: true })) };
  const html = renderDay({ title: 'T', days: [day], fx, info: [] }, day, '2026-12-01');
  assert.match(html, /All done for today[\s\S]*href="https:\/\/m\/h"/);
});
test('spend form and list', () => {
  assert.match(renderSpendForm('d1'), /<form class="add-spend" data-day="d1">/);
  assert.ok(!renderSpendForm(null).includes('data-day'));
  assert.match(renderSpendForm('d1'), /<option value="food" selected>/);
  const list = renderSpendList(rich.spends, fx);
  assert.ok(list.indexOf('data-spend="s2"') < list.indexOf('data-spend="s1"'));
  assert.match(list, /bus &lt;x&gt;/);
  assert.match(list, /¥1,200 · S\$10\.43/);
  assert.match(renderSpendList([], fx), /No spends yet/);
});
import { renderHome, renderMoney, renderView } from '../views.js';
import { normalise } from '../lib.js';
const legacyState = normalise({ title: 'Legacy', days: [
  { id: 'd1', date: '2026-12-01', city: 'Naha', items: [{ id: 'i1', time: '10:00', text: 'Land', done: false }], notes: '' }] });

test('renderHome phases', () => {
  assert.match(renderHome(legacyState, '2026-11-04'), /27 days to go · Naha/);
  const during = renderHome(legacyState, '2026-12-01');
  assert.match(during, /Today · Naha[\s\S]*Land[\s\S]*href="#\/day\/d1"/);
  assert.match(during, /<form class="add-spend" data-day="d1">/);
  assert.match(renderHome({ ...legacyState, days: [...legacyState.days, { ...legacyState.days[0], id: 'd9', date: '2026-12-03' }] }, '2026-12-02'), /No plans today[\s\S]*<form class="add-spend">/);
  assert.match(renderHome(legacyState, '2026-12-09'), /Trip complete/);
  assert.match(renderHome(legacyState, '2026-12-09'), /href="#\/money"[\s\S]*¥0 ≈ S\$0\.00/);
  assert.ok(!renderHome(legacyState, '2026-12-09').includes('class="info"'));
  const withInfo = { ...legacyState, info: [{ title: 'Emergency', lines: ['Police 110'] }] };
  assert.match(renderHome(withInfo, '2026-12-09'), /<summary>Emergency<\/summary>[\s\S]*<li>Police 110<\/li>/);
});
test('renderMoney groups by day with category line', () => {
  const s = normalise({ fx: { jpyPerHome: 115 }, days: [
    { id: 'a', date: '2026-12-02', city: 'Osaka', spends: [{ id: 's1', yen: 5000, label: 'x', category: 'food', at: '2026-12-02T10:00:00Z' }] },
    { id: 'b', date: '2026-12-01', city: 'Naha', spends: [{ id: 's2', yen: 300, label: 'y', category: 'transport', at: '2026-12-01T10:00:00Z' }] },
    { id: 'c', date: '2026-12-03', city: 'Kyoto' }] });
  const html = renderMoney(s);
  assert.match(html, /¥5,300 ≈ S\$46\.09/);
  assert.match(html, /food ¥5,000 · transport ¥300/);
  assert.ok(html.indexOf('Naha') < html.indexOf('Osaka'));
  assert.ok(!html.includes('Kyoto'));
  assert.match(html, /1 SGD = 115 JPY · updated never/);
});
test('renderView falls back to home for unknown day', () => {
  assert.equal(renderView({ view: 'day', id: 'nope' }, legacyState, '2026-11-04'), renderView({ view: 'home' }, legacyState, '2026-11-04'));
  assert.match(renderView({ view: 'money' }, legacyState, '2026-11-04'), /Rate:/);
});
