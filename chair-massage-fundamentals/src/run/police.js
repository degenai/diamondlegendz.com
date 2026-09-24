// Police response by wanted level (classic GTA3): 1 ranger on foot, 2 parks police cart, 3 two
// cop cars (light bars flashing, crews bail out within 12 m and chase on foot), 4 two roadblocks,
// 5 the SWAT van with 4. Units spawn once per heat episode; at level 0 everyone stands down and
// is cleared once out of the way. Also the arrest rule. The units' lifecycle (drive, bail, hang,
// clear) is police-units.js; the light bars police-lights.js.
import * as THREE from '../../vendor/three.module.js';
import { copHostile } from '../entities/hostile.js';
import { lineOfSight } from '../entities/npc-nav.js';
import { nearestNode, route, edgeSpot } from '../world/roads.js';
import { floorHeightAt } from '../physics.js';
import { SIZE } from '../world/layout.js';
import { blockAt } from '../world/district-layout.js';
import { endRun } from './end.js';
import { updateLights, flashUnit } from './police-lights.js';
import { emit } from '../events.js';
import { spawnVehicle, removeVehicle, addCop, hangUnits, driveUnit, clearUnit } from './police-units.js';

export { updateLights };
// Moved to police-units.js (refactor/split); re-exported here for one release.
export { spawnVehicle, removeVehicle, removeNpc, clearPolice } from './police-units.js';

export function createPolice() { return { units: [], tiers: {}, episode: false, arrestT: 0, pending: [] }; }

// ---- spawning ----
function footSpawn(ctx) {
  const pts = ctx.world.nav.points, p = ctx.player.pos;
  let best = null, fallback = null, fd = -1;
  for (let i = 0; i < pts.length; i++) {
    const q = pts[i], d2 = (q.x - p.x) ** 2 + (q.z - p.z) ** 2;
    if (d2 > fd && d2 < 60 * 60) { fd = d2; fallback = q; }
    if (d2 < 28 * 28 || d2 > 50 * 50) continue;
    if (!lineOfSight(ctx.world, q, p)) { best = q; break; }
    if (!best) best = q;
  }
  return (best || fallback || pts[0]).clone();
}

// Route metres from every street node to node `goal` (Dijkstra; the graph is ~130 nodes).
export function routeDist(G, goal) {
  const N = G.nodes.length, d = new Float64Array(N).fill(Infinity), done = new Uint8Array(N);
  d[goal] = 0;
  for (;;) {
    let u = -1, bu = Infinity;
    for (let i = 0; i < N; i++) if (!done[i] && d[i] < bu) { bu = d[i]; u = i; }
    if (u < 0) break;
    done[u] = 1;
    for (const w of G.adj[u]) {
      const nd = bu + Math.hypot(G.nodes[u].x - G.nodes[w].x, G.nodes[u].z - G.nodes[w].z);
      if (nd < d[w]) d[w] = nd;
    }
  }
  return d;
}

// A lane spot one block out by road (SPAWN_ROUTE metres of street to the node nearest the
// player, about 40 s for a cart to reach the plaza; ruled 2026-09-24 after run 5, when level 2
// units spawned 2..3 blocks out took ~98 s and never arrived). Never on a ring inside the plaza
// block or the player's own block; just out of the intersection, on the street toward him.
const SPAWN_ROUTE = SIZE;
function roadSpawn(ctx) {
  const G = ctx.world.roads;
  const p = ctx.player.vehicle ? ctx.player.vehicle.pos : ctx.player.pos;
  const vs = ctx.world.vehicles || [];
  const taken = ctx.police.pending;         // spawns still loading their mesh
  const goal = nearestNode(G, p.x, p.z), dist = routeDist(G, goal);
  const home = blockAt(p.x, p.z), plaza = blockAt(0, 0);
  const inside = (n) => { const b = blockAt(n.x, n.z); return (b[0] === home[0] && b[1] === home[1]) || (b[0] === plaza[0] && b[1] === plaza[1]); };
  const cands = G.nodes.map((n, i) => ({ i, d: dist[i] }))
    .filter((c) => Number.isFinite(c.d) && G.nodes[c.i].deg >= 2 && c.i !== G.exitNode && c.i !== G.escapeNode && !inside(G.nodes[c.i]))
    .sort((a, b) => Math.abs(a.d - SPAWN_ROUTE) - Math.abs(b.d - SPAWN_ROUTE));
  for (const c of cands) {
    // The street out of this node one step along the route to the player.
    let best = -1, bd = Infinity;
    for (const m of G.adj[c.i]) if (dist[m] < bd) { bd = dist[m]; best = m; }
    if (best < 0) continue;
    const s = edgeSpot(G, c.i, best, 9);
    if (vs.some((v) => (v.pos.x - s.x) ** 2 + (v.pos.z - s.z) ** 2 < 49)) continue;
    if (taken.some((q) => (q.x - s.x) ** 2 + (q.z - s.z) ** 2 < 49)) continue;
    const spot = { x: s.x, z: s.z, yaw: s.yaw, node: c.i, d: c.d };
    taken.push(spot);
    return spot;
  }
  const c0 = cands[0] ? cands[0].i : goal;
  const s = edgeSpot(G, c0, G.adj[c0][0], 9);
  return { x: s.x, z: s.z, yaw: s.yaw };
}

function spawnTier(ctx, P, tier) {
  if (tier === 1) { P.units.push({ kind: 'foot', cops: [addCop(ctx, footSpawn(ctx), 'ranger')] }); return; }
  const drive = (type, crew, rank) => {
    const s = roadSpawn(ctx);
    const unit = { kind: 'drive', type, crew, rank, cops: [], v: null, t: 0 };
    P.units.push(unit);
    spawnVehicle(ctx, type, s.x, s.z, s.yaw).then((v) => {
      const k = P.pending.indexOf(s);
      if (k >= 0) P.pending.splice(k, 1);
      if (!P.units.includes(unit)) { removeVehicle(ctx, v); return; }
      unit.v = v; v.parked = false; v.asleep = false;
      v.driver = { kind: 'aiDriver', pos: new THREE.Vector3() };
    }).catch((err) => console.warn('[CMF] police vehicle failed', err));
  };
  if (tier === 2) drive('cart', 1, 'ranger');
  else if (tier === 3) { drive('copcar', 2, 'cop'); drive('copcar', 2, 'cop'); }
  else if (tier === 4) roadblocks(ctx, P);
  else if (tier === 5) drive('swatvan', 4, 'swat');
}

// Two roadblocks at the first two intersections on the player's route to the escape (skipping
// any within 60 m of him): two cop cars nose to nose across the street just past the junction,
// a guard on the sidewalk beside them.
function roadblocks(ctx, P) {
  const G = ctx.world.roads, p = ctx.player.vehicle ? ctx.player.vehicle.pos : ctx.player.pos;
  const path = route(G, nearestNode(G, p.x, p.z), G.exitNode);
  const picks = [];
  for (let k = 0; k + 1 < path.length && picks.length < 2; k++) {
    const n = G.nodes[path[k]];
    if (n.deg < 3 || Math.hypot(n.x - p.x, n.z - p.z) < 60) continue;
    picks.push([path[k], path[k + 1]]);
  }
  P.roadblocks = picks.map(([a]) => a);
  for (const [a, b] of picks) {
    const c = edgeSpot(G, a, b, 10, 0), rx = -Math.cos(c.yaw), rz = Math.sin(c.yaw);  // right of travel
    const unit = { kind: 'block', cops: [], cars: [], node: a };
    P.units.push(unit);
    for (const k of [-1, 1]) {
      const x = c.x + rx * 2.4 * k, z = c.z + rz * 2.4 * k;
      spawnVehicle(ctx, 'copcar', x, z, Math.atan2(-rx * k, -rz * k)).then((v) => {
        if (!P.units.includes(unit)) { removeVehicle(ctx, v); return; }
        unit.cars.push(v); v.parked = true;
      }).catch((err) => console.warn('[CMF] roadblock failed', err));
    }
    const gx = c.x + rx * 5.2 + Math.sin(c.yaw) * 3, gz = c.z + rz * 5.2 + Math.cos(c.yaw) * 3;
    unit.cops.push(addCop(ctx, new THREE.Vector3(gx, floorHeightAt(gx, gz, ctx.world.colliders, 0.5), gz), 'cop', true));
  }
}

// Unlicensed vending (minimassage.js, a third quick mini-massage on one spot): a cop on foot who
// is up and working (a ranger first; the pivot ranger still hanging back counts) is sent to the
// spot, else a ranger is called in on foot out of sight. He walks to it and says his line on
// arrival (cop.js), then works as the 1-star unit. Returns the cop.
export const VENDING_LINE = 'We told you to stop that.';
export function dispatchTo(ctx, x, y, z) {
  const P = ctx.police;
  let c = null, cu = null, called = false;
  for (const u of P.units) for (const o of u.cops) {
    // Not a cop walking off a palm (loose, cop.js walkoff): his 10 s is his, like a treated man's 90.
    if (o.standDown || o.knockedT > 0 || o.outUntil > ctx.time || o.loose > 0 || o.state === 'walkoff' || !ctx.npcs.includes(o)) continue;
    if (!c || (o.rank === 'ranger' && c.rank !== 'ranger')) { c = o; cu = u; }
  }
  if (!c) {
    c = addCop(ctx, footSpawn(ctx), 'ranger');
    cu = { kind: 'foot', cops: [c] };
    P.units.push(cu);
    called = true;
  }
  if (cu.hang) { cu.hang = false; c.hang = false; }
  P.tiers[1] = true; P.episode = true;
  c.state = 'chase'; c.loose = 0;
  c.dispatch = { x, y, z, t: ctx.time, line: VENDING_LINE };
  emit('vending', { act: 'dispatch', rank: c.rank, called });
  return c;
}

export function updatePolice(P, dt, ctx) {
  const level = ctx.wanted.level;
  const p = ctx.player;
  hangUnits(P, dt, level);
  if (level > 0) {
    P.episode = true;
    for (let t = 1; t <= level; t++) if (!P.tiers[t]) { P.tiers[t] = true; spawnTier(ctx, P, t); }
  } else if (P.episode) {
    P.episode = false; P.tiers = {};
    for (const u of P.units) { u.standDown = true; for (const c of u.cops) c.standDown = true; }
  }
  const tgt = p.vehicle ? p.vehicle.pos : p.pos;
  for (let i = P.units.length - 1; i >= 0; i--) {
    const u = P.units[i];
    if (u.kind === 'drive' && u.v && !u.v.removed && u.v.driver && u.v.driver !== p) driveUnit(ctx, u, tgt, dt);
    flashUnit(u, ctx.time);
    if (u.standDown && clearUnit(ctx, u, tgt, dt)) P.units.splice(i, 1);
  }
  arrest(P, dt, ctx);
}

function arrest(P, dt, ctx) {
  const p = ctx.player;
  if (p.vehicle) { P.arrestT = 0; return; }
  let touch = false, near = false;
  for (const c of ctx.npcs) {
    if (c.kind !== 'cop' || !copHostile(c)) continue;
    if (Math.abs(c.pos.y - p.pos.y) > 1.2) continue;      // not across a ledge
    const d2 = (c.pos.x - p.pos.x) ** 2 + (c.pos.z - p.pos.z) ** 2;
    if (d2 < 1.2 * 1.2) touch = true;
    if (d2 < 2 * 2) near = true;
  }
  if (p.knockedT > 0 && near) { endRun(ctx, 'arrest'); return; }
  const speed = Math.hypot(p.vel.x, p.vel.z);
  P.arrestT = touch && speed < 0.5 ? P.arrestT + dt : Math.max(0, P.arrestT - dt);
  if (P.arrestT >= 1.5) endRun(ctx, 'arrest');
}
