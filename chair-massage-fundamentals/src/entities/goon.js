// Serenity Group heavies. Pack pursuit: two chase straight at the player, one flanks to a point
// 6 m off the player's side and then closes. 5.5 m/s. Bat swing at 1.6 m (0.4 s wind-up, 20 dmg,
// 1.2 s knockdown) or an unarmed shove (10 dmg). A Healing Palm puts one down; he gets up loose,
// sits on the ground for 8 s, then his radio puts him back on. Against the vehicle he drives:
// pull-out, bat on the bodywork, cling to the tail (goon-vehicle.js); else they wait at the kerb.
// Perception (sight lines ruling, 2026-09-23): a goon tracks the player only while he has line of
// sight (head to head against static colliders; vehicles never block) or is within 6 m. Any goon
// who sees him updates the whole pack's lastSeen (and pulls searching or returning goons back
// into the chase). 4 s without sight: `search` (walk to lastSeen on the nav graph, then turn in
// place for 8 s; one "Where'd he go?" per search from one goon), then `return` (walk back to the
// van and idle there, loose). The 8 s grab window always sees; knocked, loose and sitting goons
// neither look nor get re-alerted.
import { spawnPerson, disposePerson } from '../world/people.js';
import { loadMesh } from '../assets.js';
import { createNpc, stepBody, poseRig, cull, say, seek } from './npc-common.js';
import { lineOfSight } from './npc-nav.js';
import { emitChaos } from '../run/wanted.js';
import { hurtPlayer, pack, PERCEIVE } from './hostile.js';
import { sfx, shake } from '../juice.js';
import { vanHome, goHome } from './goon-home.js';
import { emit } from '../events.js';
import { vehicleMoves, vehicleStrike, clingTick } from './goon-vehicle.js';
// hostile and alertPack moved to hostile.js (refactor/split); re-exported for one release.
export { hostile, alertPack } from './hostile.js'; export { vanHome };

const RUN = 5.5;
const BAT_REACH = 1.6, SHOVE_REACH = 1.3;
const BAT_WIND = 0.4, SHOVE_WIND = 0.3;
const COOLDOWN = 1.5;
const FLANK_OFF = 6;
const SIT_TIME = 8;
// Opening beat (DESIGN.md PIVOT rulings): for 8 s from the first contact (a goon within 3 m of the
// player; ctx.grabUntil is Infinity until then) the goons only shove and grab: 5 damage, no
// knockdown, a 1.5 m push, "Come with us." on each goon's first contact. The first Healing Palm or
// gun hit ends the window early (palm.js, gun.js).
const GRAB_CD = 6;
const GRAB_DMG = 5;           // hp per grab-window shove (was 10; ruled 2026-09-24 after run 7)
const GRAB_GAP = 3;           // s between shoves landing, pack-wide (was 2.2; ruled 2026-09-24)
const GRAB_PUSH = 9.5;       // m/s; the player's 30 m/s^2 ground decel turns it into about 1.5 m
export const GRAB_WINDOW = 8;
const grabbing = (ctx) => ctx.time < (ctx.grabUntil ?? -1);
const SIGHT_NEAR = 6;        // always noticed this close, walls or not
const SIGHT_FAR = 90;
const SIGHT_EVERY = 0.2;     // line-of-sight test cadence per goon
const LOSE_AFTER = 4;        // s without sight before the search starts
const LOOK_TIME = 8;         // s turning in place at lastSeen
const GO_MAX = 25;           // give up walking to lastSeen after this long (unreachable perch)
const WALK = 2.2;            // search pace

export function createGoon(scene, pos, role, bat) {
  const mesh = spawnPerson('goon');
  scene.add(mesh);
  const e = createNpc('goon', mesh, pos, {
    role, bat, cooldown: 0.8, flankDone: false, update: updateGoon, onPalm, onVehicleHit,
    radius: 0.4,
  });
  e.state = 'chase';
  e.lastSeen = null;
  e.sightT = Math.random() * SIGHT_EVERY;
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

export function disposeGoon(e, scene) { (e.mesh.parent || scene).remove(e.mesh); disposePerson(e.mesh); } // a clinger rides a vehicle

export function updateGoon(e, dt, ctx) {
  const p = ctx.player;
  e.wishX = e.wishZ = 0; e.speed = 0; e.faceX = undefined;
  if (e.cooldown > 0) e.cooldown -= dt;
  if (e.cling) { clingTick(e, dt, ctx); return; } if (e.hold) { e.hold(e, dt, ctx); return; }   // on a tail (goon-vehicle.js); to his car (goon-car.js)
  e.noRoad = !!p.vehicle;
  if (ctx.grabUntil === Infinity && e.knockedT <= 0 && (e.pos.x - p.pos.x) ** 2 + (e.pos.z - p.pos.z) ** 2 < 9) { ctx.grabUntil = ctx.time + GRAB_WINDOW; ctx.grabStart = ctx.time; }
  if (e.stunT > 0 && e.knockedT <= 0) {           // Gun stun (gun.js): a 1.5 s stagger, no movement, no attack.
    e.stunT -= dt;
    if (e.state === 'windup') e.state = 'chase';
    e.pose = 'stagger'; stepBody(e, dt, ctx); poseRig(e, dt); cull(e, ctx); return;
  }
  if (e.knockedT <= 0 && PERCEIVE.has(e.state)) perceive(e, dt, ctx);
  if (e.knockedT > 0) {
    e.knockedT -= dt;
    if (e.knockedT <= 0) getUp(e, ctx);
  } else if (e.state === 'loose') {
    e.stateT -= dt;
    if (e.stateT <= 0) { e.state = 'sit'; e.stateT = SIT_TIME; say(ctx, e, '...I\'m gonna sit for a minute.'); }
  } else if (e.state === 'sit') {
    e.stateT -= dt;
    if (e.stateT <= 0) {
      e.state = 'chase'; e.loose = 0; say(ctx, e, '(radio) Copy. Back on it.', 'speech dim');
      const pk = pack(ctx);
      if (pk.seen) e.lastSeen = { ...pk.seen };            // the radio tells him where the pack last had him
    }
  } else if (e.state === 'treated') {
    // A charged Healing Palm (palm.js treat): sits where he was treated, then walks back to the
    // van loose and stays out of the chase until outUntil (no sight, no radio).
    e.stateT -= dt;
    if (e.stateT <= 0) {
      e.state = 'out'; e.idle = false; e.seek.nav = -1; e.seek.t = 0;
      say(ctx, e, '...I\'m taking the rest of the day.');
      emit('treat', { target: 'goon', kind: 'goon', wave: !!e.wave, phase: 'walk' });
    }
  } else if (e.state === 'out') {
    if (ctx.time >= e.outUntil) { e.state = 'return'; e.idle = false; e.loose = 0; emit('treat', { target: 'goon', kind: 'goon', wave: !!e.wave, phase: 'back' }); }
    else goHome(e, dt, ctx);
  } else if (e.state === 'windup') {
    e.stateT -= dt;
    e.faceX = p.pos.x; e.faceZ = p.pos.z;
    if (e.stateT <= 0 && !vehicleStrike(e, ctx)) strike(e, ctx);
  } else if (e.state === 'recover') {
    e.stateT -= dt;
    if (e.stateT <= 0) e.state = 'chase';
  } else if (e.state === 'chase') {
    if (tracking(e, ctx)) chase(e, dt, ctx);
    else lost(e, dt, ctx);
  } else if (e.state === 'search') {
    search(e, dt, ctx);
  } else if (e.state === 'return') {
    goHome(e, dt, ctx);
  }
  e.pose = e.knockedT > 0 ? 'down' : e.state === 'sit' || e.state === 'treated' ? 'sit' : e.state === 'out' ? 'loose' : (e.state === 'loose' || e.idle) ? 'loose'
    : e.state === 'windup' ? (e.bat && !e.grab && e.vmove !== 'pull' ? 'windup' : 'shove') : e.state === 'recover' ? (e.bat && !e.grab && e.vmove !== 'pull' ? 'swing' : 'shove') : 'walk';
  stepBody(e, dt, ctx);
  poseRig(e, dt);
  cull(e, ctx);
}

// ---- perception ---- (the pack's shared memory, pack(ctx), is hostile.js)
function target(ctx) { const p = ctx.player; return p.vehicle ? p.vehicle.pos : p.pos; }

export function seesPlayer(e, ctx) {
  const t = target(ctx);
  const d2 = (t.x - e.pos.x) ** 2 + (t.z - e.pos.z) ** 2;
  if (d2 < SIGHT_NEAR * SIGHT_NEAR) return true;
  if (d2 > SIGHT_FAR * SIGHT_FAR) return false;
  return lineOfSight(ctx.world, e.pos, t);
}

function perceive(e, dt, ctx) {
  e.sightT -= dt;
  const grab = grabbing(ctx);
  if (!grab && e.sightT > 0) return;
  e.sightT = SIGHT_EVERY;
  const t = target(ctx), pk = pack(ctx);
  if (!grab && !seesPlayer(e, ctx)) {
    e.sees = false;
    // A fresh goon off the van who cannot see him starts from the radio: the pack's last
    // sighting, or where he is right now if the pack has none.
    if (!e.lastSeen) e.lastSeen = pk.seen ? { ...pk.seen } : { x: t.x, y: t.y, z: t.z, t: ctx.time };
    return;
  }
  e.sees = true;
  pk.seen = { x: t.x, y: t.y, z: t.z, t: ctx.time };
  // Re-alert: every goon who is up and working gets the sighting; searchers and returners run.
  for (const o of ctx.npcs) {
    if (o.kind !== 'goon' || o.boss || o.knockedT > 0 || !PERCEIVE.has(o.state)) continue;
    o.lastSeen = { ...pk.seen };
    if (o.state === 'search' || o.state === 'return') { o.state = 'chase'; o.idle = false; o.seek.nav = -1; o.seek.t = 0; }
  }
}

// Tracking: the pack had him within the last two sight ticks (or no memory yet: a fresh goon
// before his first look chases like before).
function tracking(e, ctx) {
  return !e.lastSeen || ctx.time - e.lastSeen.t <= SIGHT_EVERY * 2 + 1e-6;
}

// Chasing but blind: run to where he was; after LOSE_AFTER s, search.
function lost(e, dt, ctx) {
  const L = e.lastSeen;
  if (ctx.time - L.t >= LOSE_AFTER) {
    e.state = 'search'; e.phase = 'go'; e.stateT = GO_MAX;
    e.seek.nav = -1; e.seek.t = 0;
    search(e, dt, ctx);
    return;
  }
  e.speed = RUN;
  if (seek(e, L.x, L.y, L.z, dt, ctx, 1.2)) { e.speed = 0; e.faceX = L.x; e.faceZ = L.z; }
}

function search(e, dt, ctx) {
  const L = e.lastSeen;
  e.stateT -= dt;
  if (e.phase === 'go') {
    e.speed = e.alerted ? RUN : WALK;         // radioed to a spot: they run
    const near = (L.x - e.pos.x) ** 2 + (L.z - e.pos.z) ** 2 < 1.3 * 1.3;
    const there = seek(e, L.x, L.y, L.z, dt, ctx, 1.0) || near;
    if (there || e.stateT <= 0) {
      e.phase = 'look'; e.stateT = LOOK_TIME; e.lookA = e.yaw; e.lookDir = e.id % 2 ? 1 : -1;
      e.wishX = e.wishZ = 0; e.speed = 0;
      e.reachedLastSeen = there; e.alerted = false;
      const pk = pack(ctx);
      if (pk.saidFor !== L.t) { pk.saidFor = L.t; say(ctx, e, "Where'd he go?"); }
    }
    return;
  }
  // Look around: sweep back and forth about 100 degrees, turning in place.
  e.wishX = e.wishZ = 0; e.speed = 0;
  e.lookT = (e.lookT || 0) + dt;
  e.lookA = (e.lookA ?? e.yaw) + e.lookDir * 1.1 * dt;
  if (e.lookT > 1.6) { e.lookT = 0; e.lookDir = -e.lookDir; }
  e.faceX = e.pos.x + Math.sin(e.lookA) * 5; e.faceZ = e.pos.z + Math.cos(e.lookA) * 5;
  if (e.stateT <= 0) { e.state = 'return'; e.idle = false; e.seek.nav = -1; e.seek.t = 0; }
}

function chase(e, dt, ctx) {
  const p = ctx.player;
  const tgt = p.vehicle ? p.vehicle.pos : p.pos;
  const dx = tgt.x - e.pos.x, dz = tgt.z - e.pos.z, d2 = dx * dx + dz * dz;
  e.speed = RUN;
  if (p.vehicle && vehicleMoves(e, dt, ctx, e.bat && !grabbing(ctx))) return;
  if (!p.vehicle && p.knockedT <= 0) {
    const grab = grabbing(ctx);
    const reach = e.bat && !grab ? BAT_REACH : SHOVE_REACH;
    if (d2 < reach * reach && e.cooldown <= 0 && Math.abs(p.pos.y - e.pos.y) < 1) {
      e.state = 'windup';
      e.grab = grab; e.vmove = null;
      e.stateT = e.bat && !grab ? BAT_WIND : SHOVE_WIND;
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
  const bat = e.bat && !e.grab;
  const reach = (bat ? BAT_REACH : SHOVE_REACH) + 0.4;
  const dx = p.pos.x - e.pos.x, dz = p.pos.z - e.pos.z, d2 = dx * dx + dz * dz;
  e.state = 'recover';
  e.stateT = 0.5;
  e.cooldown = e.grab ? GRAB_CD : COOLDOWN;
  if (bat) emitChaos(ctx, e.pos.x, e.pos.z, 'batSwing');
  if (p.vehicle || d2 > reach * reach || p.knockedT > 0) return;
  const d = Math.sqrt(d2) || 1;
  if (e.grab) {
    // One shove lands per GRAB_GAP across the whole pack: at most three in the 8 s window (15 hp).
    if (ctx.lastGrabHitT !== undefined && ctx.time - ctx.lastGrabHitT < GRAB_GAP) return;
    ctx.lastGrabHitT = ctx.time;
    hurtPlayer(ctx, GRAB_DMG, 0, dx / d, dz / d, GRAB_PUSH, 'grab');
    shake(ctx, 0.2);
    sfx(ctx, 'thud', p.pos.x, p.pos.z, 0.35);
    if (!e.grabbed) { e.grabbed = true; say(ctx, e, 'Come with us.'); }
  } else if (bat) {
    hurtPlayer(ctx, 20, 1.2, dx / d, dz / d, 4, 'bat');
    say(ctx, p, 'WHACK', 'thud');
    shake(ctx, 0.65);
    sfx(ctx, 'thud', p.pos.x, p.pos.z, 1);
  } else {
    hurtPlayer(ctx, 10, 0, dx / d, dz / d, 4, 'shove');
    say(ctx, p, 'shove', 'speech dim');
  }
}

function getUp(e, ctx) {
  e.knockedT = 0;
  if (e.state === 'treated' || e.state === 'out') return;   // run over while treated: still treated
  if (e.knockCause === 'palm') {
    e.state = 'loose'; e.stateT = 1.0; e.loose = 1;
  } else {
    e.state = 'chase';
  }
}

// The palm and the gun are nonviolent (ruled 2026-09-25): no wanted for a goon.
function onPalm(e, p, ctx) {
  say(ctx, e, 'TENSION RELEASED', 'released');
}

function onVehicleHit(e, v, ctx) {
  // A relaxed goon (loose or sitting after a palm) hit by a car stays relaxed: he gets up loose
  // and sits his full 8 s again instead of rising straight into the chase.
  e.knockCause = e.state === 'loose' || e.state === 'sit' ? 'palm' : 'vehicle';
  e.knockedT = 3;
  if (e.state === 'windup') e.state = 'chase';
  if ((v.driver === ctx.player || (!v.driver && v.stolen)) && ctx.wanted) ctx.wanted.report('goonHit'); // a stolen car you bailed from is still yours (ped.js)
  emitChaos(ctx, e.pos.x, e.pos.z, 'vehicleHit');
}
