import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalise, sortDays, toHome, fmtYen, fmtHome, fmtBoth, DEFAULT_FX, CATEGORIES } from '../lib.js';

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
  assert.equal(s.days[0].spends[0].category, 'other');
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
