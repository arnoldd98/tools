// Japan trip tracker — static page, data in data/trip.json.
// Edits save instantly to localStorage; "Sync" commits the JSON back to GitHub.
// Hash routes: #/ home (day strip), #/day/<id> day page, #/money spending.

import {
  normalise, parseRoute, parseYen, validRate, insertItem, ensureDay, parseFxRate, FX_URL, sortDays,
} from './lib.js';
import { renderTopRow, renderView } from './views.js';

const CFG_KEY = 'jt.cfg';
const DRAFT_KEY = 'jt.draft';
const DEFAULT_CFG = {
  owner: 'arnoldd98', repo: 'tools', branch: 'main',
  path: 'japan-trip/data/trip.json', token: '',
};

let cfg = { ...DEFAULT_CFG, ...readLS(CFG_KEY) };
let state = normalise(null);
let dirty = false;

const $ = (s) => document.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 9);
const todayISO = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local
// ISO-8601 in device local time with its offset, e.g. 2026-12-01T12:40:00+09:00.
function localISO(d = new Date()) {
  const pad = (n) => String(Math.trunc(Math.abs(n))).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    + `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    + `${off >= 0 ? '+' : '-'}${pad(off / 60)}:${pad(off % 60)}`;
}

function readLS(key) {
  try { return JSON.parse(localStorage.getItem(key)) || null; } catch { return null; }
}
function writeLS(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* storage unavailable */ }
}

// ---------- GitHub API ----------
const apiUrl = () =>
  `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${cfg.path}?ref=${cfg.branch}`;
const apiHeaders = () => ({
  Authorization: `Bearer ${cfg.token}`,
  Accept: 'application/vnd.github+json',
});
const b64encode = (str) => {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin);
};
const b64decode = (b64) =>
  new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, '')), (c) => c.charCodeAt(0)));

async function apiGet() {
  const res = await fetch(apiUrl(), { headers: apiHeaders(), cache: 'no-store' });
  if (!res.ok) throw new Error(`GitHub GET ${res.status}`);
  const json = await res.json();
  return { data: JSON.parse(b64decode(json.content)), sha: json.sha };
}

// Prefer the API when a token is set (fresh; Pages can lag a minute behind commits).
async function fetchRemote() {
  if (cfg.token) return (await apiGet()).data;
  const res = await fetch('data/trip.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Load trip.json ${res.status}`);
  return res.json();
}

async function sync() {
  if (!cfg.token) {
    setStatus('Add a GitHub token in Sync settings (bottom of page) to sync.');
    $('.settings').open = true;
    return;
  }
  setStatus('Syncing…');
  try {
    const { sha } = await apiGet();
    state.updated = new Date().toISOString();
    const res = await fetch(apiUrl().split('?')[0], {
      method: 'PUT',
      headers: apiHeaders(),
      body: JSON.stringify({
        message: `trip: update ${new Date().toLocaleString()}`,
        content: b64encode(JSON.stringify(state, null, 2) + '\n'),
        sha, branch: cfg.branch,
      }),
    });
    if (!res.ok) throw new Error(`GitHub PUT ${res.status}`);
    dirty = false;
    saveDraft();
    render();
    setStatus(`Synced ${new Date().toLocaleTimeString()}`);
  } catch (e) {
    setStatus(`Sync failed: ${e.message}. Changes are still saved on this device.`);
  }
}

// ---------- state ----------
function saveDraft() { writeLS(DRAFT_KEY, { dirty, data: state }); }
function commit() { dirty = true; saveDraft(); render(); }
function setStatus(msg) { $('#status').textContent = msg; }
const findDay = (id) => state.days.find((d) => d.id === id);

async function load({ force = false } = {}) {
  const draft = readLS(DRAFT_KEY);
  if (!force && draft?.dirty) {
    state = normalise(draft.data); dirty = true;
    setStatus('Unsynced changes on this device. Tap Sync to save to GitHub.');
  } else {
    try {
      state = normalise(await fetchRemote()); dirty = false; saveDraft();
      setStatus(state.updated ? `Last synced ${new Date(state.updated).toLocaleString()}` : '');
    } catch (e) {
      if (draft?.data) state = normalise(draft.data);
      setStatus(`Couldn't load from GitHub (${e.message}). Showing this device's copy.`);
    }
  }
  render();
}

// ---------- render ----------
let lastRouteKey = null;

function render() {
  const route = parseRoute(location.hash);
  if (route.view === 'day' && !findDay(route.id)) {
    if (location.hash !== '#/') { location.hash = '#/'; return; } // hashchange re-renders
  }
  document.title = state.title || 'Japan Trip';

  const all = state.days.flatMap((d) => d.items);
  const done = all.filter((i) => i.done).length;
  $('#progress-bar').style.width = all.length ? `${(100 * done) / all.length}%` : '0';

  const routeKey = route.view + ':' + (route.id || '');
  const stripScroll = document.querySelector('.strip')?.scrollLeft;

  $('#top').innerHTML = renderTopRow(route, state, dirty);
  $('#view').innerHTML = renderView(route, state, todayISO());

  const rate = $('#fx [name=rate]');
  if (document.activeElement !== rate) rate.value = state.fx.jpyPerHome;
  $('#fx-updated').textContent = state.fx.updatedAt
    ? `updated ${new Date(state.fx.updatedAt).toLocaleString()}` : '';

  // Scroll the strip to today / the open day only when the route changes, so a
  // re-render after a checkbox tap doesn't jump around.
  const strip = document.querySelector('.strip');
  if (routeKey !== lastRouteKey) {
    document.querySelector('.strip .card.selected, .strip .card.today')
      ?.scrollIntoView({ inline: 'center', block: 'nearest' });
    if (lastRouteKey !== null) window.scrollTo(0, 0);
  } else if (strip && stripScroll != null) {
    strip.scrollLeft = stripScroll;
  }
  lastRouteKey = routeKey;
}

function markDirty() {
  dirty = true; saveDraft();
  const btn = document.querySelector('#top [data-action=sync]');
  if (btn) { btn.classList.add('dirty'); btn.textContent = 'Sync •'; }
}

function setRate(r) {
  state.fx = { ...state.fx, jpyPerHome: r, updatedAt: new Date().toISOString() };
  commit();
}

async function fetchFx() {
  setStatus('Fetching rate…');
  let r = null;
  try {
    const res = await fetch(FX_URL, { cache: 'no-store' });
    if (res.ok) r = parseFxRate(await res.json());
  } catch { /* network error: keep the saved rate */ }
  if (r === null) { setStatus('Rate fetch failed; kept the saved rate.'); return; }
  setRate(r);
  setStatus(`Rate updated: 1 ${state.fx.home} = ${r} JPY`);
}

// ---------- events ----------
window.addEventListener('hashchange', render);

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  const action = el?.dataset.action;
  if (!action) return;
  const day = findDay(e.target.closest('[data-day]')?.dataset.day);
  const itemId = e.target.closest('[data-item]')?.dataset.item;

  if (action === 'sync') {
    sync();
  } else if (action === 'toggle') {
    const item = day?.items.find((i) => i.id === itemId);
    if (!item) return;
    item.done = !item.done; commit();
  } else if (action === 'del-item') {
    day.items = day.items.filter((i) => i.id !== itemId); commit();
  } else if (action === 'del-spend') {
    const spendId = e.target.closest('[data-spend]')?.dataset.spend;
    for (const d of state.days) d.spends = d.spends.filter((s) => s.id !== spendId);
    commit();
  } else if (action === 'del-day') {
    if (el.dataset.confirm) {
      state.days = state.days.filter((d) => d !== day); commit();
      location.hash = '#/';
    } else {
      el.dataset.confirm = '1'; el.textContent = 'Delete?';
      setTimeout(() => render(), 3000);
    }
  } else if (action === 'add-day') {
    const last = sortDays(state.days).filter((d) => d.date).pop();
    const d = { id: uid(), date: last?.date || todayISO(), city: last?.city || '', items: [], spends: [], notes: '' };
    state.days.push(d);
    commit();
    location.hash = `#/day/${d.id}`;
  } else if (action === 'fetch-fx') {
    fetchFx();
  } else if (action === 'export') {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob), download: `trip-${todayISO()}.json`,
    });
    a.click(); URL.revokeObjectURL(a.href);
  } else if (action === 'reload') {
    load({ force: true });
  }
});

// Field edits (date/city/notes) — save on change, no re-render while typing.
document.addEventListener('change', (e) => {
  const field = e.target.dataset.field;
  const day = findDay(e.target.closest('[data-day]')?.dataset.day);
  if (!field || !day) return;
  day[field] = e.target.value;
  if (field === 'date') commit();
  else markDirty();
});

document.addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  if (form.id === 'settings') {
    cfg = Object.fromEntries(fd);
    writeLS(CFG_KEY, cfg);
    setStatus('Settings saved.');
  } else if (form.id === 'fx') {
    const r = validRate(fd.get('rate'));
    if (r === null) { setStatus('Enter a rate above 0.'); return; }
    form.querySelector('[name=rate]').blur();
    setRate(r);
    setStatus(`Rate saved: 1 ${state.fx.home} = ${r} JPY`);
  } else if (form.classList.contains('add-spend')) {
    const yen = parseYen(fd.get('yen'));
    if (yen === null) { setStatus('Enter an amount in yen above 0.'); return; }
    const day = form.dataset.day ? findDay(form.dataset.day) : ensureDay(state, todayISO(), uid);
    if (!day) return;
    const pos = [...document.querySelectorAll('.add-spend')].indexOf(form);
    day.spends.push({
      id: uid(), yen, label: String(fd.get('label') || '').trim(),
      category: fd.get('category') || 'food', at: localISO(),
    });
    commit();
    setStatus(`Logged ¥${yen.toLocaleString('en-US')}.`);
    document.querySelectorAll('.add-spend')[pos]?.querySelector('[name=yen]')?.focus();
  } else if (form.classList.contains('add-item')) {
    const day = findDay(form.closest('[data-day]')?.dataset.day);
    if (!day) return;
    day.items = insertItem(day.items, {
      id: uid(), time: fd.get('time') || '', text: String(fd.get('text')).trim(), done: false,
    });
    commit();
  }
});

$('#import').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.days)) throw new Error('missing "days" array');
    state = normalise(data); commit(); setStatus('Imported. Tap Sync to save to GitHub.');
  } catch (err) { setStatus(`Import failed: ${err.message}`); }
  e.target.value = '';
});

// Fill settings form
for (const [k, v] of Object.entries(cfg)) {
  const input = document.querySelector(`#settings [name=${k}]`);
  if (input) input.value = v;
}

load();
