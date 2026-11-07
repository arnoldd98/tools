// Pure renderers: (state, …) → HTML string. No DOM access; unit-tested with `npm test`.
import {
  sortDays, nextUp, mapsUrl, dayTotal, tripTotal, byCategory, tripPhase,
  fmtYen, fmtHome, fmtBoth, toHome, CATEGORIES, CATEGORY_LABEL, CATEGORY_ICON,
  dayNumber, tripSpan, fmtRange,
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

const dayHref = (id) => `#/day/${esc(encodeURIComponent(id))}`;

const syncBtn = (dirty) =>
  `<button class="btn${dirty ? ' dirty' : ''}" data-action="sync">Sync${dirty ? ' •' : ''}</button>`;

export function renderStrip(days, { today, selectedId, compact } = {}) {
  const cards = sortDays(days).map((d) => {
    const dt = parseDate(d.date);
    const done = d.items.filter((i) => i.done).length;
    const cls = `card${d.date && d.date === today ? ' today' : ''}${d.id === selectedId ? ' selected' : ''}`;
    return `<a class="${cls}" href="${dayHref(d.id)}" data-strip="${esc(d.id)}">`
      + `<span class="wd">${dt ? WD[dt.getDay()] : '—'}</span><span class="dom">${dt ? dt.getDate() : '?'}</span>`
      + `<span class="city">${esc(d.city)}</span>`
      + `<span class="prog">${d.items.length ? `${done}/${d.items.length}` : ''}</span></a>`;
  }).join('');
  return `<nav class="strip${compact ? ' compact' : ''}">${cards}</nav>`;
}

// Top row of the sticky header, per route. Always ends with the Sync button.
export function renderHeader(route, state, dirty, today) {
  if (route.view === 'day') {
    const days = sortDays(state.days);
    const idx = days.findIndex((d) => d.id === route.id);
    const day = days[idx];
    const nav = (d, label) => (d
      ? `<a class="nav" href="${dayHref(d.id)}">${label}</a>`
      : `<span class="nav disabled">${label}</span>`);
    return '<a class="back" href="#/days">‹</a>'
      + `<span class="when">${esc(longDate(day?.date) || 'Undated')}</span>`
      + `<span class="navs">${nav(days[idx - 1], '←')}${nav(days[idx + 1], '→')}</span>`
      + syncBtn(dirty);
  }
  if (route.view === 'days') {
    const span = tripSpan(state.days);
    return `<h1>Days</h1>${span ? `<span class="muted">${fmtRange(span.start, span.end)}</span>` : ''}${syncBtn(dirty)}`;
  }
  if (route.view === 'trip') return `<h1>Trip</h1>${syncBtn(dirty)}`;
  const num = dayNumber(state.days, today);
  if (num) {
    const day = state.days.find((d) => d.date === today);
    const title = [longDate(today), day?.city].filter(Boolean).map(esc).join(' · ');
    return `<div class="hdr"><b>${title}</b><span class="muted">Day ${num.n} of ${num.of}</span></div>${syncBtn(dirty)}`;
  }
  return `<h1>${esc(state.title)}</h1>${syncBtn(dirty)}`;
}

export function renderTabs(route) {
  const active = route.view === 'day' ? 'days' : route.view;
  const tab = (view, href, label) =>
    `<a class="tab${active === view ? ' on' : ''}" href="${href}">${label}</a>`;
  return `<nav class="tabs">${tab('home', '#/', 'Today')}${tab('days', '#/days', 'Days')}${tab('trip', '#/trip', 'Trip')}</nav>`;
}

const mapsBtn = (place, label = 'Open in Maps', cls = 'btn primary') =>
  `<a class="${cls}" target="_blank" rel="noopener" href="${esc(mapsUrl(place))}">${label}</a>`;

const timeOf = (at) => (/T(\d{2}:\d{2})/.exec(at || '') || [])[1] || '';


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

function renderItem(i, nextId) {
  const detail = [
    i.place ? `${placeLine(i.place)} ${mapsBtn(i.place, 'Map', 'maplink')}` : '',
    i.note ? `<span class="note">${esc(i.note)}</span>` : '',
    i.price ? `<span class="price">${esc(i.price)}</span>` : '',
  ].filter(Boolean);
  return `
    <li class="${i.done ? 'done' : ''}${i.id === nextId ? ' next' : ''}" data-item="${esc(i.id)}">
      <input type="checkbox" ${i.done ? 'checked' : ''} data-action="toggle" aria-label="Done">
      <span class="time">${esc(i.time)}</span>
      <span class="text">${esc(i.text)}</span>
      ${detail.length ? `<div class="detail">${detail.join(' ')}</div>` : ''}
    </li>`;
}

// Hotel tag first (from day.stay), then the day's keyInfo entries. Tap expands.
export function renderKeyInfo(day) {
  const tags = [];
  if (day.stay) {
    const summary = ['🏨 ' + esc(day.stay.name || 'Hotel'), esc(day.stay.note)].filter((x) => x).join(' · ');
    tags.push(`<details class="tag"><summary>${summary}</summary>
      ${day.stay.address ? `<p>${esc(day.stay.address)}</p>` : ''}${mapsBtn(day.stay, 'Open in Maps', 'btn')}</details>`);
  }
  for (const k of day.keyInfo || []) {
    tags.push(`<details class="tag"><summary>${k.icon ? esc(k.icon) + ' ' : ''}${esc(k.label)}</summary>
      ${k.lines.map((l) => `<p>${esc(l)}</p>`).join('')}${k.place ? mapsBtn(k.place, 'Open in Maps', 'btn') : ''}</details>`);
  }
  if (!tags.length) return '';
  return `<section class="keyinfo"><p class="eyebrow">Key info</p>${tags.join('')}</section>`;
}

// Today and the day page share this. `page` adds the compact strip and day-page wording.
export function renderDayScreen(state, day, today, { page = false } = {}) {
  const next = nextUp(day);
  const spentLabel = day.date && day.date === today ? 'Spent today' : 'Spent';
  return `<section class="day-screen" data-day="${esc(day.id)}">
    ${page ? renderStrip(state.days, { today, selectedId: day.id, compact: true }) : ''}
    ${renderNextUp(day)}
    <h3>${page ? 'Plan' : "Today's plan"}</h3>
    ${day.items.length
    ? `<ol class="timeline">${day.items.map((i) => renderItem(i, next?.id)).join('')}</ol>`
    : '<p class="muted">No stops yet.</p>'}
    ${renderKeyInfo(day)}
    <details class="spent"><summary>${spentLabel} <b>${fmtBoth(dayTotal(day), state.fx)}</b></summary>
      ${renderSpendList(day.spends, state.fx)}</details>
    <details class="edit-day"><summary>Edit day</summary>
      <div class="day-head">
        <input class="date" type="date" value="${esc(day.date)}" data-field="date">
        <input class="city" value="${esc(day.city)}" placeholder="City" data-field="city">
      </div>
      <ul class="edit-items">${day.items.map((i) => `
        <li data-item="${esc(i.id)}"><span class="time">${esc(i.time)}</span><span class="text">${esc(i.text)}</span>
          <button class="icon" data-action="del-item" title="Delete stop">✕</button></li>`).join('')}</ul>
      <form class="add-item">
        <input name="time" type="time">
        <input name="text" placeholder="Add a stop…" required>
        <button class="btn" type="submit">Add</button>
      </form>
      <textarea placeholder="Notes for the day…" data-field="notes">${esc(day.notes)}</textarea>
      <button class="btn danger" data-action="del-day">Delete day</button>
    </details>
    <button class="fab" data-action="open-spend" data-day="${esc(day.id)}">＋ ¥ Spend</button>
  </section>`;
}

export function renderSpendSheet(dayId, fx) {
  const chips = CATEGORIES.map((c) => `<label class="chip"><input type="radio" name="category" value="${c}"${c === 'food' ? ' checked' : ''}> ${CATEGORY_ICON[c]} ${c === 'misc' ? 'misc' : CATEGORY_LABEL[c]}</label>`).join('');
  return `<form class="spend-sheet"${dayId ? ` data-day="${esc(dayId)}"` : ''}>
    <button type="button" class="icon close" data-action="close-spend" title="Close">✕</button>
    <p class="eyebrow">Log a spend</p>
    <input name="yen" inputmode="numeric" autocomplete="off" placeholder="¥0" enterkeyhint="done" aria-label="Amount in yen">
    <p class="live muted">≈ ${fmtHome(0, fx.home)}</p>
    <div class="chips">${chips}</div>
    <input name="label" placeholder="What for? (optional)" autocomplete="off">
    <button class="btn primary save" type="submit">Save</button>
  </form>`;
}

function renderNow(state, today) {
  const ph = tripPhase(state.days, today);
  if (ph.phase === 'before') {
    return `<section class="now"><p class="eyebrow">Countdown</p>
      <p class="what">${ph.daysToGo} day${ph.daysToGo === 1 ? '' : 's'} to go · ${esc(ph.first.city)}</p></section>`;
  }
  if (ph.phase === 'during' && ph.day) {
    const day = ph.day;
    const next = nextUp(day);
    const summary = next
      ? `<p class="what">${next.time ? `<span class="time">${esc(next.time)}</span> ` : ''}${esc(next.text)}</p>
         ${next.place ? `<p class="place">${placeLine(next.place)}</p>` : ''}`
      : '<p class="what">All done for today</p>';
    return `<section class="now"><p class="eyebrow">Today · ${esc(day.city)}</p>
      ${summary}
      <div class="actions">${next?.place ? mapsBtn(next.place) : ''}<a class="btn" href="${dayHref(day.id)}">Open today</a></div>
      <p class="eyebrow">Log a spend</p>
      ${renderSpendForm(day.id)}</section>`;
  }
  if (ph.phase === 'during') {
    return `<section class="now"><p class="what">No plans today</p>
      <p class="eyebrow">Log a spend</p>${renderSpendForm(null)}</section>`;
  }
  if (ph.phase === 'after') return '<section class="now"><p class="what">Trip complete</p></section>';
  return '<section class="now"><p class="what">Add a day to get started</p></section>';
}

export function renderHome(state, today) {
  const info = state.info.length
    ? `<section class="info"><h3>Trip info</h3>${state.info.map((s) => `
        <details><summary>${esc(s.title)}</summary>
          <ul>${s.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></details>`).join('')}</section>`
    : '';
  return `${renderStrip(state.days, { today })}
    ${renderNow(state, today)}
    <a class="tile" href="#/money"><p class="eyebrow">Spent so far</p>
      <p class="what">${fmtBoth(tripTotal(state), state.fx)}</p></a>
    ${info}`;
}

export function renderMoney(state) {
  const cats = Object.entries(byCategory(state)).filter(([, v]) => v)
    .map(([c, v]) => `${c} ${fmtYen(v)}`).join(' · ');
  const groups = sortDays(state.days).filter((d) => d.spends.length).map((d) => `
    <section class="money-day" data-day="${esc(d.id)}">
      <h3>${esc([longDate(d.date) || 'Undated', d.city].filter(Boolean).join(' · '))} <span class="total">${fmtYen(dayTotal(d))}</span></h3>
      ${renderSpendList(d.spends, state.fx)}
    </section>`).join('');
  const upd = state.fx.updatedAt ? new Date(state.fx.updatedAt).toLocaleDateString() : 'never';
  return `<section class="money">
    <h2>${fmtBoth(tripTotal(state), state.fx)}</h2>
    ${cats ? `<p class="cats">${cats}</p>` : ''}
    ${groups || '<p class="muted">No spends yet.</p>'}
    <p class="muted">Rate: 1 ${esc(state.fx.home)} = ${esc(state.fx.jpyPerHome)} JPY · updated ${esc(upd)}</p>
  </section>`;
}

export function renderView(route, state, today) {
  if (route.view === 'money') return renderMoney(state);
  if (route.view === 'day') {
    const day = state.days.find((d) => d.id === route.id);
    if (day) return renderDay(state, day, today);
  }
  return renderHome(state, today);
}
