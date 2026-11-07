// Pure helpers for the Japan trip tracker. No DOM access; unit-tested with `npm test`.

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

function normPlace(p) {
  const o = obj(p);
  return o ? { ...o, name: str(o.name), address: str(o.address) } : undefined; // maps stays optional
}

function normItem(i) {
  const o = obj(i) || {};
  const out = { ...o, id: idOf(o.id), time: str(o.time), text: str(o.text), done: Boolean(o.done) };
  if (o.fixed !== undefined) out.fixed = Boolean(o.fixed); // must-make time (flight, ferry…)
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

function normKeyInfo(k) {
  const o = obj(k);
  if (!o || !str(o.label)) return null;
  const out = { ...o, icon: str(o.icon), label: str(o.label), lines: arr(o.lines).map(str) };
  const place = o.place !== undefined ? normPlace(o.place) : undefined;
  if (place) out.place = place; else delete out.place;
  return out;
}

function normDay(d) {
  const o = obj(d) || {};
  const out = {
    ...o,
    id: idOf(o.id),
    date: str(o.date),
    city: str(o.city),
    items: arr(o.items).map(normItem),
    spends: arr(o.spends).map(normSpend),
    keyInfo: arr(o.keyInfo).map(normKeyInfo).filter(Boolean),
    notes: str(o.notes),
  };
  if (o.stay !== undefined) {
    const stay = normPlace(o.stay);
    if (stay) out.stay = stay;
    else delete out.stay;
  }
  return out;
}

// Fill defaults so old trip.json files render. Returns a new object; input untouched.
export function normalise(data) {
  const o = obj(data) || {};
  return {
    ...o,
    title: str(o.title) || 'Japan Trip',
    fx: { ...DEFAULT_FX, ...(obj(o.fx) || {}) },
    info: arr(o.info).map((s) => {
      const sec = obj(s) || {};
      return { ...sec, title: str(sec.title), lines: arr(sec.lines).map(str) };
    }),
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

// '05:10' → '5:10 am'; anything that isn't HH:MM is shown as-is.
export function fmtTime(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(str(t));
  if (!m) return str(t);
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'am' : 'pm'}`;
}

const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const minutesUntil = (time, now) => toMin(time) - toMin(now);
export function fmtUntil(min) {
  if (min <= 0) return 'now';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `in ${m} min`;
  return m ? `in ${h} h ${m} min` : `in ${h} h`;
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

export function tripOverview(days) {
  const span = tripSpan(days);
  if (!span) return null;
  const cities = [];
  for (const d of sortDays(days.filter((x) => x.date))) {
    if (d.city && !cities.includes(d.city)) cities.push(d.city);
  }
  return { ...span, cities };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtRange(start, end) {
  const [y1, m1, d1] = start.split('-').map(Number);
  const [y2, m2, d2] = end.split('-').map(Number);
  if (start === end) return `${d1} ${MONTHS[m1 - 1]} ${y1}`;
  if (y1 === y2 && m1 === m2) return `${d1}–${d2} ${MONTHS[m1 - 1]} ${y1}`;
  if (y1 === y2) return `${d1} ${MONTHS[m1 - 1]} – ${d2} ${MONTHS[m2 - 1]} ${y1}`;
  return `${d1} ${MONTHS[m1 - 1]} ${y1} – ${d2} ${MONTHS[m2 - 1]} ${y2}`;
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
