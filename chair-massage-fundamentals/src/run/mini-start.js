// The mini-massage's two E actions (interact.js calls them): set the chair down, and start the
// hold once a client kneels. The rest of the mini-massage (the client walking over, the hold, the
// pay, interruptions) is minimassage.js. Split out (refactor/split) so interact.js no longer
// imports minimassage.js, which reaches the goons.
import { findChair, chairState } from '../entities/chair.js';
import { floorHeightAt, overlapsFootprint } from '../physics.js';
import { boxDistance } from '../entities/vehicle-collide.js';
import { THERAPIST } from '../massage/stage.js';
import { sfx } from '../juice.js';
import { emit } from '../events.js';
import { createCaller, nextGap, MINI_CALLS } from '../massage/meter.js';

const SET_AT = 1.1;          // m from him
const CHAIR_R = 0.45;        // the chair's footprint radius for the clearance check

// Room for the chair at (x, z): not inside a vehicle's footprint or a static collider standing
// above the floor it would sit on (the same test as a door spot, interact.js spotFree).
function roomAt(ctx, x, z, y) {
  for (const c of ctx.world.colliders) {
    if (c.camOnly || c.maxY <= y + 0.35) continue;
    if (overlapsFootprint({ x, z }, CHAIR_R, c)) return false;
  }
  for (const v of ctx.world.vehicles || []) {
    if (!v.removed && Math.abs(v.pos.y - y) < 1.5 && boxDistance(v, x, z) < CHAIR_R) return false;
  }
  return true;
}

// Set it down SET_AT in front of him; if that spot is inside a car or a wall, to his left, then
// his right, then behind him (beside a car, ruled 2026-09-25, the front is often the car). No
// room anywhere: refused, a floater says so, the chair stays on his back.
export function setChairDown(p, ctx) {
  const c = findChair(ctx);
  if (!c) return false;
  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
  let x = 0, z = 0, y = 0, ok = false;
  for (const [dx, dz] of [[fx, fz], [fz, -fx], [-fz, fx], [-fx, -fz]]) {     // front, left, right, behind
    x = p.pos.x + dx * SET_AT; z = p.pos.z + dz * SET_AT;
    y = floorHeightAt(x, z, ctx.world.colliders, p.pos.y + 0.3);
    if (Math.abs(y - p.pos.y) < 0.6 && roomAt(ctx, x, z, y)) { ok = true; break; }
  }
  if (!ok) {
    if (ctx.hud && ctx.hud.floater) ctx.hud.floater('no room for the chair here', p.pos.x, p.pos.y + 2.1, p.pos.z, 'speech dim');
    return false;
  }
  ctx.scene.add(c);
  c.position.set(x, y, z);
  c.rotation.set(0, p.yaw + Math.PI, 0);          // face cradle (chair -Z) away from the player
  const home = ctx.world._chairHome;
  if (home) c.scale.copy(home.scale); else c.scale.set(1, 1, 1);
  Object.assign(chairState(ctx.world), { where: 'ground', vehicle: null, setDown: true });
  emit('chair', { act: 'setdown', where: 'ground' });
  const M = ctx.mini;
  M.phase = 'waiting'; M.cool = 0.5; M.chairYaw = p.yaw + Math.PI; M.pos.set(x, y, z);
  sfx(ctx, 'chairFold', x, z);
  return true;
}

// E at the chair with a client kneeling: start the hold.
export function canStart(p, ctx) {
  const M = ctx.mini;
  if (!M || M.phase !== 'ready' || p.vehicle) return false;
  return (p.pos.x - M.pos.x) ** 2 + (p.pos.z - M.pos.z) ** 2 < 2.6 * 2.6;
}

export function startMassage(p, ctx) {
  const M = ctx.mini;
  if (!canStart(p, ctx)) return false;
  M.phase = 'massage'; M.progress = 0; M.t = 0; M.startT = ctx.time;
  // The ped's calls: seeded per run seed, ped and attempt (a ped who walked off may come back).
  M.caller = createCaller(M.client, ctx.seed, `run:${(ctx.meta && ctx.meta.runs) || 0}:${M.tries++}`, MINI_CALLS);
  M.caller.wait = nextGap(M.caller);
  M.misses = 0; M.flash = null; M.flashT = 0;
  p.massaging = true;
  emit('mini', { phase: 'start', sore: !!(M.client && M.client.sore) });
  p.vel.set(0, 0, 0);
  // Stand at the therapist's spot beside the chair, facing the client's back.
  const s = Math.sin(M.chairYaw), c = Math.cos(M.chairYaw);
  p.pos.x = M.pos.x + THERAPIST.x * c + THERAPIST.z * s;
  p.pos.z = M.pos.z - THERAPIST.x * s + THERAPIST.z * c;
  p.yaw = M.chairYaw + THERAPIST.yaw;
  return true;
}
