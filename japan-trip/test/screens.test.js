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
  assert.match(day, /<a class="back" href="#\/days"><span class="chev">‹<\/span><span class="when">Tue 1 Dec<\/span><\/a>/, "the date is part of the back link");
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
  assert.match(html, /<section class="spent-card">\s*<div class="spent-head"><h3>Spent today<\/h3><button class="cur-toggle"[\s\S]*?<\/button><\/div>\s*<p class="spent-total">¥1,200<\/p>/);
  assert.ok(!html.includes('<details class="spent"'), 'not collapsible');
  assert.match(renderDayScreen(trip, trip.days[0], '2026-12-01', { cur: 'HOME' }), /<p class="spent-total">S\$10\.43<\/p>/);
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
  // a stop: its name on the full width, then time · must be on time · delete
  assert.match(html, /data-item="i2">\s*<textarea rows="1" data-item-field="text" aria-label="Stop">Check in<\/textarea>\s*<div class="edit-row">\s*<span class="time-box has-time"><input type="time" value="15:00" data-item-field="time" aria-label="Time"><button type="button" class="clear-time" data-action="clear-time" title="Clear time" aria-label="Clear time">✕<\/button><\/span>[\s\S]*?data-action="toggle-fixed"[\s\S]*?data-action="del-item"/);
  assert.ok(!/next-up|fixed-strip|spent-card|class="fab"|day-summary/.test(html), 'only editable things are shown');
  assert.match(html, /class="add-item">\s*<input name="text"[\s\S]*?<span class="time-box"><input type="time" value="" name="time"[\s\S]*?type="submit">Add</);
  assert.match(html, /data-item="i1">[\s\S]*?<span class="time-box has-time">/);
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
  const empty = renderToday(normalise({}), '2026-12-01');
  assert.match(empty, /No trip days yet/);
  assert.ok(!empty.includes('add-day'), 'no Add day button');
});
test('days list', () => {
  const html = renderDays(trip, '2026-12-01');
  assert.match(html, /class="strip"/);
  assert.match(html, /<b>Tue 1 · Naha<\/b><span class="sum">Land, Check in<\/span><span class="prog">1\/2 ›<\/span>/);
  assert.ok(html.indexOf('d1') < html.indexOf('d3'));
  assert.ok(!html.includes('add-day'), 'no Add day button');
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
  assert.match(html, /<h3>Last 5 expenses<\/h3>[\s\S]*data-spend="s1" data-day="d1"[\s\S]*lunch/);
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
  assert.match(renderDayScreen(st, day, '2026-11-13', { editing: true }), /<li class="fixed" data-item="a">[\s\S]*?<button class="fx-toggle on" data-action="toggle-fixed" title="Fixed time \(must make it\)" aria-pressed="true">⏱ Be on time<\/button>/);
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
    /<textarea class="summary" rows="1" placeholder="One-line summary of the day" data-field="summary">Land &amp; &lt;explore&gt;<\/textarea>/);
});
test('¥ | S$ switch sits where money is shown, not in the header', () => {
  const sw = /<button class="cur-toggle" data-action="toggle-cur" aria-label="Show amounts in S\$"><span class="on">¥<\/span><span>S\$<\/span><\/button>/;
  for (const r of [{ view: 'home' }, { view: 'days' }, { view: 'day', id: 'd1' }, { view: 'trip' }]) {
    assert.ok(!renderHeader(r, trip, false, '2026-12-01', { cur: 'JPY' }).includes('cur-toggle'), r.view);
  }
  assert.match(renderDayScreen(trip, trip.days[0], '2026-12-01', { cur: 'JPY' }), new RegExp('class="spent-card"[\\s\\S]*' + sw.source));
  assert.match(renderTrip(trip, { cur: 'JPY' }), new RegExp('<section class="total">[\\s\\S]*?' + sw.source));
  assert.match(renderTrip(trip, { cur: 'HOME' }), /aria-label="Show amounts in ¥"><span>¥<\/span><span class="on">S\$<\/span>/);
  assert.ok(!renderDays(trip, '2026-12-01').includes('cur-toggle'), 'no money on Days, no switch');
});
test('Trip shows the last 5 expenses, newest first, each with its date; no spends by day', () => {
  const sp = (id, yen, at) => ({ id, yen, label: id, category: 'food', at });
  const st = normalise({ fx: { jpyPerHome: 100 }, days: [
    { id: 'a', date: '2026-11-12', city: 'Osaka', spends: [sp('s1', 100, '2026-11-12T10:00:00+09:00'), sp('s2', 200, '2026-11-12T21:30:00+09:00')] },
    { id: 'b', date: '2026-11-13', city: 'Naha', spends: [sp('s3', 300, '2026-11-13T08:00:00+09:00'), sp('s4', 400, '2026-11-13T09:00:00+09:00'),
      sp('s5', 500, '2026-11-13T10:00:00+09:00'), sp('s6', 600, '2026-11-13T11:00:00+09:00')] },
    { id: 'c', date: '2026-11-14', city: 'Kyoto' }] });
  const html = renderTrip(st);
  assert.ok(!/by-day|day-spend|Spends by day|class="sort"/.test(html));
  assert.deepEqual([...html.matchAll(/<li data-spend="(\w+)" data-day="(\w+)">/g)].map((m) => m[1] + m[2]), ['s6b', 's5b', 's4b', 's3b', 's2a'], 'newest five');
  assert.match(html, /data-spend="s2" data-day="a">[\s\S]*?<button class="sp-main" data-action="edit-spend" title="Edit spend"><span class="label">s2<\/span><span class="sub">food · Thu 12 Nov · 9:30 pm<\/span><\/button>/);
  assert.match(html, /<p class="sum">¥2,100<\/p>/, 'the total still counts every spend');
  assert.match(renderTrip(st, { confirmId: 's5' }), /<li class="confirm" data-spend="s5" data-day="b">/);
  assert.match(renderTrip(normalise({ days: [{ id: 'x', date: '2026-11-12' }] })), /<h3>Last 5 expenses<\/h3>\s*<p class="muted empty">No spends yet\.<\/p>/);
});
test('a spend opens for editing with its amount, category, date, time and label filled in', () => {
  const spend = { id: 's1', yen: 1200, label: 'lunch <set>', category: 'transport', at: '2026-12-01T12:40:00+09:00' };
  const html = renderSpendSheet('d1', trip.fx, 'JPY', 'en', spend);
  assert.match(html, /<form class="spend-sheet" data-day="d1" data-spend="s1">/);
  assert.match(html, /Edit spend[\s\S]*name="yen"[^>]*value="¥1,200"[\s\S]*type="submit">Save ¥1,200</);
  assert.match(html, /value="transport" checked/);
  assert.ok(!/value="food" checked/.test(html));
  assert.match(html, /<input name="date" type="date" value="2026-12-01" required>[\s\S]*<input name="time" type="time" value="12:40">/);
  assert.match(html, /name="label"[^>]*value="lunch &lt;set&gt;"/);
  assert.match(renderSpendSheet('d1', trip.fx, 'HOME', 'en', spend), /≈ S\$10\.43/);
  assert.match(renderSpendSheet('d1', trip.fx, 'JPY', 'en', { id: 'o', yen: 5, at: '' }, '2026-12-01'), /name="date" type="date" value="2026-12-01"/, 'no timestamp: the day it sits on');
  assert.ok(!/name="date"|name="time"/.test(renderSpendSheet('d1', trip.fx)), 'a new spend is logged for now');
  assert.match(renderDayScreen(trip, trip.days[0], '2026-12-01', {}), /<li data-spend="s1">[\s\S]*?data-action="edit-spend"[\s\S]*?<span class="sub">food · 12:40 pm<\/span>/);
});

test('links are per day: stops show and edit none; old stop links appear under Bookings & files', () => {
  const day = normalise({ days: [{ id: 'L', date: '2026-11-13', items: [
    { id: 'f', time: '07:40', text: 'Flight', links: [{ label: 'Boarding <pass>', url: 'https://drive.google.com/a?x=1&y=2' }] },
    { id: 'g', text: 'Lunch' }] }] }).days[0];
  const st = { ...trip, days: [day] };
  const html = renderDayScreen(st, day, '2026-11-13', {});
  assert.match(html, /<section class="day-links">[\s\S]*?<a class="link-btn" href="https:\/\/drive\.google\.com\/a\?x=1&amp;y=2" target="_blank" rel="noopener">📁 Boarding &lt;pass&gt;<\/a>/);
  assert.equal((html.match(/class="link-btn"/g) || []).length, 1, 'not on the stop or Next up');
  const edit = renderDayScreen(st, day, '2026-11-13', { editing: true, linkFormFor: 'day:L' });
  assert.equal((edit.match(/data-action="del-link"/g) || []).length, 1);
  assert.equal((edit.match(/<form class="add-link">/g) || []).length, 1);
  const plan = edit.slice(edit.indexOf('<ol class="timeline'), edit.indexOf('</ol>'));
  assert.ok(!/link-edit|add-link|show-link-form|del-link/.test(plan), 'no link controls inside the plan');
  assert.match(edit, /<form class="add-link"><input name="url" inputmode="url" [^>]*placeholder="Paste a link \(Google Drive, Trip\.com…\)" required><input name="label" placeholder="Name, e.g\. Boarding pass"><button class="btn small" type="submit">Add<\/button><\/form>/);
});
test('Trip has no info sections, even for old data that still has them', () => {
  const old = { ...trip, info: [{ title: 'Flights', lines: ['x'] }] };
  assert.ok(!renderTrip(old).includes('info-sec'));
});
test('Spent card has a sort switch once there are 2+ spends', () => {
  const two = { ...trip.days[0], spends: [...trip.days[0].spends, { id: 's9', yen: 300, label: 'bus', category: 'transport', at: '2026-12-01T13:00:00+09:00' }] };
  const html = renderDayScreen(trip, two, '2026-12-01', { sort: 'amount' });
  assert.match(html, /<div class="sort" role="group" aria-label="Sort spends"><button data-action="sort-spends" data-sort="old">Oldest<\/button><button data-action="sort-spends" data-sort="new">Newest<\/button><button class="on" data-action="sort-spends" data-sort="amount">Amount<\/button><\/div>/);
  assert.ok(!renderDayScreen(trip, trip.days[0], '2026-12-01', {}).includes('class="sort"'), 'hidden with one spend');
});

test('day Bookings & files: shown when there are links; edit mode adds/removes', () => {
  const day = normalise({ days: [{ id: 'B', date: '2026-11-13', items: [{ id: 'x', text: 'Walk' }],
    links: [{ url: 'https://us.trip.com/w/abc' }, { label: 'Hotel <PDF>', url: 'https://drive.google.com/file/d/1/view' }] }] }).days[0];
  const st = { ...trip, days: [day] };
  const html = renderDayScreen(st, day, '2026-11-13', {});
  assert.match(html, /<section class="day-links"><h3>Bookings &amp; files<\/h3><div class="links"><a class="link-btn" href="https:\/\/us\.trip\.com\/w\/abc"[^>]*>🧳 Trip\.com<\/a><a class="link-btn"[^>]*>📁 Hotel &lt;PDF&gt;<\/a>/);
  assert.ok(html.indexOf('class="timeline') < html.indexOf('day-links'), 'after the plan');
  assert.ok(!renderDayScreen(trip, trip.days[0], '2026-12-01', {}).includes('day-links'), 'hidden when empty');
  const edit = renderDayScreen(trip, trip.days[0], '2026-12-01', { editing: true });
  assert.match(edit, /<section class="day-links"><h3>Bookings &amp; files<\/h3><div class="link-edit"><button class="btn small" data-action="show-link-form">＋ Link<\/button>/);
  const form = renderDayScreen(st, day, '2026-11-13', { editing: true, linkFormFor: 'day:B' });
  assert.match(form, /class="day-links">[\s\S]*?🧳 Trip\.com <button class="icon" data-action="del-link" data-link="0"[\s\S]*?<form class="add-link">/);
  assert.equal((form.match(/<form class="add-link">/g) || []).length, 1, 'only the day form opens');
});
test('Chinese: header, tabs, day screen, spend sheet', () => {
  const zh = { lang: 'zh' };
  const home = renderHeader({ view: 'home' }, trip, true, '2026-12-01', zh);
  assert.match(home, /<b>12月1日 周二 · Naha<\/b>[\s\S]*第 1 天 \/ 共 6 天/);
  assert.match(home, /<button class="lang-toggle" data-action="toggle-lang" lang="en" aria-label="English">EN<\/button>/);
  assert.match(home, /同步 •/);
  assert.match(renderHeader({ view: 'home' }, trip, false, '2026-12-01'), /<button class="lang-toggle" data-action="toggle-lang" lang="zh-Hans" aria-label="中文">中<\/button>/);
  assert.match(renderHeader({ view: 'days' }, trip, false, '', zh), /<h1>日程<\/h1><span class="muted">2026年12月1日–6日<\/span>/);
  assert.match(renderTabs({ view: 'home' }, 'zh'), /今天<\/a>.*日程<\/a>.*旅程<\/a>/);
  const day = renderDayScreen(trip, trip.days[0], '2026-12-01', zh);
  assert.match(day, /下一项[\s\S]*下午3:00[\s\S]*今日安排[\s\S]*✎ 编辑[\s\S]*今日支出[\s\S]*＋ ¥ 记账/);
  assert.ok(!/Next up|Today's plan|Spent today|Nothing spent/.test(day), 'no English left');
  assert.match(day, /<span class="sub">餐饮 · 下午12:40<\/span>/);
  const sheet = renderSpendSheet('d1', trip.fx, 'JPY', 'zh');
  assert.match(sheet, /记一笔支出[\s\S]*保存[\s\S]*🍜 餐饮[\s\S]*• 其他[\s\S]*用途（可选）/);
});
test('Chinese: today countdown, days list, trip summary', () => {
  assert.match(renderToday(trip, '2026-11-07', { lang: 'zh' }), /还有 24 天[\s\S]*2026年12月1日–6日 · 6 天[\s\S]*查看日程/);
  assert.match(renderDays(trip, '2026-12-01', 'zh'), /<b>1日 周二 · Naha<\/b>/);
  assert.match(renderTrip(trip, { lang: 'zh' }), /目前总支出[\s\S]*按类别[\s\S]*🍜 餐饮[\s\S]*最近 5 笔支出[\s\S]*餐饮 · 12月1日 周二 · 下午12:40[\s\S]*已完成安排：1 \/ 2/);
});

// Trip text carries its own Chinese (`zh` beside the fields); untranslated text shows as typed.
const bi = normalise({ title: 'Japan 2026', zh: { title: '日本 2026' }, days: [
  { id: 'a', date: '2026-11-13', city: 'Okinawa', summary: 'Markets', notes: 'Bring cash',
    zh: { city: '冲绳', summary: '逛市场', notes: '带现金' },
    stay: { name: 'Mercure Naha', address: 'Naha, Okinawa', zh: { name: '那霸美居酒店', address: '冲绳县那霸市' } },
    items: [
      { id: 'x', time: '07:40', text: 'Flight to Naha', fixed: true, note: '15 min drive', zh: { text: '航班飞那霸', note: '车程 15 分钟' },
        place: { name: 'Naha Airport', address: 'Naha, Okinawa', zh: { name: '那霸机场', address: '冲绳县那霸市' } } },
      { id: 'y', time: '', text: 'Ramen <shop>' }] },
  { id: 'b', date: '2026-11-20', city: 'Kyoto', zh: { city: '京都' }, items: [{ id: 'z', text: 'Kinkaku-ji', zh: { text: '金阁寺' } }] }] });

test('Chinese shows the trip text in Chinese; English shows it as typed', () => {
  const zh = renderDayScreen(bi, bi.days[0], '2026-11-13', { page: true, lang: 'zh', now: '07:00' });
  assert.match(zh, /<span class="city">冲绳<\/span>/);
  assert.match(zh, /<p class="day-summary">逛市场<\/p>/);
  assert.match(zh, /class="fixed-strip">[^<]*<b>航班飞那霸 · 上午7:40<\/b>/);
  assert.match(zh, /class="what"><span class="time">上午7:40<\/span> 航班飞那霸<\/p>/);
  assert.match(zh, /<p class="place">那霸机场 · 冲绳县那霸市<\/p>/);
  assert.match(zh, /<span class="text">航班飞那霸<\/span>[\s\S]*<span class="note">车程 15 分钟<\/span>/);
  assert.match(zh, /<span class="text">Ramen &lt;shop&gt;<\/span>/, 'no translation: as typed');
  assert.match(zh, /<p class="notes">带现金<\/p>/);
  assert.match(zh, /query=Naha%20Airport%2C%20Naha%2C%20Okinawa/, 'Maps searches the name as typed');
  assert.ok(!/Flight to Naha|Markets|Bring cash|15 min drive/.test(zh));

  const en = renderDayScreen(bi, bi.days[0], '2026-11-13', { page: true });
  assert.match(en, /<span class="text">Flight to Naha<\/span>[\s\S]*<span class="note">15 min drive<\/span>/);
  assert.ok(!/航班|冲绳|逛市场/.test(en));

  const allDone = normalise({ days: [{ ...bi.days[0], items: [] }] });
  assert.match(renderDayScreen(allDone, allDone.days[0], '2026-11-13', { lang: 'zh' }), /<p class="place">那霸美居酒店 · 冲绳县那霸市<\/p>/);
});
test('Chinese: title, header city, days list, route and edit fields use the trip text in Chinese', () => {
  assert.match(renderHeader({ view: 'home' }, bi, false, '2026-11-01', { lang: 'zh' }), /<h1>日本 2026<\/h1>/);
  assert.match(renderHeader({ view: 'home' }, bi, false, '2026-11-13', { lang: 'zh' }), /<b>11月13日 周五 · 冲绳<\/b>/);
  const days = renderDays(bi, '2026-11-13', 'zh');
  assert.match(days, /· 冲绳<\/b><span class="sum">逛市场<\/span>/);
  assert.match(days, /· 京都<\/b><span class="sum">金阁寺<\/span>/);
  assert.match(renderToday(bi, '2026-11-01', { lang: 'zh' }), /<p class="route">冲绳 → 京都<\/p>/);
  assert.match(renderToday(bi, '2026-11-01'), /<p class="route">Okinawa → Kyoto<\/p>/);
  const edit = renderDayScreen(bi, bi.days[0], '2026-11-13', { editing: true, lang: 'zh' });
  assert.match(edit, /class="city" value="冲绳"[\s\S]*data-field="summary">逛市场<\/textarea>[\s\S]*data-item-field="text" aria-label="行程">航班飞那霸<\/textarea>[\s\S]*⏱ 必须准时[\s\S]*<p class="about">那霸机场 · 冲绳县那霸市 · 车程 15 分钟<\/p>/);
});
