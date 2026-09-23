// Minimal static collision on the XZ plane with a height for each collider.
// AABB: { minX, maxX, minZ, maxZ, maxY }   Cylinder: { kind: 'cyl', x, z, r, maxY }
// Colliders are grounded (minY = 0). Low ones are standable: an entity whose feet are at or
// above maxY - SKIN is not pushed out and can land on the top surface.
// Optional flags: floor (walk surface), invisible / noCam (ignored by the camera clamp).
import * as THREE from '../vendor/three.module.js';

export const SKIN = 0.05;        // push-out only below maxY - SKIN
export const STEP_UP = 0.3;      // grounded entities walk up ledges this high (kerbs, steps)
export const LAND_BAND = 0.35;   // falling feet this close above a top still count as landing
const SUPPORT_K = 0.6;           // footprint radius factor for standing on a top

export function circleVsAabb(pos, radius, aabb) {
  const cx = Math.max(aabb.minX, Math.min(pos.x, aabb.maxX));
  const cz = Math.max(aabb.minZ, Math.min(pos.z, aabb.maxZ));
  const dx = pos.x - cx;
  const dz = pos.z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= radius * radius) return null;
  if (d2 > 1e-10) {
    const d = Math.sqrt(d2);
    const push = radius - d;
    return new THREE.Vector3((dx / d) * push, 0, (dz / d) * push);
  }
  // Center inside the box: push out along the shallowest axis.
  const left = pos.x - aabb.minX, right = aabb.maxX - pos.x;
  const top = pos.z - aabb.minZ, bottom = aabb.maxZ - pos.z;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return new THREE.Vector3(-(left + radius), 0, 0);
  if (m === right) return new THREE.Vector3(right + radius, 0, 0);
  if (m === top) return new THREE.Vector3(0, 0, -(top + radius));
  return new THREE.Vector3(0, 0, bottom + radius);
}

export function circleVsCircle(posA, rA, posB, rB) {
  const dx = posA.x - posB.x;
  const dz = posA.z - posB.z;
  const r = rA + rB;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return null;
  const d = Math.sqrt(d2);
  if (d < 1e-6) return new THREE.Vector3(r, 0, 0);
  const push = r - d;
  return new THREE.Vector3((dx / d) * push, 0, (dz / d) * push);
}

function pushOf(pos, radius, c) {
  if (c.kind === 'cyl') return circleVsCircle(pos, radius, { x: c.x, z: c.z }, c.r);
  return circleVsAabb(pos, radius, c);
}

// Does a circle at pos overlap the collider's footprint?
export function overlapsFootprint(pos, radius, c) {
  if (c.kind === 'cyl') {
    const r = radius + c.r;
    return (pos.x - c.x) ** 2 + (pos.z - c.z) ** 2 < r * r;
  }
  const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
  const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
  return (pos.x - cx) ** 2 + (pos.z - cz) ** 2 < radius * radius;
}

// Push entity out of every collider taller than its feet; zero velocity into the contact
// normal (slide). Three passes so concave corners (two lots sharing a wall) never trap it.
export function resolveStatic(entity, colliders, iterations = 3) {
  let hit = false;
  const feet = entity.pos.y;
  for (let iter = 0; iter < iterations; iter++) {
    let moved = false;
    for (const c of colliders) {
      if (c.maxY !== undefined && feet >= c.maxY - SKIN) continue;
      const push = pushOf(entity.pos, entity.radius, c);
      if (!push) continue;
      entity.pos.x += push.x;
      entity.pos.z += push.z;
      const len = Math.hypot(push.x, push.z);
      if (len > 0 && entity.vel) {
        const nx = push.x / len, nz = push.z / len;
        const vn = entity.vel.x * nx + entity.vel.z * nz;
        if (vn < 0) { entity.vel.x -= vn * nx; entity.vel.z -= vn * nz; }
      }
      moved = hit = true;
    }
    if (!moved) break;
  }
  return hit;
}

// Height of the surface under an entity (0 = street). A top counts when the entity's feet were
// already at/above it last tick (it lands when it descends onto it), or when grounded and the
// ledge is a step (<= STEP_UP). Callers snap grounded feet down to it within LAND_BAND.
export function supportHeight(pos, radius, prevFeet, grounded, colliders) {
  let best = 0;
  const rs = radius * SUPPORT_K;
  for (const c of colliders) {
    const top = c.maxY;
    if (!(top > best) || top === Infinity) continue;
    const landing = prevFeet >= top - SKIN;
    const step = grounded && top - prevFeet <= STEP_UP && top - prevFeet > -SKIN;
    if (landing && overlapsFootprint(pos, rs, c)) best = top;
    else if (step && overlapsFootprint(pos, radius + 0.02, c)) best = top;
  }
  return best;
}

// Walk-surface height directly under a point (only colliders flagged floor). For spawning.
export function floorHeightAt(x, z, colliders) {
  let best = 0;
  const p = { x, z };
  for (const c of colliders) if (c.floor && c.maxY > best && overlapsFootprint(p, 0.01, c)) best = c.maxY;
  return best;
}

function pointInside(x, y, z, c) {
  if (y >= c.maxY) return false;
  if (c.kind === 'cyl') return (x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r;
  return x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ;
}

// Stepped march from `from` toward `to` (every `step` m). Returns the distance to the first
// sample inside a visible collider, or the full length if clear.
const _cand = [];
export function segmentHit(from, to, colliders, step = 0.25) {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-6) return 0;
  const loX = Math.min(from.x, to.x), hiX = Math.max(from.x, to.x);
  const loZ = Math.min(from.z, to.z), hiZ = Math.max(from.z, to.z);
  const loY = Math.min(from.y, to.y);
  _cand.length = 0;
  for (const c of colliders) {
    if (c.invisible || c.noCam || c.maxY <= loY) continue;
    if (c.kind === 'cyl') {
      if (c.x + c.r < loX || c.x - c.r > hiX || c.z + c.r < loZ || c.z - c.r > hiZ) continue;
    } else if (c.maxX < loX || c.minX > hiX || c.maxZ < loZ || c.minZ > hiZ) continue;
    _cand.push(c);
  }
  if (!_cand.length) return len;
  const n = Math.ceil(len / step);
  for (let i = 1; i <= n; i++) {
    const t = Math.min(1, (i * step) / len);
    const x = from.x + dx * t, y = from.y + dy * t, z = from.z + dz * t;
    for (const c of _cand) if (pointInside(x, y, z, c)) return t * len;
  }
  return len;
}
