// Police units' lifecycle: the vehicles they come in (spawn, remove), officers on foot (addCop),
// driving at the player, bailing out, the pivot ranger's hang-back, the stand-down clean-up.
// police.js decides which tiers spawn and dispatches; this module runs the units it made.
import * as THREE from '../../vendor/three.module.js';
import { loadMesh } from '../assets.js';
import { createVehicle, VEHICLE_TYPES } from '../entities/vehicle.js';
import { addEntity, removeEntity } from '../entities/index.js';
import { createCop, disposeCop } from '../entities/cop.js';
import { clearDriverRig } from '../entities/seated.js';
import { driveRoute, driveAt, brake } from './driver.js';
import { nearestNode } from '../world/roads.js';
import { SIZE } from '../world/layout.js';
import { setupLights, disposeLights } from './police-lights.js';
import { blocked } from './traffic.js';
import { offroadStep } from './police-offroad.js';

const CRUISE = { copcar: 20, swatvan: 15, cart: 11 };
const BAIL = { copcar: 12, swatvan: 12, cart: 8 };
const HANG = 15;   // s the pivot ranger stands by the chair at wanted 0 before he leaves

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
  disposeLights(v);
}

export function addCop(ctx, pos, rank, guard) {
  const c = createCop(ctx.scene, pos, rank, guard);
  addEntity(ctx.entities, c);
  ctx.npcs.push(c);
  return c;
}

// ---- per tick ----
// The pivot's ranger (pivot.js beginRun): the 1-star unit if wanted reaches 1, else he stands down.
export function hangUnits(P, dt, level) {
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

export function driveUnit(ctx, u, tgt, dt) {
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
  if (offroadStep(ctx, u, tgt, dt)) return;   // he is off the road within 60 m: across the plaza (police-offroad.js)
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
    const cop = addCop(ctx, pos, u.rank);
    cop.home = v;                             // a treated cop walks back to his car (cop.js)
    u.cops.push(cop);
  }
  v.driver = null; v.ai = null; v.parked = true;
  clearDriverRig(v);                          // the driver is one of the crew now, on foot
  u.kind = 'bailed';
}

// Stand-down clean-up: returns true when the unit is gone.
export function clearUnit(ctx, u, tgt, dt) {
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
  P.units.length = 0; P.tiers = {}; P.episode = false; P.arrestT = 0; P.pauseT = 0; P.pending.length = 0;
}
