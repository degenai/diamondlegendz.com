// Roguelike meta persisted in localStorage. Everything else is per-run.
const KEY = 'cmf.meta.v1';
const DEFAULTS = { runs: 0, firstPivotSeen: false, unlocks: [] };

export function load() {
  let data = null;
  try { data = JSON.parse(window.localStorage.getItem(KEY) || 'null'); } catch (_) { data = null; }
  const m = { ...DEFAULTS, unlocks: [] };
  if (data && typeof data === 'object') {
    if (Number.isFinite(data.runs)) m.runs = data.runs;
    m.firstPivotSeen = data.firstPivotSeen === true;
    if (Array.isArray(data.unlocks)) m.unlocks = data.unlocks.slice();
  }
  return m;
}

export function save(meta) {
  try { window.localStorage.setItem(KEY, JSON.stringify(meta)); return true; } catch (_) { return false; }
}
