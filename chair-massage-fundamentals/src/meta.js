// Roguelike meta persisted in localStorage (DESIGN.md "Roguelike meta"). Everything else is per-run.
// unlocks: ids in UNLOCKS order; each SUMMARY unlocks the next one (not when the chair was left).
const KEY = 'cmf.meta.v1';

// gift: how a between-runs client talks about it ("... left you <gift> ...").
export const UNLOCKS = [
  { id: 'gun', name: 'Massage gun', desc: 'Right click: percussive taps. Q switches palm / gun.', gift: 'a massage gun' },
  { id: 'sprint', name: 'Sprint stamina up', desc: 'Sprint 15% faster.', gift: 'better running shoes' },
  { id: 'gun1', name: 'Gun range 1', desc: 'The massage gun reaches 4 m with a shockwave.', gift: 'a longer barrel for the gun' },
  { id: 'autofold', name: 'Chair auto-fold', desc: 'Pick up and load the chair twice as fast.', gift: 'a new hinge for the chair' },
  { id: 'regular', name: 'Regular client', desc: 'One regular waits near the chair every run.', gift: 'a regular' },
  // TODO(v2): gun range 2 cone, cart keys start, franchise disguise, gun range 3 knockback, block party.
  { id: 'gun2', name: 'Gun range 2', desc: 'The massage gun reaches 8 m.', gift: 'a bigger head for the gun' },
  { id: 'cartkeys', name: 'Cart keys', desc: 'Start the run with the maintenance cart.', gift: 'the cart keys' },
  { id: 'disguise', name: 'Franchise disguise', desc: 'Goons ignore you for 20 s, once.', gift: 'a Serenity Group polo' },
  { id: 'gun3', name: 'Gun range 3 "Pro"', desc: 'The massage gun reaches 14 m.', gift: 'the Pro head' },
  { id: 'blockparty', name: 'Block party', desc: 'Peds cheer, cops slower.', gift: 'a block party flyer' },
  // Ruled 2026-09-23 after the first plays: any key skips the van cutscene straight to RUN (pivot.js).
  { id: 'skipPivot', name: 'Module review: skippable', desc: "You've seen enough.", gift: 'a hall pass from the course office' },
];

const DEFAULTS = {
  runs: 0, bestTime: 0, bestCash: 0, escapes: 0, firstPivotSeen: false, unlocks: [],
  lastOutcome: null, lastUnlock: null,
};

export function load() {
  let data = null;
  try { data = JSON.parse(window.localStorage.getItem(KEY) || 'null'); } catch (_) { data = null; }
  const m = { ...DEFAULTS, unlocks: [] };
  if (data && typeof data === 'object') {
    // Counts are whole and nobody escapes in negative time: a hand-edited value that is not falls back.
    for (const k of ['runs', 'bestTime', 'bestCash', 'escapes']) if (Number.isFinite(data[k]) && data[k] >= 0 && data[k] < 1e9) m[k] = data[k];
    m.runs = Math.floor(m.runs); m.escapes = Math.min(Math.floor(m.escapes), m.runs);
    m.firstPivotSeen = data.firstPivotSeen === true;
    if (Array.isArray(data.unlocks)) m.unlocks = data.unlocks.filter((id) => UNLOCKS.some((u) => u.id === id));
    if (typeof data.lastOutcome === 'string') m.lastOutcome = data.lastOutcome;
    if (typeof data.lastUnlock === 'string') m.lastUnlock = data.lastUnlock;
  }
  return m;
}

export function save(meta) {
  try { window.localStorage.setItem(KEY, JSON.stringify(meta)); return true; } catch (_) { return false; }
}

export function has(meta, id) { return !!meta && meta.unlocks.includes(id); }
export function unlockInfo(id) { return UNLOCKS.find((u) => u.id === id) || null; }

// Massage gun level: -1 locked, 0 contact, 1..3 range upgrades.
export function gunLevel(meta) {
  if (!has(meta, 'gun')) return -1;
  return has(meta, 'gun3') ? 3 : has(meta, 'gun2') ? 2 : has(meta, 'gun1') ? 1 : 0;
}

// Perks the run reads (ctx.perks), rebuilt on RUN entry.
export function perks(meta) {
  return {
    gun: gunLevel(meta),
    sprintMul: has(meta, 'sprint') ? 1.15 : 1,
    foldMul: has(meta, 'autofold') ? 0.5 : 1,
    regular: has(meta, 'regular'),
    cartKeys: has(meta, 'cartkeys'),      // TODO(v2)
    disguise: has(meta, 'disguise'),      // TODO(v2)
    blockParty: has(meta, 'blockparty'),  // TODO(v2)
    skipPivot: has(meta, 'skipPivot'),
  };
}

// Book a finished run. outcome: escape | arrest | death | left. Returns the unlock revealed
// (null when the chair was left or everything is already unlocked).
export function recordRun(meta, outcome, seconds, cash) {
  meta.runs += 1;
  if (outcome === 'escape') {
    meta.escapes += 1;
    if (!meta.bestTime || seconds < meta.bestTime) meta.bestTime = Math.round(seconds * 10) / 10;
    meta.bestCash = Math.max(meta.bestCash || 0, Math.round(cash)); // bests are escape-only, like bestTime
  }
  let next = null;
  if (outcome !== 'left') {
    next = UNLOCKS.find((u) => !meta.unlocks.includes(u.id)) || null;
    if (next) meta.unlocks.push(next.id);
  }
  meta.lastOutcome = outcome;
  meta.lastUnlock = next ? next.id : null;
  save(meta);
  return next;
}
