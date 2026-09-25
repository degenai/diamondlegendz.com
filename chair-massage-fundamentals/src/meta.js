// Roguelike meta persisted in localStorage (DESIGN.md "Roguelike meta"). Everything else is per-run.
// Two tracks (owner ruling 2026-09-24: "the rewards for failing and for succeeding seem to be the
// same"). unlocks: the main track, ids in UNLOCKS order, one per ESCAPE. consolations: ids in
// CONSOLATIONS order, one per arrest or death, each once; exhausted, a failure grants nothing.
// Leaving the chair grants nothing on either track.
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

// The consolation track: smaller things for a run that ended in the back of a car or face down.
// sympathy: the jogger's line when handing it over between runs (clients.js). The files that
// read each effect's perks() flag are listed in DESIGN.md.
export const CONSOLATIONS = [
  { id: 'icepack', name: 'Ice pack', desc: 'Picking up the chair heals 20 hp, once per run.', gift: 'an ice pack',
    sympathy: 'I brought you an ice pack. You looked rough.' },
  { id: 'coffee', name: 'Coffee', desc: 'Stamina refills 25% faster.', gift: 'a coffee',
    sympathy: "Here, coffee. The gas station kind. You look like you haven't slept." },
  { id: 'parkingpass', name: 'Parking pass', desc: 'A sedan waits at the plaza edge nearest the chair.', gift: 'a parking pass',
    sympathy: "Walt gave me his parking pass for you. He says you keep leaving on foot." },
  { id: 'tipjar', name: 'Tip jar', desc: '+$5 per mini-massage.', gift: 'a tip jar',
    sympathy: "I made you a tip jar. It's a pickle jar. It still smells a little." },
  { id: 'getwellcard', name: 'Get-well card', desc: 'The regulars signed it. It goes on the certificate.', gift: 'a get-well card',
    sympathy: "Everybody at the pond signed a get-well card. Marcus's kid drew you as a horse." },
  { id: 'loanerscrubs', name: 'Loaner scrubs', desc: 'A second shirt: gold.', gift: 'loaner scrubs',
    sympathy: "My sister's a nurse. She lent you her spare scrubs. They're gold. Don't ask." },
];
export const NO_CONSOLATION = 'No unlock. Escape for the next one.';

const DEFAULTS = {
  runs: 0, bestTime: 0, bestCash: 0, escapes: 0, firstPivotSeen: false, firstRunSeen: false, unlocks: [], consolations: [],
  lastOutcome: null, lastUnlock: null, lastTrack: null, // lastTrack: 'main' | 'consolation' | null
};

export function load() {
  let data = null;
  try { data = JSON.parse(window.localStorage.getItem(KEY) || 'null'); } catch (_) { data = null; }
  const m = { ...DEFAULTS, unlocks: [], consolations: [] };
  if (data && typeof data === 'object') {
    // Counts are whole and nobody escapes in negative time: a hand-edited value that is not falls back.
    for (const k of ['runs', 'bestTime', 'bestCash', 'escapes']) if (Number.isFinite(data[k]) && data[k] >= 0 && data[k] < 1e9) m[k] = data[k];
    m.runs = Math.floor(m.runs); m.escapes = Math.min(Math.floor(m.escapes), m.runs);
    m.firstPivotSeen = data.firstPivotSeen === true;
    // firstRunSeen (2026-09-24, the grab-window prompts): a save from before it has seen a run if
    // it booked one or got through the pivot (set on RUN entry), so it gets no prompts.
    m.firstRunSeen = data.firstRunSeen === true || (data.firstRunSeen === undefined && (m.runs > 0 || m.firstPivotSeen));
    if (Array.isArray(data.unlocks)) m.unlocks = data.unlocks.filter((id) => UNLOCKS.some((u) => u.id === id));
    if (typeof data.lastOutcome === 'string') m.lastOutcome = data.lastOutcome;
    // Saves from before the two tracks have one mixed unlocks array: it stays the main track as is.
    if (Array.isArray(data.consolations)) m.consolations = data.consolations.filter((id) => CONSOLATIONS.some((u) => u.id === id));
    if (typeof data.lastUnlock === 'string' && unlockInfo(data.lastUnlock)) {
      m.lastUnlock = data.lastUnlock;
      m.lastTrack = trackOf(data.lastUnlock);
    }
  }
  return m;
}

export function save(meta) {
  try { window.localStorage.setItem(KEY, JSON.stringify(meta)); return true; } catch (_) { return false; }
}

// Ids are unique across both tracks, so has() answers for either.
export function has(meta, id) { return !!meta && (meta.unlocks.includes(id) || (meta.consolations || []).includes(id)); }
export function unlockInfo(id) { return UNLOCKS.find((u) => u.id === id) || CONSOLATIONS.find((u) => u.id === id) || null; }
export function trackOf(id) { return UNLOCKS.some((u) => u.id === id) ? 'main' : CONSOLATIONS.some((u) => u.id === id) ? 'consolation' : null; }

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
    // Consolation track. DESIGN.md "Roguelike meta" names the readers.
    icePack: has(meta, 'icepack'),                    // +20 hp on chair pickup, once per run (player.js)
    staminaRegenMul: has(meta, 'coffee') ? 1.25 : 1,  // stamina refill rate (player.js)
    parkingPass: has(meta, 'parkingpass'),            // a sedan at the plaza edge nearest the chair (cars.js, spawner.js)
    tipJar: has(meta, 'tipjar') ? 5 : 0,              // dollars added per mini-massage (minimassage.js)
    getWellCard: has(meta, 'getwellcard'),            // certificate stamp + jogger line (summary.js, clients.js)
    shirt: has(meta, 'loanerscrubs') ? 'gold' : null, // shirt colour, player and therapist (people.js, player.js, stage.js)
  };
}

// Book a finished run. outcome: escape | arrest | death | left. An escape takes the next main
// unlock, an arrest or death the next consolation. Returns { ...item, track } or null (the chair was
// left, or that track is exhausted).
export function recordRun(meta, outcome, seconds, cash) {
  if (!Array.isArray(meta.consolations)) meta.consolations = [];
  meta.runs += 1;
  if (outcome === 'escape') {
    meta.escapes += 1;
    if (!meta.bestTime || seconds < meta.bestTime) meta.bestTime = Math.round(seconds * 10) / 10;
    meta.bestCash = Math.max(meta.bestCash || 0, Math.round(cash)); // bests are escape-only, like bestTime
  }
  let next = null, track = null;
  if (outcome === 'escape') {
    track = 'main';
    next = UNLOCKS.find((u) => !meta.unlocks.includes(u.id)) || null;
    if (next) meta.unlocks.push(next.id);
  } else if (outcome === 'arrest' || outcome === 'death') {
    track = 'consolation';
    next = CONSOLATIONS.find((u) => !meta.consolations.includes(u.id)) || null;
    if (next) meta.consolations.push(next.id);
  }
  meta.lastOutcome = outcome;
  meta.lastUnlock = next ? next.id : null;
  meta.lastTrack = next ? track : null;
  save(meta);
  return next ? { ...next, track } : null;
}
