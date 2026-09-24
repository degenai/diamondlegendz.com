// Run pedestrians on the district's nav graph. At the start: the plaza's seeded spots first,
// the rest on nav points within two blocks of the player. They recycle: a ped more than 2.5
// blocks from the player (and not busy with the mini-massage) is moved to a nav point 1..2 blocks
// ahead of him, so the count stays where it started while he drives across the district.
import * as THREE from '../../vendor/three.module.js';
import { addEntity } from '../entities/index.js';
import { createPed } from '../entities/ped.js';
import { navInfo, nearestNav } from '../entities/npc-nav.js';
import { SIZE } from '../world/layout.js';

const NEAR = 2 * SIZE, FAR = 2.5 * SIZE, AHEAD0 = SIZE, AHEAD1 = 2 * SIZE;
const EVERY = 0.5;
const PEDS = 30;
const BUSY = ['kneel', 'toChair', 'leave'];

function putOnEdge(e, world, idx, rng) {
  const { adj, points } = navInfo(world);
  const nb = adj[idx].length ? adj[idx][rng.int(0, adj[idx].length - 1)] : idx;
  const t = rng.range(0, 0.7), a = points[idx], b = points[nb];
  e.pos.set(a.x + (b.x - a.x) * t, Math.max(a.y, b.y), a.z + (b.z - a.z) * t);
  e.navFrom = idx; e.navTo = nb;
}

// A nav point r0..r1 from (x, z), ahead along (dx, dz) when given.
function pickPoint(world, rng, x, z, r0, r1, dx, dz) {
  const pts = navInfo(world).points;
  let fallback = -1;
  for (let t = 0; t < 300; t++) {
    const i = rng.int(0, pts.length - 1), ox = pts[i].x - x, oz = pts[i].z - z, d = Math.hypot(ox, oz);
    if (d < r0 || d > r1) continue;
    if (fallback < 0) fallback = i;
    if (dx === undefined || ox * dx + oz * dz >= d * 0.3) return i;
  }
  return fallback;
}

export function spawnPeds(ctx, rng) {
  const world = ctx.world;
  const { points } = navInfo(world);
  const n = PEDS;
  const base = world.spawns.peds;
  const p = ctx.player.pos;
  for (let i = 0; i < n; i++) {
    let idx = -1;
    if (i < base.length) idx = nearestNav(world, base[i].x, base[i].z, base[i].y);
    if (idx < 0) idx = pickPoint(world, rng, p.x, p.z, 6, NEAR);
    if ((points[idx].x - p.x) ** 2 + (points[idx].z - p.z) ** 2 < 36) idx = pickPoint(world, rng, p.x, p.z, 6, NEAR);
    const e = createPed(ctx.scene, points[idx].clone(), idx, rng);
    putOnEdge(e, world, idx, rng);
    e.mesh.position.copy(e.pos);
    addEntity(ctx.entities, e);
    ctx.npcs.push(e);
  }
  ctx.pedTarget = n;
  ctx.pedLog = [];
  ctx.pedT = 0;
}

// "Regular client" unlock: one guaranteed willing ped idling a few metres from the chair spot.
export function spawnRegular(ctx, rng) {
  const { points } = navInfo(ctx.world);
  const c = ctx.world.chairSpot;
  let best = 0, bd = Infinity;
  for (let i = 0; i < points.length; i++) {
    const d = Math.abs(Math.hypot(points[i].x - c.x, points[i].z - c.z) - 6);
    if (d < bd) { bd = d; best = i; }
  }
  const e = createPed(ctx.scene, points[best].clone(), best, rng);
  e.regular = true; e.idleT = 6;
  addEntity(ctx.entities, e);
  ctx.npcs.push(e);
}

function travelDir(ctx) {
  const p = ctx.player, v = p.vehicle ? p.vehicle.vel : p.vel;
  const l = Math.hypot(v.x, v.z);
  if (l > 1) return [v.x / l, v.z / l];
  const d = new THREE.Vector3();
  ctx.camera.getWorldDirection(d);
  const m = Math.hypot(d.x, d.z) || 1;
  return [d.x / m, d.z / m];
}

// Per RUN tick (throttled): far peds jump ahead of the player; extras (a carjacked driver) that
// wander far are dropped instead, back to the starting count.
export function recyclePeds(ctx, dt, dispose) {
  ctx.pedT = (ctx.pedT || 0) - dt;
  if (ctx.pedT > 0 || !ctx.pedTarget) return;
  ctx.pedT = EVERY;
  const world = ctx.world, at = ctx.player.vehicle ? ctx.player.vehicle.pos : ctx.player.pos;
  const rng = ctx.pedRng || (ctx.pedRng = { next: Math.random, range: (a, b) => a + Math.random() * (b - a), int: (a, b) => a + Math.floor(Math.random() * (b - a + 1)) });
  let count = 0;
  for (const e of ctx.npcs) if (e.kind === 'ped') count++;
  let dir = null;
  for (let k = ctx.npcs.length - 1; k >= 0; k--) {
    const e = ctx.npcs[k];
    if (e.kind !== 'ped' || e.regular || BUSY.includes(e.state) || e.knockedT > 0) continue;
    const d = Math.hypot(e.pos.x - at.x, e.pos.z - at.z);
    if (d <= FAR) continue;
    if (count > ctx.pedTarget) { dispose(ctx, e); ctx.npcs.splice(k, 1); count--; continue; }
    if (!dir) dir = travelDir(ctx);
    const idx = pickPoint(world, rng, at.x, at.z, AHEAD0, AHEAD1, dir[0], dir[1]);
    if (idx < 0) continue;
    const from = [Math.round(e.pos.x), Math.round(e.pos.z)];
    putOnEdge(e, world, idx, rng);
    e.vel.set(0, 0, 0); e.state = 'wander'; e.fleeT = 0; e.idleT = 0; e.soreT = 0; e.loose = 0; e.sore = false;
    e.mesh.position.copy(e.pos);
    ctx.pedLog.push({ t: +ctx.time.toFixed(1), id: e.id, from, to: [Math.round(e.pos.x), Math.round(e.pos.z)] });
  }
}
