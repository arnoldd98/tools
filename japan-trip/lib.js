// Pure helpers for the Japan trip tracker. No DOM access; unit-tested with `npm test`.
import { strings } from './i18n.js?v=20';

export const DEFAULT_FX = { home: 'SGD', jpyPerHome: 115, updatedAt: null };
export const CATEGORIES = ['food', 'shopping', 'transport', 'tickets', 'misc'];
export const CATEGORY_LABEL = {
  food: 'food', shopping: 'shopping', transport: 'transport', tickets: 'tickets', misc: 'miscellaneous',
};
export const CATEGORY_ICON = { food: '🍜', shopping: '🛍', transport: '🚃', tickets: '🎫', misc: '•' };

const str = (v) => (v == null ? '' : String(v));
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
const arr = (v) => (Array.isArray(v) ? v : []);
// Hand-written JSON may omit ids; handlers match on them, so they must be unique.
const genId = () => Math.random().toString(36).slice(2, 9);
const idOf = (v) => str(v) || genId();

// Trip text in the reader's language. A day, stop, place or the trip itself may carry
// `zh: { <field>: '中文' }` beside its fields as typed; Chinese falls back to the text as typed.
export const loc = (o, field, lang) => str((lang === 'zh' && obj(obj(o)?.zh)?.[field]) || obj(o)?.[field]);
// Save an edit made while reading in `lang`. Chinese edits change the translation where one
// exists; editing the text as typed drops its translation, which would no longer match.
export function setLoc(o, field, value, lang) {
  const zh = obj(o.zh);
  if (lang === 'zh' && zh?.[field]) {
    if (value) zh[field] = value; else delete zh[field];
  } else {
    o[field] = value;
    if (zh) delete zh[field];
  }
  if (zh && !Object.keys(zh).length) delete o.zh;
}

function normPlace(p) {
  const o = obj(p);
  return o ? { ...o, name: str(o.name), address: str(o.address) } : undefined; // maps stays optional
}

// Only http(s) links are kept, so a pasted 'javascript:' URL can never run.
export function safeUrl(u) {
  const s = str(u).trim();
  return /^https?:\/\/\S+$/i.test(s) ? s : null;
}

// Pull the link out of whatever was pasted: a bare URL, a URL without https://, or an
// app's share text ("Check out this hotel on Trip.com! https://…"). null if none.
export function extractUrl(text) {
  const s = str(text).trim();
  const m = /https?:\/\/[^\s<>"'\u2018-\u201f\u3000-\u303f\uff00-\uffef]+/i.exec(s); // stops at full-width punctuation (，。！)
  if (m) return safeUrl(trimUrlEnd(m[0]));
  // no scheme: only something that ends in a real top-level domain (not 'e.g' or '1.5')
  if (/^(www\.)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(s)) return safeUrl(trimUrlEnd('https://' + s));
  return null;
}
// Sentence punctuation after a link isn't part of it; a closing bracket is kept when the link
// opened it (…/Kinkaku-ji_(temple)).
const CLOSERS = { ')': '(', ']': '[', '}': '{' };
function trimUrlEnd(u) {
  for (;;) {
    const last = u.slice(-1);
    const open = CLOSERS[last];
    const unbalanced = open && u.split(open).length < u.split(last).length;
    if (!(/[.,;:!?'"]/.test(last) || unbalanced)) return u;
    u = u.slice(0, -1);
  }
}

// Known sites get an icon and a default name (used when a link is added without one).
const LINK_SITES = [
  [/(^|\.)drive\.google\.com$/, '📁', 'Google Drive'],
  [/(^|\.)docs\.google\.com$/, '📄', (path) => (path.startsWith('/spreadsheets') ? 'Google Sheets'
    : path.startsWith('/presentation') ? 'Google Slides' : 'Google Docs')],
  [/(^|\.)photos\.(google\.com|app\.goo\.gl)$/, '🖼', 'Google Photos'],
  [/^(maps\.app\.goo\.gl|maps\.google\.[a-z.]+)$/, '📍', 'Google Maps'],
  [/(^|\.)trip\.com$/, '🧳', 'Trip.com'],
  [/(^|\.)klook\.com$/, '🎟', 'Klook'],
  [/(^|\.)kkday\.com$/, '🎟', 'KKday'],
  [/(^|\.)booking\.com$/, '🏨', 'Booking.com'],
  [/(^|\.)agoda\.com$/, '🏨', 'Agoda'],
  [/(^|\.)airbnb\.[a-z.]+$/, '🏠', 'Airbnb'],
];
export function linkKind(url) {
  let u;
  try { u = new URL(url); } catch { return { icon: '🔗', name: 'Link' }; }
  const host = u.hostname.toLowerCase();
  const path = u.pathname;
  if (host === 'www.google.com' && path.startsWith('/maps')) return { icon: '📍', name: 'Google Maps' };
  for (const [re, icon, name] of LINK_SITES) {
    if (re.test(host)) return { icon, name: typeof name === 'function' ? name(path) : name };
  }
  if (/\.pdf$/i.test(path)) return { icon: '📄', name: 'PDF' };
  return { icon: '🔗', name: host.replace(/^www\./, '') };
}

function normLink(l) {
  const o = obj(l);
  const url = o && safeUrl(o.url);
  return url ? { label: str(o.label).trim() || linkKind(url).name, url } : null;
}
const normLinks = (v) => arr(v).map(normLink).filter(Boolean);

function normItem(i) {
  const o = obj(i) || {};
  const out = { ...o, id: idOf(o.id), time: str(o.time), text: str(o.text), done: Boolean(o.done) };
  if (o.fixed !== undefined) out.fixed = Boolean(o.fixed); // must-make time (flight, ferry…)
  if (o.links !== undefined) out.links = normLinks(o.links); // tickets, bookings
  if (o.place !== undefined) out.place = normPlace(o.place);
  if (out.place === undefined) delete out.place;
  return out;
}

function normSpend(s) {
  const o = obj(s) || {};
  return {
    ...o,
    id: idOf(o.id),
    yen: Math.trunc(Number(o.yen)) || 0,
    label: str(o.label),
    category: CATEGORIES.includes(o.category) ? o.category : 'misc', // old 'stay'/'other' → misc
    at: str(o.at),
  };
}

function normDay(d) {
  const o = obj(d) || {};
  const out = {
    ...o,
    id: idOf(o.id),
    date: str(o.date),
    city: str(o.city),
    summary: str(o.summary), // one-line "what's this day about"
    items: arr(o.items).map(normItem),
    spends: arr(o.spends).map(normSpend),
    notes: str(o.notes),
  };
  if (o.links !== undefined) out.links = normLinks(o.links); // bookings & files for the day
  if (o.stay !== undefined) {
    const stay = normPlace(o.stay);
    if (stay) out.stay = stay;
    else delete out.stay;
  }
  return out;
}

// Fill defaults so old trip.json files render. Returns a new object; input untouched.
export function normalise(data) {
  const { info, ...o } = obj(data) || {}; // old files' trip-info sections are dropped
  return {
    ...o,
    title: str(o.title) || 'Japan Trip',
    fx: { ...DEFAULT_FX, ...(obj(o.fx) || {}) },
    days: arr(o.days).map(normDay),
  };
}

export const sortDays = (days) =>
  [...days].sort((a, b) => {
    if (!a.date !== !b.date) return a.date ? -1 : 1;
    return (a.date || '').localeCompare(b.date || '');
  });

export const toHome = (yen, fx) => yen / fx.jpyPerHome;

export const fmtYen = (n) => '¥' + Math.round(n).toLocaleString('en-US');

export function fmtHome(amount, home) {
  const prefix = home === 'SGD' ? 'S$' : `${home} `;
  const num = Math.abs(amount) >= 100
    ? Math.round(amount).toLocaleString('en-US')
    : amount.toFixed(2);
  return prefix + num;
}

// One currency at a time: cur 'JPY' (default) or 'HOME' (e.g. SGD).
export const fmtMoney = (yen, fx, cur = 'JPY') =>
  (cur === 'HOME' ? fmtHome(toHome(yen, fx), fx.home) : fmtYen(yen));
export const homeSymbol = (home) => (home === 'SGD' ? 'S$' : home);

export const fmtBoth = (yen, fx) => `${fmtYen(yen)} ≈ ${fmtHome(toHome(yen, fx), fx.home)}`;

// "1,200", "¥1200", "1200.5" → 1200. Negative, zero, blank → null.
export function parseYen(input) {
  const whole = str(input).split('.')[0];
  if (whole.includes('-')) return null;
  const n = parseInt(whole.replace(/\D/g, ''), 10);
  return n > 0 ? n : null;
}

export function validRate(input) {
  if (typeof input === 'string' && input.trim() === '') return null;
  const n = Number(input);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// '05:10' → '5:10 am' (中文: '上午5:10'); anything that isn't HH:MM is shown as-is.
export function fmtTime(t, lang) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(str(t));
  if (!m) return str(t);
  return strings(lang).time12(Number(m[1]), m[2]);
}

const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const minutesUntil = (time, now) => toMin(time) - toMin(now);
export function fmtUntil(min, lang) {
  const T = strings(lang);
  if (min <= 0) return T.now;
  return T.inMin(Math.floor(min / 60), min % 60);
}

export const nextFixed = (day) => (day?.items || []).find((i) => i.fixed && !i.done) || null;

export const nextUp = (day) => (day?.items || []).find((i) => !i.done) || null;

export const dayTotal = (day) => (day?.spends || []).reduce((sum, s) => sum + (s.yen || 0), 0);
export const tripTotal = (state) => state.days.reduce((sum, d) => sum + dayTotal(d), 0);
export function byCategory(state) {
  const out = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  for (const d of state.days) for (const s of d.spends || []) {
    const c = CATEGORIES.includes(s.category) ? s.category : 'misc';
    out[c] += s.yen || 0;
  }
  return out;
}

export function mapsUrl(place) {
  if (place?.maps) return place.maps;
  const q = [place?.name, place?.address].filter(Boolean).join(', ');
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
}

// Array order is authoritative: a timed stop goes before the first later-timed stop;
// untimed stops (and stops later than everything) are appended.
export function insertItem(items, item) {
  const idx = item.time ? items.findIndex((i) => i.time && i.time > item.time) : -1;
  if (idx === -1) return [...items, item];
  return [...items.slice(0, idx), item, ...items.slice(idx)];
}

export function parseRoute(hash) {
  const parts = str(hash).replace(/^#\/?/, '').split('/');
  if (parts[0] === 'day' && parts[1]) {
    try { return { view: 'day', id: decodeURIComponent(parts[1]) }; } catch { return { view: 'home' }; }
  }
  if (parts[0] === 'days') return { view: 'days' };
  if (parts[0] === 'trip') return { view: 'trip' };
  if (parts[0] === 'money') return { view: 'redirect', to: '#/trip' }; // old link
  return { view: 'home' };
}

const utcDay = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };

export function tripPhase(days, today) {
  const dated = sortDays(days.filter((d) => d.date));
  if (!dated.length) return { phase: 'none' };
  const first = dated[0];
  const last = dated[dated.length - 1];
  if (today < first.date) {
    return { phase: 'before', daysToGo: Math.round((utcDay(first.date) - utcDay(today)) / 86400000), first };
  }
  if (today > last.date) return { phase: 'after' };
  return { phase: 'during', day: dated.find((d) => d.date === today) || null };
}

// Span of the trip in calendar days, over days that have a date.
export function tripSpan(days) {
  const dated = sortDays(days.filter((d) => d.date));
  if (!dated.length) return null;
  const start = dated[0].date;
  const end = dated[dated.length - 1].date;
  return { start, end, length: Math.round((utcDay(end) - utcDay(start)) / 86400000) + 1 };
}

// "Day n of m" in calendar days; null outside the trip.
export function dayNumber(days, date) {
  const span = tripSpan(days);
  if (!span || !date || date < span.start || date > span.end) return null;
  return { n: Math.round((utcDay(date) - utcDay(span.start)) / 86400000) + 1, of: span.length };
}

export function tripOverview(days, lang) {
  const span = tripSpan(days);
  if (!span) return null;
  const cities = [];
  for (const d of sortDays(days.filter((x) => x.date))) {
    const city = loc(d, 'city', lang);
    if (city && !cities.includes(city)) cities.push(city);
  }
  return { ...span, cities };
}

export function fmtRange(start, end, lang) {
  const part = (iso) => { const [y, m, d] = iso.split('-').map(Number); return { iso, y, m, d }; };
  return strings(lang).range(part(start), part(end));
}

export function ensureDay(state, date, uid) {
  const found = state.days.find((d) => d.date === date);
  if (found) return found;
  const day = { id: uid(), date, city: '', items: [], spends: [], notes: '' };
  state.days.push(day);
  return day;
}

// Exchange rate: Fawaz Ahmed's free currency API (github.com/fawazahmed0/exchange-api),
// CDN first, Cloudflare mirror as fallback. Returns JPY per 1 unit of the home currency.
export const fxUrls = (home) => {
  const c = encodeURIComponent(str(home).toLowerCase());
  return [
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${c}.json`,
    `https://latest.currency-api.pages.dev/v1/currencies/${c}.json`,
  ];
};
export const parseFxRate = (json, home) => {
  const table = obj(obj(json)?.[str(home).toLowerCase()]);
  return validRate(table ? table.jpy : NaN);
};
// Of two rates, the one updated more recently (an unset updatedAt counts as oldest).
export const newerFx = (a, b) => ((Date.parse(b?.updatedAt || '') || 0) > (Date.parse(a?.updatedAt || '') || 0) ? b : a);
const DAY_MS = 24 * 60 * 60 * 1000;
export const rateIsStale = (fx, now = new Date()) => {
  const t = Date.parse(fx?.updatedAt || '');
  return Number.isNaN(t) || now - t > DAY_MS;
};

// How a screen change animates, iPhone-style: tabs crossfade ('tab'), opening a day
// slides it in from the right ('push') and leaving slides it back out ('pop'), and
// moving between days pages sideways by date ('next' / 'prev').
export function navDirection(from, to, days) {
  if (!from || !to) return 'none';
  if (from.view === 'day' && to.view === 'day') {
    if (from.id === to.id) return 'none';
    const order = sortDays(days).map((d) => d.id);
    return order.indexOf(to.id) > order.indexOf(from.id) ? 'next' : 'prev';
  }
  if (to.view === 'day') return 'push';
  if (from.view === 'day') return 'pop';
  return from.view === to.view ? 'none' : 'tab';
}

// A deliberate horizontal swipe: long enough, mostly sideways, and quick.
export function swipeDir(dx, dy, ms) {
  if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) / 2 || ms > 800) return null;
  return dx < 0 ? 'left' : 'right';
}
