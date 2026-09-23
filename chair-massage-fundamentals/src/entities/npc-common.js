// Shared NPC plumbing: the plain-object body, steering + physics step (gravity, kerbs, static
// pushout from the nearby-collider grid, parked vehicles, separation), seek-with-nav-fallback,
// knockdown and the Chex Quest relaxed rise, and the procedural rig poses (walk, loose, sore,
// sit, swing). Behaviour modules (ped.js, goon.js, cop.js) own their state machines.
import * as THREE from '../../vendor/three.module.js';
import { resolveStatic, supportHeight, LAND_BAND } from '../physics.js';
import { vehicleCircles } from './vehicle-collide.js';
import { nearColliders, nearestNav, entryNav, nextHop, walkable, isRoad } from './npc-nav.js';

const GRAVITY = 18;
const ACCEL = 20;
const KNOCK_DECEL = 8;
const KNOCK_TILT = -1.4;
const REPLAN = 0.5;
const SEP = 0.8;                       // centre distance two bodies keep apart

export function createNpc(kind, mesh, pos, extra) {
  mesh.rotation.order = 'YXZ';
  mesh.position.copy(pos);
  return {
    id: null, kind, npc: true,
    pos: pos.clone(), vel: new THREE.Vector3(), yaw: 0, radius: 0.35, hp: 100, mesh,
    grounded: true, walkPhase: Math.random() * 6, knockedT: 0, knockTilt: 0, knockCause: null,
    loose: 0, sore: false, soreT: 0, state: 'idle', stateT: 0,
    wishX: 0, wishZ: 0, speed: 0,
    seek: { mode: 'direct', t: 0, nav: -1, goal: -1, stuckT: 0, forceNavT: 0, sideT: 0, side: 1 },
    noRoad: false, swingT: 0, pose: 'walk', lineT: 0,
    ...extra,
  };
}

function wrap(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function knockdown(e, t, cause, dirX = 0, dirZ = 0, push = 0) {
  e.knockedT = t;
  e.knockCause = cause;
  e.getUpDone = false;
  e.swingT = 0;
  if (push) { e.vel.x = dirX * push; e.vel.z = dirZ * push; e.vel.y = 1.5; e.grounded = false; }
}

// Seek (tx, tz): straight when the way is walkable, else along the nav graph toward the
// nav point nearest the target. Re-plans at most every REPLAN s. Sets e.wishX/Z (unit or 0).
export function seek(e, tx, ty, tz, dt, ctx, arrive = 0.5) {
  const s = e.seek, world = ctx.world;
  s.t -= dt;
  if (s.forceNavT > 0) s.forceNavT -= dt;
  const dx = tx - e.pos.x, dz = tz - e.pos.z, d2 = dx * dx + dz * dz;
  if (d2 < arrive * arrive && Math.abs(ty - e.pos.y) < 0.5) { e.wishX = e.wishZ = 0; return true; }
  if (s.t <= 0) {
    s.t = REPLAN * (0.8 + Math.random() * 0.4);
    const direct = s.forceNavT <= 0 && walkable(world, e.pos.x, e.pos.y, e.pos.z, tx, ty, tz);
    if (direct) s.mode = 'direct';
    else if (s.forceNavT <= 0 && Math.abs(ty - e.pos.y) < 0.3 && feel(e, world, dx, dz, s)) s.mode = 'feel';
    else {
      s.mode = 'nav';
      s.goal = nearestNav(world, tx, tz, ty);
      if (s.nav < 0 || s.navGoal !== s.goal) { s.nav = entryNav(world, e.pos.x, e.pos.y, e.pos.z, s.goal); s.navGoal = s.goal; }
    }
  }
  let wx = dx, wz = dz;
  if (s.mode === 'feel') { wx = s.fx; wz = s.fz; }
  else if (s.mode === 'nav' && s.nav >= 0) {
    const p = world.nav.points[s.nav];
    let px = p.x - e.pos.x, pz = p.z - e.pos.z;
    if (px * px + pz * pz < 0.8 * 0.8) {
      if (s.nav === s.goal) {
        // Only drop back to walking straight when the true target really is walkable from here
        // (a goal node across a terrace lip would otherwise loop: wall, stuck, nav, wall).
        if (walkable(world, e.pos.x, e.pos.y, e.pos.z, tx, ty, tz)) { s.mode = 'direct'; s.forceNavT = 0; }
      }
      else {
        const n = nextHop(world, s.nav, s.goal);
        s.nav = n >= 0 ? n : s.goal;
      }
      const q = world.nav.points[s.nav];
      px = q.x - e.pos.x; pz = q.z - e.pos.z;
    }
    if (s.mode === 'nav') { wx = px; wz = pz; }
  }
  const l = Math.hypot(wx, wz) || 1;
  e.wishX = wx / l; e.wishZ = wz / l;
  // Stuck on something the knee ray missed (a wall edge, a trunk): sidestep, and when walking
  // straight, take the nav graph for a while.
  if (s.sideT > 0) {
    s.sideT -= dt;
    const c = 0.34, sn = 0.94 * s.side;           // ~70 degrees off the wish
    const x = e.wishX * c - e.wishZ * sn, z = e.wishX * sn + e.wishZ * c;
    e.wishX = x; e.wishZ = z;
  } else if (e.speed > 0.5) {
    const hs = Math.hypot(e.vel.x, e.vel.z);
    s.stuckT = hs < e.speed * 0.3 ? s.stuckT + dt : Math.max(0, s.stuckT - dt);
    if (s.stuckT > 0.6) {
      s.stuckT = 0; s.sideT = 0.6; s.side = Math.random() < 0.5 ? -1 : 1;
      if (s.mode !== 'nav') { s.forceNavT = 3; s.t = 0; s.nav = -1; }
    }
  }
  return false;
}

// Feelers: the way straight at the target is blocked on the same level (a seat wall, a
// planter), so try 4 m probes swung 30..90 degrees either side; take the first clear one.
const FEEL = [0.52, -0.52, 1.05, -1.05, 1.57, -1.57];
function feel(e, world, dx, dz, s) {
  const base = Math.atan2(dx, dz), flip = s.side || 1;
  for (let k = 0; k < FEEL.length; k++) {
    const a = base + FEEL[k] * flip;
    const fx = Math.sin(a), fz = Math.cos(a);
    if (walkable(world, e.pos.x, e.pos.y, e.pos.z, e.pos.x + fx * 4, e.pos.y, e.pos.z + fz * 4)) {
      s.fx = fx; s.fz = fz;
      return true;
    }
  }
  return false;
}

// One physics step: accelerate toward wish * speed, gravity + ground, static + vehicle pushout,
// separation from the other NPCs and the player, facing. Then the mesh follows.
export function stepBody(e, dt, ctx) {
  const knocked = e.knockedT > 0;
  const world = ctx.world;
  if (knocked) {
    const hs = Math.hypot(e.vel.x, e.vel.z);
    if (hs > 1e-4) { const k = Math.max(0, hs - KNOCK_DECEL * dt) / hs; e.vel.x *= k; e.vel.z *= k; }
  } else {
    const tx = e.wishX * e.speed, tz = e.wishZ * e.speed, a = ACCEL * dt;
    e.vel.x += Math.max(-a, Math.min(a, tx - e.vel.x));
    e.vel.z += Math.max(-a, Math.min(a, tz - e.vel.z));
  }
  const prevFeet = e.pos.y;
  if (e.noRoad && !knocked && !isRoad(e.pos.x, e.pos.z) && isRoad(e.pos.x + e.vel.x * 0.25, e.pos.z + e.vel.z * 0.25)) {
    e.vel.x = 0; e.vel.z = 0;          // waits at the kerb
  }
  e.vel.y -= GRAVITY * dt;
  e.pos.x += e.vel.x * dt; e.pos.y += e.vel.y * dt; e.pos.z += e.vel.z * dt;
  const cols = nearColliders(world, e.pos.x, e.pos.z);
  const floor = supportHeight(e.pos, e.radius, prevFeet, e.grounded, cols);
  if (e.pos.y <= floor) { e.pos.y = floor; if (e.vel.y < 0) e.vel.y = 0; e.grounded = true; }
  else if (e.grounded && e.vel.y <= 0 && e.pos.y - floor <= LAND_BAND) { e.pos.y = floor; e.vel.y = 0; }
  else e.grounded = false;
  resolveStatic(e, cols);
  pushVehicles(e, ctx);
  separate(e, ctx);

  if (!knocked && (e.wishX || e.wishZ) && e.speed > 0) {
    e.yaw = wrap(e.yaw + wrap(Math.atan2(e.wishX, e.wishZ) - e.yaw) * Math.min(1, 10 * dt));
  } else if (e.faceX !== undefined && !knocked) {
    e.yaw = wrap(e.yaw + wrap(Math.atan2(e.faceX - e.pos.x, e.faceZ - e.pos.z) - e.yaw) * Math.min(1, 8 * dt));
  }
  e.knockTilt += Math.max(-8 * dt, Math.min(2.5 * dt, (knocked ? KNOCK_TILT : 0) - e.knockTilt));
  e.mesh.position.copy(e.pos);
  e.mesh.rotation.y = e.yaw;
  e.mesh.rotation.x = e.knockTilt;
}

function pushVehicles(e, ctx) {
  const list = ctx.world.vehicles;
  if (!list) return;
  for (let i = 0; i < list.length; i++) {
    const v = list[i];
    const reach = v.spec.halfL + 1;
    const dx0 = e.pos.x - v.pos.x, dz0 = e.pos.z - v.pos.z;
    if (dx0 * dx0 + dz0 * dz0 > reach * reach || e.pos.y > v.pos.y + v.spec.height - 0.1) continue;
    const circ = vehicleCircles(v);
    for (let k = 0; k < 3; k++) {
      const q = circ[k], r = e.radius + v.spec.circleR;
      const dx = e.pos.x - q.x, dz = e.pos.z - q.z, d2 = dx * dx + dz * dz;
      if (d2 >= r * r || d2 < 1e-8) continue;
      const d = Math.sqrt(d2), push = r - d;
      e.pos.x += (dx / d) * push; e.pos.z += (dz / d) * push;
    }
  }
}

function separate(e, ctx) {
  const list = ctx.npcs;
  const lie = e.knockedT > 0;
  for (let i = 0; i < list.length; i++) {
    const o = list[i];
    if (o === e || o.knockedT > 0) continue;
    const dx = e.pos.x - o.pos.x, dz = e.pos.z - o.pos.z, d2 = dx * dx + dz * dz;
    if (d2 >= SEP * SEP || d2 < 1e-8 || lie || e.fixed) continue;
    const d = Math.sqrt(d2), k = (SEP - d) * 0.5 / d;
    e.pos.x += dx * k; e.pos.z += dz * k;
  }
  const p = ctx.player;
  if (p && !p.vehicle && !e.fixed) {
    const r = e.radius + p.radius;
    const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z, d2 = dx * dx + dz * dz;
    if (d2 < r * r && d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; e.pos.x += dx * k; e.pos.z += dz * k; }
  }
}

// ---- rig poses (all cheap rotation writes; called every tick after stepBody) ----
const BODY_Y = 1.15;
export function poseRig(e, dt) {
  const u = e.mesh.userData, j = u.joints;
  const hs = Math.hypot(e.vel.x, e.vel.z);
  const amt = Math.min(hs / 6, 1) * (e.grounded ? 1 : 0.3);
  e.walkPhase += dt * (2 + hs * 1.8);
  const sw = Math.sin(e.walkPhase) * 0.9 * amt;
  const pose = e.knockedT > 0 ? 'down' : e.pose;
  u.body.position.y = BODY_Y;
  u.hips.position.set(0, -0.2, 0);
  u.hips.rotation.x = 0;
  u.torso.rotation.set(0, 0, 0);
  u.head.rotation.set(0, 0, 0);
  j.upperLegL.rotation.set(sw, 0, 0); j.upperLegR.rotation.set(-sw, 0, 0);
  j.lowerLegL.rotation.set(Math.max(0, -sw) * 0.8, 0, 0); j.lowerLegR.rotation.set(Math.max(0, sw) * 0.8, 0, 0);
  j.upperArmL.rotation.set(-sw * 0.8, 0, 0); j.upperArmR.rotation.set(sw * 0.8, 0, 0);
  j.lowerArmL.rotation.set(-0.15, 0, 0); j.lowerArmR.rotation.set(-0.15, 0, 0);
  const t = e.walkPhase;
  if (pose === 'down') {
    j.upperArmL.rotation.set(0, 0, 0.9); j.upperArmR.rotation.set(0, 0, -0.9);
  } else if (pose === 'loose') {
    // Relaxed: arms hang wide and heavy, head tipped back a little, a slow sway.
    j.upperArmL.rotation.set(-sw * 0.4, 0, 0.18 + Math.sin(t * 0.5) * 0.05);
    j.upperArmR.rotation.set(sw * 0.4, 0, -0.18 - Math.sin(t * 0.5) * 0.05);
    j.lowerArmL.rotation.set(0, 0, 0); j.lowerArmR.rotation.set(0, 0, 0);
    u.head.rotation.x = -0.2; u.torso.rotation.z = Math.sin(t * 0.4) * 0.04;
  } else if (pose === 'sore') {
    u.torso.rotation.x = 0.3;
    j.upperArmR.rotation.set(0.7, 0, 0); j.lowerArmR.rotation.set(0, 0, 1.5);
    j.upperArmL.rotation.set(0.5, 0, 0); j.lowerArmL.rotation.set(0, 0, -1.4);
  } else if (pose === 'sit') {
    u.hips.position.set(0, -1.02, 0);
    u.torso.rotation.x = -0.25; u.head.rotation.x = -0.1;
    j.upperLegL.rotation.set(-1.25, 0, 0.12); j.upperLegR.rotation.set(-1.25, 0, -0.12);
    j.lowerLegL.rotation.set(1.3, 0, 0); j.lowerLegR.rotation.set(1.3, 0, 0);
    j.upperArmL.rotation.set(0.5, 0, 0.3); j.upperArmR.rotation.set(0.5, 0, -0.3);
    j.lowerArmL.rotation.set(0, 0, 0); j.lowerArmR.rotation.set(0, 0, 0);
  } else if (pose === 'windup') {
    j.upperArmR.rotation.set(2.5, 0, -0.3); j.lowerArmR.rotation.set(-0.6, 0, 0); u.torso.rotation.y = 0.35;
  } else if (pose === 'swing') {
    j.upperArmR.rotation.set(-1.3, 0, 0.3); j.lowerArmR.rotation.set(-0.2, 0, 0); u.torso.rotation.y = -0.3;
  } else if (pose === 'shove') {
    j.upperArmL.rotation.set(-1.5, 0, 0); j.upperArmR.rotation.set(-1.5, 0, 0);
    j.lowerArmL.rotation.set(0, 0, 0); j.lowerArmR.rotation.set(0, 0, 0); u.torso.rotation.x = 0.2;
  } else if (pose === 'reach') {
    j.upperArmR.rotation.set(-1.4, 0, 0); j.lowerArmR.rotation.set(0, 0, 0);
  }
  u.body.position.y = BODY_Y + Math.abs(Math.sin(e.walkPhase)) * 0.04 * amt;
}

// Distance culling: the rig is ~11 draw calls, far people are fog anyway.
export function cull(e, ctx, far2 = 75 * 75) {
  const c = ctx.camera;
  if (!c) return;
  const dx = e.pos.x - c.position.x, dz = e.pos.z - c.position.z;
  e.mesh.visible = dx * dx + dz * dz < far2;
}

// Relieved line + TENSION RELEASED, floating over the head.
export function say(ctx, e, text, cls = 'speech') {
  if (ctx.hud && ctx.hud.floater) ctx.hud.floater(text, e.pos.x, e.pos.y + 2.1, e.pos.z, cls);
}

export function dist2(a, b) {
  const dx = a.x - b.x, dz = a.z - b.z;
  return dx * dx + dz * dz;
}
