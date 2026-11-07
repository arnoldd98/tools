import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalise, sortDays, toHome, fmtYen, fmtHome, fmtBoth, DEFAULT_FX, CATEGORIES,
  CATEGORY_LABEL, CATEGORY_ICON, tripSpan, dayNumber, tripOverview, fmtRange } from '../lib.js';

const legacy = { title: 'T', days: [{ id: 'd1', date: '2026-12-01', city: 'Naha',
  items: [{ id: 'i1', time: '10:00', text: 'Land', done: 0 }], notes: '' }] };

test('normalise fills defaults on a legacy file without mutating it', () => {
  const copy = JSON.parse(JSON.stringify(legacy));
  const s = normalise(legacy);
  assert.deepEqual(legacy, copy);
  assert.deepEqual(s.fx, DEFAULT_FX);
  assert.deepEqual(s.info, []);
  assert.deepEqual(s.days[0].spends, []);
  assert.equal(s.days[0].items[0].done, false);
});
test('normalise tolerates null and garbage', () => {
  assert.deepEqual(normalise(null).days, []);
  assert.equal(normalise({}).title, 'Japan Trip');
  const s = normalise({ days: [{ id: 'x', spends: [{ id: 's', yen: '1200.9', category: 'nope' }] }] });
  assert.equal(s.days[0].spends[0].yen, 1200);
  assert.equal(s.days[0].spends[0].category, 'misc');
  assert.equal(s.days[0].notes, '');
  assert.equal(s.days[0].city, '');
});
test('normalise merges a partial fx over the default', () => {
  assert.deepEqual(normalise({ fx: { jpyPerHome: 110 } }).fx, { home: 'SGD', jpyPerHome: 110, updatedAt: null });
});
test('sortDays orders by date with empty dates last', () => {
  const out = sortDays([{ id: 'a', date: '' }, { id: 'b', date: '2026-12-02' }, { id: 'c', date: '2026-12-01' }]);
  assert.deepEqual(out.map((d) => d.id), ['c', 'b', 'a']);
});
test('money formatting', () => {
  const fx = { home: 'SGD', jpyPerHome: 115 };
  assert.equal(toHome(1200, fx).toFixed(4), '10.4348');
  assert.equal(fmtYen(1200), '¥1,200');
  assert.equal(fmtYen(0), '¥0');
  assert.equal(fmtHome(10.4348, 'SGD'), 'S$10.43');
  assert.equal(fmtHome(107.8, 'SGD'), 'S$108');
  assert.equal(fmtHome(10.4348, 'EUR'), 'EUR 10.43');
  assert.equal(fmtBoth(1200, fx), '¥1,200 ≈ S$10.43');
  assert.equal(CATEGORIES[0], 'food');
});
import { parseYen, validRate, nextUp, dayTotal, tripTotal, byCategory, mapsUrl, insertItem,
  parseRoute, tripPhase, ensureDay, parseFxRate } from '../lib.js';

test('parseYen accepts messy input and rejects non-positive', () => {
  assert.equal(parseYen('1,200'), 1200);
  assert.equal(parseYen('¥1200'), 1200);
  assert.equal(parseYen('1200.5'), 1200);
  assert.equal(parseYen('0'), null);
  assert.equal(parseYen('-5'), null);
  assert.equal(parseYen(''), null);
});
test('validRate', () => {
  assert.equal(validRate('115.3'), 115.3);
  for (const bad of ['0', '-1', 'abc', '', 'Infinity']) assert.equal(validRate(bad), null, bad);
});
test('nextUp is first undone item in array order regardless of time', () => {
  const day = { items: [{ id: 'a', time: '12:00', done: true }, { id: 'b', time: '', done: false }, { id: 'c', time: '09:00', done: false }] };
  assert.equal(nextUp(day).id, 'b');
  assert.equal(nextUp({ items: [{ done: true }] }), null);
});
test('totals and categories', () => {
  const state = { days: [
    { spends: [{ yen: 1200, category: 'food' }, { yen: 300, category: 'transport' }] },
    { spends: [{ yen: 5000, category: 'food' }] }, { spends: [] }] };
  assert.equal(dayTotal(state.days[0]), 1500);
  assert.equal(tripTotal(state), 6500);
  assert.deepEqual(byCategory(state), { food: 6200, shopping: 0, transport: 300, tickets: 0, misc: 0 });
});
test('mapsUrl prefers explicit link, else builds a search', () => {
  assert.equal(mapsUrl({ name: 'X', maps: 'https://maps.app.goo.gl/abc' }), 'https://maps.app.goo.gl/abc');
  assert.equal(mapsUrl({ name: 'Shuri Castle', address: '1-2 Shurikinjocho, Naha' }),
    'https://www.google.com/maps/search/?api=1&query=Shuri%20Castle%2C%201-2%20Shurikinjocho%2C%20Naha');
  assert.equal(mapsUrl({ name: 'Shuri Castle' }), 'https://www.google.com/maps/search/?api=1&query=Shuri%20Castle');
});
test('insertItem keeps array order authoritative', () => {
  const items = [{ id: 'a', time: '09:00' }, { id: 'b', time: '' }, { id: 'c', time: '14:00' }];
  assert.deepEqual(insertItem(items, { id: 'n', time: '12:00' }).map((i) => i.id), ['a', 'b', 'n', 'c']);
  assert.deepEqual(insertItem(items, { id: 'n', time: '' }).map((i) => i.id), ['a', 'b', 'c', 'n']);
  assert.deepEqual(insertItem(items, { id: 'n', time: '18:00' }).map((i) => i.id), ['a', 'b', 'c', 'n']);
  assert.equal(items.length, 3);
});
test('parseRoute', () => {
  for (const h of ['', '#', '#/', '#/xyz', '#/day/']) assert.deepEqual(parseRoute(h), { view: 'home' }, h);
  assert.deepEqual(parseRoute('#/day/d3'), { view: 'day', id: 'd3' });
});
test('tripPhase', () => {
  const days = [{ id: 'a', date: '2026-12-01' }, { id: 'b', date: '2026-12-03' }, { id: 'z', date: '' }];
  assert.deepEqual(tripPhase([], '2026-11-04'), { phase: 'none' });
  assert.deepEqual(tripPhase(days, '2026-11-04'), { phase: 'before', daysToGo: 27, first: days[0] });
  assert.deepEqual(tripPhase(days, '2026-12-01'), { phase: 'during', day: days[0] });
  assert.deepEqual(tripPhase(days, '2026-12-02'), { phase: 'during', day: null });
  assert.deepEqual(tripPhase(days, '2026-12-04'), { phase: 'after' });
});
test('ensureDay finds or creates', () => {
  const state = { days: [{ id: 'a', date: '2026-12-01', items: [], spends: [], notes: '' }] };
  assert.equal(ensureDay(state, '2026-12-01', () => 'new'), state.days[0]);
  const made = ensureDay(state, '2026-12-02', () => 'new');
  assert.deepEqual(made, { id: 'new', date: '2026-12-02', city: '', items: [], spends: [], notes: '' });
  assert.equal(state.days.length, 2);
});
test('parseFxRate reads frankfurter shape', () => {
  assert.equal(parseFxRate({ rates: { JPY: 115.3 } }), 115.3);
  assert.equal(parseFxRate({}), null);
  assert.equal(parseFxRate(null), null);
});
import { readFileSync } from 'node:fs';
test('shipped trip.json normalises without change and uses the new fields', () => {
  const raw = JSON.parse(readFileSync(new URL('../data/trip.json', import.meta.url)));
  const s = normalise(raw);
  assert.equal(s.fx.home, 'SGD');
  assert.ok(s.info.length >= 1);
  assert.ok(s.days.some((d) => d.stay));
  assert.ok(s.days.some((d) => d.items.some((i) => i.place)));
  assert.ok(s.days.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date)), 'every day dated');
  assert.equal(new Set(s.days.map((d) => d.date)).size, s.days.length, 'no duplicate dates');
  assert.ok(s.days.some((d) => d.keyInfo.length >= 2));
  assert.ok(s.days.some((d) => d.keyInfo.some((k) => k.place)));
  assert.ok(s.days.every((d) => d.spends.every((x) => CATEGORIES.includes(x.category))));
  assert.deepEqual(JSON.parse(JSON.stringify(s)), raw, 'seed should already be in normalised shape');
});

test('normalise gives missing ids unique values', () => {
  const s = normalise({ days: [{ items: [{ text: 'a' }, { text: 'b' }, { id: 'keep', text: 'c' }], spends: [{ yen: 1 }, { yen: 2 }] }, {}] });
  const ids = [...s.days.map((d) => d.id), ...s.days[0].items.map((i) => i.id), ...s.days[0].spends.map((x) => x.id)];
  assert.ok(ids.every(Boolean), 'no empty ids');
  assert.equal(new Set(ids).size, ids.length, 'ids unique');
  assert.equal(s.days[0].items[2].id, 'keep');
});
test('parseRoute survives malformed escapes', () => {
  assert.deepEqual(parseRoute('#/day/%'), { view: 'home' });
  assert.deepEqual(parseRoute('#/day/50%25'), { view: 'day', id: '50%' });
});
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
