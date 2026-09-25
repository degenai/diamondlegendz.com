// The mini-massage's two E actions (interact.js calls them): set the chair down, and start the
// hold once a client kneels. The rest of the mini-massage (the client walking over, the hold, the
// pay, interruptions) is minimassage.js. Split out (refactor/split) so interact.js no longer
// imports minimassage.js, which reaches the goons.
import { findChair, chairState } from '../entities/chair.js';
import { floorHeightAt } from '../physics.js';
import { THERAPIST } from '../massage/stage.js';
import { sfx } from '../juice.js';
import { emit } from '../events.js';
import { createCaller, nextGap, MINI_CALLS } from '../massage/meter.js';

export function setChairDown(p, ctx) {
  const c = findChair(ctx);
  if (!c) return false;
  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
  const x = p.pos.x + fx * 1.1, z = p.pos.z + fz * 1.1;
  const y = floorHeightAt(x, z, ctx.world.colliders, p.pos.y + 0.3);
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
