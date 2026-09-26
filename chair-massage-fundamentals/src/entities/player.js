// Player: third-person on-foot controller, orbit camera, procedural walk, Healing Palm (palm.js).
// Phase 4: E interactions (interact.js), driving (the vehicle reads input; the player sits
// visibly at the wheel, seated.js), chase camera (chase-cam.js), knockdown when a vehicle hits them
// on foot. Sprint stamina: a 3 s pool (4.5 s with the "sprint" unlock), shown under the health bar;
// refills in 6 s (4.8 s with the coffee). Consolation perks read here: icePack, staminaRegenMul, shirt.
// Split 2026-09-24 (refactor/split): movement and stamina are player-move.js, E / palm / gun input
// and the perks player-actions.js. This module keeps create, the per-tick order, and the camera.
import * as THREE from '../../vendor/three.module.js';
import { spawnPerson } from '../world/people.js';
import { segmentHit } from '../physics.js';
import { updateChaseCamera, blendLook } from './chase-cam.js';
import { cancelCharge, updateHealth, applyShake } from './palm.js';
import { poseTherapist } from '../run/minimassage.js';
import { moveOnFoot, tickStamina, animate } from './player-move.js';
import { counterInput } from './goon-counter.js';
import { interactInput, gunTick, palmInput, poseArms } from './player-actions.js';

// Moved out in the split; re-exported here for one release.
export { tickStamina } from './player-move.js';
export { wearPerks } from './player-actions.js';

const CAM_DIST = 6;
const CAM_HEIGHT = 2.5;
const LOOK_HEIGHT = 1.5;
const HEAD_HEIGHT = 1.6;   // camera clamp ray starts here
const CAM_PAD = 0.3;       // stay this far in front of the first collider hit
const PITCH_MIN = -0.35;
const PITCH_MAX = 1.1;
const MOUSE_SENS = 0.0025;
const KNOCK_TILT = -1.35;  // rig tilts back (rad about local X)

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

export function updatePlayer(p, dt, ctx) {
  const input = ctx.input;
  counterInput(p, ctx, input);        // the counter is Q (goon-counter.js)

  // Chair folding takes a moment (standing still); every other E acts at once (player-actions.js).
  interactInput(p, dt, ctx, input);
  updateHealth(p, dt, ctx);
  gunTick(p, dt, ctx);
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

  // --- movement, stamina, floor, jump, facing (player-move.js) ---
  const hSpeed = moveOnFoot(p, dt, ctx, input, knocked);

  // --- Healing Palm input (player-actions.js, palm.js) ---
  palmInput(p, dt, ctx, input, knocked);

  // Knockdown: tip over fast, get back up once knockedT runs out.
  p.knockTilt += Math.max(-8 * dt, Math.min(3 * dt, (knocked ? KNOCK_TILT : 0) - p.knockTilt));

  animate(p, dt, hSpeed);
  poseArms(p);
  syncMesh(p);
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
