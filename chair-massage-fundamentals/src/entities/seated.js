// People in vehicles. poseSeated() bends a spawnPerson rig into a driver's pose (only rotations
// and the hips' height change, so every pivot handle stays valid). seatRig() parents a rig at a
// vehicle type's `seat` (vehicle-types.js: the floor point under the driver's hips, vehicle-local,
// left = +X); unseatRig() hands it back to the scene standing. syncDriverRig() gives every
// AI-driven vehicle a cosmetic driver of the right kind (cop / ranger / SWAT / goon) and drops it
// the moment the vehicle loses its AI driver (crew bailed, van parked for good, removed).
// Cosmetic drivers are never entities and never enter ctx.npcs, so nothing collides with them,
// the camera ignores them, and the Healing Palm and the gun (which scan ctx.npcs) cannot hit them.
import { spawnPerson, disposePerson, resetPose } from '../world/people.js';
import { loadMesh } from '../assets.js';
import { OUTFIT } from './cop.js';

export const SEAT_HIP = 0.42;         // hip joint above the seat point (the floor under the hips)
const THIGH_UP = 0.2;                 // knees a little above the hips
const SHIN_FWD = 0.3;                 // shins reach forward to the pedals
const LEAN = 0.06;                    // torso: upright, a touch toward the wheel
const ARM = -1.0, FOREARM = -0.6, ARM_IN = 0.16; // hands forward to a wheel

// Driver's pose, person-local (faces +Z, origin under the hips). Feet land ~SEAT_HIP below.
export function poseSeated(rig) {
  resetPose(rig);
  const { joints: j, body, hips, torso, head } = rig.userData;
  hips.position.set(0, SEAT_HIP - body.position.y, 0);
  if (torso.userData.restY !== undefined) torso.position.y = torso.userData.restY; // no walk bob
  torso.rotation.x = LEAN;
  head.rotation.x = -LEAN;             // eyes level on the road
  for (const [s, side] of [[1, 'L'], [-1, 'R']]) {
    j['upperLeg' + side].rotation.set(-Math.PI / 2 - THIGH_UP, 0, 0.05 * s);
    j['lowerLeg' + side].rotation.x = Math.PI / 2 + THIGH_UP - SHIN_FWD;
    j['upperArm' + side].rotation.set(ARM, 0, -ARM_IN * s);
    j['lowerArm' + side].rotation.set(FOREARM, 0, 0);
  }
  rig.userData.seated = true;
  rig.updateMatrixWorld(true);
}

// Parent `rig` to the vehicle's leaning body at its type's seat, posed.
export function seatRig(rig, v) {
  const seat = v.spec.seat || { x: 0, y: 0, z: 0 };
  (v.body || v.mesh).add(rig);
  rig.position.set(seat.x, seat.y, seat.z);
  rig.rotation.set(0, 0, 0);
  poseSeated(rig);
  rig.visible = true;
}

// Back into `parent` standing at world (pos, yaw) with the neutral walking pose.
export function unseatRig(rig, parent, pos, yaw) {
  if (rig.parent !== parent) parent.add(rig);
  resetPose(rig);
  rig.userData.seated = false;
  rig.position.copy(pos);
  rig.rotation.set(0, yaw, 0);
  rig.visible = true;
}

// Which cosmetic driver an AI vehicle gets: police by type, anything else is Serenity (a goon).
function driverKind(v) {
  if (!v.police) return { kind: 'goon', rank: null };
  const rank = v.type === 'cart' ? 'ranger' : v.type === 'swatvan' ? 'swat' : 'cop';
  return { kind: 'cop', rank };
}

function spawnDriver(v) {
  const { kind, rank } = driverKind(v);
  const rig = spawnPerson(kind, rank ? OUTFIT[rank] || undefined : undefined);
  rig.name = 'seatedDriver';
  rig.userData.cosmetic = true;
  rig.userData.rank = rank;
  if (rank === 'ranger') {
    loadMesh('assets/ranger.json').then((g) => {
      if (v.seatRig !== rig) return;     // bailed before the hat arrived
      const hat = g.getObjectByName('hat') || g;
      hat.position.set(0, 0.25, 0.01);
      rig.userData.head.add(hat);
    }).catch((err) => console.warn('[CMF] ranger hat failed', err));
  }
  seatRig(rig, v);
  return rig;
}

// Remove the cosmetic driver (if any) from the vehicle and free its geometry.
export function clearDriverRig(v) {
  const rig = v.seatRig;
  if (!rig) return;
  v.seatRig = null;
  if (rig.parent) rig.parent.remove(rig);
  disposePerson(rig);
}

// Per vehicle tick: an AI driver shows a seated person; no AI driver, no person.
export function syncDriverRig(v, ctx) {
  const ai = v.driver && v.driver !== ctx.player && v.driver.kind === 'aiDriver' && !v.removed;
  if (ai && !v.seatRig) v.seatRig = spawnDriver(v);
  else if (!ai && v.seatRig) clearDriverRig(v);
}
