// Police response by wanted level (classic GTA3): 1 ranger on foot, 2 parks police cart, 3 two
// cop cars (light bars flashing, crews bail out within 12 m and chase on foot), 4 two roadblocks,
// 5 the SWAT van with 4. Units spawn once per heat episode; at level 0 everyone stands down and
// is cleared once out of the way. Also the arrest rule and the light-bar flasher.
import * as THREE from '../../vendor/three.module.js';
import { loadMesh } from '../assets.js';
import { createVehicle, VEHICLE_TYPES } from '../entities/vehicle.js';
import { addEntity, removeEntity } from '../entities/index.js';
import { createCop, disposeCop, copHostile } from '../entities/cop.js';
import { clearDriverRig } from '../entities/seated.js';
import { lineOfSight } from '../entities/npc-nav.js';
import { driveRoute, driveAt, brake } from './driver.js';
import { nearestNode, route, edgeSpot } from '../world/roads.js';
import { floorHeightAt } from '../physics.js';
import { SIZE } from '../world/layout.js';
import { endRun } from './end.js';
import { setupLights, updateLights } from './lights.js';
import { blocked } from './traffic.js';

export { updateLights };

const CRUISE = { copcar: 20, swatvan: 15, cart: 11 };
const BAIL = { copcar: 12, swatvan: 12, cart: 8 };

export function createPolice() { return { units: [], tiers: {}, episode: false, arrestT: 0, pending: [] }; }

// ---- vehicles ----
export function spawnVehicle(ctx, type, x, z, yaw) {
  return loadMesh(VEHICLE_TYPES[type].asset).then((mesh) => {
    const world = ctx.world;
    mesh.name = 'police_' + type;
    world.root.add(mesh);
    const v = createVehicle(type, mesh, new THREE.Vector3(x, 0, z), yaw);
    v.police = true;
    if (!world.vehicles) world.vehicles = [];
    world.vehicles.push(v);
    addEntity(ctx.entities, v);
    setupLights(v);
    return v;
  });
}

export function removeVehicle(ctx, v) {
  const L = ctx.world.vehicles, i = L.indexOf(v);
  if (i >= 0) L.splice(i, 1);
  removeEntity(ctx.entities, v);
  clearDriverRig(v);                          // the cosmetic driver goes with the car
  if (v.mesh.parent) v.mesh.parent.remove(v.mesh);
  if (v.lightbar) { v.lightbar.geo.dispose(); v.lightbar.mat.dispose(); }
}

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

// A lane spot on the street grid 2..3 blocks from the player (nearest 2.5 blocks first), just out
// of an intersection on the street that leads toward him.
function roadSpawn(ctx) {
  const G = ctx.world.roads;
  const p = ctx.player.vehicle ? ctx.player.vehicle.pos : ctx.player.pos;
  const vs = ctx.world.vehicles || [];
  const taken = ctx.police.pending;         // spawns still loading their mesh
  const cands = G.nodes.map((n, i) => ({ i, d: Math.hypot(n.x - p.x, n.z - p.z) }))
    .filter((c) => G.nodes[c.i].deg >= 2 && c.i !== G.exitNode)
    .sort((a, b) => Math.abs(a.d - 2.5 * SIZE) - Math.abs(b.d - 2.5 * SIZE));
  for (const c of cands) {
    // The street out of this node that heads most directly at the player.
    let best = -1, bd = Infinity;
    for (const m of G.adj[c.i]) { const n = G.nodes[m], d = Math.hypot(n.x - p.x, n.z - p.z); if (d < bd) { bd = d; best = m; } }
    if (best < 0) continue;
    const s = edgeSpot(G, c.i, best, 9);
    if (vs.some((v) => (v.pos.x - s.x) ** 2 + (v.pos.z - s.z) ** 2 < 49)) continue;
    if (taken.some((q) => (q.x - s.x) ** 2 + (q.z - s.z) ** 2 < 49)) continue;
    const spot = { x: s.x, z: s.z, yaw: s.yaw, node: c.i, d: c.d };
    taken.push(spot);
    return spot;
  }
  const s = edgeSpot(G, cands[0].i, G.adj[cands[0].i][0], 9);
  return { x: s.x, z: s.z, yaw: s.yaw };
}

function addCop(ctx, pos, rank, guard) {
  const c = createCop(ctx.scene, pos, rank, guard);
  addEntity(ctx.entities, c);
  ctx.npcs.push(c);
  return c;
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

// ---- per tick ----
const HANG = 15;   // s the pivot ranger stands by the chair at wanted 0 before he leaves

// The pivot's ranger (pivot.js beginRun): the 1-star unit if wanted reaches 1, else he stands down.
function hangUnits(P, dt, level) {
  for (const u of P.units) {
    if (!u.hang) continue;
    u.t += dt;
    const r = u.cops[0];
    if (level > 0 && !P.tiers[1]) {
      P.tiers[1] = true; u.hang = false;
      if (r) { r.hang = false; if (r.state === 'hang') r.state = 'chase'; }
    } else if (u.t >= HANG || level > 0) {
      u.hang = false; u.standDown = true;
      if (r) { r.hang = false; r.standDown = true; }
    }
  }
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
    for (const v of [u.v, ...(u.cars || [])]) if (v) updateLights(v, ctx.time);
    if (u.standDown && clearUnit(ctx, u, tgt, dt)) P.units.splice(i, 1);
  }
  arrest(P, dt, ctx);
}

function driveUnit(ctx, u, tgt, dt) {
  const v = u.v, p = ctx.player, G = ctx.world.roads;
  u.t += dt;
  if (u.standDown) {                          // off down the street, away from him
    if (u.away === undefined) {
      let far = 0, fd = -1;
      G.nodes.forEach((n, i) => { const d = Math.hypot(n.x - tgt.x, n.z - tgt.z); if (d > fd && d < 3 * SIZE && i !== G.exitNode) { fd = d; far = i; } });
      u.away = far;
    }
    driveRoute(v, G, u.away, CRUISE[u.type], dt);
    return;
  }
  const d = Math.hypot(tgt.x - v.pos.x, tgt.z - v.pos.z);
  if (!p.vehicle && (d < BAIL[u.type] || u.t > 35 && d < 60)) {
    brake(v);
    if (Math.abs(v.speed) < 1.5) bail(ctx, u);
    return;
  }
  // Close, or already at the street node nearest the player (he is deep in a block): go in.
  const goal = nearestNode(G, tgt.x, tgt.z), n = G.nodes[goal];
  const onPoint = Math.hypot(n.x - v.pos.x, n.z - v.pos.z) < 12;
  if (d < 30 || onPoint) driveAt(v, tgt.x, tgt.z, p.vehicle ? CRUISE[u.type] : 10, dt);
  else if (blocked(ctx, v, 4) === 'car' && Math.abs(v.speed) > 0.5) brake(v);   // the unit in front
  else driveRoute(v, G, goal, CRUISE[u.type], dt);
}

function bail(ctx, u) {
  const v = u.v, s = Math.sin(v.yaw), c = Math.cos(v.yaw);
  for (let k = 0; k < u.crew; k++) {
    const side = k % 2 ? -1 : 1, along = (Math.floor(k / 2) - 0.5) * 1.2;
    const off = v.spec.halfW + 0.7;
    const pos = new THREE.Vector3(v.pos.x + c * off * side + s * along, v.pos.y, v.pos.z - s * off * side + c * along);
    u.cops.push(addCop(ctx, pos, u.rank));
  }
  v.driver = null; v.ai = null; v.parked = true;
  clearDriverRig(v);                          // the driver is one of the crew now, on foot
  u.kind = 'bailed';
}

// Stand-down clean-up: returns true when the unit is gone.
function clearUnit(ctx, u, tgt, dt) {
  u.clearT = (u.clearT || 0) + dt;
  const far = (o) => (o.pos.x - tgt.x) ** 2 + (o.pos.z - tgt.z) ** 2 > 40 * 40 || u.clearT > 20;
  for (let i = u.cops.length - 1; i >= 0; i--) {
    const c = u.cops[i];
    if (far(c)) { removeNpc(ctx, c); u.cops.splice(i, 1); }
  }
  const vs = [u.v, ...(u.cars || [])].filter(Boolean);
  let left = 0;
  for (const v of vs) {
    if (v.driver === ctx.player || v.chairLoaded || !far(v)) { left++; continue; }
    if (!v.removed) { v.removed = true; removeVehicle(ctx, v); }
    if (u.v === v) u.v = null;
    else if (u.cars) { const k = u.cars.indexOf(v); if (k >= 0) u.cars.splice(k, 1); }
  }
  return u.cops.length === 0 && left === 0;
}

export function removeNpc(ctx, e) {
  const i = ctx.npcs.indexOf(e);
  if (i >= 0) ctx.npcs.splice(i, 1);
  removeEntity(ctx.entities, e);
  disposeCop(e, ctx.scene);
}

export function clearPolice(P, ctx) {
  for (const u of P.units) {
    for (const c of u.cops) removeNpc(ctx, c);
    for (const v of [u.v, ...(u.cars || [])]) if (v && !v.removed && v.driver !== ctx.player) { v.removed = true; removeVehicle(ctx, v); }
  }
  P.units.length = 0; P.tiers = {}; P.episode = false; P.arrestT = 0; P.pending.length = 0;
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
