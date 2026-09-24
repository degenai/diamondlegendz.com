// Player: third-person on-foot controller, orbit camera, procedural walk, Healing Palm (palm.js).
// Phase 4: E interactions (interact.js), driving (the vehicle reads input; the player sits
// visibly at the wheel, seated.js), chase camera (chase-cam.js), knockdown when a vehicle hits them
// on foot. Sprint stamina: a 3 s pool (4.5 s with the "sprint" unlock), shown under the health bar;
// refills in 6 s (4.8 s with the coffee). Consolation perks read here: icePack, staminaRegenMul, shirt.
import * as THREE from '../../vendor/three.module.js';
import { spawnPerson, setPersonColours, shirtFor } from '../world/people.js';
import { chairState } from './chair.js';
import { emit } from '../events.js';
import { resolveStatic, supportHeight, floorHeightAt, segmentHit, LAND_BAND } from '../physics.js';
import { handleInteract, interaction } from './interact.js';
import { updateChaseCamera, blendLook } from './chase-cam.js';
import { startCharge, cancelCharge, updatePalm, updateHealth, applyShake, CHARGE } from './palm.js';
import { poseTherapist } from '../run/minimassage.js';
import { updateGun, poseGun } from './gun.js';
import { setStamina } from '../hud-run.js';

const WALK = 4;
const SPRINT = 7;
const ACCEL = 30;          // m/s^2 toward target velocity on the ground
const AIR_ACCEL = 8;
const JUMP_V = 5.5;
const GRAVITY = 18;
const CAM_DIST = 6;
const CAM_HEIGHT = 2.5;
const LOOK_HEIGHT = 1.5;
const HEAD_HEIGHT = 1.6;   // camera clamp ray starts here
const CAM_PAD = 0.3;       // stay this far in front of the first collider hit
const PITCH_MIN = -0.35;
const PITCH_MAX = 1.1;
const MOUSE_SENS = 0.0025;
const KNOCK_DECEL = 9;     // m/s^2 slide while knocked down
const KNOCK_TILT = -1.35;  // rig tilts back (rad about local X)
const FOLD = 0.5;          // s to fold the chair onto your back / into a vehicle (auto-fold halves it)
const FOLD_ACTS = new Set(['pickup', 'take', 'load']);
const STAMINA = 3;         // s of sprint in a full pool
const STAMINA_PERK = 1.5;  // the "sprint" unlock (perks.sprintMul > 1): a 50% bigger pool
const REFILL = 6;          // s of not sprinting to refill an empty pool
const ICE_PACK = 20;       // hp the ice pack (perks.icePack) gives back on a chair pickup, once per run
const WINDED = 1;          // s of recharge before an emptied pool lets you sprint again

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _wish = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _camDesired = new THREE.Vector3();
const _head = new THREE.Vector3();

export function createPlayer(scene, pos) {
  const mesh = spawnPerson('player');
  mesh.position.copy(pos);
  mesh.rotation.order = 'YXZ'; // yaw, then the knockdown tilt about the body's own X
  scene.add(mesh);
  return {
    id: null,
    kind: 'player',
    pos: pos.clone(),
    vel: new THREE.Vector3(),
    yaw: 0,              // body facing (radians, 0 = +Z)
    radius: 0.4,
    hp: 100,
    mesh,
    grounded: true,
    camYaw: Math.PI,     // camera behind the player (player faces +Z, camera looks +Z)
    camPitch: 0.25,
    walkPhase: 0,
    elbowT: 0,
    camInit: false,
    camDist: CAM_DIST,   // head-to-camera distance after the collider clamp
    floorInit: false,
    vehicle: null,       // the vehicle being driven, or null on foot
    knockedT: 0,         // > 0: knocked down (no control, cannot enter vehicles)
    knockTilt: 0,
    update: updatePlayer,
    lateUpdate: lateUpdatePlayer,
  };
}

export const create = createPlayer;
export const update = updatePlayer;

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function updatePlayer(p, dt, ctx) {
  const input = ctx.input;

  // Chair folding takes a moment (standing still); every other E acts at once.
  if (input && input.ePressed && !(p.foldT > 0)) {
    const act = p.vehicle ? null : interaction(p, ctx).act;
    if (FOLD_ACTS.has(act)) { p.foldT = FOLD * ((ctx.perks && ctx.perks.foldMul) || 1); p.foldAct = act; }
    else handleInteract(p, ctx);
  }
  if (p.foldT > 0) {
    p.foldT -= dt;
    if (p.knockedT > 0 || p.vehicle) p.foldT = 0;
    else if (p.foldT <= 0) {
      p.foldT = 0;
      if (interaction(p, ctx).act === p.foldAct) { handleInteract(p, ctx); if (chairState(ctx.world).where === 'player') icePack(p, ctx); }
    }
  }
  updateHealth(p, dt, ctx);
  updateGun(p, dt, ctx);
  if (p.vehicle) {
    // Driving: the vehicle reads the input; the player sits at the wheel (seated.js).
    tickStamina(p, dt, ctx, false);
    p.pos.copy(p.vehicle.pos);
    p.vel.set(0, 0, 0);
    if (p.chargeT >= 0) cancelCharge(p, 'vehicle');
    p.lungeT = 0;
    p.knockedT = 0; p.knockTilt = 0;
    return;
  }
  const knocked = p.knockedT > 0;
  if (knocked) p.knockedT = Math.max(0, p.knockedT - dt);

  // --- camera orbit from mouse (pointer lock deltas) ---
  if (input) {
    p.camYaw -= input.dx * MOUSE_SENS;
    p.camPitch = Math.min(PITCH_MAX, Math.max(PITCH_MIN, p.camPitch + input.dy * MOUSE_SENS));
  }
  // Mini-massage: planted at the chair, both palms on the client's back (run/minimassage.js).
  if (p.massaging && !knocked) {
    p.vel.set(0, 0, 0);
    p.knockTilt = 0;
    poseTherapist(p, ctx);
    return;
  }

  // --- movement relative to camera yaw ---
  // Camera looks along forward = (-sin yaw, 0, -cos yaw).
  _fwd.set(-Math.sin(p.camYaw), 0, -Math.cos(p.camYaw));
  _right.set(Math.cos(p.camYaw), 0, -Math.sin(p.camYaw));
  _wish.set(0, 0, 0);
  if (input && !knocked && !(p.foldT > 0) && !(p.chargeT >= 0) && !(p.lungeT > 0)) {   // planted while charging the palm
    if (input.forward) _wish.add(_fwd);
    if (input.back) _wish.sub(_fwd);
    if (input.right) _wish.add(_right);
    if (input.left) _wish.sub(_right);
  }
  const moving = _wish.lengthSq() > 0;
  if (moving) _wish.normalize();
  const sprinting = tickStamina(p, dt, ctx, !!(input && input.shift && moving && !knocked && !(p.foldT > 0)));
  const speed = sprinting ? SPRINT : WALK;
  const tx = _wish.x * speed, tz = _wish.z * speed;
  const a = (knocked ? KNOCK_DECEL : p.grounded ? ACCEL : AIR_ACCEL) * dt;
  if (!(p.lungeT > 0)) {                    // the charged lunge carries itself (palm.js)
    p.vel.x += THREE.MathUtils.clamp(tx - p.vel.x, -a, a);
    p.vel.z += THREE.MathUtils.clamp(tz - p.vel.z, -a, a);
  }

  const colliders = ctx.world ? ctx.world.colliders : null;
  // First tick after spawn: stand on whatever walk surface is under the spawn point.
  if (colliders && !p.floorInit) {
    p.pos.y = Math.max(p.pos.y, floorHeightAt(p.pos.x, p.pos.z, colliders, p.pos.y));
    p.floorInit = true;
  }
  const prevFeet = p.pos.y;

  // --- jump + gravity; land on the street or on the top of a low collider ---
  if (input && input.spacePressed && p.grounded && !knocked) {
    p.vel.y = JUMP_V;
    p.grounded = false;
  }
  p.vel.y -= GRAVITY * dt;

  p.pos.addScaledVector(p.vel, dt);
  const floor = colliders ? supportHeight(p.pos, p.radius, prevFeet, p.grounded, colliders) : 0;
  if (p.pos.y <= floor) {
    p.pos.y = floor;
    if (p.vel.y < 0) p.vel.y = 0;
    p.grounded = true;
  } else if (p.grounded && p.vel.y <= 0 && p.pos.y - floor <= LAND_BAND) {
    p.pos.y = floor;          // walking down a kerb or a step
    p.vel.y = 0;
  } else {
    p.grounded = false;
  }

  if (colliders) resolveStatic(p, colliders);

  // --- facing: turn toward movement direction ---
  const hSpeed = Math.hypot(p.vel.x, p.vel.z);
  if (moving && !(p.palmT > 0) && !(p.gunFireT > 0)) { // hold the strike's facing through the wind-up
    const targetYaw = Math.atan2(_wish.x, _wish.z);
    p.yaw += wrapAngle(targetYaw - p.yaw) * Math.min(1, 12 * dt);
    p.yaw = wrapAngle(p.yaw);
  }

  // --- Healing Palm: press to charge, hold 0.7 s for the treating lunge, a tap for the quick
  // palm (palm.js). p.holdPalm stands in for the button in headless checks.
  if (input && input.leftClicked && input.locked && p.elbowT <= 0 && !knocked) startCharge(p);
  updatePalm(p, dt, ctx, !!((input && input.mouseLeft && input.locked) || p.holdPalm));
  if (p.elbowT > 0) p.elbowT = Math.max(0, p.elbowT - dt);

  // Knockdown: tip over fast, get back up once knockedT runs out.
  p.knockTilt += Math.max(-8 * dt, Math.min(3 * dt, (knocked ? KNOCK_TILT : 0) - p.knockTilt));

  animate(p, dt, hSpeed);
  if (p.foldT > 0) { const l = p.mesh.userData.limbs; l.armL.rotation.x = -1.1; l.armR.rotation.x = -1.1; }
  else poseGun(p);
  syncMesh(p);
}

// The ice pack (consolation perk): the first chair pickup of a run that finds him hurt heals
// 20 hp. A pickup at full health does not spend it. p.icePackUsed is cleared on RUN entry.
function icePack(p, ctx) {
  if (!(ctx.perks && ctx.perks.icePack) || p.icePackUsed || !(p.hp > 0 && p.hp < 100)) return;
  const from = p.hp;
  p.hp = Math.min(100, p.hp + ICE_PACK);
  p.prevHp = p.hp;
  p.icePackUsed = true;
  if (ctx.hud && ctx.hud.floater) ctx.hud.floater(`+${Math.round(p.hp - from)}`, p.pos.x, p.pos.y + 2.1, p.pos.z, 'released');
  emit('perk', { id: 'icepack', hp: Math.round(p.hp), from: Math.round(from) });
}

// The loaner scrubs (perks.shirt): the player's shirt follows the perk, re-skinned via people.js.
export function wearPerks(p, perks) {
  setPersonColours(p.mesh, { shirt: shirtFor('player', perks && perks.shirt) });
}

// Sprint stamina, seconds in the pool. Draws while sprinting; empty means walk until it has
// recharged for WINDED s; refills at pool/REFILL per s whenever not sprinting (driving too).
// Returns whether this tick may sprint. The bar (hud-run.js) reads p.stamina / p.staminaMax.
export function tickStamina(p, dt, ctx, wants) {
  const max = STAMINA * ((ctx.perks && ctx.perks.sprintMul) > 1 ? STAMINA_PERK : 1);
  // First tick, or back after a MASSAGE (no player ticks there): a full pool.
  if (p.staminaMax !== max || p.stamina === undefined || ctx.time - (p.staminaAt ?? -1e9) > 1) {
    p.staminaMax = max; p.stamina = max; p.winded = false; p.windT = 0;
  }
  p.staminaAt = ctx.time;
  const sprint = wants && !p.winded && p.stamina > 0;
  if (sprint) {
    p.stamina = Math.max(0, p.stamina - dt);
    if (p.stamina <= 0) { p.winded = true; p.windT = 0; }
  } else {
    // Holding Shift while winded is panic, not rest: no refill and no recovery until you let go.
    if (!(p.winded && wants)) {
      p.stamina = Math.min(max, p.stamina + (max / REFILL) * ((ctx.perks && ctx.perks.staminaRegenMul) || 1) * dt);
      if (p.winded && (p.windT += dt) >= WINDED) p.winded = false;
    }
  }
  setStamina(p.stamina / max, ctx.time);
  return sprint;
}

// Camera runs after every entity has moved (vehicles update after the player).
const _camColliders = [];
const _vehBoxes = [];
// Static colliders plus a bounding box per vehicle (other than the one being driven),
// so the camera pulls in front of cars instead of clipping through them. The boxes are also
// kept apart in _vehBoxes: the chase camera treats them differently at speed.
function cameraColliders(p, ctx, withStatic = true) {
  const world = ctx.world;
  if (!world) return null;
  _vehBoxes.length = 0;
  for (const e of ctx.entities) {
    if (e.kind !== 'vehicle' || e === p.vehicle || !e.spec) continue;
    const s = Math.abs(Math.sin(e.yaw)), c = Math.abs(Math.cos(e.yaw));
    const hx = e.spec.halfL * s + e.spec.halfW * c, hz = e.spec.halfL * c + e.spec.halfW * s;
    _vehBoxes.push({ minX: e.pos.x - hx, maxX: e.pos.x + hx, minZ: e.pos.z - hz, maxZ: e.pos.z + hz,
      maxY: e.pos.y + e.spec.height, camOnly: true, vehBox: true });
  }
  if (!withStatic) return world.colliders;
  _camColliders.length = 0;
  for (const c of world.colliders) _camColliders.push(c);
  for (const b of _vehBoxes) _camColliders.push(b);
  return _camColliders;
}

export function lateUpdatePlayer(p, dt, ctx) {
  if (p.exitGrace) { p.exitGrace.t -= dt; if (p.exitGrace.t <= 0) p.exitGrace = null; }
  if (p.vehicle) {
    const statics = cameraColliders(p, ctx, false);
    updateChaseCamera(p, p.vehicle, dt, ctx.camera, statics, ctx.input, statics ? _vehBoxes : null);
  } else {
    p.chaseLimit = undefined;
    updateCamera(p, dt, ctx.camera, cameraColliders(p, ctx));
  }
  applyShake(p, ctx.camera);
}

function animate(p, dt, hSpeed) {
  const limbs = p.mesh.userData.limbs;
  const amt = p.grounded ? Math.min(hSpeed / SPRINT, 1) : 0.3;
  p.walkPhase += dt * (2 + hSpeed * 1.6);
  const swing = Math.sin(p.walkPhase) * 0.9 * amt;
  limbs.legL.rotation.x = swing;
  limbs.legR.rotation.x = -swing;
  limbs.armL.rotation.x = -swing * 0.8;
  if (p.chargeT >= 0) {
    // Charging: the right arm winds back and up over the 0.7 s, the left hand points the way.
    const k = Math.min(1, p.chargeT / CHARGE);
    limbs.armR.rotation.x = 0.4 + 1.9 * k;
    limbs.armR.rotation.z = -0.25 - 0.35 * k;
    limbs.armL.rotation.x = -1.2 * k;
    limbs.legL.rotation.x = -0.35 * k; limbs.legR.rotation.x = 0.3 * k;   // planted stance
  } else if (p.palmT > 0) {
    // Wind-up: the palm draws back past the hip.
    limbs.armR.rotation.x = 1.3;
    limbs.armR.rotation.z = -0.25;
  } else if (p.elbowT > 0) {
    // The Healing Palm: right arm straight out, heel of the hand first.
    limbs.armR.rotation.x = -Math.PI / 2;
    limbs.armR.rotation.z = 0.15;
  } else {
    limbs.armR.rotation.x = swing * 0.8;
    limbs.armR.rotation.z = 0;
  }
  // Small bob while moving: bob the torso so the feet stay planted.
  const torso = p.mesh.userData.torso;
  if (torso) {
    if (torso.userData.restY === undefined) torso.userData.restY = torso.position.y;
    torso.position.y = torso.userData.restY + Math.abs(Math.sin(p.walkPhase)) * 0.05 * amt;
  }
}

function syncMesh(p) {
  p.mesh.position.copy(p.pos);
  p.mesh.rotation.y = p.yaw;
  p.mesh.rotation.x = p.knockTilt;
}

function updateCamera(p, dt, camera, colliders) {
  if (!camera) return;
  _camTarget.set(p.pos.x, p.pos.y + LOOK_HEIGHT, p.pos.z);
  const horiz = Math.cos(p.camPitch) * CAM_DIST;
  _camDesired.set(
    p.pos.x + Math.sin(p.camYaw) * horiz,
    p.pos.y + CAM_HEIGHT + Math.sin(p.camPitch) * CAM_DIST - Math.sin(0.25) * CAM_DIST,
    p.pos.z + Math.cos(p.camYaw) * horiz,
  );
  _camDesired.y = Math.max(0.3, _camDesired.y);

  // Clamp: march from the head toward the camera; stop CAM_PAD short of the first collider.
  _head.set(p.pos.x, p.pos.y + HEAD_HEIGHT, p.pos.z);
  const full = _head.distanceTo(_camDesired);
  let dist = full;
  if (colliders && full > 1e-4) {
    const hit = segmentHit(_head, _camDesired, colliders, 0.25);
    if (hit < full) dist = Math.max(0.2, hit - CAM_PAD);
  }
  p.camDist = dist;
  if (dist < full) _camDesired.sub(_head).multiplyScalar(dist / full).add(_head);

  if (!p.camInit) {
    camera.position.copy(_camDesired);
    p.camInit = true;
  } else {
    camera.position.lerp(_camDesired, 1 - Math.exp(-10 * dt));
    // Never let the smoothing drag the camera through a wall: re-test along the
    // direction the lerp actually produced, not the desired ray.
    const d = camera.position.distanceTo(_head);
    let limit = dist;
    if (colliders && d > 1e-4) {
      const hit2 = segmentHit(_head, camera.position, colliders, 0.25);
      if (hit2 < d) limit = Math.min(limit, Math.max(0.2, hit2 - CAM_PAD));
    }
    if (d > limit) camera.position.sub(_head).multiplyScalar(limit / d).add(_head);
  }
  camera.lookAt(blendLook(p, _camTarget, dt));
}
