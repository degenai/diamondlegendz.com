// Chase camera while driving: settles 9 m behind the vehicle's heading at 3.5 m, looking a
// little ahead of the car. Mouse orbits it; once the mouse stops, the orbit recentres over
// 1.5 s. Clamped against colliders with segmentHit exactly like the on-foot camera.
// blendLook() eases the look target across enter/exit so the view never snaps.
import * as THREE from '../../vendor/three.module.js';
import { segmentHit } from '../physics.js';

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

const _desired = new THREE.Vector3();
const _pivot = new THREE.Vector3();
const _look = new THREE.Vector3();
const _blend = new THREE.Vector3();

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

export function updateChaseCamera(p, v, dt, camera, colliders, input) {
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
  _desired.y = Math.max(0.3, _desired.y);

  _pivot.set(v.pos.x, v.pos.y + PIVOT_Y, v.pos.z);
  const full = _pivot.distanceTo(_desired);
  let dist = full;
  if (colliders && full > 1e-4) {
    const hit = segmentHit(_pivot, _desired, colliders, 0.25);
    if (hit < full) dist = Math.max(0.2, hit - CAM_PAD);
  }
  p.camDist = dist;
  if (dist < full) _desired.sub(_pivot).multiplyScalar(dist / full).add(_pivot);

  camera.position.lerp(_desired, 1 - Math.exp(-POS_RATE * dt));
  const d = camera.position.distanceTo(_pivot);
  let limit = dist;
  if (colliders && d > 1e-4) {
    const hit2 = segmentHit(_pivot, camera.position, colliders, 0.25);
    if (hit2 < d) limit = Math.min(limit, Math.max(0.2, hit2 - CAM_PAD));
  }
  if (d > limit) camera.position.sub(_pivot).multiplyScalar(limit / d).add(_pivot);

  _look.set(v.pos.x + Math.sin(v.yaw) * LOOK_AHEAD, v.pos.y + LOOK_Y, v.pos.z + Math.cos(v.yaw) * LOOK_AHEAD);
  camera.lookAt(blendLook(p, _look, dt));
}
