// Parked sedans along the outer kerb: planned per block (spawns.parking), shown and woken by
// parked.js; recolourBody gives each a paint colour (vertex colours rewritten, cached per colour).
// spawnVehicles() adds the maintenance cart (plaza), the black franchise van (spawns.vanEntry)
// and a cop car once world.ready resolves.
import * as THREE from '../../vendor/three.module.js';
import { loadMesh } from '../assets.js';
import { ROAD_OUT, DECK_HALF, PLAZA_HALF, GAP_HALF, EDGES, SIDE, toXZ, laneForward, boxAt } from './layout.js';
import { createVehicle, VEHICLE_TYPES } from '../entities/vehicle.js';
import { addEntity } from '../entities/index.js';
import { overlapsFootprint, floorHeightAt } from '../physics.js';

export const CAR_COLOURS = [0xb8322c, 0x2c5aa0, 0xe8e4da, 0x2b2d30, 0x8a9096, 0x3f7a4a, 0xd9a441, 0x6d2f4f];
const CAR_W = 1.9, CAR_L = 4.4, CAR_H = 1.5;

// Kerbside spots on the outer lane, clear of the crosswalks and every gap mouth (link and escape).
// uMax: how far toward the ring corners spots go (the plaza keeps the single block's 43; other
// blocks stop at 31 so AI cars have room to swing round the corners).
export function planParking(rng, gaps, uMax = 31) {
  const spots = [];
  const d = ROAD_OUT - 0.95;
  for (const e of EDGES) {
    for (let u = -43; u <= 43; u += 6.5) {
      if (Math.abs(u) < 7 || Math.abs(u) > uMax) continue;                // crosswalk; corners
      if (gaps.some((q) => q.edge === e && Math.abs(u - q.g) < GAP_HALF + 3.5)) continue; // street mouths
      const [x, z] = toXZ(e, u, d);
      const [fx, fz] = laneForward(e);
      spots.push({ pos: new THREE.Vector3(x, 0, z), yaw: Math.atan2(fx, fz), edge: e });
    }
  }
  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [spots[i], spots[j]] = [spots[j], spots[i]];
  }
  const n = rng.int(10, 16);
  return spots.slice(0, n).map((s) => ({ ...s, colour: CAR_COLOURS[Math.floor(rng.next() * CAR_COLOURS.length)] }));
}

export function carCollider(spot) {
  const alongX = Math.abs(Math.sin(spot.yaw)) > 0.5;
  return boxAt(spot.pos.x, spot.pos.z, alongX ? CAR_L : CAR_W, alongX ? CAR_W : CAR_L, CAR_H, { tag: 'car' });
}

const bodyCache = new Map(); // asset:colour -> recoloured Body geometry

export function recolourBody(car, colour) {
  const body = car.getObjectByName('Body');
  const paint = car.userData.materials && car.userData.materials.Paint;
  if (!body || !body.geometry.getAttribute('color') || !paint) return false;
  const key = `${car.name}:${colour}`;
  let g = bodyCache.get(key);
  if (!g) {
    g = body.geometry.clone();
    const col = g.getAttribute('color');
    const [pr, pg, pb] = paint.color;
    const c = new THREE.Color(colour);
    for (let i = 0; i < col.count; i++) {
      if (Math.abs(col.getX(i) - pr) < 0.02 && Math.abs(col.getY(i) - pg) < 0.02 && Math.abs(col.getZ(i) - pb) < 0.02) {
        col.setXYZ(i, c.r, c.g, c.b);
      }
    }
    col.needsUpdate = true;
    bodyCache.set(key, g);
  }
  body.geometry = g;
  return true;
}

// --- Phase 4: vehicles ---

function footprintFree(world, type, x, y, z, yaw) {
  const T = VEHICLE_TYPES[type];
  const s = Math.sin(yaw), c = Math.cos(yaw);
  for (let i = -1; i <= 1; i++) {
    const q = { x: x + s * i * T.circleOff, z: z + c * i * T.circleOff };
    for (const col of world.colliders) {
      if (col.camOnly || col.maxY <= y + 0.35) continue;
      if (overlapsFootprint(q, T.circleR + 0.2, col)) return false;
    }
  }
  return true;
}

export function placeVehicle(world, root, entities, type, mesh, pos, yaw) {
  root.add(mesh);
  const v = createVehicle(type, mesh, pos, yaw);
  world.vehicles.push(v);
  addEntity(entities, v);
  return v;
}

// Maintenance cart on the plaza near the chair: first clear spot at least 5 m from the chair.
function cartSpot(world) {
  const cs = world.chairSpot;
  const cands = [[6, 1.5, 0], [-6, 1.5, 0], [6, -3, Math.PI / 2], [-6, -3, Math.PI / 2], [3, 4, Math.PI / 2],
    [-3, 4, Math.PI / 2], [8, 8, 0], [-8, 8, 0], [0, 12, Math.PI / 2], [10, 14, 0], [-10, 14, 0]];
  for (const [dx, dz, yaw] of cands) {
    const x = cs.x + dx, z = cs.z + dz;
    const y = floorHeightAt(x, z, world.colliders, 2);
    if (footprintFree(world, 'cart', x, y, z, yaw)) return { pos: new THREE.Vector3(x, y, z), yaw };
  }
  return { pos: new THREE.Vector3(cs.x + 6, 0.15, cs.z + 6), yaw: 0 };
}

// Cop car parked in the inner lane of a side away from the van, far along the street.
function copSpot(world) {
  const vanEdge = world.spawns.vanEntry.edge;
  const edges = EDGES.filter((e) => e !== vanEdge);
  for (const e of edges) {
    for (const u of [38, -38, 30, -30, 20, -20]) {
      const [x, z] = toXZ(e, u, DECK_HALF + 2);
      const [fx, fz] = laneForward(e);
      const yaw = Math.atan2(-fx, -fz);
      if (footprintFree(world, 'copcar', x, 0, z, yaw)) return { pos: new THREE.Vector3(x, 0, z), yaw };
    }
  }
  return null;
}

// Call after world.ready: adds the maintenance cart, the franchise van and the parked cop car
// (each remembers its home for the between-runs reset). Parked sedans are parked.js's: proxies
// that become vehicles near the player. Resolves with world.vehicles.
export function spawnVehicles(world, root, entities) {
  if (world.vehicles) return Promise.resolve(world.vehicles);
  world.vehicles = [];
  const cart = cartSpot(world);
  const cop = copSpot(world);
  const van = world.spawns.vanEntry;
  const home = (v, pos, yaw) => { v.home = { pos: pos.clone(), yaw }; return v; };
  const jobs = [
    loadMesh(VEHICLE_TYPES.cart.asset).then((m) => {
      m.name = 'maintenanceCart';
      home(placeVehicle(world, root, entities, 'cart', m, cart.pos, cart.yaw), cart.pos, cart.yaw);
    }),
    loadMesh(VEHICLE_TYPES.van.asset).then((m) => {
      recolourBody(m, 0x111214);  // franchise black
      m.name = 'franchiseVan';
      const v = home(placeVehicle(world, root, entities, 'van', m, van.pos, van.yaw), van.pos, van.yaw);
      v.franchise = true;
    }),
    cop && loadMesh(VEHICLE_TYPES.copcar.asset).then((m) => {
      m.name = 'copCar';
      const v = home(placeVehicle(world, root, entities, 'copcar', m, cop.pos, cop.yaw), cop.pos, cop.yaw);
      v.lights = false;           // light bar off until Phase 5
    }),
  ];
  return Promise.all(jobs).catch((err) => console.warn('[CMF] vehicle spawn failed', err)).then(() => world.vehicles);
}

// The parking pass (consolation perk, perks.parkingPass): one sedan at the inner kerb of the ring
// road, on the plaza edge nearest the chair, as close along that edge to the chair as a clear
// spot allows. Keys in: it is not parked (entering it is no theft) and has no home, so the
// MASSAGE reset (run/reset.js) removes it with the carjacked cars. spawner.begin() calls this on
// RUN entry; clearPassCar() (spawner.clear) drops a load still in flight and forgets the car.
const PASS_D = DECK_HALF + 1.3;
function passSpot(world) {
  const P = (world.blocks || []).find((b) => b.kind === 'plaza');
  const [cx, cz] = P ? P.centre : [0, 0];
  const lx = world.chairSpot.x - cx, lz = world.chairSpot.z - cz;
  let edge = 'S', best = Infinity;
  for (const e of EDGES) {
    const [ox, oz] = SIDE[e].out, d = PLAZA_HALF - (lx * ox + lz * oz);
    if (d < best) { best = d; edge = e; }
  }
  const [ox] = SIDE[edge].out, u0 = ox !== 0 ? lz : lx;
  const [fx, fz] = laneForward(edge), yaw = Math.atan2(-fx, -fz);   // inner lane, like the cop car
  const gaps = P ? P.gaps.filter((q) => q.edge === edge) : [];
  for (let k = 0; k <= 16; k++) {
    const u = u0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 3;
    if (Math.abs(u) < 7 || Math.abs(u) > 40 || gaps.some((q) => Math.abs(u - q.g) < GAP_HALF + 3.5)) continue;
    const [x0, z0] = toXZ(edge, u, PASS_D), x = x0 + cx, z = z0 + cz;
    if (!footprintFree(world, 'sedan', x, 0, z, yaw)) continue;
    if ((world.vehicles || []).some((v) => (v.pos.x - x) ** 2 + (v.pos.z - z) ** 2 < 36)) continue;
    return { pos: new THREE.Vector3(x, floorHeightAt(x, z, world.colliders, 0.3), z), yaw, edge };
  }
  return null;
}

export function spawnPassCar(world, root, entities) {
  clearPassCar(world);
  const gen = world._passGen;
  const spot = passSpot(world);
  if (!spot || !world.vehicles) return Promise.resolve(null);
  return loadMesh(VEHICLE_TYPES.sedan.asset).then((m) => {
    if (gen !== world._passGen || !world.vehicles) return null;
    recolourBody(m, 0xffcc00);          // PE gold: you can find it from the chair
    m.name = 'passSedan';
    const v = placeVehicle(world, root, entities, 'sedan', m, spot.pos, spot.yaw);
    v.parked = false; v.pass = true;    // keys in
    world.passCar = v;
    return v;
  }).catch((err) => { console.warn('[CMF] parking pass car failed', err); return null; });
}

export function clearPassCar(world) {
  world._passGen = (world._passGen || 0) + 1;
  world.passCar = null;
}
