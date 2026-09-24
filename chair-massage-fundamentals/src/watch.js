// The run watcher (watch.html): a second tab on the same origin. Replays the ring buffer the game
// keeps in localStorage (src/events.js), then listens on BroadcastChannel('cmf') for new events.
// Shows a live feed, a card for the current run, a table of finished runs, and the rules-based
// report (src/run-report.js) with its diffs under the selected run, and under the finished runs the
// Repeats list (voice lines heard in three or more runs). The feed filters to All or Lines.
// No server, nothing external.
import { CHANNEL, KEY } from './events.js';
import { groupRuns, runStats, fullReport, clock, repeatLines, repeatsText, REPEAT_RUNS } from './run-report.js';

const $ = (id) => document.getElementById(id);
const W = { events: [], seen: new Set(), groups: [], selected: null, doneCount: 0, lastCopy: '', lastDownload: '' };
window.__watch = W;                                   // debug handle, like window.CMF

const keyOf = (e) => `${e.wall}|${e.run}|${e.type}|${e.t}`;
const FEED_MAX = 2000;

function short(e) {
  const d = e.data || {};
  switch (e.type) {
    case 'state': return `${d.from || '-'} -> ${d.to}`;
    case 'wanted': return `${d.prev} -> ${d.level} stars, heat ${d.heat} (${d.cause})`;
    case 'run.start': return `seed ${d.seed}, build ${d.build}, unlocks [${(d.unlocks || []).join(', ')}]`;
    case 'run.end': return `${d.reason} in ${clock(d.time)}, cash $${d.cash}, tension ${d.tension}${d.unlock ? `, unlocked ${d.unlock}` : ''}`;
    case 'vehicle': return `${d.act} ${d.type}${d.stolen ? ' (stolen)' : ''}`;
    case 'chair': return `${d.act} -> ${d.where}${d.vehicle ? ` (${d.vehicle})` : ''}`;
    case 'pivot': return d.beat === 'line' ? `${d.speaker}: "${d.text}"` : `${d.beat}${d.at !== undefined ? ` at ${d.at} s` : ''}`;
    case 'damage': return `-${d.amount} from ${d.source}, hp ${d.hp}`;
    case 'knockdown': return `${d.who} (${d.by || d.cause})${d.mine ? ' by you' : ''}`;
    case 'mini': return `${d.phase}${d.reason ? ` (${d.reason})` : ''}${d.pay ? ` +$${d.pay}` : ''}`;
    case 'van': return `${d.act}${d.hp !== undefined ? `, your ${d.vehicle} at ${d.hp} hp` : ''}${d.x !== undefined ? ` at ${d.x}, ${d.z}` : ''}`;
    case 'vending': return `${d.act}${d.heat ? ` (heat ${d.heat})` : ''}${d.goons !== undefined ? `, ${d.goons} goons` : ''}${d.rank ? `, ${d.rank}` : ''}${d.after !== undefined ? ` after ${d.after} s` : ''}`;
    case 'peds': return `left block ${d.block}: ${d.arrived} peds on arrival, ${d.moved} moved in, ${d.have} at the end`;
    case 'treat': return `${d.kind || d.target}${d.wave ? ' (wave)' : ''}${d.rank ? ` (${d.rank})` : ''} ${d.phase || 'sit'}`;
    case 'leave': return `${d.phase}${d.vehicle ? ` (${d.vehicle})` : ''}${d.why ? ` (${d.why})` : ''}${d.held !== undefined ? ` after ${d.held} s` : ''}`;
    case 'palm': return d.target ? `${d.charged ? 'charged' : 'quick'} on ${d.target}` : `${d.phase}${d.cause ? ` (${d.cause})` : ''}`;
    case 'line': return `${d.speaker}${d.name !== null && d.name !== undefined ? ` ${d.name}` : ''}: "${d.text}" [${d.state || '-'}]`;
    case 'tutorial': return `step ${d.step} ${d.act}: ${d.text}`;
    default: return Object.entries(d).map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' ');
  }
}

function hhmmss(wall) {
  const d = new Date(wall);
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
}

function feedRow(e) {
  const div = document.createElement('div');
  div.className = `ev-${e.type.replace(/\./g, '-')}`;
  const tm = document.createElement('span'); tm.className = 'tm'; tm.textContent = `${hhmmss(e.wall)} r${e.run} `;
  const k = document.createElement('span'); k.className = 'k'; k.textContent = e.type;
  div.append(tm, k, document.createTextNode(short(e)));
  return div;
}

function add(list, live) {
  const feed = $('w-feed');
  const atBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 40;
  const frag = document.createDocumentFragment();
  let n = 0;
  for (const e of list) {
    if (!e || typeof e !== 'object' || !e.type) continue;
    const k = keyOf(e);
    if (W.seen.has(k)) continue;
    W.seen.add(k);
    W.events.push(e);
    frag.appendChild(feedRow(e));
    n++;
  }
  if (!n) return;
  feed.appendChild(frag);
  while (feed.childElementCount > FEED_MAX) feed.firstElementChild.remove();
  if (atBottom || !live) feed.scrollTop = feed.scrollHeight;
  if (W.events.length > FEED_MAX * 2) { W.events.splice(0, W.events.length - FEED_MAX); W.seen = new Set(W.events.map(keyOf)); }
  refresh();
}

function lastState() {
  for (let i = W.events.length - 1; i >= 0; i--) if (W.events[i].type === 'state') return W.events[i].data.to;
  return null;
}

function renderCard() {
  const g = W.groups[W.groups.length - 1];
  const state = lastState();
  $('c-state').textContent = state || '-';
  if (!g) { $('w-card-title').textContent = 'Current run: none yet'; return; }
  const st = runStats(g.events);
  let dur = st.duration;
  if (!st.ending && state === 'RUN') {
    const last = g.events[g.events.length - 1];
    dur += Math.max(0, (Date.now() - last.wall) / 1000);   // still running: count on from the last event
  }
  $('w-card-title').textContent = `Run ${g.run}${st.seed !== null ? ` · seed ${st.seed}` : ''}${st.ending ? ` · ${st.ending}` : ' · live'}`;
  $('c-dur').textContent = clock(dur);
  $('c-stars').textContent = `${'★'.repeat(st.level)}${'☆'.repeat(Math.max(0, 3 - st.level))} (${st.maxStars})`;
  $('c-hits').textContent = `${st.palms} / ${st.guns}`;
  $('c-chair').textContent = st.chair === 'vehicle' ? `in the ${st.chairVehicle || 'car'}` : st.chair === 'player' ? 'on your back' : st.chairMoved ? 'on the ground' : 'at the station';
  $('c-cash').textContent = `$${Math.round(st.cash * 100) / 100}`;
  const strip = $('c-strip');
  strip.textContent = '';
  const total = Math.max(dur, 0.1);
  st.stars.forEach((s, i) => {
    const end = i + 1 < st.stars.length ? st.stars[i + 1].t : total;
    const w = Math.max(0, end - s.t);
    if (w <= 0 && i + 1 < st.stars.length) return;
    const seg = document.createElement('i');
    seg.className = `w-s${Math.min(4, s.level)}`;
    seg.style.flexGrow = String(Math.max(w, 0.001));
    seg.title = `${clock(s.t)} wanted ${s.level}`;
    strip.appendChild(seg);
  });
  $('c-strip-end').textContent = clock(dur);
}

function renderTable() {
  const rows = $('w-rows');
  const done = W.groups.map((g, i) => ({ g, i, st: runStats(g.events) })).filter((r) => r.st.finished);
  if (!done.length) {
    rows.innerHTML = '<tr><td colspan="8" class="w-empty">No finished runs yet. Open the game in another tab and play.</td></tr>';
    $('w-report').textContent = 'Pick a finished run.';
    return;
  }
  // A newly finished run takes the selection (the watcher follows the game); a click picks any row.
  if (W.selected === null || done.length !== W.doneCount || !done.some((r) => r.i === W.selected)) W.selected = done[done.length - 1].i;
  W.doneCount = done.length;
  rows.textContent = '';
  for (const r of done) {
    const tr = document.createElement('tr');
    if (r.i === W.selected) tr.className = 'sel';
    tr.dataset.idx = String(r.i);
    const cells = [r.g.run, r.st.seed, r.st.build, r.st.ending, clock(r.st.duration), r.st.maxStars, r.st.tension, `$${Math.round(r.st.cash * 100) / 100}`];
    cells.forEach((c, k) => {
      const td = document.createElement('td');
      td.textContent = c === null || c === undefined ? '-' : String(c);
      if (k === 3) td.className = `w-end-${r.st.ending}`;
      tr.appendChild(td);
    });
    tr.addEventListener('click', () => { W.selected = r.i; renderTable(); });
    rows.appendChild(tr);
  }
  const g = W.groups[W.selected];
  $('w-report-title').textContent = `Run report · run ${g.run}`;
  $('w-report').textContent = fullReport(W.groups, W.selected);
}

function renderRepeats() {
  const rows = repeatLines(W.groups);
  W.repeats = rows;
  const box = $('w-repeats');
  box.textContent = rows.length ? repeatsText(W.groups).split('\n').slice(1).map((s) => s.trim()).join('\n')
    : `No line heard in ${REPEAT_RUNS} or more runs yet.`;
}

function refresh() {
  W.groups = groupRuns(W.events);
  renderCard();
  renderTable();
  renderRepeats();
}

function note(text) {
  $('w-note').textContent = text;
  clearTimeout(note.t);
  note.t = setTimeout(() => { $('w-note').textContent = ''; }, 4000);
}

function lastFinished() {
  for (let i = W.groups.length - 1; i >= 0; i--) if (runStats(W.groups[i].events).finished) return i;
  return -1;
}

function download() {
  const sel = $('w-scope').value === 'sel' && W.selected !== null ? W.selected : -1;
  const events = sel >= 0 ? W.groups[sel].events : W.events;
  const groups = sel >= 0 ? [sel] : W.groups.map((_, i) => i);
  const doc = {
    kind: 'cmf-run-log', version: 1, exported: new Date().toISOString(), count: events.length,
    reports: groups.map((i) => ({ run: W.groups[i].run, report: fullReport(W.groups, i) })),
    repeats: repeatLines(W.groups),
    events,
  };
  const text = JSON.stringify(doc, null, 1);
  W.lastDownload = text;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = sel >= 0 ? `cmf-run-${W.groups[sel].run}.json` : 'cmf-run-log.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  note(`downloaded ${events.length} events`);
}

async function copyLast() {
  const i = lastFinished();
  if (i < 0) { note('no finished run yet'); return; }
  const g = W.groups[i];
  const text = `${fullReport(W.groups, i)}\n\n${JSON.stringify({ kind: 'cmf-run', run: g.run, count: g.events.length, events: g.events })}`;
  W.lastCopy = text;
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch (_) {
    try {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      ok = document.execCommand('copy'); ta.remove();
    } catch (_) { ok = false; }
  }
  note(ok ? `copied run ${g.run} (report + ${g.events.length} events)` : 'copy blocked by the browser');
}

function clearLog() {
  if (!window.confirm('Clear the event log? Finished runs and their reports go with it.')) return;
  try { window.localStorage.removeItem(KEY); } catch (_) { /* private mode */ }
  try { if (W.chan) W.chan.postMessage({ clear: true }); } catch (_) { /* ignore */ }
  W.events = []; W.seen = new Set(); W.groups = []; W.selected = null; W.doneCount = 0;
  $('w-feed').textContent = '';
  refresh();
  note('log cleared');
}

function boot() {
  let saved = [];
  try { const a = JSON.parse(window.localStorage.getItem(KEY) || '[]'); if (Array.isArray(a)) saved = a; } catch (_) { saved = []; }
  try {
    W.chan = new BroadcastChannel(CHANNEL);
    W.chan.onmessage = (m) => { if (m.data && m.data.type) add([m.data], true); $('w-live').textContent = `live · ${W.events.length} events`; };
    $('w-live').textContent = `listening · ${saved.length} replayed`;
  } catch (_) {
    $('w-live').textContent = 'BroadcastChannel unavailable: replay only (reload to update)';
  }
  add(saved, false);
  W.replayed = saved.length;
  $('w-download').addEventListener('click', download);
  $('w-copy').addEventListener('click', copyLast);
  $('w-clear').addEventListener('click', clearLog);
  const filt = $('w-filter');
  filt.addEventListener('change', () => { $('w-feed').classList.toggle('w-only-lines', filt.value === 'lines'); $('w-feed').scrollTop = $('w-feed').scrollHeight; });
  setInterval(renderCard, 500);                       // the live duration ticks between events
  if (!saved.length) refresh();
}

boot();
