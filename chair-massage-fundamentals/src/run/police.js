// Police response by wanted level (classic GTA3): 1 ranger on foot, 2 parks police cart, 3 two
// cop cars (light bars flashing, crews bail out within 12 m and chase on foot), 4 two roadblocks,
// 5 the SWAT van with 4. Units spawn once per heat episode; at level 0 everyone stands down and
// is cleared once out of the way. Also the arrest rule and the light-bar flasher.
import * as THREE from '../../vendor/three.module.js';
import { loadMesh } from '../assets.js';
import { createVehicle, VEHICLE_TYPES } from '../entities/vehicle.js';
import { addEntity, removeEntity } from '../entities/index.js';
import { createCop, disposeCop, copHostile } from '../entities/cop.js';
import { lineOfSight } from '../entities/npc-nav.js';
import { ringS, ringPoint, ringDelta, ringYaw, driveRing, driveAt, brake } from './driver.js';
import { endRun } from './end.js';

const CRUISE = { copcar: 20, swatvan: 15, cart: 11 };
const BAIL = { copcar: 12, swatvan: 12, cart: 8 };
const _p = { x: 0, z: 0 };

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
  if (v.mesh.parent) v.mesh.parent.remove(v.mesh);
  if (v.lightbar) { v.lightbar.geo.dispose(); v.lightbar.mat.dispose(); }
}

// Unlit per-vehicle light bar: red and blue halves swap bright/dim at 4 Hz.
function setupLights(v) {
  const bar = v.mesh.getObjectByName('lightbar');
  if (!bar || !bar.geometry) return;
  const geo = bar.geometry.clone();
  const col = geo.getAttribute('color');
  const red = [], blue = [];
  for (let i = 0; i < col.count; i++) {
    const r = col.getX(i), b = col.getZ(i);
    if (r > 0.5 && b < 0.1) red.push(i); else if (b > 0.5 && r < 0.1) blue.push(i);
  }
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true });
  bar.geometry = geo; bar.material = mat;
  v.lightbar = { geo, mat, red, blue, phase: -1, toggles: 0 };
  v.lights = true;
}

export function updateLights(v, time) {
  if (!v || v.removed || !v.lightbar) return;
  const L = v.lightbar;
  const phase = v.lights ? Math.floor(time * 4) % 2 : 2;
  if (phase === L.phase) return;
  L.phase = phase; L.toggles++;
  const col = L.geo.getAttribute('color');
  const rOn = phase === 0, bOn = phase === 1;
  for (const i of L.red) col.setXYZ(i, rOn ? 1 : 0.18, rOn ? 0.08 : 0.01, rOn ? 0.06 : 0.01);
  for (const i of L.blue) col.setXYZ(i, bOn ? 0.1 : 0.01, bOn ? 0.35 : 0.03, bOn ? 1 : 0.16);
  col.needsUpdate = true;
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

function roadSpawn(ctx) {
  const p = ctx.player.vehicle ? ctx.player.vehicle.pos : ctx.player.pos;
  const sp = ringS(p.x, p.z);
  const vs = ctx.world.vehicles || [];
  const taken = ctx.police.pending;         // spawns still loading their mesh
  for (let k = 0; k < 12; k++) {
    const s = sp + 208 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 18;
    ringPoint(s, _p);
    if (vs.some((v) => (v.pos.x - _p.x) ** 2 + (v.pos.z - _p.z) ** 2 < 49)) continue;
    if (taken.some((q) => (q.x - _p.x) ** 2 + (q.z - _p.z) ** 2 < 49)) continue;
    const dir = Math.sign(ringDelta(s, sp)) || 1;
    const spot = { x: _p.x, z: _p.z, yaw: ringYaw(s, dir) };
    taken.push(spot);
    return spot;
  }
  ringPoint(sp + 208, _p);
  return { x: _p.x, z: _p.z, yaw: ringYaw(sp + 208, 1) };
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

// Two cop cars nose to nose across the road near the two ring corners closest to the player.
function roadblocks(ctx, P) {
  const p = ctx.player.pos;
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
    .sort((a, b) => ((a[0] * 52 - p.x) ** 2 + (a[1] * 52 - p.z) ** 2) - ((b[0] * 52 - p.x) ** 2 + (b[1] * 52 - p.z) ** 2));
  for (const [sx, sz] of corners.slice(0, 2)) {
    const vs = ctx.world.vehicles || [];
    let u = 38;
    for (const cand of [38, 34, 42, 30, 26]) {
      if (!vs.some((v) => Math.abs(v.pos.x - sx * cand) < 3.5 && Math.abs(Math.abs(v.pos.z) - 52) < 5 && Math.sign(v.pos.z) === sz)) { u = cand; break; }
    }
    const unit = { kind: 'block', cops: [], cars: [] };
    P.units.push(unit);
    for (const k of [-1, 1]) {
      spawnVehicle(ctx, 'copcar', sx * u, sz * 52 + k * 2.5, k < 0 ? 0 : Math.PI).then((v) => {
        if (!P.units.includes(unit)) { removeVehicle(ctx, v); return; }
        unit.cars.push(v); v.parked = true;
      }).catch((err) => console.warn('[CMF] roadblock failed', err));
    }
    unit.cops.push(addCop(ctx, new THREE.Vector3(sx * u + 3, 0.15, sz * 46.5), 'cop', true));
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
  const v = u.v, p = ctx.player;
  u.t += dt;
  if (u.standDown) { driveRing(v, ringS(tgt.x, tgt.z) + 208, CRUISE[u.type], dt); return; }
  const d = Math.hypot(tgt.x - v.pos.x, tgt.z - v.pos.z);
  if (!p.vehicle && (d < BAIL[u.type] || u.t > 35)) {
    brake(v);
    if (Math.abs(v.speed) < 1.5) bail(ctx, u);
    return;
  }
  // Close, or already at the loop point nearest the player (they are deep in the plaza): go in.
  const onPoint = Math.abs(ringDelta(ringS(v.pos.x, v.pos.z), ringS(tgt.x, tgt.z))) < 12;
  if (d < 30 || onPoint) driveAt(v, tgt.x, tgt.z, p.vehicle ? CRUISE[u.type] : 10, dt);
  else driveRing(v, ringS(tgt.x, tgt.z), CRUISE[u.type], dt);
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
