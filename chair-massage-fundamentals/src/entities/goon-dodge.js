// A goon's wind-up is a call (DESIGN.md, ruled 2026-09-25). When a goon winds up on the player on
// foot (bat, shove, grab), the course's key cue shows over him: the S keycap and a bar draining
// with the wind-up (hud-dodge.js draws it from ctx.dodge). Tapping S inside the wind-up, or up to
// BUFFER s before it started, backsteps about 2 m straight away from him (player-move.js backstep)
// and the strike whiffs; he staggers STAGGER s on top of his recover, and his cooldown grows by the
// same, which is the Healing Palm's charge window: dodge, counter, TREATED. Any other key or none
// is a miss and he connects as before; S after the strike landed (within LATE s) is 'late'.
// Pull-outs and bats on a vehicle (goon-vehicle.js) are not calls: the player is not on foot.
// Watcher: `dodge` { who: 'goon', id, act: 'shown' | 'dodged' | 'miss' | 'late', ... }.
import { emit } from '../events.js';
import { backstep } from './player-move.js';
import { cancelCharge } from './palm.js';
import { sfx } from '../juice.js';

export const BUFFER = 0.15;   // s: an S tap this long before the wind-up starts still counts
export const STAGGER = 1;     // s: a whiffed goon stands there, then recovers as usual
const LATE = 0.5;             // s after the strike when an S tap is logged 'late' (else 'miss')
const FLASH = 0.45;           // s the cue stays up green (dodged) or red (hit) after it resolves
const RECOVER = 0.5, COOLDOWN = 1.5, GRAB_CD = 6;   // goon.js strike(): the recover and cooldowns

const r2 = (v) => Math.round(v * 100) / 100;

// RUN entry (wiring.js): no cues, no remembered tap.
export function resetDodge(ctx) { ctx.dodge = { lastS: -1e9, cues: [] }; }

function canDodge(p) {
  return !p.vehicle && !(p.knockedT > 0) && !p.massaging && !(p.lungeT > 0) && !(p.foldT > 0) && !(p.swingT >= 0);   // not mid-fold or mid-swing
}

// Backstep away from the goon whose strike comes soonest; he whiffs, and so does any other goon
// winding up on the far side of the same step (the step carries straight away from him too,
// within AWAY of it). The rest still swing: a second tap can take the next one.
const AWAY = 0.7;             // cos 45 degrees
function dodge(ctx, open, buffered) {
  const p = ctx.player, e = open.reduce((a, b) => (b.end < a.end ? b : a)).e;
  let dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z;
  const d = Math.hypot(dx, dz);
  if (d > 1e-3) { dx /= d; dz /= d; } else { dx = Math.sin(p.yaw || 0); dz = Math.cos(p.yaw || 0); }
  backstep(p, dx, dz);
  cancelCharge(p, 'dodge');
  sfx(ctx, 'whoosh', p.pos.x, p.pos.z, 0.7);
  for (const c of open) {
    if (c.e !== e) {
      const ox = p.pos.x - c.e.pos.x, oz = p.pos.z - c.e.pos.z, od = Math.hypot(ox, oz) || 1;
      if ((ox * dx + oz * dz) / od < AWAY) continue;
    }
    c.dodged = true; c.doneAt = ctx.time;
    emit('dodge', { who: 'goon', id: c.id, act: 'dodged', kind: c.kind, buffered, at: r2(ctx.time - c.t0), window: c.win });
  }
}

// goon.js chase(): the wind-up just started (e.stateT is its length).
export function dodgeOpen(e, ctx) {
  const D = ctx.dodge, p = ctx.player;
  if (!D || p.vehicle) return;
  const kind = e.grab ? 'grab' : e.bat ? 'bat' : 'shove';
  const c = { e, id: e.id, kind, t0: ctx.time, end: ctx.time + e.stateT, win: r2(e.stateT), dodged: false, struckAt: null, doneAt: null };
  D.cues.push(c);
  emit('dodge', { who: 'goon', id: e.id, act: 'shown', kind, window: c.win });
  if (ctx.time - D.lastS <= BUFFER + 1e-6 && canDodge(p)) dodge(ctx, [c], true);
}

// goon.js strike(), first thing: true when the player dodged this wind-up (the strike whiffs and
// the goon staggers; strike() returns at once), false to strike as before.
export function dodgeWhiff(e, ctx) {
  const D = ctx.dodge;
  const c = D && D.cues.find((q) => q.e === e && q.struckAt === null);
  if (!c) return false;
  c.struckAt = ctx.time;
  if (!c.dodged) return false;
  e.state = 'recover'; e.stateT = RECOVER;
  e.cooldown = (e.grab ? GRAB_CD : COOLDOWN) + STAGGER;
  e.stunT = STAGGER;                      // goon.js: no movement, no attack, the stagger pose
  sfx(ctx, 'whoosh', e.pos.x, e.pos.z, 0.5);
  if (ctx.hud && ctx.hud.floater) ctx.hud.floater('whiff', e.pos.x, e.pos.y + 1.9, e.pos.z, 'speech dim');
  return true;
}

// Per tick from updatePlayer, before anything else: remember an S tap, dodge the open cues,
// resolve struck cues to 'miss' or 'late', drop cancelled ones (the goon was stunned, knocked down
// or treated mid-wind-up: no strike came) and finished flashes.
export function dodgeInput(p, ctx, input) {
  const D = ctx.dodge;
  if (!D) return;
  const tap = !!(input && input.pressed && (input.pressed.has('KeyS') || input.pressed.has('ArrowDown')));
  if (tap) D.lastS = ctx.time;
  let lateUsed = false;
  for (let i = D.cues.length - 1; i >= 0; i--) {
    const c = D.cues[i], e = c.e;
    if (c.struckAt === null && !c.dodged && (e.state !== 'windup' || e.knockedT > 0 || e.dead)) { D.cues.splice(i, 1); continue; }
    if (c.struckAt !== null && !c.dodged && c.doneAt === null) {
      const hit = (p.hurtAt ?? -1) >= c.struckAt;
      if (tap && !lateUsed && ctx.time - c.struckAt <= LATE) {
        lateUsed = true; c.doneAt = ctx.time;
        emit('dodge', { who: 'goon', id: c.id, act: 'late', kind: c.kind, hit, after: r2(ctx.time - c.struckAt) });
      } else if (ctx.time - c.struckAt > LATE) {
        c.doneAt = ctx.time;
        emit('dodge', { who: 'goon', id: c.id, act: 'miss', kind: c.kind, hit });
      }
    }
    if (c.doneAt !== null && ctx.time - c.doneAt > FLASH && (c.struckAt !== null || e.state !== 'windup')) D.cues.splice(i, 1);
  }
  if (!tap || !canDodge(p)) return;
  const open = D.cues.filter((c) => !c.dodged && c.struckAt === null);
  if (open.length) dodge(ctx, open, false);
}

// The open calls, for the snapshot and the agent: [{ id, kind, left }] (s left in the wind-up).
export function openDodges(ctx) {
  const D = ctx.dodge;
  if (!D) return [];
  return D.cues.filter((c) => !c.dodged && c.struckAt === null).map((c) => ({ id: c.id, kind: c.kind, left: r2(Math.max(0, c.end - ctx.time)) }));
}
