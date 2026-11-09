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
  assert.ok(!('info' in s), 'no trip info field');
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
  parseRoute, tripPhase, ensureDay, parseFxRate, fxUrls, rateIsStale } from '../lib.js';

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
test('parseFxRate reads the currency-api shape for the home currency', () => {
  assert.equal(parseFxRate({ date: '2026-11-07', sgd: { jpy: 123.56 } }, 'SGD'), 123.56);
  assert.equal(parseFxRate({ myr: { jpy: 33.1 } }, 'MYR'), 33.1);
  assert.equal(parseFxRate({ sgd: { jpy: 0 } }, 'SGD'), null);
  assert.equal(parseFxRate({ rates: { JPY: 115 } }, 'SGD'), null);
  assert.equal(parseFxRate(null, 'SGD'), null);
});
test('fxUrls: primary CDN then fallback, for the home currency', () => {
  assert.deepEqual(fxUrls('SGD'), [
    'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/sgd.json',
    'https://latest.currency-api.pages.dev/v1/currencies/sgd.json',
  ]);
});
test('rateIsStale after a day or when never fetched', () => {
  const now = new Date('2026-11-13T10:00:00Z');
  assert.equal(rateIsStale({ updatedAt: null }, now), true);
  assert.equal(rateIsStale({ updatedAt: '2026-11-12T09:00:00Z' }, now), true);
  assert.equal(rateIsStale({ updatedAt: '2026-11-12T11:00:00Z' }, now), false);
  assert.equal(rateIsStale({ updatedAt: 'garbage' }, now), true);
});
import { readFileSync } from 'node:fs';
// Guards the shipped data file without depending on what the trip contains.
test('data/trip.json is valid and loadable', () => {
  const raw = JSON.parse(readFileSync(new URL('../data/trip.json', import.meta.url)));
  assert.ok(Array.isArray(raw.days), 'has a days array');
  const s = normalise(raw);
  const dayIds = s.days.map((d) => d.id);
  assert.equal(new Set(dayIds).size, dayIds.length, 'day ids are unique');
  for (const d of s.days) {
    const ids = d.items.map((i) => i.id);
    assert.equal(new Set(ids).size, ids.length, `stop ids unique on ${d.date || d.id}`);
  }
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
test('normalise does not add a keyInfo field', () => {
  assert.ok(!('keyInfo' in normalise({ days: [{ id: 'd' }] }).days[0]));
});
// Old saved data may have a hotel entry with no name.
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

import { fmtTime, minutesUntil, fmtUntil, nextFixed } from '../lib.js';
test('fmtTime is 12-hour', () => {
  assert.equal(fmtTime('05:10'), '5:10 am');
  assert.equal(fmtTime('12:00'), '12:00 pm');
  assert.equal(fmtTime('00:30'), '12:30 am');
  assert.equal(fmtTime('23:20'), '11:20 pm');
  assert.equal(fmtTime(''), '');
  assert.equal(fmtTime('nonsense'), 'nonsense');
});
test('normalise keeps fixed only when set', () => {
  const s = normalise({ days: [{ id: 'd', items: [{ id: 'a', fixed: 1 }, { id: 'b' }] }] });
  assert.equal(s.days[0].items[0].fixed, true);
  assert.ok(!('fixed' in s.days[0].items[1]));
});
test('countdown helpers', () => {
  assert.equal(minutesUntil('05:10', '04:30'), 40);
  assert.equal(minutesUntil('05:10', '06:00'), -50);
  assert.equal(fmtUntil(40), 'in 40 min');
  assert.equal(fmtUntil(135), 'in 2 h 15 min');
  assert.equal(fmtUntil(120), 'in 2 h');
  assert.equal(fmtUntil(0), 'now');
  assert.equal(fmtUntil(-5), 'now');
});
test('nextFixed is the first undone fixed stop', () => {
  const day = { items: [{ id: 'a', fixed: true, done: true }, { id: 'b' }, { id: 'c', fixed: true }, { id: 'd', fixed: true }] };
  assert.equal(nextFixed(day).id, 'c');
  assert.equal(nextFixed({ items: [{ id: 'x' }] }), null);
});
import { newerFx } from '../lib.js';
test('newerFx keeps the more recently updated rate', () => {
  const old = { home: 'SGD', jpyPerHome: 115, updatedAt: null };
  const fresh = { home: 'SGD', jpyPerHome: 123.56, updatedAt: '2026-11-13T02:00:00Z' };
  assert.equal(newerFx(fresh, old), fresh);
  assert.equal(newerFx(old, fresh), fresh);
  assert.equal(newerFx({ ...fresh, updatedAt: '2026-11-14T00:00:00Z' }, fresh).updatedAt, '2026-11-14T00:00:00Z');
  assert.equal(newerFx(old, { ...old }).jpyPerHome, 115);
});
test('normalise gives every day a summary string', () => {
  const s = normalise({ days: [{ id: 'a', summary: 'Beach day' }, { id: 'b' }, { id: 'c', summary: 5 }] });
  assert.deepEqual(s.days.map((d) => d.summary), ['Beach day', '', '5']);
});
import { fmtMoney } from '../lib.js';
test('fmtMoney shows one currency', () => {
  const fx = { home: 'SGD', jpyPerHome: 115 };
  assert.equal(fmtMoney(1200, fx, 'JPY'), '¥1,200');
  assert.equal(fmtMoney(1200, fx, 'HOME'), 'S$10.43');
  assert.equal(fmtMoney(1200, fx), '¥1,200');
});
import { safeUrl } from '../lib.js';
test('safeUrl only allows http(s) links', () => {
  assert.equal(safeUrl(' https://drive.google.com/file/d/x/view '), 'https://drive.google.com/file/d/x/view');
  assert.equal(safeUrl('http://a.b/c'), 'http://a.b/c');
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl('drive.google.com/x'), null);
  assert.equal(safeUrl(''), null);
});
test('normalise keeps valid stop links, drops bad ones, adds none by default', () => {
  const s = normalise({ days: [{ id: 'd', items: [
    { id: 'a', links: [{ label: 'Boarding pass', url: 'https://drive.google.com/x' }, { label: 'bad', url: 'javascript:x' }, { url: 'https://k.lk/y' }, 'junk'] },
    { id: 'b' }] }] });
  assert.deepEqual(s.days[0].items[0].links, [
    { label: 'Boarding pass', url: 'https://drive.google.com/x' }, { label: 'k.lk', url: 'https://k.lk/y' }]);
  assert.ok(!('links' in s.days[0].items[1]));
});

import { extractUrl, linkKind } from '../lib.js';
test('extractUrl takes a bare link, one without https://, or share text', () => {
  assert.equal(extractUrl(' https://drive.google.com/file/d/abc/view?usp=sharing '), 'https://drive.google.com/file/d/abc/view?usp=sharing');
  assert.equal(extractUrl('drive.google.com/file/d/abc/view'), 'https://drive.google.com/file/d/abc/view');
  assert.equal(extractUrl('www.trip.com/hotels/x'), 'https://www.trip.com/hotels/x');
  assert.equal(extractUrl('Check out this hotel on Trip.com! https://us.trip.com/w/AbC12.'), 'https://us.trip.com/w/AbC12');
  assert.equal(extractUrl('我在携程发现了好酒店：https://m.trip.com/x/1，快来看！'), 'https://m.trip.com/x/1');
  assert.equal(extractUrl('javascript:alert(1)'), null);
  assert.equal(extractUrl('just words'), null);
  assert.equal(extractUrl(''), null);
});
test('linkKind names known sites (Drive, Trip.com, …) and falls back to the host', () => {
  const k = (u) => linkKind(u).name;
  assert.deepEqual(linkKind('https://drive.google.com/file/d/x/view'), { icon: '📁', name: 'Google Drive' });
  assert.equal(k('https://docs.google.com/document/d/x'), 'Google Docs');
  assert.equal(k('https://docs.google.com/spreadsheets/d/x'), 'Google Sheets');
  assert.deepEqual(linkKind('https://us.trip.com/w/abc'), { icon: '🧳', name: 'Trip.com' });
  assert.equal(k('https://www.trip.com/hotels/detail'), 'Trip.com');
  assert.equal(k('https://www.klook.com/activity/1'), 'Klook');
  assert.equal(k('https://www.booking.com/hotel/jp/x.html'), 'Booking.com');
  assert.equal(k('https://www.agoda.com/x'), 'Agoda');
  assert.equal(k('https://www.airbnb.com.sg/rooms/1'), 'Airbnb');
  assert.equal(k('https://maps.app.goo.gl/abc'), 'Google Maps');
  assert.equal(k('https://example.com/ticket.pdf'), 'PDF');
  assert.deepEqual(linkKind('https://www.jreast.co.jp/x'), { icon: '🔗', name: 'jreast.co.jp' });
  assert.equal(k('https://nottrip.com/x'), 'nottrip.com', 'only trip.com itself');
});
test('day links (bookings & files) are normalised like stop links', () => {
  const s = normalise({ days: [{ id: 'd', links: [{ url: 'https://us.trip.com/w/1' }, { url: 'ftp://x' }] }, { id: 'e' }] });
  assert.deepEqual(s.days[0].links, [{ label: 'Trip.com', url: 'https://us.trip.com/w/1' }]);
  assert.ok(!('links' in s.days[1]));
});
test('times, countdowns and date ranges in Chinese', () => {
  assert.equal(fmtTime('05:10', 'zh'), '上午5:10');
  assert.equal(fmtTime('14:00', 'zh'), '下午2:00');
  assert.equal(fmtTime('14:00'), '2:00 pm');
  assert.equal(fmtUntil(40, 'zh'), '40 分钟后');
  assert.equal(fmtUntil(100, 'zh'), '1 小时 40 分钟后');
  assert.equal(fmtUntil(120, 'zh'), '2 小时后');
  assert.equal(fmtUntil(0, 'zh'), '现在');
  assert.equal(fmtRange('2026-12-01', '2026-12-06', 'zh'), '2026年12月1日–6日');
  assert.equal(fmtRange('2026-11-12', '2026-12-06', 'zh'), '2026年11月12日–12月6日');
  assert.equal(fmtRange('2026-12-30', '2027-01-02', 'zh'), '2026年12月30日–2027年1月2日');
  assert.equal(fmtRange('2026-12-01', '2026-12-01', 'zh'), '2026年12月1日');
});
test('extractUrl keeps brackets the link opened, drops sentence punctuation, rejects non-links', () => {
  assert.equal(extractUrl('https://en.wikipedia.org/wiki/Kinkaku-ji_(temple)'), 'https://en.wikipedia.org/wiki/Kinkaku-ji_(temple)');
  assert.equal(extractUrl('(see https://www.klook.com/activity/1)'), 'https://www.klook.com/activity/1');
  assert.equal(extractUrl('Book here: https://us.trip.com/w/x!'), 'https://us.trip.com/w/x');
  assert.equal(extractUrl('“https://us.trip.com/w/y”'), 'https://us.trip.com/w/y');
  for (const junk of ['e.g', '1.5', 'v1.2', 'hello world']) assert.equal(extractUrl(junk), null, junk);
  assert.equal(extractUrl('trip.com'), 'https://trip.com');
});
