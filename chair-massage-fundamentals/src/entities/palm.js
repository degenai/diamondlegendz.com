// The Healing Palm (the only player weapon, Chex Quest rules) plus player health.
// Ruled 2026-09-24 ("fighting is fruitless ... a telegraphed charge attack, and he says HEALING
// PALM like Falcon Punch"): hold left click to charge for 0.7 s. The player plants, the right arm
// winds back, a ring fills on the HUD, and once the hold is more than a tap he shouts "HEALING
// PALM". The charge completing launches a 3 m lunge and the strike: the target is TREATED (sits
// 20 s on the spot, then walks off loose and stays out of the chase for 90 s). A bat hit or a
// shove during the charge cancels it: the wind-up is the risk. Letting go early (or a plain tap)
// is the quick palm: 0.25 s wind-up, a 1.6 m / 60 degree cone, knockdown 3 s, relaxed rise, no
// treatment. Health: 100, regenerates 2/s after 8 s without damage, death at 0.
import { palmVehicles } from './interact.js';
import { lineOfSight } from './npc-nav.js';
import { emitChaos } from '../run/wanted.js';
import { endRun } from '../run/end.js';
import { sfx, knockFx, shake } from '../juice.js';
import { emit } from '../events.js';
import { say as bubble } from '../bubbles.js';
import { setCharge } from '../hud-run.js';

const WIND = 0.25;
const REACH = 1.6;
const CONE_COS = Math.cos(Math.PI / 6);   // 60 degree cone = +-30
const KNOCK = 3;
const KNOCK_PUSH = 5.7;                   // with 8 m/s^2 slide decel: ~2 m of knockback
const SHAKE = 0.15;
const REGEN_DELAY = 8;
const REGEN = 2;
const LUNGE = 3.5;
export const CHARGE = 0.7;                // s of hold for a charged palm
const TAP = 0.18;                         // a hold shorter than this is a tap: no shout
const LUNGE_D = 3, LUNGE_T = 0.22;        // the charged lunge: 3 m in 0.22 s
export const TREAT_SIT = 20;              // s sitting where he was treated
export const TREAT_OUT = 90;              // s out of the chase after that
export const SHOUT = 'HEALING PALM';

export function startPalm(p) {
  if (p.palmT > 0 || p.knockedT > 0 || p.vehicle || p.massaging) return false;
  p.palmT = WIND;
  // Strike where the camera looks (the body may be facing its last walk direction).
  p.yaw = Math.atan2(-Math.sin(p.camYaw), -Math.cos(p.camYaw));
  return true;
}

// Left button down: start the charge (updatePalm follows the hold).
export function startCharge(p) {
  if (p.chargeT >= 0 || p.palmT > 0 || p.lungeT > 0 || p.knockedT > 0 || p.foldT > 0 || p.vehicle || p.massaging) return false;
  p.chargeT = 0; p.chargeShout = false;
  p.yaw = Math.atan2(-Math.sin(p.camYaw), -Math.cos(p.camYaw));
  emit('palm', { phase: 'charge' });
  return true;
}

// A bat or a shove during the charge (hurtPlayer), a knockdown, or getting in a car.
export function cancelCharge(p, cause) {
  if (!(p.chargeT >= 0)) return;
  emit('palm', { phase: 'cancel', cause, at: Math.round(p.chargeT * 100) / 100 });
  p.chargeT = -1; p.chargeShout = false;
  setCharge(null);
}

function landHit(p, ctx, hit, charged) {
  const dx = hit.pos.x - p.pos.x, dz = hit.pos.z - p.pos.z, d = Math.hypot(dx, dz) || 1;
  p.shakeT = SHAKE;
  ctx.grabUntil = 0;                        // the first palm brings the bats out (goon.js)
  knockFx(ctx, hit, p);
  if (charged) {
    emit('palm', { target: hit.kind, charged: true });
    if (hit.onPalm) hit.onPalm(hit, p, ctx);
    treat(hit, ctx, dx / d, dz / d);
    sfx(ctx, 'pay', hit.pos.x, hit.pos.z);
  } else {
    hit.knockedT = KNOCK;
    hit.knockCause = 'palm';
    emit('palm', { target: hit.kind });
    hit.vel.x = (dx / d) * KNOCK_PUSH; hit.vel.z = (dz / d) * KNOCK_PUSH; hit.vel.y = 1.5;
    hit.grounded = false;
    sfx(ctx, 'thud', hit.pos.x, hit.pos.z);
    if (ctx.hud && ctx.hud.floater) ctx.hud.floater('THUD', hit.pos.x, hit.pos.y + 1.6, hit.pos.z, 'thud');
    if (hit.onPalm) hit.onPalm(hit, p, ctx);
  }
  emitChaos(ctx, hit.pos.x, hit.pos.z, 'palm');
}

// TREATED: a short push, then he sits where he is for TREAT_SIT s (the entity's own update runs
// the state: goon.js, cop.js, ped.js), walks off loose and stays out for TREAT_OUT s after that.
export function treat(e, ctx, dirX = 0, dirZ = 0) {
  e.knockedT = 0; e.stunT = 0; e.gunTaps = 0;
  e.state = 'treated'; e.stateT = TREAT_SIT; e.treatedAt = ctx.time; e.outUntil = ctx.time + TREAT_SIT + TREAT_OUT;
  e.loose = 1; e.dispatch = null; e.hang = false; e.idle = false;
  e.vel.x = dirX * 2.5; e.vel.z = dirZ * 2.5;
  if (e.seek) { e.seek.nav = -1; e.seek.t = 0; }
  if (ctx.hud && ctx.hud.floater) ctx.hud.floater('TENSION RELEASED', e.pos.x, e.pos.y + 2.3, e.pos.z, 'released');
  if (ctx.runStats) ctx.runStats.tension++;
  emit('treat', { target: e.kind, rank: e.rank || null });
}

// Per tick from updatePlayer (on foot). `hold`: the left button is down (or a test's p.holdPalm).
// Returns the NPC hit on the strike tick, else null.
export function updatePalm(p, dt, ctx, hold = false) {
  if (p.shakeT > 0) p.shakeT = Math.max(0, p.shakeT - dt);
  if (p.knockedT > 0) { cancelCharge(p, 'knockdown'); p.palmT = 0; p.lungeT = 0; return null; }
  if (p.chargeT >= 0) {
    p.chargeT += dt;
    if (!p.chargeShout && p.chargeT >= TAP && hold) {
      p.chargeShout = true;
      bubble(ctx, p, SHOUT, { skin: 'run', preset: 'player', kind: 'shout' });
      emit('palm', { phase: 'shout' });
    }
    setCharge(Math.min(1, p.chargeT / CHARGE));
    if (p.chargeT >= CHARGE) {
      // Charged: the lunge; the strike lands on the first body in the cone along the way.
      p.chargeT = -1; setCharge(null);
      p.lungeT = LUNGE_T;
      p.elbowT = LUNGE_T + 0.2;
      emit('palm', { phase: 'lunge' });
    } else if (ctx.input && ctx.input.locked === false) {
      // Pointer lock lost mid-charge (Esc, tab switch): that is not a release, cancel cleanly.
      cancelCharge(p, 'unlocked');
    } else if (!hold) {
      // Let go early: the quick palm, its wind-up already partly done.
      const held = p.chargeT;
      p.chargeT = -1; setCharge(null);
      p.palmT = Math.max(0.05, WIND - held);
    }
    return null;
  }
  if (p.lungeT > 0) {
    p.lungeT -= dt;
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), v = LUNGE_D / LUNGE_T;
    p.vel.x = fx * v; p.vel.z = fz * v;
    const hit = palmTarget(p, ctx, fx, fz);
    if (hit || p.lungeT <= 0) {
      p.lungeT = 0; p.vel.x = fx * 2; p.vel.z = fz * 2;
      p.lastPalm = { t: ctx.time, hit: hit ? hit.kind : null, charged: true, treated: !!hit };
      if (hit) landHit(p, ctx, hit, true);
      else vehicles(p, ctx, fx, fz, false);
      return hit;
    }
    return null;
  }
  if (!(p.palmT > 0)) return null;
  p.palmT -= dt;
  if (p.palmT > 0) return null;
  p.palmT = 0;
  p.elbowT = 0.2;
  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
  p.vel.x += fx * LUNGE; p.vel.z += fz * LUNGE;
  const hit = palmTarget(p, ctx, fx, fz);
  p.lastPalm = { t: ctx.time, hit: hit ? hit.kind : null };
  if (hit) landHit(p, ctx, hit, false);
  vehicles(p, ctx, fx, fz, !!hit);
  return hit;
}

function vehicles(p, ctx, fx, fz, hit) {
  const v = palmVehicles(p, ctx);
  if (!v) return;
  p.shakeT = SHAKE;
  shake(ctx, 0.2);
  if (!hit) sfx(ctx, 'thud', p.pos.x + fx, p.pos.z + fz, 0.7);
  if (ctx.wanted) ctx.wanted.report('propertyHit');
  if (!hit && ctx.hud && ctx.hud.floater) ctx.hud.floater('THUD', p.pos.x + fx, p.pos.y + 1.3, p.pos.z + fz, 'thud');
}

function palmTarget(p, ctx, fx, fz) {
  const list = ctx.npcs;
  if (!list) return null;
  let best = null, bd = Infinity;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (e.knockedT > 0 || e.state === 'kneel' || e.state === 'treated' || e.state === 'out' || Math.abs(e.pos.y - p.pos.y) > 1.2) continue; // never palm your own client, nor a treated man walking off
    const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z, d2 = dx * dx + dz * dz;
    const r = REACH + e.radius;
    if (d2 > r * r || d2 >= bd) continue;
    const d = Math.sqrt(d2);
    if (d > 0.3 && (dx * fx + dz * fz) < CONE_COS * d) continue;
    if (ctx.world && !lineOfSight(ctx.world, p.pos, e.pos)) continue; // no palms through walls
    best = e; bd = d2;
  }
  return best;
}

// Damage the player (goon bat / shove). knockT > 0 knocks them down.
export function hurtPlayer(ctx, dmg, knockT, dirX, dirZ, push, src = 'hit') {
  const p = ctx.player;
  if (p.vehicle) return;
  p.hurtSrc = src;                            // the watcher's damage event names it (updateHealth)
  if (knockT > 0 && !(p.knockedT > 0)) emit('knockdown', { who: 'player', cause: src });
  p.hp = Math.max(0, p.hp - dmg);
  p.hurtAt = ctx.time;
  if (knockT > 0) { p.knockedT = Math.max(p.knockedT, knockT); p.palmT = 0; }
  if (dmg > 0) cancelCharge(p, src);            // the wind-up is the risk
  p.vel.x += dirX * push; p.vel.z += dirZ * push;
  p.shakeT = SHAKE;
}

// Per tick (on foot and driving): regen, any damage taken elsewhere (vehicles), death.
export function updateHealth(p, dt, ctx) {
  if (p.prevHp === undefined) p.prevHp = p.hp;
  if (p.hp < p.prevHp - 1e-6) { p.hurtAt = ctx.time; emit('damage', { source: p.hurtSrc || (p.hitBy ? p.hitBy.spec.label : 'crash'), amount: Math.round(p.prevHp - p.hp), hp: Math.round(p.hp) }); p.hurtSrc = null; }
  if (p.hp > 0 && p.hp < 100 && ctx.time - (p.hurtAt ?? -1e9) >= REGEN_DELAY) p.hp = Math.min(100, p.hp + REGEN * dt);
  p.prevHp = p.hp;
  if (p.hp <= 0 && !ctx.runEnd) endRun(ctx, 'death');
}

// After the camera is placed: a short random jolt.
export function applyShake(p, camera) {
  if (!(p.shakeT > 0) || !camera) return;
  const k = (p.shakeT / SHAKE) * 0.12;
  camera.position.x += (Math.random() - 0.5) * k;
  camera.position.y += (Math.random() - 0.5) * k;
  camera.position.z += (Math.random() - 0.5) * k;
}
