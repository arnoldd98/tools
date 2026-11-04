// Pure helpers for the Japan trip tracker. No DOM access; unit-tested with `npm test`.

export const DEFAULT_FX = { home: 'SGD', jpyPerHome: 115, updatedAt: null };
export const CATEGORIES = ['food', 'transport', 'shopping', 'tickets', 'stay', 'other'];

const str = (v) => (v == null ? '' : String(v));
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
const arr = (v) => (Array.isArray(v) ? v : []);

function normPlace(p) {
  const o = obj(p);
  return o ? { ...o, name: str(o.name), address: str(o.address) } : undefined; // maps stays optional
}

function normItem(i) {
  const o = obj(i) || {};
  const out = { ...o, id: str(o.id), time: str(o.time), text: str(o.text), done: Boolean(o.done) };
  if (o.place !== undefined) out.place = normPlace(o.place);
  if (out.place === undefined) delete out.place;
  return out;
}

function normSpend(s) {
  const o = obj(s) || {};
  return {
    ...o,
    id: str(o.id),
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
    id: str(o.id),
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
