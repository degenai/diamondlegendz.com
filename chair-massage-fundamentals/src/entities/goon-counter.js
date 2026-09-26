// The counter is Q (DESIGN.md "The fight tilts toward Arkham", ruling 1, 2026-09-25; it replaces
// "A goon's wind-up is a call" and its S backstep). When a goon winds up on the player on foot (bat,
// shove, grab), the cue shows over him: the Q keycap and a bar draining with the wind-up
// (hud-counter.js draws it from ctx.counter). The window is the wind-up (WIND, on foot) plus BUFFER s
// before it: about 0.6 s.
//   Tap Q inside it: the player slips the swing and drops him with a palm strike, the quick palm's
//   outcome (palm.js landHit: down 3 s, relaxed rise, no treatment). The tap resolves on release.
//   Hold Q through it (still down HOLD_MIN s after the press when his strike comes): the strike is
//   caught, he stands there (a stagger), the player is planted, and on the release (or HOLD_MAX s
//   after the catch) he says HEALING PALM and the goon is TREATED, the charged palm's outcome.
// Anything else is a miss and he connects as before; Q within LATE s after the strike is 'late'.
// Pull-outs and bats on a vehicle (goon-vehicle.js) are not counterable (ruled): not on foot.
// Watcher: `counter` { who: 'goon', id, act: 'shown' | 'tap' | 'hold' | 'miss' | 'late', kind }.
import { emit } from '../events.js';
import { cancelCharge, landHit, SHOUT } from './palm.js';
import { setCharge } from '../hud-run.js';
import { say as bubble } from '../bubbles.js';
import { sfx } from '../juice.js';

export const WIND = 0.45;     // s: a goon's wind-up on the player on foot (was 0.4 bat, 0.3 shove)
export const BUFFER = 0.15;   // s: a Q press this long before the wind-up starts still counts
const HOLD_MIN = 0.2;         // s of Q down at his strike for the counter to be a hold, not a tap
const HOLD_MAX = 0.8;         // s after the catch when a still-held counter fires anyway
const LATE = 0.5;             // s after the strike when a Q press is logged 'late' (else 'miss')
const FLASH = 0.45;           // s the cue stays up after it resolves

const r2 = (v) => Math.round(v * 100) / 100;
const isQ = (set) => !!(set && set.has('KeyQ'));

// RUN entry (wiring.js): no cues, no remembered press.
export function resetCounter(ctx) { ctx.counter = { pressAt: -1e9, used: true, held: false, cues: [], hold: null }; }

function canCounter(p) {
  return !p.vehicle && !(p.knockedT > 0) && !p.massaging && !(p.lungeT > 0) && !(p.foldT > 0) && !(p.swingT >= 0);
}

// The quick counter: face him, slip, drop him (the quick palm's hit).
function strikeBack(ctx, c, charged) {
  const p = ctx.player, e = c.e;
  p.yaw = Math.atan2(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
  cancelCharge(p, 'counter'); p.palmT = 0;
  p.elbowT = charged ? 0.4 : 0.2;
  sfx(ctx, 'whoosh', p.pos.x, p.pos.z, 0.7);
  if (charged) bubble(ctx, p, SHOUT, { skin: 'run', preset: 'player', kind: 'shout' });
  if (e.state === 'windup') e.state = 'recover';
  landHit(p, ctx, e, charged);
  e.turnDone = true;                       // goon-turns.js: the token passes
  c.done = charged ? 'hold' : 'tap'; c.doneAt = ctx.time;
  emit('counter', { who: 'goon', id: c.id, act: c.done, kind: c.kind, at: r2((c.armedAt ?? ctx.time) - c.t0), window: c.win });
}

// goon.js chase(): the wind-up just started (e.stateT is its length).
export function counterOpen(e, ctx) {
  const D = ctx.counter, p = ctx.player;
  if (!D || p.vehicle) return;
  const kind = e.grab ? 'grab' : e.bat ? 'bat' : 'shove';
  const c = { e, id: e.id, kind, t0: ctx.time, end: ctx.time + e.stateT, win: r2(e.stateT + BUFFER), armedAt: null, struckAt: null, done: null, doneAt: null };
  D.cues.push(c);
  emit('counter', { who: 'goon', id: e.id, act: 'shown', kind, window: c.win });
  if (!D.used && ctx.time - D.pressAt <= BUFFER + 1e-6 && canCounter(p)) arm(ctx, c);
}

function arm(ctx, c) {
  const D = ctx.counter;
  D.used = true; c.armedAt = D.pressAt;
  if (!D.held) strikeBack(ctx, c, false);  // pressed and let go already (a buffered tap)
}

// goon.js strike(), first thing: true when the counter took this strike (it never lands).
export function counterCatch(e, ctx) {
  const D = ctx.counter;
  const c = D && D.cues.find((q) => q.e === e && q.struckAt === null && !q.done);
  if (!c) return false;
  c.struckAt = ctx.time;
  if (c.armedAt === null) return false;
  if (!D.held || ctx.time - c.armedAt < HOLD_MIN) { strikeBack(ctx, c, false); return true; }
  e.state = 'recover'; e.stateT = HOLD_MAX + 0.2; e.stunT = HOLD_MAX + 0.2;   // caught: he stands there
  D.hold = { c, at: ctx.time };
  return true;
}

// Per tick from updatePlayer, before anything else.
export function counterInput(p, ctx, input) {
  const D = ctx.counter;
  if (!D) return;
  const press = isQ(input && input.pressed), release = isQ(input && input.released);
  if (press) { D.pressAt = ctx.time; D.used = false; D.held = true; }
  if (release || (input && input.keys && !input.keys.has('KeyQ') && !press)) D.held = false;
  // A caught swing: planted until the release, then the charged counter.
  if (D.hold) {
    const h = D.hold, e = h.c.e;
    if (!canCounter(p) || e.knockedT > 0 || e.state === 'treated' || e.state === 'out') { D.hold = null; p.counterHold = false; setCharge(null); e.stunT = 0; h.c.done = 'miss'; h.c.doneAt = ctx.time; emit('counter', { who: 'goon', id: h.c.id, act: 'miss', kind: h.c.kind, hit: false, broken: true }); }
    else if (!D.held || ctx.time - h.at >= HOLD_MAX) { D.hold = null; p.counterHold = false; setCharge(null); strikeBack(ctx, h.c, true); }
    else { p.counterHold = true; p.vel.x = p.vel.z = 0; setCharge(Math.min(1, (ctx.time - h.c.armedAt) / (h.c.end - h.c.armedAt + HOLD_MAX))); }
  } else p.counterHold = D.held && D.cues.some((c) => c.armedAt !== null && !c.done && ctx.time - c.armedAt >= HOLD_MIN);   // planted for the hold
  const open0 = D.cues.some((c) => !c.done && c.struckAt === null && c.armedAt === null);
  let lateUsed = open0;             // a press with a swing still coming counters that one instead
  for (let i = D.cues.length - 1; i >= 0; i--) {
    const c = D.cues[i], e = c.e;
    if (!c.done && c.struckAt === null && (e.state !== 'windup' || e.knockedT > 0 || e.dead)) { D.cues.splice(i, 1); continue; }   // stunned, knocked or treated mid-wind-up
    if (c.armedAt !== null && !c.done && c.struckAt === null && !D.held) { strikeBack(ctx, c, false); continue; }   // a tap, released in the window
    if (c.struckAt !== null && c.armedAt === null && !c.done) {
      const hit = (p.hurtAt ?? -1) >= c.struckAt;
      if (press && !lateUsed && ctx.time - c.struckAt <= LATE) {
        lateUsed = true; D.used = true; c.done = 'late'; c.doneAt = ctx.time;
        emit('counter', { who: 'goon', id: c.id, act: 'late', kind: c.kind, hit, after: r2(ctx.time - c.struckAt) });
      } else if (ctx.time - c.struckAt > LATE) {
        c.done = 'miss'; c.doneAt = ctx.time;
        emit('counter', { who: 'goon', id: c.id, act: 'miss', kind: c.kind, hit });
      }
    }
    if (c.doneAt !== null && ctx.time - c.doneAt > FLASH) D.cues.splice(i, 1);
  }
  if (!press || D.used || !canCounter(p)) return;   // a press this tick; an earlier one only counts through counterOpen's buffer
  const open = D.cues.filter((c) => !c.done && c.struckAt === null && c.armedAt === null);
  if (open.length) arm(ctx, open.reduce((a, b) => (b.end < a.end ? b : a)));   // the swing that lands first
}

// The open calls, for the snapshot and the agent: [{ id, kind, left }] (s left in the wind-up).
export function openCounters(ctx) {
  const D = ctx.counter;
  if (!D) return [];
  return D.cues.filter((c) => !c.done && c.struckAt === null && c.armedAt === null).map((c) => ({ id: c.id, kind: c.kind, left: r2(Math.max(0, c.end - ctx.time)) }));
}
