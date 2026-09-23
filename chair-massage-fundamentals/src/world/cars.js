// Parked sedans along the outer kerb. Spots are planned synchronously (spawns.parking); the baked
// meshes arrive async and get a recoloured Body (vertex colours rewritten, geometry cached per colour).
import * as THREE from '../../vendor/three.module.js';
import { loadMesh } from '../assets.js';
import { ROAD_OUT, GAP_HALF, EDGES, toXZ, laneForward, boxAt } from './layout.js';

const CAR_COLOURS = [0xb8322c, 0x2c5aa0, 0xe8e4da, 0x2b2d30, 0x8a9096, 0x3f7a4a, 0xd9a441, 0x6d2f4f];
const CAR_W = 1.9, CAR_L = 4.4, CAR_H = 1.5;

export function planParking(rng, esc) {
  const spots = [];
  const d = ROAD_OUT - 0.95;
  for (const e of EDGES) {
    for (let u = -43; u <= 43; u += 6.5) {
      if (Math.abs(u) < 7) continue;                                     // crosswalk
      if (e === esc.edge && Math.abs(u - esc.g) < GAP_HALF + 3.5) continue; // escape street mouth
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

const bodyCache = new Map(); // colour -> recoloured Body geometry

function recolourBody(car, colour) {
  const body = car.getObjectByName('Body');
  const paint = car.userData.materials && car.userData.materials.Paint;
  if (!body || !body.geometry.getAttribute('color') || !paint) return false;
  let g = bodyCache.get(colour);
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
    bodyCache.set(colour, g);
  }
  body.geometry = g;
  return true;
}

// Adds each car mesh + collider to the world; resolves with the parked list.
export function loadParked(world, root, spots) {
  return Promise.all(spots.map((spot) => loadMesh('assets/sedan.json').then((car) => {
    recolourBody(car, spot.colour);
    car.position.copy(spot.pos);
    car.rotation.y = spot.yaw;
    car.name = 'parkedSedan';
    root.add(car);
    const collider = carCollider(spot);
    world.colliders.push(collider);
    world.parked.push({ mesh: car, collider, spawn: spot });
    return car;
  }))).catch((err) => {
    console.warn('[CMF] parked cars failed to load', err);
  }).then(() => world.parked);
}
