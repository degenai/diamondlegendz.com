// Event bus for the run watcher (watch.html). The game calls emit(type, data) from one-line hooks;
// each event { t, wall, run, type, data } goes out on BroadcastChannel('cmf') to any watch tab and
// into a localStorage ring buffer (cmf.events.v1, newest 2,000) that a watch tab replays on load.
// Nothing here may ever throw into the game: every browser call is wrapped.
export const CHANNEL = 'cmf';
export const KEY = 'cmf.events.v1';
export const CAP = 2000;
const FLUSH_MS = 250;

let ctx = null;
let runId = 1;
let buf = null;
let chan = null;
let timer = 0;

function load() {
  if (buf) return buf;
  buf = [];
  try { const a = JSON.parse(window.localStorage.getItem(KEY) || '[]'); if (Array.isArray(a)) buf = a.slice(-CAP); } catch (_) { buf = []; }
  return buf;
}

function flush() {
  timer = 0;
  try { window.localStorage.setItem(KEY, JSON.stringify(buf)); } catch (_) { /* quota or private mode */ }
}

// Boot: remember ctx (for ctx.time), open the channel. The watcher's "Clear log" posts a clear.
export function initEvents(c) {
  ctx = c;
  runId = runsSoFar() + 1;
  load();
  try {
    chan = new BroadcastChannel(CHANNEL);
    chan.onmessage = (m) => { if (m.data && m.data.clear) buf = []; };
  } catch (_) { chan = null; }
  try { window.addEventListener('pagehide', () => { if (timer) { clearTimeout(timer); flush(); } }); } catch (_) { /* ignore */ }
}

function runsSoFar() { return (ctx && ctx.meta && Number.isFinite(ctx.meta.runs)) ? ctx.meta.runs : 0; }

// The run events are filed under: meta.runs + 1, taken on entering MASSAGE and RUN, so the massage,
// the pivot, the run, and its certificate (after recordRun counted it) all carry the same number.
export function currentRun() { return runId; }

export function emit(type, data = {}) {
  try {
    if (type === 'state' && (data.to === 'MASSAGE' || data.to === 'RUN')) runId = runsSoFar() + 1;
    const ev = { t: Math.round(((ctx && ctx.time) || 0) * 100) / 100, wall: Date.now(), run: runId, type, data };
    if (chan) { try { chan.postMessage(ev); } catch (_) { /* uncloneable data */ } }
    load().push(ev);
    if (buf.length > CAP) buf.splice(0, buf.length - CAP);
    if (!timer) timer = setTimeout(flush, FLUSH_MS);
  } catch (_) { /* never into the game */ }
}
