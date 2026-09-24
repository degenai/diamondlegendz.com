// Chase camera while driving: settles 9 m behind the vehicle's heading at 3.5 m, looking a
// little ahead of the car. Mouse orbits it; once the mouse stops, the orbit recentres over
// 1.5 s. Clamped against colliders with segmentHit exactly like the on-foot camera.
// blendLook() eases the look target across enter/exit so the view never snaps.
// The clamp distance has hysteresis: it shortens at once (a wall) but lengthens at most
// LENGTHEN m/s, so a ray grazing something on alternate frames cannot pump the zoom.
// Floors the camera is above never clamp it, and other cars' boxes (rebuilt every frame from
// yaw, so a turning car's box breathes) only count at speed when they are further than our
// own car's length down the ray.
import * as THREE from '../../vendor/three.module.js';
import { segmentHit, floorHeightAt } from '../physics.js';

const DIST = 9;
const HEIGHT = 3.5;
const LOOK_AHEAD = 4;
const LOOK_Y = 1.2;
const PIVOT_Y = 1.8;        // clamp ray starts above the roof line
const CAM_PAD = 0.3;
const MOUSE_SENS = 0.0025;
const RECENTRE = 1.5;       // seconds to recentre after the mouse stops
const HEADING_RATE = 4;     // 1/s, how fast the camera swings behind a turning car
const POS_RATE = 8;
const PITCH_MIN = -0.25, PITCH_MAX = 0.9;
const BLEND = 0.6;          // look-target blend on enter/exit, seconds
const LENGTHEN = 4;         // m/s, how fast the clamp may let the camera back out
const FAST = 3;             // m/s, above this near vehicle boxes are ignored
const EPS = 1e-4;

const _desired = new THREE.Vector3();
const _pivot = new THREE.Vector3();
const _look = new THREE.Vector3();
const _blend = new THREE.Vector3();

const _one = [null];
let _floorY = 0;
const skipFloor = (c) => c.floor && c.maxY <= _floorY;

// Distance from `from` to the first thing the camera should stop at on the way to `to`.
function clampHit(from, to, colliders, vehBoxes, fast, ownLen) {
  _floorY = to.y;
  let hit = colliders ? segmentHit(from, to, colliders, 0.25, skipFloor) : Infinity;
  if (vehBoxes) {
    for (let i = 0; i < vehBoxes.length; i++) {
      _one[0] = vehBoxes[i];
      const h = segmentHit(from, to, _one);
      if (h < hit && !(fast && h < ownLen)) hit = h;
    }
  }
  return hit;
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Returns the look point to use this frame, easing from the previous mode's look target.
export function blendLook(p, target, dt) {
  if (!p.camLook) { p.camLook = target.clone(); p.camLookFrom = target.clone(); p.camBlendT = 1; }
  if (p.camBlendT === 0) p.camLookFrom.copy(p.camLook);
  if (p.camBlendT < 1) {
    p.camBlendT = Math.min(1, p.camBlendT + dt / BLEND);
    const k = p.camBlendT * p.camBlendT * (3 - 2 * p.camBlendT);
    _blend.lerpVectors(p.camLookFrom, target, k);
    p.camLook.copy(_blend);
    return _blend;
  }
  p.camLook.copy(target);
  return target;
}

export function updateChaseCamera(p, v, dt, camera, colliders, input, vehBoxes = null) {
  if (!camera) return;
  const behind = v.yaw + Math.PI;
  if (p.chaseYaw === undefined) p.chaseYaw = behind;
  p.chaseYaw = wrapAngle(p.chaseYaw + wrapAngle(behind - p.chaseYaw) * (1 - Math.exp(-HEADING_RATE * dt)));

  if (input && (input.dx || input.dy)) {
    p.orbitYaw = wrapAngle((p.orbitYaw || 0) - input.dx * MOUSE_SENS);
    p.orbitPitch = THREE.MathUtils.clamp((p.orbitPitch || 0) + input.dy * MOUSE_SENS, PITCH_MIN, PITCH_MAX);
    p.orbitIdle = 0;
    p.orbitFromYaw = p.orbitYaw; p.orbitFromPitch = p.orbitPitch;
  } else {
    p.orbitIdle = (p.orbitIdle || 0) + dt;
    const k = Math.min(1, p.orbitIdle / RECENTRE), s = 1 - k * k * (3 - 2 * k);
    p.orbitYaw = (p.orbitFromYaw || 0) * s;
    p.orbitPitch = (p.orbitFromPitch || 0) * s;
  }

  const yaw = p.chaseYaw + p.orbitYaw;
  const pitch = p.orbitPitch;
  const horiz = DIST * Math.cos(pitch);
  _desired.set(
    v.pos.x + Math.sin(yaw) * horiz,
    v.pos.y + HEIGHT + DIST * Math.sin(pitch),
    v.pos.z + Math.cos(yaw) * horiz,
  );
  // Keep the camera above whatever walk surface (deck, terrace, step) is under it.
  const floorY = colliders ? floorHeightAt(_desired.x, _desired.z, colliders, _desired.y, 1.5) : 0;
  _desired.y = Math.max(floorY + 0.3, _desired.y);

  _pivot.set(v.pos.x, v.pos.y + PIVOT_Y, v.pos.z);
  const fast = Math.abs(v.speed || 0) > FAST;
  const ownLen = v.spec ? v.spec.halfL * 2 : 4.5;
  const full = _pivot.distanceTo(_desired);
  let dist = full;
  if (full > EPS) {
    const hit = clampHit(_pivot, _desired, colliders, vehBoxes, fast, ownLen);
    if (hit < full - EPS) dist = Math.max(0.2, hit - CAM_PAD);
  }
  // Hysteresis: shorten at once, lengthen at LENGTHEN m/s.
  if (p.chaseLimit === undefined || p.chaseLimitVeh !== v) { p.chaseLimit = dist; p.chaseLimitVeh = v; }
  else p.chaseLimit = dist < p.chaseLimit ? dist : Math.min(dist, p.chaseLimit + LENGTHEN * dt);
  dist = p.chaseLimit;
  p.camDist = dist;
  if (dist < full) _desired.sub(_pivot).multiplyScalar(dist / full).add(_pivot);

  camera.position.lerp(_desired, 1 - Math.exp(-POS_RATE * dt));
  const d = camera.position.distanceTo(_pivot);
  let limit = dist;
  if (d > EPS) {
    const hit2 = clampHit(_pivot, camera.position, colliders, vehBoxes, fast, ownLen);
    if (hit2 < d - EPS) limit = Math.min(limit, Math.max(0.2, hit2 - CAM_PAD));
  }
  if (d > limit) camera.position.sub(_pivot).multiplyScalar(limit / d).add(_pivot);

  _look.set(v.pos.x + Math.sin(v.yaw) * LOOK_AHEAD, v.pos.y + LOOK_Y, v.pos.z + Math.cos(v.yaw) * LOOK_AHEAD);
  camera.lookAt(blendLook(p, _look, dt));
}
