// Pure helpers for the Japan trip tracker. No DOM access; unit-tested with `npm test`.

export const DEFAULT_FX = { home: 'SGD', jpyPerHome: 115, updatedAt: null };
export const CATEGORIES = ['food', 'transport', 'shopping', 'tickets', 'stay', 'other'];

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
    category: CATEGORIES.includes(o.category) ? o.category : 'other',
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
    items: arr(o.items).map(normItem),
    spends: arr(o.spends).map(normSpend),
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

export const nextUp = (day) => (day?.items || []).find((i) => !i.done) || null;

export const dayTotal = (day) => (day?.spends || []).reduce((sum, s) => sum + (s.yen || 0), 0);
export const tripTotal = (state) => state.days.reduce((sum, d) => sum + dayTotal(d), 0);
export function byCategory(state) {
  const out = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  for (const d of state.days) for (const s of d.spends || []) {
    const c = CATEGORIES.includes(s.category) ? s.category : 'other';
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
  if (parts[0] === 'money') return { view: 'money' };
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

export function ensureDay(state, date, uid) {
  const found = state.days.find((d) => d.date === date);
  if (found) return found;
  const day = { id: uid(), date, city: '', items: [], spends: [], notes: '' };
  state.days.push(day);
  return day;
}

export const FX_URL = 'https://api.frankfurter.app/latest?from=SGD&to=JPY';
export const parseFxRate = (json) => validRate(obj(json) && obj(json.rates) ? json.rates.JPY : NaN);
