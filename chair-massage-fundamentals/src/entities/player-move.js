// Player on foot: movement relative to the camera, sprint stamina, the floor under him (kerbs,
// steps, low collider tops), jump and gravity, facing, and the procedural walk. player.js calls
// moveOnFoot and animate once per tick; tickStamina also runs while driving (the pool refills).
import * as THREE from '../../vendor/three.module.js';
import { resolveStatic, supportHeight, floorHeightAt, LAND_BAND } from '../physics.js';
import { CHARGE } from './palm.js';
import { setStamina } from '../hud-run.js';

const WALK = 4;
const SPRINT = 7;
const ACCEL = 30;          // m/s^2 toward target velocity on the ground
const AIR_ACCEL = 8;
const JUMP_V = 5.5;
const GRAVITY = 18;
const KNOCK_DECEL = 9;     // m/s^2 slide while knocked down
const STAMINA = 3;         // s of sprint in a full pool
const STAMINA_PERK = 1.5;  // the "sprint" unlock (perks.sprintMul > 1): a 50% bigger pool
const REFILL = 6;          // s of not sprinting to refill an empty pool
const WINDED = 1;          // s of recharge before an emptied pool lets you sprint again

const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _wish = new THREE.Vector3();

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// The dodge's backstep (goon-dodge.js, "A goon's wind-up is a call"): about 2 m straight away from
// the goon winding up, carried at a fixed speed for DODGE_T whatever the keys say, then the usual
// acceleration takes over. (dirX, dirZ) is a unit vector.
const DODGE_V = 8, DODGE_T = 0.25;
export function backstep(p, dirX, dirZ) {
  p.vel.x = dirX * DODGE_V; p.vel.z = dirZ * DODGE_V;
  p.dodgeT = DODGE_T;
}

// One on-foot tick: wish direction from the camera yaw, speed (walk or sprint), acceleration,
// jump and gravity, landing, static collisions, facing. Returns the horizontal speed.
export function moveOnFoot(p, dt, ctx, input, knocked) {
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
  const dodging = p.dodgeT > 0 && !knocked; // the backstep carries itself (backstep)
  if (p.dodgeT > 0) p.dodgeT = Math.max(0, p.dodgeT - dt);
  if (!dodging && !(p.lungeT > 0)) {        // the charged lunge carries itself (palm.js)
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
  return hSpeed;
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

export function animate(p, dt, hSpeed) {
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
