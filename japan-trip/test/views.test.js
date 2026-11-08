import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esc, renderStrip, renderSpendList } from '../views.js';

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

const fx = { home: 'SGD', jpyPerHome: 115, updatedAt: null };
const spends = [
  { id: 's1', yen: 1200, label: 'lunch', category: 'food', at: '2026-12-01T12:40:00+09:00' },
  { id: 's2', yen: 300, label: 'bus <x>', category: 'transport', at: '2026-12-01T14:00:00+09:00' },
];
test('spend list', () => {
  const list = renderSpendList(spends, fx);
  assert.ok(list.indexOf('data-spend="s2"') < list.indexOf('data-spend="s1"'));
  assert.match(list, /bus &lt;x&gt;/);
  assert.match(list, /<span class="amt">¥1,200<\/span>/);
  assert.ok(!list.includes('S$'), 'one currency at a time');
  assert.match(list, /<span class="sp-ico" aria-hidden="true">🚃<\/span>/);
  assert.match(list, /<span class="sub">transport · 2:00 pm<\/span>/);
  const sgd = renderSpendList(spends, fx, 'HOME');
  assert.match(sgd, /<span class="amt">S\$10\.43<\/span>/);
  assert.ok(!sgd.includes('¥1,200'));
  assert.match(renderSpendList([], fx), /Nothing spent yet/);
});

test('day links URL-encode ids', () => {
  const ds = [{ id: '50%', date: '2026-12-01', city: 'A', items: [], spends: [], notes: '' }];
  assert.match(renderStrip(ds, { today: '' }), /href="#\/day\/50%25"/);
});
test('unlabelled spend names the category once', () => {
  const html = renderSpendList([{ id: 'x', yen: 66, label: '', category: 'food', at: '2026-11-13T12:10:00+09:00' }], fx);
  assert.match(html, /<span class="label">food<\/span><span class="sub">12:10 pm<\/span>/);
});
