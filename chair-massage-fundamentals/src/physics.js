// Minimal static collision on the XZ plane with a height for each collider.
// AABB: { minX, maxX, minZ, maxZ, maxY }   Cylinder: { kind: 'cyl', x, z, r, maxY }
// Colliders are grounded (minY = 0). Low ones are standable: an entity whose feet are at or
// above maxY - SKIN is not pushed out and can land on the top surface.
// Optional flags: floor (walk surface), invisible / noCam (ignored by the camera clamp).
// camOnly colliders may carry a minY (a roof slab): segment tests then see only minY..maxY.
import * as THREE from '../vendor/three.module.js';
import { query } from './physics-grid.js';

const _qa = [], _qb = [], _qc = [], _qd = [], _qe = [];

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
  const m = entity.radius + 1.5;
  colliders = query(colliders, entity.pos.x - m, entity.pos.x + m, entity.pos.z - m, entity.pos.z + m, _qa);
  for (let iter = 0; iter < iterations; iter++) {
    let moved = false;
    for (const c of colliders) {
      if (c.camOnly) continue;
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
  colliders = query(colliders, pos.x - radius - 0.1, pos.x + radius + 0.1, pos.z - radius - 0.1, pos.z + radius + 0.1, _qb);
  for (const c of colliders) {
    if (c.camOnly) continue;
    const top = c.maxY;
    if (!(top > best) || top === Infinity) continue;
    const landing = prevFeet >= top - SKIN;
    const step = grounded && top - prevFeet <= STEP_UP && top - prevFeet > -SKIN;
    // Grounded walk-off uses the smaller support radius so edges feel natural; a
    // descending airborne entity uses its full radius so no dead ring exists where
    // pushout fires but landing does not.
    if (landing && overlapsFootprint(pos, grounded ? rs : radius, c)) best = top;
    else if (step && overlapsFootprint(pos, radius + 0.02, c)) best = top;
  }
  return best;
}

// Walk-surface height directly under a point (only colliders flagged floor). For spawning.
// Only tops within `reach` metres above `y` count, so a spawn inside a building
// footprint is not lifted onto its roof.
export function floorHeightAt(x, z, colliders, y = 0, reach = 1.0) {
  let best = 0;
  const p = { x, z };
  colliders = query(colliders, x - 0.1, x + 0.1, z - 0.1, z + 0.1, _qc);
  for (const c of colliders) {
    if (!c.floor || !(c.maxY > best) || c.maxY > y + reach) continue;
    if (overlapsFootprint(p, 0.01, c)) best = c.maxY;
  }
  return best;
}

function pointInside(x, y, z, c) {
  if (y >= c.maxY) return false;
  if (c.kind === 'cyl') return (x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r;
  return x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ;
}

// Analytic segment test from `from` toward `to`. Returns the distance to the first
// visible collider entered (slab test for boxes, quadratic for cylinders, capped by
// each collider's top), or the full length if clear. Thin walls cannot be skipped.
// The full length is sqrt of the summed squares, bit-identical to THREE's distanceTo, so a
// caller's `hit < from.distanceTo(to)` is never true on a clear segment. (Math.hypot rounds
// differently: ~18% of the time it came out one ulp short, and the cameras read that as a
// hit at their own end point and pulled in by CAM_PAD - the chase-cam zoom jitter.)
// Optional `skip(c)` leaves a collider out of this test.
const _cand = [];
function slabHit(from, dx, dy, dz, len, c) {
  let t0 = 0, t1 = 1;
  const axes = [[from.x, dx, c.minX, c.maxX], [from.z, dz, c.minZ, c.maxZ], [from.y, dy, c.minY ?? -Infinity, c.maxY]];
  for (const [o, d, lo, hi] of axes) {
    if (Math.abs(d) < 1e-9) { if (o <= lo || o >= hi) return Infinity; continue; }
    let a = (lo - o) / d, b = (hi - o) / d;
    if (a > b) { const tmp = a; a = b; b = tmp; }
    if (a > t0) t0 = a;
    if (b < t1) t1 = b;
    if (t0 > t1) return Infinity;
  }
  return t0 * len;
}
function cylHit(from, dx, dy, dz, len, c) {
  const fx = from.x - c.x, fz = from.z - c.z;
  const A = dx * dx + dz * dz, B = 2 * (fx * dx + fz * dz), C = fx * fx + fz * fz - c.r * c.r;
  let t0, t1;
  if (A < 1e-12) { if (C >= 0) return Infinity; t0 = 0; t1 = 1; }
  else {
    const disc = B * B - 4 * A * C;
    if (disc < 0) return Infinity;
    const sq = Math.sqrt(disc);
    t0 = (-B - sq) / (2 * A); t1 = (-B + sq) / (2 * A);
    if (t1 < 0 || t0 > 1) return Infinity;
    t0 = Math.max(0, t0); t1 = Math.min(1, t1);
  }
  // Clip to below the top.
  if (Math.abs(dy) < 1e-9) { if (from.y >= c.maxY) return Infinity; }
  else {
    const ty = (c.maxY - from.y) / dy;
    if (dy > 0) t1 = Math.min(t1, ty); else t0 = Math.max(t0, ty);
    if (t0 > t1) return Infinity;
  }
  return t0 * len;
}
export function segmentHit(from, to, colliders, _step = 0.25, skip = null) {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (len < 1e-6) return 0;
  const loX = Math.min(from.x, to.x), hiX = Math.max(from.x, to.x);
  const loZ = Math.min(from.z, to.z), hiZ = Math.max(from.z, to.z);
  const loY = Math.min(from.y, to.y), hiY = Math.max(from.y, to.y);
  let best = len;
  colliders = query(colliders, loX - 0.1, hiX + 0.1, loZ - 0.1, hiZ + 0.1, _qd);
  for (const c of colliders) {
    if (c.invisible || c.noCam || c.maxY <= loY || c.minY >= hiY || (skip && skip(c))) continue;
    if (c.kind === 'cyl') {
      if (c.x + c.r < loX || c.x - c.r > hiX || c.z + c.r < loZ || c.z - c.r > hiZ) continue;
    } else if (c.maxX < loX || c.minX > hiX || c.maxZ < loZ || c.minZ > hiZ) continue;
    const h = c.kind === 'cyl' ? cylHit(from, dx, dy, dz, len, c) : slabHit(from, dx, dy, dz, len, c);
    if (h < best) best = h;
  }
  return best;
}

// Push a circle out of every collider standing above `feet` (same skip rules as resolveStatic),
// in one pass. Mutates pos; returns the summed push in `out` ({ x, z }, zero when clear).
// Vehicles use it per body circle and turn the push into an impact.
export function pushCircle(pos, radius, feet, colliders, out = { x: 0, z: 0 }) {
  out.x = 0; out.z = 0;
  const m = radius + 1;
  colliders = query(colliders, pos.x - m, pos.x + m, pos.z - m, pos.z + m, _qe);
  for (const c of colliders) {
    if (c.camOnly) continue;
    if (c.maxY !== undefined && feet >= c.maxY - SKIN) continue;
    if (!overlapsFootprint(pos, radius, c)) continue;
    const push = pushOf(pos, radius, c);
    if (!push) continue;
    pos.x += push.x; pos.z += push.z;
    out.x += push.x; out.z += push.z;
  }
  return out;
}
