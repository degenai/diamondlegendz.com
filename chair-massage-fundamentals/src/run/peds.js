// Run pedestrians on the district's nav graph, kept as a per-block quota round the player: his own
// block 9, each block one away 3, each block two away 1 (40 at most; blocks off the district edge
// simply get none). At the start the plaza's seeded spots fill the plaza's quota and every other
// block within two gets its share. Every half second the blocks over quota (anything beyond two
// blocks is over by definition) give their farthest idle ped to the block most under quota, up to
// four moves a tick, so a block he walks or drives into fills within a few seconds.
// Ruled 2026-09-24 after run 5 ("blocks with no pedestrians"): the old rule seeded 16 of 30 peds
// on the plaza and recycled only past 2.5 blocks (400 m). In a 4x4 district nothing is ever that
// far from the plaza, so those 16 never left it and the other 14 were spread over a dozen
// blocks: one or two per block, none on many. Every centre type has nav points (146..183 per
// block); the gaps were the budget, not the graph.
import { addEntity } from '../entities/index.js';
import { createPed } from '../entities/ped.js';
import { navInfo, nearestNav } from '../entities/npc-nav.js';
import { blockAt } from '../world/layout.js';
import { emit } from '../events.js';

const QUOTA = [9, 3, 1];     // by Chebyshev block distance from the player's block
const PEDS = 40;
const EVERY = 0.5;
const MOVES = 4;             // re-homed per tick
const HIDE_R = 35;           // a re-homed ped lands at least this far from the player
const BUSY = ['kneel', 'toChair', 'leave'];

const key = (b) => `${b[0]},${b[1]}`;

// Nav point ids per block (by the block the point stands in).
function blockPoints(world) {
  if (world._pedBlocks) return world._pedBlocks;
  const m = new Map();
  navInfo(world).points.forEach((p, i) => {
    const k = key(blockAt(p.x, p.z));
    let l = m.get(k);
    if (!l) m.set(k, (l = []));
    l.push(i);
  });
  return (world._pedBlocks = m);
}

// Quota per block key for a player standing in block `home` (only blocks that exist).
function quotas(world, home) {
  const q = new Map(), B = blockPoints(world);
  for (const k of B.keys()) {
    const [i, j] = k.split(',').map(Number);
    const c = Math.max(Math.abs(i - home[0]), Math.abs(j - home[1]));
    if (c < QUOTA.length) q.set(k, QUOTA[c]);
  }
  return q;
}

function putOnEdge(e, world, idx, rng) {
  const { adj, points } = navInfo(world);
  const nb = adj[idx].length ? adj[idx][rng.int(0, adj[idx].length - 1)] : idx;
  const t = rng.range(0, 0.7), a = points[idx], b = points[nb];
  e.pos.set(a.x + (b.x - a.x) * t, Math.max(a.y, b.y), a.z + (b.z - a.z) * t);
  e.navFrom = idx; e.navTo = nb;
}

// A nav point in block `k`, at least `r0` m from (x, z) when it can manage (behind the camera
// preferred when (fx, fz) is given).
function pointIn(world, k, rng, x, z, r0, fx, fz) {
  const ids = blockPoints(world).get(k), pts = navInfo(world).points;
  if (!ids || !ids.length) return -1;
  let fallback = -1;
  for (let t = 0; t < 40; t++) {
    const i = ids[rng.int(0, ids.length - 1)], dx = pts[i].x - x, dz = pts[i].z - z;
    if (dx * dx + dz * dz < r0 * r0) continue;
    if (fallback < 0) fallback = i;
    if (fx === undefined || dx * fx + dz * fz < 0) return i;
  }
  return fallback >= 0 ? fallback : ids[rng.int(0, ids.length - 1)];
}

function addPed(ctx, idx, rng) {
  const world = ctx.world, e = createPed(ctx.scene, navInfo(world).points[idx].clone(), idx, rng);
  putOnEdge(e, world, idx, rng);
  e.mesh.position.copy(e.pos);
  addEntity(ctx.entities, e);
  ctx.npcs.push(e);
  return e;
}

export function spawnPeds(ctx, rng) {
  const world = ctx.world, p = ctx.player.pos;
  const Q = quotas(world, blockAt(p.x, p.z));
  const plaza = key(blockAt(0, 0));
  let n = 0;
  // The plaza's seeded spots first (up to its quota), then each block's share.
  const base = world.spawns.peds;
  const filled = new Map();
  for (let i = 0; i < base.length && n < PEDS && (filled.get(plaza) || 0) < (Q.get(plaza) || 0); i++) {
    const idx = nearestNav(world, base[i].x, base[i].z, base[i].y);
    if ((navInfo(world).points[idx].x - p.x) ** 2 + (navInfo(world).points[idx].z - p.z) ** 2 < 36) continue;
    addPed(ctx, idx, rng); n++;
    filled.set(plaza, (filled.get(plaza) || 0) + 1);
  }
  const order = [...Q.entries()].sort((a, b) => b[1] - a[1]);
  for (const [k, want] of order) {
    for (let have = filled.get(k) || 0; have < want && n < PEDS; have++) {
      const idx = pointIn(world, k, rng, p.x, p.z, 6);
      if (idx < 0) break;
      addPed(ctx, idx, rng); n++;
    }
  }
  ctx.pedTarget = n;
  ctx.pedLog = [];
  ctx.pedT = 0;
  ctx.pedHome = null;
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

const movable = (e) => e.kind === 'ped' && !e.regular && !BUSY.includes(e.state) && !(e.knockedT > 0) && e.state !== 'treated';

// Per RUN tick (throttled): rebalance the blocks round the player; extras (a carjacked driver)
// beyond two blocks are dropped instead, back to the starting count.
export function recyclePeds(ctx, dt, dispose) {
  ctx.pedT = (ctx.pedT || 0) - dt;
  if (ctx.pedT > 0 || !ctx.pedTarget) return;
  ctx.pedT = EVERY;
  const world = ctx.world, at = ctx.player.vehicle ? ctx.player.vehicle.pos : ctx.player.pos;
  const rng = ctx.pedRng || (ctx.pedRng = { next: Math.random, range: (a, b) => a + Math.random() * (b - a), int: (a, b) => a + Math.floor(Math.random() * (b - a + 1)) });
  const home = blockAt(at.x, at.z), hk = key(home);
  const Q = quotas(world, home);
  const by = new Map();
  let count = 0;
  for (let k = 0; k < ctx.npcs.length; k++) {
    const e = ctx.npcs[k];
    if (e.kind !== 'ped') continue;
    count++;
    const bk = key(blockAt(e.pos.x, e.pos.z));
    let l = by.get(bk);
    if (!l) by.set(bk, (l = []));
    l.push(e);
  }
  // Extras past two blocks go first.
  for (let k = ctx.npcs.length - 1; k >= 0 && count > ctx.pedTarget; k--) {
    const e = ctx.npcs[k];
    if (!movable(e) || Q.has(key(blockAt(e.pos.x, e.pos.z)))) continue;
    dispose(ctx, e); ctx.npcs.splice(k, 1); count--;
    const l = by.get(key(blockAt(e.pos.x, e.pos.z))); if (l) l.splice(l.indexOf(e), 1);
  }
  const need = [...Q.entries()].map(([k, q]) => [k, q - (by.get(k) || []).length]).filter(([, d]) => d > 0).sort((a, b) => b[1] - a[1]);
  if (!need.length) { note(ctx, hk, 0, (by.get(hk) || []).length); return; }
  const cam = ctx.camera, f = cam ? cam.getWorldDirection(ctx._pedDir || (ctx._pedDir = cam.position.clone())) : null;
  let moves = 0;
  for (const nd of need) {
    while (nd[1] > 0 && moves < MOVES) {
      // Donor: the block most over its quota (0 for blocks beyond two), its ped farthest from him.
      let donor = null, surplus = 0;
      for (const [k, l] of by) {
        const s = l.length - (Q.get(k) || 0);
        if (k !== nd[0] && s > surplus && l.some(movable)) { surplus = s; donor = k; }
      }
      if (!donor) break;
      const l = by.get(donor);
      let e = null, fd = -1;
      for (const o of l) { if (!movable(o)) continue; const d = (o.pos.x - at.x) ** 2 + (o.pos.z - at.z) ** 2; if (d > fd) { fd = d; e = o; } }
      const idx = pointIn(world, nd[0], rng, at.x, at.z, nd[0] === hk ? HIDE_R : 12, f && f.x, f && f.z);
      if (idx < 0) break;
      const from = [Math.round(e.pos.x), Math.round(e.pos.z)];
      putOnEdge(e, world, idx, rng);
      e.vel.set(0, 0, 0); e.state = 'wander'; e.fleeT = 0; e.idleT = 0; e.soreT = 0; e.loose = 0; e.sore = false;
      e.mesh.position.copy(e.pos);
      l.splice(l.indexOf(e), 1);
      let t = by.get(nd[0]); if (!t) by.set(nd[0], (t = [])); t.push(e);
      nd[1]--; moves++;
      ctx.pedLog.push({ t: +ctx.time.toFixed(1), id: e.id, from, to: [Math.round(e.pos.x), Math.round(e.pos.z)] });
      if (ctx.pedLog.length > 200) ctx.pedLog.splice(0, 100);
    }
    if (moves >= MOVES) break;
  }
  note(ctx, hk, moves, by.get(hk) ? by.get(hk).length : 0);
}

// Watcher: one `peds` event each time he enters a new block (how many were there, how many came).
function note(ctx, hk, moves, have) {
  const H = ctx.pedHome;
  if (!H || H.k !== hk) {
    if (H && H.k) emit('peds', { block: H.k, arrived: H.have0, moved: H.moved, have: H.have });
    ctx.pedHome = { k: hk, have0: have ?? 0, have: have ?? 0, moved: 0 };
    return;
  }
  H.moved += moves;
  if (have !== undefined) H.have = have;
}
