// Call and response (owner ruling 2026-09-24, Andy: "the pressure meter reads too heavy"). There is
// no pressure meter any more: the client calls out every 4 to 8 s (seeded, per client personality)
// and the player answers on the run's keys, so W stays "more" and S stays "less" (pillar 1).
//   lighter  "Ow. Lighter."               tap S within 1.5 s
//   harder   "Harder. Try to hurt me."    hold W for 1 s (the hold has to finish within 2.5 s)
//   still    "That's it, right there."    no W or S for 2 s
//   left     "A little to the left."      tap A within 2 s (A/D are answers only during this call)
//   right    "A little to the right."     tap D within 2 s
// The opposite key (W for lighter, S for harder, W or S while still, D for left, A for right) is a
// wrong answer; running out the window is late. This file only judges: session.js speaks the call,
// starts its window when the line starts, and pays out or drains. The file keeps its old name so
// the module map stays put.
import { makeRng, hashSeed } from '../rng.js';

export const CALLS = {
  lighter: { text: 'Ow. Lighter.', key: 'S', window: 1.5 },
  harder: { text: 'Harder. Try to hurt me.', key: 'W', window: 2.5, hold: 1 },
  still: { text: "That's it, right there.", key: '', window: 2 },
  left: { text: 'A little to the left.', key: 'A', window: 2 },
  right: { text: 'A little to the right.', key: 'D', window: 2 },
};
export const STILL_GRACE = 0.3; // s a W or S already held when "right there" starts may take to let go
const DEFAULT = { every: [4, 8], weights: { lighter: 1, harder: 1, still: 1, left: 0.5, right: 0.5 } };

// One caller per client: its own seeded stream, so the same run seed calls the same things.
export function createCaller(client, seed, idx) {
  const p = client.calls || DEFAULT;
  return {
    every: p.every || DEFAULT.every, weights: p.weights || DEFAULT.weights,
    rng: makeRng(hashSeed(`${seed}:${client.id}:${idx}:calls`)),
    wait: 0, call: null, log: [],
  };
}

// Seconds until the next call (the gap starts once the previous call is answered).
export function nextGap(k) { return k.rng.range(k.every[0], k.every[1]); }

export function pickCall(k, force = null) {
  if (force) return force;
  const w = k.weights, names = Object.keys(CALLS).filter((n) => w[n] > 0);
  let r = k.rng.next() * names.reduce((s, n) => s + w[n], 0);
  for (const n of names) { r -= w[n]; if (r <= 0) return n; }
  return names[names.length - 1];
}

// A fresh call, not yet open: its window starts when the line starts speaking (openCall).
export function makeCall(name) {
  return { name, ...CALLS[name], open: false, t: 0, held: 0, result: null, answer: null };
}
export function openCall(c) { c.open = true; c.t = 0; c.held = 0; }

const W = (p) => p.has('KeyW') || p.has('ArrowUp');
const Sk = (p) => p.has('KeyS') || p.has('ArrowDown');
const A = (p) => p.has('KeyA') || p.has('ArrowLeft');
const D = (p) => p.has('KeyD') || p.has('ArrowRight');

// One tick of an open call. Returns null while undecided, else { correct, late, answer }.
export function judge(c, input, dt) {
  c.t += dt;
  const p = (input && input.pressed) || new Set();
  const fw = !!(input && input.forward), bk = !!(input && input.back);
  // A key already held when the call opens never fires a pressed edge (nitpick 2026-09-25): the held
  // level counts as the answer too, so easing off on S when they say "lighter" is right, not late.
  const lf = !!(input && input.left), rt = !!(input && input.right);
  const done = (correct, answer, late = false) => ({ correct, late, answer });
  switch (c.name) {
    case 'lighter':
      if (Sk(p) || bk) return done(true, 'S');
      if (W(p)) return done(false, 'W');
      break;
    case 'harder':
      if (Sk(p)) return done(false, 'S');
      c.held = fw ? c.held + dt : 0;
      if (c.held >= c.hold) return done(true, 'W');
      break;
    case 'still':
      if (W(p) || Sk(p) || ((fw || bk) && c.t > STILL_GRACE)) return done(false, W(p) || fw ? 'W' : 'S');
      if (c.t >= c.window) return done(true, 'none');
      return null;
    case 'left':
      if (A(p) || lf) return done(true, 'A');
      if (D(p)) return done(false, 'D');
      break;
    case 'right':
      if (D(p) || rt) return done(true, 'D');
      if (A(p)) return done(false, 'A');
      break;
    default: break;
  }
  if (c.t >= c.window) return done(false, fw ? 'W' : bk ? 'S' : 'none', true);
  return null;
}

// While a left / right call exists, A/D answer it instead of cycling the modality. Keyed on the call
// existing, not on `open`: the bubble opens it at the end of the tick it was asked, and an A/D edge
// on that tick would otherwise cycle the modality and be lost as an answer (nitpick 2026-09-25).
export const takesAD = (c) => !!c && (c.name === 'left' || c.name === 'right');
