// Japan trip tracker — static page, data in data/trip.json.
// Edits save instantly to localStorage; "Sync" commits the JSON back to GitHub.

const CFG_KEY = 'jt.cfg';
const DRAFT_KEY = 'jt.draft';
const DEFAULT_CFG = {
  owner: 'arnoldd98', repo: 'tools', branch: 'main',
  path: 'japan-trip/data/trip.json', token: '',
};

let cfg = { ...DEFAULT_CFG, ...readLS(CFG_KEY) };
let state = { title: 'Japan Trip', days: [] };
let dirty = false;

const $ = (s) => document.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 9);
const todayISO = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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

async function apiGet() {
  const res = await fetch(apiUrl(), { headers: apiHeaders(), cache: 'no-store' });
  if (!res.ok) throw new Error(`GitHub GET ${res.status}`);
  const json = await res.json();
  return { data: JSON.parse(b64decode(json.content)), sha: json.sha };
}

// Prefer the API when a token is set (fresh; Pages can lag a minute behind commits).
async function fetchRemote() {
  if (cfg.token) return (await apiGet()).data;
  const res = await fetch('data/trip.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Load trip.json ${res.status}`);
  return res.json();
}

async function sync() {
  if (!cfg.token) {
    setStatus('Add a GitHub token in Sync settings (bottom of page) to sync.');
    $('.settings').open = true;
    return;
  }
  setStatus('Syncing…');
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
    saveDraft();
    render();
    setStatus(`Synced ${new Date().toLocaleTimeString()}`);
  } catch (e) {
    setStatus(`Sync failed: ${e.message}. Changes are still saved on this device.`);
  }
}

// ---------- state ----------
function saveDraft() { writeLS(DRAFT_KEY, { dirty, data: state }); }
function commit() { dirty = true; saveDraft(); render(); }
function setStatus(msg) { $('#status').textContent = msg; }
const findDay = (id) => state.days.find((d) => d.id === id);

async function load({ force = false } = {}) {
  const draft = readLS(DRAFT_KEY);
  if (!force && draft?.dirty) {
    state = draft.data; dirty = true;
    setStatus('Unsynced changes on this device. Tap Sync to save to GitHub.');
  } else {
    try {
      state = await fetchRemote(); dirty = false; saveDraft();
      setStatus(state.updated ? `Last synced ${new Date(state.updated).toLocaleString()}` : '');
    } catch (e) {
      if (draft?.data) state = draft.data;
      setStatus(`Couldn't load from GitHub (${e.message}). Showing this device's copy.`);
    }
  }
  render();
  document.querySelector('.day.today')?.scrollIntoView({ block: 'start' });
}

// ---------- render ----------
function render() {
  document.title = state.title || 'Japan Trip';
  $('#title').textContent = state.title || 'Japan Trip';
  $('#sync-btn').classList.toggle('dirty', dirty);
  $('#sync-btn').textContent = dirty ? 'Sync •' : 'Sync';

  const all = state.days.flatMap((d) => d.items);
  const done = all.filter((i) => i.done).length;
  $('#progress-bar').style.width = all.length ? `${(100 * done) / all.length}%` : '0';

  const today = todayISO();
  const days = [...state.days].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  $('#days').innerHTML = days.map((d) => `
    <section class="day ${d.date === today ? 'today' : ''}" data-day="${d.id}">
      <div class="day-head">
        <input class="date" type="date" value="${esc(d.date)}" data-field="date">
        <input class="city" value="${esc(d.city)}" placeholder="City" data-field="city">
        ${d.date === today ? '<span class="badge">Today</span>' : ''}
        <button class="icon" data-action="del-day" title="Delete day">✕</button>
      </div>
      <ul class="items">
        ${d.items.map((i) => `
          <li class="${i.done ? 'done' : ''}" data-item="${i.id}">
            <input type="checkbox" ${i.done ? 'checked' : ''} data-action="toggle">
            <span class="time">${esc(i.time)}</span>
            <span class="text">${esc(i.text)}</span>
            <button class="icon" data-action="del-item" title="Delete">✕</button>
          </li>`).join('')}
      </ul>
      <form class="add-item">
        <input name="time" type="time">
        <input name="text" placeholder="Add a plan…" required>
        <button class="btn" type="submit">Add</button>
      </form>
      <textarea placeholder="Notes for the day…" data-field="notes">${esc(d.notes)}</textarea>
    </section>`).join('');
}

// ---------- events ----------
document.addEventListener('click', (e) => {
  const action = e.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  const day = findDay(e.target.closest('[data-day]')?.dataset.day);
  const itemId = e.target.closest('[data-item]')?.dataset.item;

  if (action === 'toggle') {
    const item = day.items.find((i) => i.id === itemId);
    item.done = !item.done; commit();
  } else if (action === 'del-item') {
    day.items = day.items.filter((i) => i.id !== itemId); commit();
  } else if (action === 'del-day') {
    if (e.target.dataset.confirm) {
      state.days = state.days.filter((d) => d !== day); commit();
    } else {
      e.target.dataset.confirm = '1'; e.target.textContent = 'Delete?';
      setTimeout(() => render(), 3000);
    }
  } else if (action === 'add-day') {
    const last = [...state.days].sort((a, b) => (a.date || '').localeCompare(b.date || '')).pop();
    state.days.push({ id: uid(), date: last?.date || todayISO(), city: last?.city || '', items: [], notes: '' });
    commit();
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

// Field edits (date/city/notes) — save on change, no re-render while typing.
document.addEventListener('change', (e) => {
  const field = e.target.dataset.field;
  const day = findDay(e.target.closest('[data-day]')?.dataset.day);
  if (!field || !day) return;
  day[field] = e.target.value;
  if (field === 'date') commit();
  else { dirty = true; saveDraft(); $('#sync-btn').classList.add('dirty'); $('#sync-btn').textContent = 'Sync •'; }
});

document.addEventListener('submit', (e) => {
  e.preventDefault();
  if (e.target.id === 'settings') {
    cfg = Object.fromEntries(new FormData(e.target));
    writeLS(CFG_KEY, cfg);
    setStatus('Settings saved.');
    return;
  }
  const day = findDay(e.target.closest('[data-day]')?.dataset.day);
  const fd = new FormData(e.target);
  day.items.push({ id: uid(), time: fd.get('time'), text: fd.get('text').trim(), done: false });
  day.items.sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
  commit();
});

$('#import').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.days)) throw new Error('missing "days" array');
    state = data; commit(); setStatus('Imported. Tap Sync to save to GitHub.');
  } catch (err) { setStatus(`Import failed: ${err.message}`); }
  e.target.value = '';
});

$('#sync-btn').addEventListener('click', sync);

// Fill settings form
for (const [k, v] of Object.entries(cfg)) {
  const input = document.querySelector(`#settings [name=${k}]`);
  if (input) input.value = v;
}

load();
