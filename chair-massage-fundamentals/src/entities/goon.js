// Serenity Group heavies. Pack pursuit: two chase straight at the player, one flanks to a point
// 6 m off the player's side and then closes. 5.5 m/s. Bat swing at 1.6 m (0.4 s wind-up, 20 dmg,
// 1.2 s knockdown) or an unarmed shove (10 dmg). A Healing Palm puts one down; he gets up loose,
// sits on the ground for 8 s, then his radio puts him back on. On-foot goons wait at the kerb
// while the player is in a vehicle.
import { spawnPerson, disposePerson } from '../world/people.js';
import { loadMesh } from '../assets.js';
import { createNpc, stepBody, poseRig, cull, say, seek } from './npc-common.js';
import { emitChaos } from '../run/wanted.js';
import { hurtPlayer } from './palm.js';

const RUN = 5.5;
const BAT_REACH = 1.6, SHOVE_REACH = 1.3;
const BAT_WIND = 0.4, SHOVE_WIND = 0.3;
const COOLDOWN = 1.5;
const FLANK_OFF = 6;
const SIT_TIME = 8;

export function createGoon(scene, pos, role, bat) {
  const mesh = spawnPerson('goon');
  scene.add(mesh);
  const e = createNpc('goon', mesh, pos, {
    role, bat, cooldown: 0.8, flankDone: false, update: updateGoon, onPalm, onVehicleHit,
    radius: 0.4,
  });
  e.state = 'chase';
  if (bat) {
    loadMesh('assets/bat.json').then((g) => {
      const b = g.getObjectByName('bat') || g;
      b.position.set(0, -0.27, 0.02);
      b.rotation.set(1.25, 0, 0);
      mesh.userData.joints.lowerArmR.add(b);
    }).catch((err) => console.warn('[CMF] bat failed', err));
  }
  return e;
}

export function disposeGoon(e, scene) { scene.remove(e.mesh); disposePerson(e.mesh); }

export function hostile(e) {
  return e.knockedT <= 0 && (e.state === 'chase' || e.state === 'windup' || e.state === 'recover');
}

export function updateGoon(e, dt, ctx) {
  const p = ctx.player;
  e.wishX = e.wishZ = 0; e.speed = 0; e.faceX = undefined;
  if (e.cooldown > 0) e.cooldown -= dt;
  e.noRoad = !!p.vehicle;
  if (e.knockedT > 0) {
    e.knockedT -= dt;
    if (e.knockedT <= 0) getUp(e, ctx);
  } else if (e.state === 'loose') {
    e.stateT -= dt;
    if (e.stateT <= 0) { e.state = 'sit'; e.stateT = SIT_TIME; say(ctx, e, '...I\'m gonna sit for a minute.'); }
  } else if (e.state === 'sit') {
    e.stateT -= dt;
    if (e.stateT <= 0) { e.state = 'chase'; e.loose = 0; say(ctx, e, '(radio) Copy. Back on it.', 'speech dim'); }
  } else if (e.state === 'windup') {
    e.stateT -= dt;
    e.faceX = p.pos.x; e.faceZ = p.pos.z;
    if (e.stateT <= 0) strike(e, ctx);
  } else if (e.state === 'recover') {
    e.stateT -= dt;
    if (e.stateT <= 0) e.state = 'chase';
  } else if (e.state === 'chase') {
    chase(e, dt, ctx);
  }
  e.pose = e.knockedT > 0 ? 'down' : e.state === 'sit' ? 'sit' : e.state === 'loose' ? 'loose'
    : e.state === 'windup' ? (e.bat ? 'windup' : 'shove') : e.state === 'recover' ? (e.bat ? 'swing' : 'shove') : 'walk';
  stepBody(e, dt, ctx);
  poseRig(e, dt);
  cull(e, ctx);
}

function chase(e, dt, ctx) {
  const p = ctx.player;
  const tgt = p.vehicle ? p.vehicle.pos : p.pos;
  const dx = tgt.x - e.pos.x, dz = tgt.z - e.pos.z, d2 = dx * dx + dz * dz;
  e.speed = RUN;
  if (!p.vehicle && p.knockedT <= 0) {
    const reach = e.bat ? BAT_REACH : SHOVE_REACH;
    if (d2 < reach * reach && e.cooldown <= 0 && Math.abs(p.pos.y - e.pos.y) < 1) {
      e.state = 'windup';
      e.stateT = e.bat ? BAT_WIND : SHOVE_WIND;
      return;
    }
  }
  let tx = tgt.x, tz = tgt.z;
  if (e.role === 'flank') {
    if (d2 > 14 * 14 && e.flankDone && (e.flankT || 0) <= 0) { e.flankDone = false; e.flankT = 8; }
    if (!e.flankDone) {
      e.flankT = (e.flankT ?? 8) - dt;
      if (e.flankT <= 0) e.flankDone = true;       // could not get round: just close in
      const d = Math.sqrt(d2) || 1;
      const side = e.id % 2 ? 1 : -1;
      const fx = tgt.x + (-dz / d) * FLANK_OFF * side, fz = tgt.z + (dx / d) * FLANK_OFF * side;
      const f2 = (fx - e.pos.x) ** 2 + (fz - e.pos.z) ** 2;
      if (f2 < 2.5 * 2.5 || d2 < 5 * 5) e.flankDone = true;
      else { tx = fx; tz = fz; }
    }
  }
  if (p.vehicle && d2 < 4 * 4) { e.faceX = tgt.x; e.faceZ = tgt.z; e.speed = 0; return; }
  seek(e, tx, tgt.y, tz, dt, ctx, e.bat ? 1.2 : 0.9);
  if (!e.wishX && !e.wishZ) { e.faceX = tgt.x; e.faceZ = tgt.z; }
}

function strike(e, ctx) {
  const p = ctx.player;
  const reach = (e.bat ? BAT_REACH : SHOVE_REACH) + 0.4;
  const dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z, d2 = dx * dx + dz * dz;
  e.state = 'recover';
  e.stateT = 0.5;
  e.cooldown = COOLDOWN;
  if (e.bat) emitChaos(ctx, e.pos.x, e.pos.z, 'batSwing');
  if (p.vehicle || d2 > reach * reach || p.knockedT > 0) return;
  const d = Math.sqrt(d2) || 1;
  if (e.bat) {
    hurtPlayer(ctx, 20, 1.2, dx / d, dz / d, 4);
    say(ctx, p, 'WHACK', 'thud');
  } else {
    hurtPlayer(ctx, 10, 0, dx / d, dz / d, 4);
    say(ctx, p, 'shove', 'speech dim');
  }
}

function getUp(e, ctx) {
  e.knockedT = 0;
  if (e.knockCause === 'palm') {
    e.state = 'loose'; e.stateT = 1.0; e.loose = 1;
  } else {
    e.state = 'chase';
  }
}

function onPalm(e, p, ctx) {
  if (ctx.wanted) ctx.wanted.report('goonHit');
  say(ctx, e, 'TENSION RELEASED', 'released');
}

function onVehicleHit(e, v, ctx) {
  e.knockCause = 'vehicle';
  e.knockedT = 3;
  if (e.state === 'windup') e.state = 'chase';
  if (v.driver === ctx.player && ctx.wanted) ctx.wanted.report('goonHit');
  emitChaos(ctx, e.pos.x, e.pos.z, 'vehicleHit');
}
