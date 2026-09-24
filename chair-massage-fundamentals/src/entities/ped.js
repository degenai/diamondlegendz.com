// Pedestrians: wander the nav graph at 1.2 m/s with idle stops, flee chaos at 5 m/s for 6 s,
// tumble when a car hits them (then walk holding their back, sore), and get up relaxed after a
// Healing Palm. The mini-massage (run/minimassage.js) borrows them as clients.
import { spawnPerson, disposePerson } from '../world/people.js';
import { createNpc, stepBody, poseRig, cull, say } from './npc-common.js';
import { navInfo, nearestNav } from './npc-nav.js';
import { emitChaos } from '../run/wanted.js';

const WALK = 1.2;
const LOOSE_WALK = 0.85;
const SORE_WALK = 0.6;
const FLEE = 5;
const FLEE_TIME = 6;
const SORE_TIME = 10;
const LOOSE_TIME = 25;

export function createPed(scene, pos, navIdx, rng) {
  const mesh = spawnPerson('ped');
  scene.add(mesh);
  const e = createNpc('ped', mesh, pos, {
    navFrom: navIdx, navTo: navIdx, rng, fleeT: 0, fx: 0, fz: 0, idleT: rng.range(0, 2),
    paid: false, update: updatePed, flee: startFlee, onPalm, onVehicleHit,
  });
  e.yaw = rng.range(-Math.PI, Math.PI);
  e.state = 'wander';
  return e;
}

export function disposePed(e, scene) { scene.remove(e.mesh); disposePerson(e.mesh); }

function startFlee(e, x, z) {
  if (e.state === 'kneel' || e.state === 'toChair' || e.state === 'treated' || e.knockedT > 0) return;
  e.state = 'flee';
  e.fleeT = FLEE_TIME;
  e.fx = x; e.fz = z;
  e.navTo = -1;
}

// Among the neighbours of `from` (and itself), the nav point farthest from the threat.
function awayFrom(world, from, fx, fz) {
  const { adj, points } = navInfo(world);
  let best = from, bd = -1;
  const cands = adj[from];
  for (let i = -1; i < cands.length; i++) {
    const n = i < 0 ? from : cands[i];
    const d = (points[n].x - fx) ** 2 + (points[n].z - fz) ** 2;
    if (d > bd) { bd = d; best = n; }
  }
  return best;
}

function pickNext(e, world) {
  const { adj } = navInfo(world);
  const n = adj[e.navTo];
  if (!n || !n.length) return e.navTo;
  if (n.length === 1) return n[0];
  let k = n[Math.floor(e.rng.next() * n.length)];
  if (k === e.navFrom) k = n[Math.floor(e.rng.next() * n.length)];
  return k;
}

function walkNav(e, world, speed) {
  const pts = world.nav.points;
  if (e.navTo < 0) e.navTo = nearestNav(world, e.pos.x, e.pos.z);
  const p = pts[e.navTo];
  const dx = p.x - e.pos.x, dz = p.z - e.pos.z, d2 = dx * dx + dz * dz;
  if (d2 < 0.35 * 0.35) return true;
  const l = Math.sqrt(d2);
  e.wishX = dx / l; e.wishZ = dz / l;
  e.speed = speed;
  return false;
}

export function updatePed(e, dt, ctx) {
  const world = ctx.world;
  e.wishX = e.wishZ = 0;
  if (e.state === 'kneel') { e.vel.set(0, 0, 0); cull(e, ctx); return; } // posed by the mini-massage
  if (e.soreT > 0) e.soreT -= dt;
  if (e.loose > 0) e.loose -= dt;
  if (e.stunT > 0 && e.knockedT <= 0) {           // Gun stun (gun.js): a 1.5 s stagger, no movement, no attack.
    e.stunT -= dt;
    e.pose = 'stagger';
    stepBody(e, dt, ctx); poseRig(e, dt); cull(e, ctx);
    return;
  }
  if (e.knockedT > 0) {
    e.knockedT -= dt;
    if (e.knockedT <= 0) getUp(e, ctx);
  } else if (e.state === 'treated') {
    // A charged Healing Palm (palm.js treat): sits a while, then wanders loose.
    e.stateT -= dt;
    if (e.stateT <= 0) { e.state = 'wander'; e.loose = LOOSE_TIME; e.navTo = nearestNav(world, e.pos.x, e.pos.z); say(ctx, e, '...oh. Oh, that\'s better.'); }
  } else if (e.state === 'flee') {
    e.fleeT -= dt;
    if (e.fleeT <= 0) { e.state = 'wander'; e.navTo = nearestNav(world, e.pos.x, e.pos.z); }
    else if (e.navTo < 0 || walkNav(e, world, 0)) {
      const from = e.navTo < 0 ? nearestNav(world, e.pos.x, e.pos.z) : e.navTo;
      e.navFrom = from;
      e.navTo = awayFrom(world, from, e.fx, e.fz);
      if (e.navTo === from) { const n = navInfo(world).adj[from]; e.navTo = n[Math.floor(e.rng.next() * n.length)]; }
    }
    walkNav(e, world, e.soreT > 0 ? FLEE * 0.5 : FLEE);
  } else if (e.state === 'toChair' || e.state === 'leave') {
    // Steered by the mini-massage (wish + speed are set there before this update runs).
    e.wishX = e.cwX || 0; e.wishZ = e.cwZ || 0; e.speed = e.cSpeed || 0;
    if (e.state === 'leave') { e.stateT -= dt; if (e.stateT <= 0) { e.state = 'wander'; e.navTo = nearestNav(world, e.pos.x, e.pos.z); } }
  } else if (e.idleT > 0) {
    e.idleT -= dt;
  } else {
    const speed = e.soreT > 0 ? SORE_WALK : e.loose > 0 ? LOOSE_WALK : WALK;
    if (walkNav(e, world, speed)) {
      const next = pickNext(e, world);
      e.navFrom = e.navTo; e.navTo = next;
      if (e.rng.next() < 0.25) e.idleT = e.loose > 0 ? e.rng.range(3, 7) : e.rng.range(1, 4);
      walkNav(e, world, speed);
    }
  }
  e.pose = e.state === 'treated' ? 'sit' : e.soreT > 0 ? 'sore' : e.loose > 0 ? 'loose' : 'walk';
  stepBody(e, dt, ctx);
  poseRig(e, dt);
  cull(e, ctx);
}

function getUp(e, ctx) {
  e.knockedT = 0;
  if (e.state === 'treated') return;
  e.state = 'wander';
  e.navTo = nearestNav(ctx.world, e.pos.x, e.pos.z);
  if (e.knockCause === 'palm') {
    e.loose = LOOSE_TIME;
    say(ctx, e, '...oh. Oh, that\'s better.');
  } else if (e.knockCause === 'vehicle') {
    e.soreT = SORE_TIME;
    e.sore = true;
    say(ctx, e, 'Oh, my BACK.');
  }
}

function onPalm(e, p, ctx) {
  if (ctx.wanted) ctx.wanted.report('pedHurt');
  say(ctx, e, 'TENSION RELEASED', 'released');
  e.state = 'wander';
}

function onVehicleHit(e, v, ctx) {
  e.knockCause = 'vehicle';
  e.knockedT = 3;
  if (e.state === 'kneel' || e.state === 'toChair') e.state = 'wander';
  if (v.driver === ctx.player || (!v.driver && v.stolen)) {
    if (ctx.wanted) ctx.wanted.report('pedHurt');
  }
  emitChaos(ctx, e.pos.x, e.pos.z, 'vehicleHit');
}
