// Minimal static collision: circles on the XZ plane vs circles and AABBs.
// AABB shape: { minX, maxX, minZ, maxZ } (Y ignored for ground movement).
import * as THREE from '../vendor/three.module.js';

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

// Push entity out of every static collider; zero velocity into the contact normal (slide).
export function resolveStatic(entity, colliders) {
  let hit = false;
  for (let iter = 0; iter < 2; iter++) {
    let moved = false;
    for (const box of colliders) {
      if (box.maxY !== undefined && entity.pos.y > box.maxY) continue;
      const push = circleVsAabb(entity.pos, entity.radius, box);
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
