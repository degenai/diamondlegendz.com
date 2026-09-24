// The Serenity Group's goons: the opening pack of three and the van's 90 s waves (GOON_CAP alive).
// The first three come out of the van during the PIVOT (pivot.js calls spawnGoons); spawner.begin()
// only spawns them itself on the debug path that skips the pivot (openingPack). Every WAVE s the
// van driver (van-ai.js) breaks off whatever he is doing, returns to vanEntry and drops three more.
import * as THREE from '../../vendor/three.module.js';
import { floorHeightAt } from '../physics.js';
import { addEntity } from '../entities/index.js';
import { createGoon } from '../entities/goon.js';
import { driveRoute, driveAt, brake } from './driver.js';
import { nearestNode } from '../world/roads.js';

export const WAVE = 90;
export const GOON_CAP = 9;
export const VAN_CRUISE = 14;

export function countKind(ctx, kind) {
  let n = 0;
  for (const e of ctx.npcs) if (e.kind === kind) n++;
  return n;
}

// Out of the van's side door (the side facing the plaza), or at vanEntry without a van.
// wave: the van's drop (waveStep); the opening three (pivot.js) are not a wave.
export function spawnGoons(ctx, n, wave = false) {
  const alive = countKind(ctx, 'goon');
  n = Math.min(n, GOON_CAP - alive);
  const van = ctx.world.vehicles && ctx.world.vehicles.find((v) => v.franchise);
  const at = van ? van.pos : ctx.world.spawns.vanEntry.pos;
  const yaw = van ? van.yaw : ctx.world.spawns.vanEntry.yaw;
  const s = Math.sin(yaw), c = Math.cos(yaw);
  const off = (van ? van.spec.halfW : 1) + 0.9;
  const side = (at.x + c * off) ** 2 + (at.z - s * off) ** 2 < (at.x - c * off) ** 2 + (at.z + s * off) ** 2 ? 1 : -1;
  for (let k = 0; k < n; k++) {
    const along = (k - 1) * 1.1;
    const x = at.x + c * off * side + s * along, z = at.z - s * off * side + c * along;
    const pos = new THREE.Vector3(x, floorHeightAt(x, z, ctx.world.colliders, (at.y || 0) + 0.3), z); // the van may be up on the terrace
    const idx = alive + k;
    const g = createGoon(ctx.scene, pos, idx % 3 === 2 ? 'flank' : 'direct', idx % 3 === 0);
    g.yaw = yaw + (side > 0 ? Math.PI / 2 : -Math.PI / 2);
    g.wave = wave;
    addEntity(ctx.entities, g);
    ctx.npcs.push(g);
  }
  return n;
}

// The debug path that skips the pivot: begin() spawns the opening three itself.
export function openingPack(ctx) {
  if (countKind(ctx, 'goon') === 0) spawnGoons(ctx, 3);
}

// The van's wave clock (A = ctx.vanAI, v its van). Returns true while a drop owns the van this
// tick: to vanEntry by the street graph, then three goons out of the side door.
export function waveStep(ctx, A, v, dt) {
  A.waveT += dt;
  if (A.waveT >= WAVE && A.mode !== 'drop') { A.mode = 'drop'; A.dropT = 0; A.parked = false; A.shoves = 0; }
  if (A.mode !== 'drop') return false;
  A.dropT += dt;
  const e = ctx.world.spawns.vanEntry.pos;
  const d = Math.hypot(e.x - v.pos.x, e.z - v.pos.z);
  if (d > 16) driveRoute(v, ctx.world.roads, nearestNode(ctx.world.roads, e.x, e.z), VAN_CRUISE, dt);
  else if (d > 3.5) driveAt(v, e.x, e.z, 7, dt);
  else brake(v);
  if ((d <= 3.5 && Math.abs(v.speed) < 0.5) || A.dropT > 30) {
    spawnGoons(ctx, 3, true);
    A.mode = 'wait'; A.waveT = 0; A.spawnedAt = ctx.time; A.parked = false;
  }
  return true;
}
