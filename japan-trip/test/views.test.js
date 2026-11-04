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
