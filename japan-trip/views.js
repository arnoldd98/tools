// Pure renderers: (state, …) → HTML string. No DOM access; unit-tested with `npm test`.
import {
  sortDays, nextUp, mapsUrl, dayTotal, tripTotal, byCategory, tripPhase,
  fmtYen, fmtHome, fmtBoth, toHome, CATEGORIES,
} from './lib.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const parseDate = (date) => {
  const d = date ? new Date(date + 'T00:00:00') : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};
// "Tue 1 Dec", or '' when the date is empty/invalid.
const longDate = (date) => {
  const d = parseDate(date);
  return d ? `${WD[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}` : '';
};

const syncBtn = (dirty) =>
  `<button class="btn${dirty ? ' dirty' : ''}" data-action="sync">Sync${dirty ? ' •' : ''}</button>`;

export function renderStrip(days, { today, selectedId, compact } = {}) {
  const cards = sortDays(days).map((d) => {
    const dt = parseDate(d.date);
    const done = d.items.filter((i) => i.done).length;
    const cls = `card${d.date && d.date === today ? ' today' : ''}${d.id === selectedId ? ' selected' : ''}`;
    return `<a class="${cls}" href="#/day/${esc(d.id)}" data-strip="${esc(d.id)}">`
      + `<span class="wd">${dt ? WD[dt.getDay()] : '—'}</span><span class="dom">${dt ? dt.getDate() : '?'}</span>`
      + `<span class="city">${esc(d.city)}</span>`
      + `<span class="prog">${d.items.length ? `${done}/${d.items.length}` : ''}</span></a>`;
  }).join('');
  return `<nav class="strip${compact ? ' compact' : ''}">${cards}</nav>`;
}

export function renderTopRow(route, state, dirty) {
  if (route.view === 'day') {
    const days = sortDays(state.days);
    const idx = days.findIndex((d) => d.id === route.id);
    const day = days[idx];
    const nav = (d, label) => (d
      ? `<a class="nav" href="#/day/${esc(d.id)}">${label}</a>`
      : `<span class="nav disabled">${label}</span>`);
    return `<a class="back" href="#/" title="All days">‹</a>`
      + `<span class="when">${esc(longDate(day?.date) || 'Undated')}</span>`
      + `<span class="navs">${nav(days[idx - 1], '←')}${nav(days[idx + 1], '→')}</span>`
      + syncBtn(dirty);
  }
  if (route.view === 'money') {
    return `<a class="back" href="#/" title="All days">‹</a><h1>Spending</h1>${syncBtn(dirty)}`;
  }
  return `<h1>${esc(state.title)}</h1>${syncBtn(dirty)}`;
}
