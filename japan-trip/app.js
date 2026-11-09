// Japan trip tracker — static page, data in data/trip.json.
// Edits save instantly to localStorage; "Sync" commits the JSON back to GitHub.
// Hash routes: #/ Today, #/days, #/day/<id>, #/trip. Bottom tabs switch between them.

import {
  normalise, parseRoute, parseYen, validRate, insertItem, ensureDay, parseFxRate, fxUrls, rateIsStale, newerFx,
  extractUrl, linkKind, fmtMoney,
  toHome, fmtHome, navDirection, swipeDir, sortDays,
} from './lib.js?v=17';
import { renderHeader, renderTabs, renderView, renderSpendSheet } from './views.js?v=17';
import { strings, normLang } from './i18n.js?v=17';

const LOAD_TIMEOUT_MS = 8000;

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
const nowHHMM = () => new Date().toTimeString().slice(0, 5); // local 'HH:MM'
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

async function apiGet(signal) {
  const res = await fetch(apiUrl(), { headers: apiHeaders(), cache: 'no-store', signal });
  if (!res.ok) throw new Error(`GitHub GET ${res.status}`);
  const json = await res.json();
  return { data: JSON.parse(b64decode(json.content)), sha: json.sha };
}

// Prefer the API when a token is set (fresh; Pages can lag a minute behind commits).
async function fetchRemote(signal) {
  if (cfg.token) return (await apiGet(signal)).data;
  const res = await fetch('data/trip.json', { cache: 'no-store', signal });
  if (!res.ok) throw new Error(`Load trip.json ${res.status}`);
  return res.json();
}

async function sync() {
  if (!cfg.token) {
    location.hash = '#/trip';
    $('#tools').open = true;
    $('.settings').open = true;
    setStatus(T().st.needToken);
    return;
  }
  setStatus(T().st.syncing);
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
    edits++;
    saveDraft();
    render();
    setStatus('');
    toast(T().st.synced(new Date().toLocaleTimeString(T().htmlLang)));
  } catch (e) {
    setStatus(T().st.syncFailed(e.message));
  }
}

// ---------- state ----------
// Bumped by every local change and every successful Sync. A background load that
// started before a change must not overwrite it (see load()).
let edits = 0;
function saveDraft() { writeLS(DRAFT_KEY, { dirty, data: state }); }
function commit() { edits++; dirty = true; saveDraft(); render(); }
function setStatus(msg) { $('#status').textContent = msg; }
const findDay = (id) => state.days.find((d) => d.id === id);

// Fetch remote data, giving up after LOAD_TIMEOUT_MS (weak signal must not hang the app).
async function fetchRemoteWithTimeout() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LOAD_TIMEOUT_MS);
  try {
    return await fetchRemote(ctrl.signal);
  } catch (e) {
    throw ctrl.signal.aborted ? new Error('timed out') : e;
  } finally {
    clearTimeout(timer);
  }
}

function offlineOr(msg) {
  return navigator.onLine === false ? T().st.offline : msg;
}

// Device first: draw the phone's copy immediately, then refresh from remote in the
// background. Unsynced edits on the device always win unless forced (Reload).
async function load({ force = false } = {}) {
  const draft = readLS(DRAFT_KEY);
  const haveCopy = !force && draft?.data;
  const editsAtStart = edits;
  if (haveCopy) {
    state = normalise(draft.data); dirty = !!draft.dirty;
    render();
    if (dirty) setStatus(T().st.unsynced);
  }
  try {
    const remote = normalise(await fetchRemoteWithTimeout());
    // Something changed on this phone (an edit, or a Sync) while we waited: keep it.
    if (!force && edits !== editsAtStart) { refreshRateIfStale(); return; }
    if (force || !dirty) {
      remote.fx = newerFx(remote.fx, state.fx); // keep a fresher rate fetched on this phone
      state = remote; dirty = false; saveDraft();
      render();
      setStatus(offlineOr(state.updated ? T().st.lastSynced(new Date(state.updated).toLocaleString(T().htmlLang)) : ''));
    }
  } catch (e) {
    if (!haveCopy && draft?.data && !force) state = normalise(draft.data);
    if (!haveCopy) render();
    setStatus(offlineOr(T().st.cantReach(e.message)));
  }
  refreshRateIfStale();
}

// ---------- motion ----------
// Screen changes use the View Transitions API (Chrome, iOS 18+); elsewhere, and with
// Reduce Motion on, screens just swap. html[data-nav] picks the slide direction in CSS.
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
function transition(dir, update) {
  if (!document.startViewTransition || reduceMotion() || dir === 'none') { update(); return; }
  document.documentElement.dataset.nav = dir;
  const t = document.startViewTransition(update);
  t.finished.finally(() => { delete document.documentElement.dataset.nav; });
}

// ---------- toasts (with optional Undo) ----------
let toastTimer = null;
let undoFn = null;
function toast(msg, undo = null) {
  const el = $('#toast');
  undoFn = undo;
  el.innerHTML = `<span>${msg.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</span>`
    + (undo ? `<button class="toast-undo" data-action="undo">${T().undo}</button>` : '');
  el.hidden = false;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); // restart the pop-in
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, undo ? 6000 : 3000);
}
function hideToast() { $('#toast').hidden = true; undoFn = null; }
// Undo restores the whole trip as it was just before the action.
const snapshot = () => JSON.stringify(state);
const restoreFrom = (snap) => () => { state = normalise(JSON.parse(snap)); commit(); };

// ---------- render ----------
let lastRouteKey = null;
let lastRoute = null;
let editingId = null; // day whose plan is in edit mode (Edit / Done)
let linkFormFor = null; // stop whose "add link" form is open (edit mode)
// Which currency amounts show in ('JPY' or 'HOME'); a per-phone preference, not trip data.
const CUR_KEY = 'jt.cur';
let cur = readLS(CUR_KEY) === 'HOME' ? 'HOME' : 'JPY';
// How spend lists are ordered: 'old' (order entered), 'new' or 'amount'; per phone.
const SORT_KEY = 'jt.sort';
let sort = ['new', 'amount'].includes(readLS(SORT_KEY)) ? readLS(SORT_KEY) : 'old';
let confirmSpendId = null; // spend whose delete is waiting for "Delete" / "Keep"
// UI language, 'en' or 'zh' (Simplified Chinese); per phone. First visit follows the phone's language.
const LANG_KEY = 'jt.lang';
let lang = normLang(readLS(LANG_KEY) || (/^zh/i.test(navigator.language || '') ? 'zh' : 'en'));
function T() { return strings(lang); }

// Static text in index.html (Settings panel, update note) carries data-i18n="<key>".
function translatePage() {
  document.documentElement.lang = T().htmlLang;
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = T().page[el.dataset.i18n] ?? el.textContent;
}

function render() {
  const route = parseRoute(location.hash);
  // replace, not assign: dead or old entries must not trap the Back button
  if (route.view === 'redirect') { location.replace(route.to); return; }
  if (route.view === 'day' && !findDay(route.id)) { location.replace('#/days'); return; }
  document.title = state.title || 'Japan Trip';
  const today = todayISO();

  const routeKey = route.view + ':' + (route.id || '');
  if (routeKey !== lastRouteKey) { editingId = null; linkFormFor = null; confirmSpendId = null; } // reset per-screen modes
  const stripScroll = document.querySelector('.strip')?.scrollLeft;
  const openDetails = [...document.querySelectorAll('#view details')].map((d) => d.open);

  $('#top').innerHTML = renderHeader(route, state, dirty, today, { cur, lang });
  $('#view').innerHTML = renderView(route, state, today, { editingId, now: nowHHMM(), cur, linkFormFor, sort, confirmId: confirmSpendId, lang });
  $('#tabs').innerHTML = renderTabs(route, lang);
  $('#tools').hidden = route.view !== 'trip';

  const rate = $('#fx [name=rate]');
  if (document.activeElement !== rate) rate.value = state.fx.jpyPerHome;
  $('#fx-updated').textContent = state.fx.updatedAt
    ? T().st.updatedAt(new Date(state.fx.updatedAt).toLocaleString(T().htmlLang)) : '';

  const strip = document.querySelector('.strip');
  if (routeKey !== lastRouteKey) {
    document.querySelector('.strip .card.selected, .strip .card.today')
      ?.scrollIntoView({ inline: 'center', block: 'nearest' });
    if (lastRouteKey !== null) window.scrollTo(0, 0);
  } else {
    if (strip && stripScroll != null) strip.scrollLeft = stripScroll;
    // keep expanded sections (Spent, spends by day, …) open across re-renders on the same screen
    // (by position: several tags share a class name)
    const now = document.querySelectorAll('#view details');
    if (now.length === openDetails.length) now.forEach((d, i) => { d.open = openDetails[i]; });
  }
  lastRouteKey = routeKey;
  lastRoute = route;
}

function markDirty() {
  edits++; dirty = true; saveDraft();
  const btn = document.querySelector('#top [data-action=sync]');
  if (btn) { btn.classList.add('dirty'); btn.textContent = `${T().sync} •`; }
}

function setRate(r) {
  state.fx = { ...state.fx, jpyPerHome: r, updatedAt: new Date().toISOString() };
  commit();
}

async function getLatestRate() {
  for (const url of fxUrls(state.fx.home)) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      const r = res.ok ? parseFxRate(await res.json(), state.fx.home) : null;
      if (r !== null) return Math.round(r * 100) / 100;
    } catch { /* try the fallback */ }
  }
  return null;
}

// Tapped "Fetch latest": counts as an edit (Sync •).
async function fetchFx() {
  setStatus(T().st.fetchingRate);
  const r = await getLatestRate();
  if (r === null) { setStatus(T().st.rateFailed); return; }
  setRate(r);
  toast(T().st.rateUpdated(state.fx.home, r));
}

// Background refresh about once a day when online. Not an edit: no Sync •.
async function refreshRateIfStale() {
  if (navigator.onLine === false || !rateIsStale(state.fx)) return;
  const r = await getLatestRate();
  if (r === null) return;
  state.fx = { ...state.fx, jpyPerHome: r, updatedAt: new Date().toISOString() };
  saveDraft();
  render();
}

// ---------- spend sheet ----------
// Opening pushes a history entry so the phone's Back closes the sheet; closing any
// other way pops that entry again, so no stray entry is ever left behind.
let sheetOpen = false;

function openSheet(dayId) {
  $('#sheet-body').innerHTML = renderSpendSheet(dayId, state.fx, cur, lang);
  $('#sheet').hidden = false;
  sheetOpen = true;
  $('#sheet [name=yen]').focus(); // must stay inside the tap handler for the iPhone keyboard
  history.pushState({ sheet: true }, '');
  window.visualViewport?.addEventListener('resize', liftSheet);
  liftSheet();
}

// iOS overlays the keyboard on the layout viewport; lift the sheet above it.
function liftSheet() {
  const vv = window.visualViewport;
  const form = $('#sheet .spend-sheet');
  if (!vv || !form) return;
  form.style.bottom = `${Math.max(0, window.innerHeight - vv.height - vv.offsetTop)}px`;
}

function closeSheet({ fromPop = false } = {}) {
  if (!sheetOpen) return;
  sheetOpen = false;
  window.visualViewport?.removeEventListener('resize', liftSheet);
  const hide = () => { if (!sheetOpen) { $('#sheet').hidden = true; $('#sheet-body').innerHTML = ''; } };
  const form = $('#sheet .spend-sheet');
  if (form?.animate && !reduceMotion()) { // slide back down, then hide
    $('#sheet').classList.add('closing');
    form.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(100%)' }], { duration: 180, easing: 'ease-in' })
      .finished.then(() => { $('#sheet').classList.remove('closing'); hide(); }, hide);
  } else hide();
  if (!fromPop) history.back();
}

window.addEventListener('popstate', () => { if (sheetOpen) closeSheet({ fromPop: true }); });

function updateSheetPreview(input) {
  const yen = parseYen(input.value);
  const form = input.form;
  const live = form.querySelector('.live'); // only shown when amounts are in the home currency
  if (live) live.textContent = '≈ ' + fmtHome(toHome(yen || 0, state.fx), state.fx.home);
  form.querySelector('.save').textContent = yen ? T().saveYen(`¥${yen.toLocaleString('en-US')}`) : T().save;
}

// ---------- events ----------
window.addEventListener('hashchange', () => {
  const from = lastRoute;
  const to = parseRoute(location.hash);
  transition(navDirection(from, to, state.days), render);
});

// Swipe left/right on a day page for the next/previous day (not on the strip or fields).
let touchStart = null;
document.addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  const skip = e.target.closest?.('.strip, input, textarea, select, .sheet, #tabs');
  touchStart = !skip && parseRoute(location.hash).view === 'day' && t ? { x: t.clientX, y: t.clientY, at: Date.now() } : null;
}, { passive: true });
document.addEventListener('touchend', (e) => {
  if (!touchStart) return;
  const t = e.changedTouches[0];
  const dir = swipeDir(t.clientX - touchStart.x, t.clientY - touchStart.y, Date.now() - touchStart.at);
  touchStart = null;
  if (!dir) return;
  const days = sortDays(state.days);
  const i = days.findIndex((d) => d.id === parseRoute(location.hash).id);
  const next = days[dir === 'left' ? i + 1 : i - 1];
  if (next) location.hash = `#/day/${encodeURIComponent(next.id)}`;
});

// Keep the "Next fixed … in 40 min" countdown current, without disturbing typing.
setInterval(() => {
  const typing = document.activeElement?.closest?.('#view, #sheet, #tools') && document.activeElement.matches('input, textarea, select');
  if (!sheetOpen && !typing && document.visibilityState === 'visible') render();
}, 60000);

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  const action = el?.dataset.action;
  if (!action) return;
  const day = findDay(e.target.closest('[data-day]')?.dataset.day);
  const itemId = e.target.closest('[data-item]')?.dataset.item;

  if (action === 'sync') {
    sync();
  } else if (action === 'toggle-fixed') {
    const item = day?.items.find((i) => i.id === itemId);
    if (!item) return;
    if (item.fixed) delete item.fixed; else item.fixed = true;
    commit();
  } else if (action === 'toggle-cur') {
    cur = cur === 'HOME' ? 'JPY' : 'HOME';
    writeLS(CUR_KEY, cur);
    render();
  } else if (action === 'toggle-lang') {
    lang = lang === 'zh' ? 'en' : 'zh';
    writeLS(LANG_KEY, lang);
    translatePage();
    // the old message is in the other language; keep the one that matters (unsynced edits)
    setStatus(dirty ? T().st.unsynced : '');
    render();
  } else if (action === 'show-link-form') {
    // a stop's links, or (no data-item) the day's Bookings & files
    linkFormFor = itemId || (day && `day:${day.id}`);
    render();
    const scope = itemId ? `[data-item="${CSS.escape(itemId)}"]` : '.day-links';
    document.querySelector(`${scope} .add-link [name=url]`)?.focus();
  } else if (action === 'del-link') {
    const target = itemId ? day?.items.find((i) => i.id === itemId) : day;
    if (!target?.links) return;
    target.links.splice(Number(el.dataset.link), 1);
    if (!target.links.length) delete target.links;
    commit();
  } else if (action === 'toggle-edit') {
    linkFormFor = null;
    editingId = editingId === day?.id ? null : day?.id ?? null;
    render();
  } else if (action === 'open-spend') {
    openSheet(el.dataset.day || null);
  } else if (action === 'close-spend') {
    closeSheet();
  } else if (action === 'undo') {
    const fn = undoFn;
    hideToast();
    fn?.();
  } else if (action === 'toggle') {
    const item = day?.items.find((i) => i.id === itemId);
    if (!item) return;
    item.done = !item.done;
    commit();
  } else if (action === 'del-item') {
    const gone = day?.items.find((i) => i.id === itemId);
    if (!gone) return;
    const snap = snapshot();
    day.items = day.items.filter((i) => i.id !== itemId); commit();
    toast(T().st.stopDeleted(gone.text), restoreFrom(snap));
  } else if (action === 'del-spend') {
    confirmSpendId = e.target.closest('[data-spend]')?.dataset.spend ?? null;
    render();
  } else if (action === 'cancel-del-spend') {
    confirmSpendId = null;
    render();
  } else if (action === 'confirm-del-spend') {
    const spendId = e.target.closest('[data-spend]')?.dataset.spend;
    const gone = day?.spends.find((s) => s.id === spendId);
    confirmSpendId = null;
    if (!gone) { render(); return; }
    const snap = snapshot();
    const finish = () => {
      day.spends = day.spends.filter((s) => s.id !== spendId);
      commit();
      toast(T().st.deleted(fmtMoney(gone.yen, state.fx, cur), gone.label || T().cat[gone.category] || gone.category), restoreFrom(snap));
    };
    const row = el.closest('li');
    if (row && row.animate && !reduceMotion()) { // fold the row away, then remove it
      row.animate([{ opacity: 1, height: `${row.offsetHeight}px` }, { opacity: 0, height: '0px', paddingBlock: '0px' }],
        { duration: 220, easing: 'ease-in' }).finished.then(finish, finish);
    } else finish();
  } else if (action === 'sort-spends') {
    sort = el.dataset.sort;
    writeLS(SORT_KEY, sort);
    render();
  } else if (action === 'del-day') {
    if (el.dataset.confirm) {
      state.days = state.days.filter((d) => d !== day);
      location.replace('#/days'); // the deleted day's page leaves history
      commit();
    } else {
      el.dataset.confirm = '1'; el.textContent = T().tapAgain;
      setTimeout(() => render(), 3000);
    }
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

document.addEventListener('input', (e) => {
  if (e.target.matches('.spend-sheet [name=yen]')) updateSheetPreview(e.target);
});

// Field edits (date/city/notes, stop time/text) — save on change, no re-render while typing.
document.addEventListener('change', (e) => {
  const itemField = e.target.dataset.itemField;
  if (itemField) {
    const day = findDay(e.target.closest('[data-day]')?.dataset.day);
    const item = day?.items.find((i) => i.id === e.target.closest('[data-item]')?.dataset.item);
    if (!item) return;
    const value = itemField === 'text' ? e.target.value.trim() : e.target.value;
    if (itemField === 'text' && !value) { e.target.value = item.text; return; } // keep a stop's name
    item[itemField] = value;
    markDirty();
    return;
  }
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
    toast(T().st.settingsSaved);
  } else if (form.id === 'fx') {
    const r = validRate(fd.get('rate'));
    if (r === null) { setStatus(T().st.rateInvalid); return; }
    form.querySelector('[name=rate]').blur();
    setRate(r);
    toast(T().st.rateSaved(state.fx.home, r));
  } else if (form.classList.contains('spend-sheet')) {
    const yen = parseYen(fd.get('yen'));
    if (yen === null) {
      toast(T().st.yenInvalid);
      form.querySelector('[name=yen]').focus();
      return;
    }
    const day = form.dataset.day ? findDay(form.dataset.day) : ensureDay(state, todayISO(), uid);
    if (!day) return;
    const snap = snapshot();
    const id = uid();
    day.spends.push({
      id, yen, label: String(fd.get('label') || '').trim(),
      category: fd.get('category') || 'food', at: localISO(),
    });
    closeSheet();
    commit();
    document.querySelector(`[data-spend="${CSS.escape(id)}"]`)?.classList.add('enter');
    toast(T().st.logged(`¥${yen.toLocaleString('en-US')}`), restoreFrom(snap));
  } else if (form.classList.contains('add-link')) {
    // accepts a bare link, one without https://, or an app's share text containing one
    const url = extractUrl(fd.get('url'));
    if (!url) { setStatus(T().st.badLink); return; }
    const day = findDay(form.closest('[data-day]')?.dataset.day);
    const itemId = form.closest('[data-item]')?.dataset.item;
    const target = itemId ? day?.items.find((i) => i.id === itemId) : day;
    if (!target) return;
    const label = String(fd.get('label') || '').trim() || linkKind(url).name; // e.g. 'Trip.com', 'Google Drive'
    target.links = [...(target.links || []), { label, url }];
    linkFormFor = null;
    commit();
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
    state = normalise(data); commit(); setStatus(T().st.imported);
  } catch (err) { setStatus(T().st.importFailed(err.message)); }
  e.target.value = '';
});

// ---------- offline app (service worker) ----------
// A new version installs in the background and waits; the note lets the user switch.
function watchForUpdates(reg) {
  const showIfWaiting = () => {
    if (reg.waiting && navigator.serviceWorker.controller) $('#update').hidden = false;
  };
  showIfWaiting();
  reg.addEventListener('updatefound', () => {
    const w = reg.installing;
    w?.addEventListener('statechange', () => { if (w.state === 'installed') showIfWaiting(); });
  });
  // iPhone home-screen apps are resumed, not relaunched: check for a new version on resume.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { reg.update().catch(() => {}); refreshRateIfStale(); }
  });
  // A worker may already be installing when registration resolves.
  reg.installing?.addEventListener('statechange', (e) => { if (e.target.state === 'installed') showIfWaiting(); });
  $('#update').addEventListener('click', () => reg.waiting?.postMessage('skip-waiting'));
  // Reload only when an existing worker is replaced, not on the very first install.
  let reloaded = !hadController;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    location.reload();
  });
}

const hadController = !!navigator.serviceWorker?.controller;
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
    .then(watchForUpdates)
    .catch(() => { /* no offline support (e.g. file://); the app still works online */ });
}

// Fill settings form
for (const [k, v] of Object.entries(cfg)) {
  const input = document.querySelector(`#settings [name=${k}]`);
  if (input) input.value = v;
}

translatePage();
load();
