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

const mapsBtn = (place, label = 'Open in Maps', cls = 'btn primary') =>
  `<a class="${cls}" target="_blank" rel="noopener" href="${esc(mapsUrl(place))}">${label}</a>`;

const timeOf = (at) => (/T(\d{2}:\d{2})/.exec(at || '') || [])[1] || '';

export function renderSpendForm(dayId) {
  const opts = CATEGORIES.map((c) => `<option value="${c}"${c === 'food' ? ' selected' : ''}>${c}</option>`).join('');
  return `<form class="add-spend"${dayId ? ` data-day="${esc(dayId)}"` : ''}>`
    + '<input name="yen" inputmode="numeric" placeholder="¥ amount" required>'
    + '<input name="label" placeholder="What for?">'
    + `<select name="category">${opts}</select>`
    + '<button class="btn" type="submit">Add</button></form>';
}

export function renderSpendList(spends, fx) {
  if (!spends.length) return '<p class="muted">No spends yet.</p>';
  const rows = [...spends].sort((a, b) => (b.at || '').localeCompare(a.at || '')).map((s) => `
    <li data-spend="${esc(s.id)}">
      <span class="label">${esc(s.label) || '<span class="muted">—</span>'}</span>
      <span class="cat">${esc(s.category)}</span>
      <span class="amt">${fmtYen(s.yen)} · ${fmtHome(toHome(s.yen, fx), fx.home)}</span>
      <span class="at muted">${timeOf(s.at)}</span>
      <button class="icon" data-action="del-spend" title="Delete spend">✕</button>
    </li>`).join('');
  return `<ul class="spends">${rows}</ul>`;
}

const placeLine = (p) => [p?.name, p?.address].filter(Boolean).map(esc).join(' · ');

function renderNextUp(day) {
  const next = nextUp(day);
  if (!next) {
    return `<div class="next-up done-all"><p class="eyebrow">Next up</p><p class="what">All done for today</p>
      ${day.stay ? `<p class="place">${placeLine(day.stay)}</p>${mapsBtn(day.stay, 'Maps to hotel')}` : ''}</div>`;
  }
  return `<div class="next-up"><p class="eyebrow">Next up</p>
    <p class="what">${next.time ? `<span class="time">${esc(next.time)}</span> ` : ''}${esc(next.text)}</p>
    ${next.place ? `<p class="place">${placeLine(next.place)}</p>` : ''}
    <div class="actions">${next.place ? mapsBtn(next.place) : ''}<button class="btn" data-action="toggle" data-item="${esc(next.id)}">Done</button></div>
  </div>`;
}

function renderItem(i) {
  const detail = [
    i.place ? `${placeLine(i.place)} ${mapsBtn(i.place, 'Map', 'maplink')}` : '',
    i.note ? `<span class="note">${esc(i.note)}</span>` : '',
    i.price ? `<span class="price">${esc(i.price)}</span>` : '',
  ].filter(Boolean);
  return `
    <li class="${i.done ? 'done' : ''}" data-item="${esc(i.id)}">
      <input type="checkbox" ${i.done ? 'checked' : ''} data-action="toggle" aria-label="Done">
      <span class="time">${esc(i.time)}</span>
      <span class="text">${esc(i.text)}</span>
      <button class="icon" data-action="del-item" title="Delete">✕</button>
      ${detail.length ? `<div class="detail">${detail.join(' ')}</div>` : ''}
    </li>`;
}

export function renderDay(state, day, today) {
  const isToday = day.date && day.date === today;
  return `<section class="day-page" data-day="${esc(day.id)}">
    ${renderStrip(state.days, { today, selectedId: day.id, compact: true })}
    <div class="day-head">
      <input class="date" type="date" value="${esc(day.date)}" data-field="date">
      <input class="city" value="${esc(day.city)}" placeholder="City" data-field="city">
      ${isToday ? '<span class="badge">Today</span>' : ''}
      <button class="icon" data-action="del-day" title="Delete day">✕</button>
    </div>
    ${renderNextUp(day)}
    <h3>Plan</h3>
    ${day.items.length ? `<ol class="timeline">${day.items.map(renderItem).join('')}</ol>` : '<p class="muted">No stops yet.</p>'}
    <form class="add-item">
      <input name="time" type="time">
      <input name="text" placeholder="Add a stop…" required>
      <button class="btn" type="submit">Add</button>
    </form>
    <section class="spend">
      <h3>Spending <span class="total">${fmtBoth(dayTotal(day), state.fx)}</span></h3>
      ${renderSpendForm(day.id)}
      ${renderSpendList(day.spends, state.fx)}
    </section>
    ${day.stay ? `<section class="stay"><p class="eyebrow">Stay</p>
      <p class="what">${esc(day.stay.name)}</p>
      ${day.stay.address ? `<p class="place">${esc(day.stay.address)}</p>` : ''}
      ${day.stay.note ? `<p class="muted">${esc(day.stay.note)}</p>` : ''}
      ${mapsBtn(day.stay, 'Open in Maps', 'btn')}</section>` : ''}
    <h3>Notes</h3>
    <textarea placeholder="Notes for the day…" data-field="notes">${esc(day.notes)}</textarea>
  </section>`;
}
