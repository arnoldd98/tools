// Pure renderers: (state, …) → HTML string. No DOM access; unit-tested with `npm test`.
import {
  sortDays, nextUp, mapsUrl, dayTotal, tripTotal, byCategory, tripPhase,
  fmtYen, fmtHome, fmtMoney, homeSymbol, toHome, CATEGORIES, CATEGORY_ICON,
  dayNumber, tripSpan, fmtRange, tripOverview, fmtTime, minutesUntil, fmtUntil, nextFixed, linkKind,
} from './lib.js?v=17';
import { strings, normLang } from './i18n.js?v=17';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Every renderer takes `lang` ('en' | 'zh'); `T` is that language's strings (i18n.js).
const parseDate = (date) => {
  const d = date ? new Date(date + 'T00:00:00') : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};
// "Tue 1 Dec" / "12月1日 周二", or '' when the date is empty/invalid.
const longDate = (date, T) => {
  const d = parseDate(date);
  return d ? T.longDate(d) : '';
};

const dayHref = (id) => `#/day/${esc(encodeURIComponent(id))}`;

const curToggle = (cur, fx, T) => {
  const home = esc(homeSymbol(fx?.home || 'SGD'));
  const other = cur === 'HOME' ? '¥' : home;
  return `<button class="cur-toggle" data-action="toggle-cur" aria-label="${esc(T.showIn(other))}">`
    + `<span${cur === 'HOME' ? '' : ' class="on"'}>¥</span><span${cur === 'HOME' ? ' class="on"' : ''}>${home}</span></button>`;
};

// One compact button naming the other language: 中 while in English, EN while in Chinese.
const langToggle = (lang) => (lang === 'zh'
  ? `<button class="lang-toggle" data-action="toggle-lang" lang="en" aria-label="English">EN</button>`
  : `<button class="lang-toggle" data-action="toggle-lang" lang="zh-Hans" aria-label="中文">中</button>`);

const syncBtn = (dirty, T) =>
  `<button class="btn${dirty ? ' dirty' : ''}" data-action="sync">${T.sync}${dirty ? ' •' : ''}</button>`;

export function renderStrip(days, { today, selectedId, compact, lang } = {}) {
  const T = strings(lang);
  const cards = sortDays(days).map((d) => {
    const dt = parseDate(d.date);
    const done = d.items.filter((i) => i.done).length;
    const cls = `card${d.date && d.date === today ? ' today' : ''}${d.id === selectedId ? ' selected' : ''}`;
    return `<a class="${cls}" href="${dayHref(d.id)}" data-strip="${esc(d.id)}">`
      + `<span class="wd">${dt ? T.wd[dt.getDay()] : '—'}</span><span class="dom">${dt ? dt.getDate() : '?'}</span>`
      + `<span class="city">${esc(d.city)}</span>`
      + `<span class="prog">${d.items.length ? `${done}/${d.items.length}` : ''}</span></a>`;
  }).join('');
  return `<nav class="strip${compact ? ' compact' : ''}">${cards}</nav>`;
}

// Top row of the sticky header, per route. Always ends with the Sync button.
export function renderHeader(route, state, dirty, today, { cur = 'JPY', lang } = {}) {
  lang = normLang(lang);
  const T = strings(lang);
  const right = `<span class="hdr-actions">${langToggle(lang)}${curToggle(cur, state.fx, T)}${syncBtn(dirty, T)}</span>`;
  if (route.view === 'day') {
    const days = sortDays(state.days);
    const idx = days.findIndex((d) => d.id === route.id);
    const day = days[idx];
    const nav = (d, label) => (d
      ? `<a class="nav" href="${dayHref(d.id)}">${label}</a>`
      : `<span class="nav disabled">${label}</span>`);
    return '<a class="back" href="#/days">‹</a>'
      + `<span class="when">${esc(longDate(day?.date, T) || T.undated)}</span>`
      + `<span class="navs">${nav(days[idx - 1], '←')}${nav(days[idx + 1], '→')}</span>`
      + right;
  }
  if (route.view === 'days') {
    const span = tripSpan(state.days);
    return `<h1>${T.days}</h1>${span ? `<span class="muted">${fmtRange(span.start, span.end, lang)}</span>` : ''}${right}`;
  }
  if (route.view === 'trip') return `<h1>${T.trip}</h1>${right}`;
  const num = dayNumber(state.days, today);
  if (num) {
    const day = state.days.find((d) => d.date === today);
    const title = [longDate(today, T), day?.city].filter(Boolean).map(esc).join(' · ');
    return `<div class="hdr"><div class="hdr-title"><b>${title}</b><span class="hanko" aria-label="${T.today}">今日</span></div>`
      + `<span class="muted">${T.dayOf(num.n, num.of)}</span></div>${right}`;
  }
  return `<h1>${esc(state.title)}</h1>${right}`;
}

export function renderTabs(route, lang) {
  const T = strings(lang);
  const active = route.view === 'day' ? 'days' : route.view;
  const tab = (view, href, label) =>
    `<a class="tab${active === view ? ' on' : ''}" href="${href}">${label}</a>`;
  return `<nav class="tabs">${tab('home', '#/', T.today)}${tab('days', '#/days', T.days)}${tab('trip', '#/trip', T.trip)}</nav>`;
}

const mapsBtn = (place, label, cls = 'btn primary') =>
  `<a class="${cls}" target="_blank" rel="noopener" href="${esc(mapsUrl(place))}">${label}</a>`;

const timeOf = (at) => (/T(\d{2}:\d{2})/.exec(at || '') || [])[1] || '';


const SPEND_SORTS = {
  old: (a, b) => (a.at || '').localeCompare(b.at || ''), // order entered
  new: (a, b) => (b.at || '').localeCompare(a.at || ''),
  amount: (a, b) => (b.yen - a.yen) || (a.at || '').localeCompare(b.at || ''),
};

const sortSwitch = (sort, T) => `<div class="sort" role="group" aria-label="${T.sortSpends}">${
  [['old', T.oldest], ['new', T.newest], ['amount', T.amount]].map(([k, label]) =>
    `<button${k === sort ? ' class="on"' : ''} data-action="sort-spends" data-sort="${k}">${label}</button>`).join('')}</div>`;

const catName = (c, T) => T.cat[c] || c;

export function renderSpendList(spends, fx, cur = 'JPY', { sort = 'old', confirmId = null, lang } = {}) {
  const T = strings(lang);
  if (!spends.length) return `<p class="muted empty">${T.nothingSpent}</p>`;
  const rows = [...spends].sort(SPEND_SORTS[sort] || SPEND_SORTS.old).map((s) => {
    const name = esc(s.label || (CATEGORIES.includes(s.category) ? catName(s.category, T) : '') || T.spend);
    const icon = `<span class="sp-ico" aria-hidden="true">${CATEGORY_ICON[s.category] || CATEGORY_ICON.misc}</span>`;
    if (s.id === confirmId) {
      return `
    <li class="confirm" data-spend="${esc(s.id)}">${icon}
      <span class="sp-main"><span class="label">${T.confirmDel(fmtMoney(s.yen, fx, cur), name)}</span></span>
      <span class="confirm-btns"><button class="btn danger" data-action="confirm-del-spend">${T.del}</button><button class="btn" data-action="cancel-del-spend">${T.keep}</button></span>
    </li>`;
    }
    return `
    <li data-spend="${esc(s.id)}">${icon}
      <span class="sp-main"><span class="label">${name}</span>`
    + `<span class="sub">${[s.label ? esc(catName(s.category, T)) : '', fmtTime(timeOf(s.at), lang)].filter(Boolean).join(' · ')}</span></span>
      <span class="amt">${fmtMoney(s.yen, fx, cur)}</span>
      <button class="icon" data-action="del-spend" title="${T.delSpend}">✕</button>
    </li>`;
  }).join('');
  return `<ul class="spends">${rows}</ul>`;
}

// Always-open card: title + total, then the day's spends (newest first).
function renderSpentCard(title, spends, fx, cur, opts = {}) {
  const total = spends.reduce((sum, x) => sum + (x.yen || 0), 0);
  return `<section class="spent-card">
    <div class="spent-head"><h3>${title}</h3><span class="spent-total">${fmtMoney(total, fx, cur)}</span></div>
    ${spends.length >= 2 ? sortSwitch(opts.sort || 'old', strings(opts.lang)) : ''}
    ${renderSpendList(spends, fx, cur, opts)}
  </section>`;
}

// Tickets, bookings, Drive files. Known sites (Drive, Trip.com, Klook…) get their own icon.
const linkBtns = (links) => (links?.length
  ? `<div class="links">${links.map((l) => `<a class="link-btn" href="${esc(l.url)}" target="_blank" rel="noopener">${linkKind(l.url).icon} ${esc(l.label)}</a>`).join('')}</div>`
  : '');

const placeLine = (p) => [p?.name, p?.address].filter(Boolean).map(esc).join(' · ');

function renderNextUp(day, T, lang) {
  const next = nextUp(day);
  if (!next) {
    return `<div class="next-up done-all"><p class="eyebrow">${T.nextUp}</p><p class="what">${T.allDone}</p>
      ${day.stay ? `<p class="place">${placeLine(day.stay)}</p>${mapsBtn(day.stay, T.mapsToHotel)}` : ''}</div>`;
  }
  return `<div class="next-up${next.fixed ? ' fixed' : ''}"><p class="eyebrow">${T.nextUp}</p>
    <p class="what">${next.time ? `<span class="time">${esc(fmtTime(next.time, lang))}</span> ` : ''}${esc(next.text)}</p>
    ${next.fixed ? `<p class="ontime">${T.beOnTime}</p>` : ''}
    ${next.place ? `<p class="place">${placeLine(next.place)}</p>` : ''}
    ${linkBtns(next.links)}
    <div class="actions">${next.place ? mapsBtn(next.place, T.openInMaps) : ''}<button class="btn" data-action="toggle" data-item="${esc(next.id)}">${T.done}</button></div>
  </div>`;
}

// Links for a stop or (outside any [data-item]) for the whole day. The url box is plain
// text, not type=url, so pasted share text ("…on Trip.com! https://…") can be submitted.
function renderLinkEditor(links, formOpen, T) {
  const chips = (links || []).map((l, n) =>
    `<span class="link-chip">${linkKind(l.url).icon} ${esc(l.label)} <button class="icon" data-action="del-link" data-link="${n}" title="${T.removeLink}">✕</button></span>`).join('');
  const add = formOpen
    ? `<form class="add-link"><input name="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(T.pasteLink)}" required>`
      + `<input name="label" placeholder="${esc(T.linkName)}"><button class="btn small" type="submit">${T.add}</button></form>`
    : `<button class="btn small" data-action="show-link-form">${T.addLink}</button>`;
  return `<div class="link-edit">${chips}${add}</div>`;
}

// Bookings & files for the whole day (hotel booking, Drive folder…). Hidden when empty, except in edit mode.
function renderDayLinks(day, editing, linkFormFor, T) {
  if (!editing && !day.links?.length) return '';
  return `<section class="day-links"><h3>${esc(T.bookings)}</h3>${editing
    ? renderLinkEditor(day.links, linkFormFor === `day:${day.id}`, T) : linkBtns(day.links)}</section>`;
}

function renderItem(i, nextId, editing, linkFormFor, T, lang) {
  const detail = [
    i.fixed && !editing ? `<span class="ontime">${T.beOnTime}</span>` : '',
    i.place ? `${placeLine(i.place)} ${mapsBtn(i.place, T.map, 'maplink')}` : '',
    i.note ? `<span class="note">${esc(i.note)}</span>` : '',
    i.price ? `<span class="price">${esc(i.price)}</span>` : '',
  ].filter(Boolean);
  return `
    <li class="${[i.fixed && 'fixed', i.done && 'done', i.id === nextId && 'next'].filter(Boolean).join(' ')}" data-item="${esc(i.id)}">
      ${editing
    ? `<input type="time" value="${esc(i.time)}" data-item-field="time" aria-label="${T.time}">
      <input value="${esc(i.text)}" data-item-field="text" aria-label="${T.stop}">
      <span class="row-btns"><button class="icon fx-toggle${i.fixed ? ' on' : ''}" data-action="toggle-fixed" title="${T.fixedTitle}" aria-pressed="${!!i.fixed}">⏱</button><button class="icon" data-action="del-item" title="${T.delStop}">✕</button></span>`
    : `<input type="checkbox" ${i.done ? 'checked' : ''} data-action="toggle" aria-label="${T.done}">
      <span class="time">${esc(fmtTime(i.time, lang))}</span>
      <span class="text">${esc(i.text)}</span>`}
      ${detail.length ? `<div class="detail">${detail.join(' ')}</div>` : ''}
      ${editing ? renderLinkEditor(i.links, i.id === linkFormFor, T) : linkBtns(i.links)}
    </li>`;
}

// The next must-make stop. On today's screen it counts down from `now` ('HH:MM').
function renderFixedStrip(day, today, now, T, lang) {
  const nf = nextFixed(day);
  if (!nf) return '';
  const isToday = day.date && day.date === today;
  const what = esc(nf.text) + (nf.time ? ` · ${esc(fmtTime(nf.time, lang))}` : '');
  const until = isToday && now && nf.time ? ` · ${fmtUntil(minutesUntil(nf.time, now), lang)}` : '';
  return `<div class="fixed-strip">⏱ ${isToday ? T.nextFixed : T.fixed}<b>${what}</b>${until}</div>`;
}

// Today and the day page share this. `page` adds the compact strip and day-page wording;
// `editing` turns the plan into in-place fields (Edit / Done button on the plan heading).
export function renderDayScreen(state, day, today, { page = false, editing = false, now = '', cur = 'JPY', linkFormFor = null, sort = 'old', confirmId = null, lang } = {}) {
  lang = normLang(lang);
  const T = strings(lang);
  const next = nextUp(day);
  const spentLabel = day.date && day.date === today ? T.spentToday : T.spent;
  const editBtn = `<button class="btn small" data-action="toggle-edit">${editing ? T.done : T.edit}</button>`;
  const notes = editing
    ? `<h3>${T.notes}</h3><textarea placeholder="${esc(T.notesPh)}" data-field="notes">${esc(day.notes)}</textarea>`
    : (day.notes ? `<h3>${T.notes}</h3><p class="notes">${esc(day.notes)}</p>` : '');
  return `<section class="day-screen${editing ? ' is-editing' : ''}" data-day="${esc(day.id)}">
    ${page ? renderStrip(state.days, { today, selectedId: day.id, compact: true, lang }) : ''}
    ${day.summary && !editing ? `<p class="day-summary">${esc(day.summary)}</p>` : ''}
    ${renderFixedStrip(day, today, now, T, lang)}
    ${renderNextUp(day, T, lang)}
    <div class="plan-head"><h3>${page ? T.plan : T.todaysPlan}</h3>${editBtn}</div>
    ${editing ? `<div class="day-fields">
      <input class="date" type="date" value="${esc(day.date)}" data-field="date" aria-label="${T.date}">
      <input class="city" value="${esc(day.city)}" placeholder="${T.city}" data-field="city" aria-label="${T.city}">
      <input class="summary" value="${esc(day.summary)}" placeholder="${esc(T.summaryPh)}" data-field="summary" aria-label="${T.summary}">
    </div>` : ''}
    ${day.items.length
    ? `<ol class="timeline${editing ? ' editing' : ''}">${day.items.map((i) => renderItem(i, next?.id, editing, linkFormFor, T, lang)).join('')}</ol>`
    : `<p class="muted">${T.noStops}</p>`}
    ${editing ? `<form class="add-item">
      <input name="time" type="time" aria-label="${T.time}">
      <input name="text" placeholder="${esc(T.addStop)}" required>
      <button class="btn" type="submit">${T.add}</button>
    </form>` : ''}
    ${renderDayLinks(day, editing, linkFormFor, T)}
    ${notes}
    ${editing ? `<button class="btn danger" data-action="del-day">${T.delDay}</button>` : ''}
    ${renderSpentCard(spentLabel, day.spends, state.fx, cur, { sort, confirmId, lang })}
    <button class="fab" data-action="open-spend" data-day="${esc(day.id)}">${T.spendFab}</button>
  </section>`;
}

export function renderSpendSheet(dayId, fx, cur = 'JPY', lang) {
  const T = strings(lang);
  const chips = CATEGORIES.map((c) => `<label class="chip"><input type="radio" name="category" value="${c}"${c === 'food' ? ' checked' : ''}> ${CATEGORY_ICON[c]} ${T.catChip[c] || T.cat[c]}</label>`).join('');
  return `<form class="spend-sheet"${dayId ? ` data-day="${esc(dayId)}"` : ''}>
    <button type="button" class="icon close" data-action="close-spend" title="${T.close}">✕</button>
    <p class="eyebrow">${T.logSpend}</p>
    <input name="yen" inputmode="numeric" autocomplete="off" placeholder="¥0" enterkeyhint="done" aria-label="${T.amountYen}">
    ${cur === 'HOME' ? `<p class="live muted">≈ ${fmtHome(0, fx.home)}</p>` : ''}
    <button class="btn primary save" type="submit">${T.save}</button>
    <div class="chips">${chips}</div>
    <input name="label" placeholder="${esc(T.whatFor)}" autocomplete="off">
  </form>`;
}

const shortDate = (date, T) => {
  const d = parseDate(date);
  return d ? T.shortDate(d) : T.undated;
};

export function renderToday(state, today, { editingId, now, cur = 'JPY', linkFormFor, sort, confirmId, lang } = {}) {
  lang = normLang(lang);
  const T = strings(lang);
  const ph = tripPhase(state.days, today);
  if (ph.phase === 'during' && ph.day) {
    return renderDayScreen(state, ph.day, today, { page: false, editing: ph.day.id === editingId, now, cur, linkFormFor, sort, confirmId, lang });
  }
  if (ph.phase === 'during') {
    return `<section class="day-screen">
      <p class="what">${T.noPlansToday}</p>
      ${renderSpentCard(T.spentToday, [], state.fx, cur, { lang })}
      <button class="fab" data-action="open-spend">${T.spendFab}</button>
    </section>`;
  }
  if (ph.phase === 'before') {
    const ov = tripOverview(state.days);
    return `<section class="countdown">
      <p class="big">${T.daysToGo(ph.daysToGo)}</p>
      <p>${fmtRange(ov.start, ov.end, lang)} · ${T.nDays(ov.length)}</p>
      ${ov.cities.length ? `<p class="route">${ov.cities.map(esc).join(' → ')}</p>` : ''}
      <a class="btn" href="#/days">${T.seeDays}</a>
    </section>`;
  }
  if (ph.phase === 'after') {
    return `<section class="countdown">
      <p class="big">${T.tripComplete}</p>
      <p>${T.amtSpent(fmtMoney(tripTotal(state), state.fx, cur))}</p>
      <a class="btn" href="#/trip">${T.tripSummary}</a>
    </section>`;
  }
  return `<section class="countdown"><p class="big">${T.noDays}</p></section>`;
}

export function renderDays(state, today, lang) {
  const T = strings(lang);
  const rows = sortDays(state.days).map((d) => {
    const done = d.items.filter((i) => i.done).length;
    const sum = d.summary ? esc(d.summary) : d.items.slice(0, 3).map((i) => esc(i.text)).join(', ');
    const title = [shortDate(d.date, T), d.city].filter(Boolean).map(esc).join(' · ');
    return `<li><a class="day-row" href="${dayHref(d.id)}"><b>${title}</b><span class="sum">${sum}</span>`
      + `<span class="prog">${done}/${d.items.length} ›</span></a></li>`;
  }).join('');
  return `${renderStrip(state.days, { today, lang })}
    <ul class="day-list">${rows}</ul>`;
}

export function renderTrip(state, { cur = 'JPY', sort = 'old', confirmId = null, lang } = {}) {
  const T = strings(lang);
  const total = tripTotal(state);
  const cats = byCategory(state);
  const catRows = CATEGORIES.map((c) => {
    const pct = total ? Math.round((100 * cats[c]) / total) : 0;
    return `<div class="cat-row${cats[c] ? '' : ' zero'}"><span>${CATEGORY_ICON[c]} ${catName(c, T)}</span>`
      + `<span class="amt">${fmtMoney(cats[c], state.fx, cur)}</span><div class="bar"><i style="width:${pct}%"></i></div></div>`;
  }).join('');
  const groups = sortDays(state.days).filter((d) => d.spends.length).map((d) => `
    <section class="money-day" data-day="${esc(d.id)}">
      <h3>${esc([longDate(d.date, T) || T.undated, d.city].filter(Boolean).join(' · '))} <span class="total">${fmtMoney(dayTotal(d), state.fx, cur)}</span></h3>
      ${renderSpendList(d.spends, state.fx, cur, { sort, confirmId, lang })}
    </section>`).join('');
  const items = state.days.flatMap((d) => d.items);
  const done = items.filter((i) => i.done).length;
  const pctDone = items.length ? Math.round((100 * done) / items.length) : 0;
  return `<section class="total"><p class="eyebrow">${T.spentSoFar}</p>
      <p class="sum">${fmtMoney(total, state.fx, cur)}</p>
      <p class="muted">1 ${esc(state.fx.home)} = ${esc(state.fx.jpyPerHome)} JPY</p></section>
    <section class="cats"><p class="eyebrow">${T.byCategory}</p>${catRows}</section>
    <details class="by-day"><summary>${T.spendsByDay}</summary>${state.days.reduce((n, d) => n + d.spends.length, 0) >= 2 ? sortSwitch(sort, T) : ''}${groups || `<p class="muted">${T.noSpends}</p>`}</details>
    <p class="muted">${T.plansDone(done, items.length)}</p>
    <div class="progress"><div style="width:${pctDone}%"></div></div>`;
}

export function renderView(route, state, today, { editingId, now, cur = 'JPY', linkFormFor, sort, confirmId, lang } = {}) {
  if (route.view === 'trip') return renderTrip(state, { cur, sort, confirmId, lang });
  if (route.view === 'days') return renderDays(state, today, lang);
  if (route.view === 'day') {
    const day = state.days.find((d) => d.id === route.id);
    return day ? renderDayScreen(state, day, today, { page: true, editing: day.id === editingId, now, cur, linkFormFor, sort, confirmId, lang }) : renderDays(state, today, lang);
  }
  return renderToday(state, today, { editingId, now, cur, linkFormFor, sort, confirmId, lang });
}
