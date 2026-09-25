// Seeded PRNG (mulberry32) and string hashing for run seeds.

export function hashSeed(str) {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function makeRng(seed) {
  let a = (typeof seed === 'string' ? hashSeed(seed) : seed >>> 0) || 1;
  function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    range(lo, hi) { return lo + (hi - lo) * next(); },
    int(lo, hi) { return lo + Math.floor(next() * (hi - lo + 1)); }, // inclusive
    pick(arr) { return arr[Math.floor(next() * arr.length)]; },
  };
}

// Named seeded streams for gameplay code that has no rng of its own (Playtesting with Jev, milestone
// 1: the goon sight phase, the NPC replan timer and sidestep, the ped relocation). main.js seeds them
// from the run seed at boot; each name gets its own mulberry32 stream, so one kind's draws never shift
// another's. Before seedStreams() runs (module tests) the base is 0: still repeatable.
let streamBase = 0;
const streams = new Map();
export function seedStreams(seed) { streamBase = seed >>> 0; streams.clear(); }
export function stream(name) {
  let r = streams.get(name);
  if (!r) { r = makeRng(hashSeed(`${streamBase}:${name}`)); streams.set(name, r); }
  return r;
}
