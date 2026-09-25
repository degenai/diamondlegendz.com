// The pivot's cast and helpers (split from pivot.js; P is pivot.js's cutscene state): the boss
// who speaks first and gets back in, the "skip" banner, the ranger who jogs in, and where the
// van's drive would have come to rest (for the skip).
import * as THREE from '../vendor/three.module.js';
import { createNpc } from './entities/npc-common.js';
import { createCop } from './entities/cop.js';
import { addEntity, removeEntity } from './entities/index.js';
import { navInfo } from './entities/npc-nav.js';
import { spawnPerson } from './world/people.js';
import { disposeGoon } from './entities/goon.js';
import { floorHeightAt } from './physics.js';

const STOP_AT = 8;          // metres from the chair (pivot.js)
const BOSS_SUIT = { shirt: 0x6d6f74, pants: 0x5f6166, shoes: 0x1a1a1a };
const SKIP_TEXT = 'Press any key to skip the drive-up';   // shown during the drive-up only (pivot-skip.js)
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);
const CAM_EASE = 3;

// The boss: grey suit, no bat, out of the passenger door on the crew's side, two steps toward the
// chair. He speaks the first line, walks back and gets in (removed at the door); he never chases.
export function spawnBoss(ctx, P) {
  const v = P.van, c = ctx.world.chairSpot;
  const at = v ? v.pos : ctx.world.spawns.vanEntry.pos, yaw = v ? v.yaw : ctx.world.spawns.vanEntry.yaw;
  const s = Math.sin(yaw), co = Math.cos(yaw), off = (v ? v.spec.halfW : 1) + 0.7;
  const side = (at.x + co * off - c.x) ** 2 + (at.z - s * off - c.z) ** 2 < (at.x - co * off - c.x) ** 2 + (at.z + s * off - c.z) ** 2 ? 1 : -1;
  const x = at.x + co * off * side + s * 1.6, z = at.z - s * off * side + co * 1.6;   // the front door
  const pos = new THREE.Vector3(x, floorHeightAt(x, z, ctx.world.colliders, (at.y || 0) + 0.3), z);
  const b = createNpc('goon', spawnPerson('goon', BOSS_SUIT), pos, { role: 'boss', bat: false, radius: 0.4, update: null });
  ctx.scene.add(b.mesh);
  b.boss = true; b.state = 'script'; b.yaw = yaw + (side > 0 ? Math.PI / 2 : -Math.PI / 2);
  addEntity(ctx.entities, b);
  ctx.npcs.push(b);
  const dx = c.x - x, dz = c.z - z, d = Math.hypot(dx, dz) || 1;
  b.goal = { x: x + (dx / d) * 2.2, z: z + (dz / d) * 2.2 };
  P.boss = b; P.bossDoor = { x, z };
}

export function dropBoss(ctx, P) {
  const b = P && P.boss;
  if (!b) return;
  P.boss = null;
  const i = ctx.npcs.indexOf(b);
  if (i >= 0) ctx.npcs.splice(i, 1);
  removeEntity(ctx.entities, b);
  disposeGoon(b, ctx.scene);
}

// A course-skin line for the whole cutscene once the skip is unlocked.
export function showSkip(P) {
  const root = document.getElementById('hud');
  if (!root) return;
  const n = document.createElement('div');
  n.className = 'pv-skip';
  n.textContent = SKIP_TEXT;
  n.style.cssText = 'position:absolute;bottom:16px;left:50%;transform:translateX(-50%);pointer-events:none;'
    + 'background:var(--cm-paper,#f3ecd8);color:var(--cm-ink,#3b3326);border:1px solid var(--cm-rule,#cdbf9a);'
    + 'font:13px var(--cm-serif,Georgia,serif);padding:5px 12px;box-shadow:0 2px 6px rgba(0,0,0,.25);';
  root.appendChild(n);
  P.skipEl = n;
}
export function hideSkip(P) { if (P && P.skipEl) { P.skipEl.remove(); P.skipEl = null; } }

// The ranger: from a sidewalk / path nav point 12..26 m from the chair that the wide shot can
// see (else any), farthest from the van, to 4 m off the chair on the goons' side.
export function spawnRanger(ctx, P) {
  const c = ctx.world.chairSpot, pts = navInfo(ctx.world).points, v = P.dest;
  let best = null, bs = -Infinity;
  for (const q of pts) {
    const dc = Math.hypot(q.x - c.x, q.z - c.z);
    if (dc < 12 || dc > 26) continue;
    _a.set(q.x, q.y + 1, q.z).project(ctx.camera);
    const seen = _a.z < 1 && Math.abs(_a.x) < 0.8 && Math.abs(_a.y) < 0.9;
    const s = Math.hypot(q.x - v.x, q.z - v.z) + (seen ? 1000 : 0);
    if (s > bs) { bs = s; best = q; }
  }
  const at = (best || pts[0]).clone();
  const r = createCop(ctx.scene, at, 'ranger');
  r.state = 'script';
  addEntity(ctx.entities, r);
  ctx.npcs.push(r);
  const dx = v.x - c.x, dz = v.z - c.z, d = Math.hypot(dx, dz) || 1;
  P.ranger = r;
  P.rangerGoal = { x: c.x + (dx / d) * 4 + (-dz / d) * 2.5, y: c.y, z: c.z + (dz / d) * 4 + (dx / d) * 2.5 }; // up on the chair's deck
}

// Where the drive would have come to rest: along the route from the van's progress, the first point
// STOP_AT + 0.8 m from the chair, else the route's end (the van brakes into it), and its heading.
export function stopPoint(ctx, P) {
  const { pts, cum, total } = P.poly, c = ctx.world.chairSpot;
  let i = 1, x = pts[0].x, z = pts[0].z, yaw = P.van.yaw;
  for (let d = Math.max(0, P.poly.prog || 0); d <= total + 0.25; d += 0.25) {
    const dd = Math.min(d, total);
    while (i < pts.length - 1 && cum[i] < dd) i++;
    const a = pts[i - 1], b = pts[i], L = cum[i] - cum[i - 1] || 1, t = Math.max(0, Math.min(1, (dd - cum[i - 1]) / L));
    x = a.x + (b.x - a.x) * t; z = a.z + (b.z - a.z) * t;
    if (b.x !== a.x || b.z !== a.z) yaw = Math.atan2(b.x - a.x, b.z - a.z);
    if (Math.hypot(x - c.x, z - c.z) < STOP_AT + 0.8) break;
  }
  return { x, z, yaw };
}


// Wide shot: behind the chair, away from the van's stop, easing out from the massage camera.
export function pivotCamera(dt, ctx, P) {
  const c = ctx.world.chairSpot, cam = ctx.camera;
  _a.set(c.x - P.dest.x, 0, c.z - P.dest.z).normalize();
  const side = _b.set(-_a.z, 0, _a.x);
  const pos = _b.multiplyScalar(3).addScaledVector(_a, 6.5).add(c);
  pos.y += 4;
  const look = _a.set((c.x + P.dest.x) / 2, c.y + 0.8, (c.z + P.dest.z) / 2);
  if (P.van) look.lerp(P.van.pos, 0.2);
  const k = 1 - Math.exp(-3 * dt);
  if (P.t <= dt * 1.5) { P.camPos.copy(pos); P.camLook.copy(look); }
  P.camPos.lerp(pos, k); P.camLook.lerp(look, k);
  _m.lookAt(P.camPos, P.camLook, UP);
  _q.setFromRotationMatrix(_m);
  const e = Math.min(1, P.t / CAM_EASE), s = e * e * (3 - 2 * e);
  cam.position.lerpVectors(P.cam0, P.camPos, s);
  cam.quaternion.slerpQuaternions(P.q0, _q, s);
  cam.updateMatrixWorld();
}
