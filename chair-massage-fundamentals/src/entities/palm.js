// The Healing Palm (the only player weapon, Chex Quest rules) plus player health.
// Left click: 0.25 s wind-up, then a lunge and a 1.6 m / 60 degree cone hit on the nearest NPC
// (knockback 2 m, knockdown 3 s, relaxed rise) and a dent on any vehicle in front. THUD floater,
// 0.15 s screen shake. Health: 100, regenerates 2/s after 8 s without damage, death at 0.
import { palmVehicles } from './interact.js';
import { lineOfSight } from './npc-nav.js';
import { emitChaos } from '../run/wanted.js';
import { endRun } from '../run/end.js';

const WIND = 0.25;
const REACH = 1.6;
const CONE_COS = Math.cos(Math.PI / 6);   // 60 degree cone = +-30
const KNOCK = 3;
const KNOCK_PUSH = 5.7;                   // with 8 m/s^2 slide decel: ~2 m of knockback
const SHAKE = 0.15;
const REGEN_DELAY = 8;
const REGEN = 2;
const LUNGE = 3.5;

export function startPalm(p) {
  if (p.palmT > 0 || p.knockedT > 0 || p.vehicle || p.massaging) return false;
  p.palmT = WIND;
  // Strike where the camera looks (the body may be facing its last walk direction).
  p.yaw = Math.atan2(-Math.sin(p.camYaw), -Math.cos(p.camYaw));
  return true;
}

// Per tick from updatePlayer (on foot). Returns the NPC hit on the strike tick, else null.
export function updatePalm(p, dt, ctx) {
  if (p.shakeT > 0) p.shakeT = Math.max(0, p.shakeT - dt);
  if (!(p.palmT > 0)) return null;
  if (p.knockedT > 0) { p.palmT = 0; return null; }
  p.palmT -= dt;
  if (p.palmT > 0) return null;
  p.palmT = 0;
  p.elbowT = 0.2;
  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
  p.vel.x += fx * LUNGE; p.vel.z += fz * LUNGE;
  const hit = palmTarget(p, ctx, fx, fz);
  p.lastPalm = { t: ctx.time, hit: hit ? hit.kind : null };
  if (hit) {
    const dx = hit.pos.x - p.pos.x, dz = hit.pos.z - p.pos.z, d = Math.hypot(dx, dz) || 1;
    hit.knockedT = KNOCK;
    hit.knockCause = 'palm';
    hit.vel.x = (dx / d) * KNOCK_PUSH; hit.vel.z = (dz / d) * KNOCK_PUSH; hit.vel.y = 1.5;
    hit.grounded = false;
    p.shakeT = SHAKE;
    if (ctx.hud && ctx.hud.floater) ctx.hud.floater('THUD', hit.pos.x, hit.pos.y + 1.6, hit.pos.z, 'thud');
    if (hit.onPalm) hit.onPalm(hit, p, ctx);
    emitChaos(ctx, hit.pos.x, hit.pos.z, 'palm');
  }
  const v = palmVehicles(p, ctx);
  if (v) {
    p.shakeT = SHAKE;
    if (ctx.wanted) ctx.wanted.report('propertyHit');
    if (!hit && ctx.hud && ctx.hud.floater) ctx.hud.floater('THUD', p.pos.x + fx, p.pos.y + 1.3, p.pos.z + fz, 'thud');
  }
  return hit;
}

function palmTarget(p, ctx, fx, fz) {
  const list = ctx.npcs;
  if (!list) return null;
  let best = null, bd = Infinity;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (e.knockedT > 0 || Math.abs(e.pos.y - p.pos.y) > 1.2) continue;
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
export function hurtPlayer(ctx, dmg, knockT, dirX, dirZ, push) {
  const p = ctx.player;
  if (p.vehicle) return;
  p.hp = Math.max(0, p.hp - dmg);
  p.hurtAt = ctx.time;
  if (knockT > 0) { p.knockedT = Math.max(p.knockedT, knockT); p.palmT = 0; }
  p.vel.x += dirX * push; p.vel.z += dirZ * push;
  p.shakeT = SHAKE;
}

// Per tick (on foot and driving): regen, any damage taken elsewhere (vehicles), death.
export function updateHealth(p, dt, ctx) {
  if (p.prevHp === undefined) p.prevHp = p.hp;
  if (p.hp < p.prevHp - 1e-6) p.hurtAt = ctx.time;
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
