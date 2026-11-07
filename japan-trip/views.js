// Pure renderers: (state, …) → HTML string. No DOM access; unit-tested with `npm test`.
import {
  sortDays, nextUp, mapsUrl, dayTotal, tripTotal, byCategory, tripPhase,
  fmtYen, fmtHome, fmtBoth, toHome, CATEGORIES, CATEGORY_LABEL, CATEGORY_ICON,
  dayNumber, tripSpan, fmtRange, tripOverview,
} from './lib.js?v=2';

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

function renderItem(i, nextId, editing) {
  const detail = [
    i.place ? `${placeLine(i.place)} ${mapsBtn(i.place, 'Map', 'maplink')}` : '',
    i.note ? `<span class="note">${esc(i.note)}</span>` : '',
    i.price ? `<span class="price">${esc(i.price)}</span>` : '',
  ].filter(Boolean);
  return `
    <li class="${i.done ? 'done' : ''}${i.id === nextId ? ' next' : ''}" data-item="${esc(i.id)}">
      ${editing
    ? `<input type="time" value="${esc(i.time)}" data-item-field="time" aria-label="Time">
      <input value="${esc(i.text)}" data-item-field="text" aria-label="Stop">
      <button class="icon" data-action="del-item" title="Delete stop">✕</button>`
    : `<input type="checkbox" ${i.done ? 'checked' : ''} data-action="toggle" aria-label="Done">
      <span class="time">${esc(i.time)}</span>
      <span class="text">${esc(i.text)}</span>`}
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

// Today and the day page share this. `page` adds the compact strip and day-page wording;
// `editing` turns the plan into in-place fields (Edit / Done button on the plan heading).
export function renderDayScreen(state, day, today, { page = false, editing = false } = {}) {
  const next = nextUp(day);
  const spentLabel = day.date && day.date === today ? 'Spent today' : 'Spent';
  const editBtn = `<button class="btn small" data-action="toggle-edit">${editing ? 'Done' : '✎ Edit'}</button>`;
  const notes = editing
    ? `<h3>Notes</h3><textarea placeholder="Notes for the day…" data-field="notes">${esc(day.notes)}</textarea>`
    : (day.notes ? `<h3>Notes</h3><p class="notes">${esc(day.notes)}</p>` : '');
  return `<section class="day-screen${editing ? ' is-editing' : ''}" data-day="${esc(day.id)}">
    ${page ? renderStrip(state.days, { today, selectedId: day.id, compact: true }) : ''}
    ${renderNextUp(day)}
    <div class="plan-head"><h3>${page ? 'Plan' : "Today's plan"}</h3>${editBtn}</div>
    ${editing ? `<div class="day-fields">
      <input class="date" type="date" value="${esc(day.date)}" data-field="date" aria-label="Date">
      <input class="city" value="${esc(day.city)}" placeholder="City" data-field="city" aria-label="City">
    </div>` : ''}
    ${day.items.length
    ? `<ol class="timeline${editing ? ' editing' : ''}">${day.items.map((i) => renderItem(i, next?.id, editing)).join('')}</ol>`
    : '<p class="muted">No stops yet.</p>'}
    ${editing ? `<form class="add-item">
      <input name="time" type="time" aria-label="Time">
      <input name="text" placeholder="Add a stop…" required>
      <button class="btn" type="submit">Add</button>
    </form>` : ''}
    ${notes}
    ${editing ? '<button class="btn danger" data-action="del-day">Delete day</button>' : ''}
    ${renderKeyInfo(day)}
    <details class="spent"><summary>${spentLabel} <b>${fmtBoth(dayTotal(day), state.fx)}</b></summary>
      ${renderSpendList(day.spends, state.fx)}</details>
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
    <button class="btn primary save" type="submit">Save</button>
    <div class="chips">${chips}</div>
    <input name="label" placeholder="What for? (optional)" autocomplete="off">
  </form>`;
}

const shortDate = (date) => {
  const d = parseDate(date);
  return d ? `${WD[d.getDay()]} ${d.getDate()}` : 'Undated';
};

export function renderToday(state, today, { editingId } = {}) {
  const ph = tripPhase(state.days, today);
  if (ph.phase === 'during' && ph.day) {
    return renderDayScreen(state, ph.day, today, { page: false, editing: ph.day.id === editingId });
  }
  if (ph.phase === 'during') {
    return `<section class="day-screen">
      <p class="what">No plans today</p>
      <details class="spent"><summary>Spent today <b>${fmtBoth(0, state.fx)}</b></summary>
        ${renderSpendList([], state.fx)}</details>
      <button class="fab" data-action="open-spend">＋ ¥ Spend</button>
    </section>`;
  }
  if (ph.phase === 'before') {
    const ov = tripOverview(state.days);
    return `<section class="countdown">
      <p class="big">${ph.daysToGo} day${ph.daysToGo === 1 ? '' : 's'} to go</p>
      <p>${fmtRange(ov.start, ov.end)} · ${ov.length} day${ov.length === 1 ? '' : 's'}</p>
      ${ov.cities.length ? `<p class="route">${ov.cities.map(esc).join(' → ')}</p>` : ''}
      <a class="btn" href="#/days">See the days</a>
    </section>`;
  }
  if (ph.phase === 'after') {
    return `<section class="countdown">
      <p class="big">Trip complete</p>
      <p>${fmtBoth(tripTotal(state), state.fx)}</p>
      <a class="btn" href="#/trip">Trip summary</a>
    </section>`;
  }
  return `<section class="countdown"><p class="big">Add a day to get started</p>
    <button class="btn" data-action="add-day">+ Add day</button></section>`;
}

export function renderDays(state, today) {
  const rows = sortDays(state.days).map((d) => {
    const done = d.items.filter((i) => i.done).length;
    const sum = d.items.slice(0, 3).map((i) => esc(i.text)).join(', ');
    const title = [shortDate(d.date), d.city].filter(Boolean).map(esc).join(' · ');
    return `<li><a class="day-row" href="${dayHref(d.id)}"><b>${title}</b><span class="sum">${sum}</span>`
      + `<span class="prog">${done}/${d.items.length} ›</span></a></li>`;
  }).join('');
  return `${renderStrip(state.days, { today })}
    <ul class="day-list">${rows}</ul>
    <button class="btn" data-action="add-day">+ Add day</button>`;
}

export function renderTrip(state) {
  const total = tripTotal(state);
  const cats = byCategory(state);
  const catRows = CATEGORIES.map((c) => {
    const pct = total ? Math.round((100 * cats[c]) / total) : 0;
    return `<div class="cat-row${cats[c] ? '' : ' zero'}"><span>${CATEGORY_ICON[c]} ${CATEGORY_LABEL[c]}</span>`
      + `<span class="amt">${fmtYen(cats[c])}</span><div class="bar"><i style="width:${pct}%"></i></div></div>`;
  }).join('');
  const groups = sortDays(state.days).filter((d) => d.spends.length).map((d) => `
    <section class="money-day" data-day="${esc(d.id)}">
      <h3>${esc([longDate(d.date) || 'Undated', d.city].filter(Boolean).join(' · '))} <span class="total">${fmtYen(dayTotal(d))}</span></h3>
      ${renderSpendList(d.spends, state.fx)}
    </section>`).join('');
  const info = state.info.map((s) => `
    <details class="info-sec"><summary>${esc(s.title)}</summary>
      <ul>${s.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></details>`).join('');
  const items = state.days.flatMap((d) => d.items);
  const done = items.filter((i) => i.done).length;
  const pctDone = items.length ? Math.round((100 * done) / items.length) : 0;
  return `<section class="total"><p class="eyebrow">Spent so far</p>
      <p class="sum">${fmtYen(total)}</p>
      <p class="muted">≈ ${fmtHome(toHome(total, state.fx), state.fx.home)} · 1 ${esc(state.fx.home)} = ${esc(state.fx.jpyPerHome)} JPY</p></section>
    <section class="cats"><p class="eyebrow">By category</p>${catRows}</section>
    <details class="by-day"><summary>Spends by day</summary>${groups || '<p class="muted">No spends yet.</p>'}</details>
    ${info ? `<section class="info">${info}</section>` : ''}
    <p class="muted">Plans done: ${done} of ${items.length}</p>
    <div class="progress"><div style="width:${pctDone}%"></div></div>`;
}

export function renderView(route, state, today, { editingId } = {}) {
  if (route.view === 'trip') return renderTrip(state);
  if (route.view === 'days') return renderDays(state, today);
  if (route.view === 'day') {
    const day = state.days.find((d) => d.id === route.id);
    return day ? renderDayScreen(state, day, today, { page: true, editing: day.id === editingId }) : renderDays(state, today);
  }
  return renderToday(state, today, { editingId });
}
