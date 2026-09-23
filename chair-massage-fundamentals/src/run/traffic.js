// Light civilian traffic: COUNT sedans (seeded colours, a cosmetic civilian at the wheel via
// seated.js) wandering the street graph at 8..10 m/s in the right-hand lane. Each stops for
// whatever is in its lane ahead (the player, his vehicle, any car, anyone on foot) and waits.
// Recycled like the peds: only within two blocks of the player; a car more than 2.5 blocks away
// jumps to a street 1..2 blocks ahead of him. interact.js carjacks them (takeCivilian).
import * as THREE from '../../vendor/three.module.js';
import { loadMesh } from '../assets.js';
import { makeRng } from '../rng.js';
import { removeEntity } from '../entities/index.js';
import { clearDriverRig } from '../entities/seated.js';
import { placeVehicle, recolourBody, CAR_COLOURS } from '../world/cars.js';
import { lanePoints, edgeSpot } from '../world/roads.js';
import { SIZE } from '../world/layout.js';
import { followPoly } from '../pivot-path.js';
import { driveAt, brake } from './driver.js';

const COUNT = 6;
const NEAR = 2 * SIZE, FAR = 2.5 * SIZE, AHEAD0 = SIZE, AHEAD1 = 2 * SIZE;
const LOOK = 7;            // metres of clear lane wanted ahead of the bumper
const EVERY = 0.5;
const BEND = [10, 16, 3.5];  // see run/driver.js

// count: how many cars to keep (COUNT; a debug handle can set it, e.g. 0 for an empty grid).
export function createTraffic(seed) { return { cars: [], rng: makeRng((seed ^ 0x7a11c) >>> 0), loading: 0, gen: 0, log: [], t: 0, count: COUNT }; }

function travelDir(ctx) {
  const p = ctx.player, v = p.vehicle ? p.vehicle.vel : p.vel;
  if (Math.hypot(v.x, v.z) > 1) { const l = Math.hypot(v.x, v.z); return [v.x / l, v.z / l]; }
  const c = ctx.camera;
  if (c) { const d = new THREE.Vector3(); c.getWorldDirection(d); const l = Math.hypot(d.x, d.z) || 1; return [d.x / l, d.z / l]; }
  return [0, 1];
}

// A lane spot on a street whose middle is r0..r1 from the player (ahead of him when `ahead`),
// clear of other vehicles. Never the escape street (a dead end).
function pickSpot(ctx, r0, r1, ahead) {
  const G = ctx.world.roads, T = ctx.traffic, rng = T.rng;
  const at = ctx.player.vehicle ? ctx.player.vehicle.pos : ctx.player.pos;
  const [dx, dz] = travelDir(ctx);
  const vs = ctx.world.vehicles || [];
  for (let tries = 0; tries < 80; tries++) {
    const [a0, b0] = G.edges[rng.int(0, G.edges.length - 1)];
    if (a0 === G.exitNode || b0 === G.exitNode) continue;
    const [a, b] = rng.next() < 0.5 ? [a0, b0] : [b0, a0];
    const A = G.nodes[a], B = G.nodes[b], len = Math.hypot(B.x - A.x, B.z - A.z);
    if (len < 20) continue;
    const s = edgeSpot(G, a, b, rng.range(8, len - 8));
    const ox = s.x - at.x, oz = s.z - at.z, d = Math.hypot(ox, oz);
    if (d < r0 || d > r1) continue;
    if (ahead && tries < 60 && ox * dx + oz * dz < d * 0.3) continue;
    if (vs.some((v) => (v.pos.x - s.x) ** 2 + (v.pos.z - s.z) ** 2 < 100)) continue;
    return { ...s, a, b };
  }
  return null;
}

function nextNode(G, from, to, rng) {
  const opts = G.adj[to].filter((n) => n !== from && n !== G.exitNode);
  return opts.length ? opts[rng.int(0, opts.length - 1)] : from;
}

function makePoly(v, G, tr) {
  // From the lane point behind the car: the pursuit carrot stays on the lane (followPoly projects).
  const pts = lanePoints(G, [tr.from, tr.to, tr.next]);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  tr.poly = { pts, cum, total: cum[2], ringEnd: 3, prog: 0, seg: 0 };
}

function spawnCar(ctx, spot) {
  const T = ctx.traffic, gen = T.gen, G = ctx.world.roads;
  const colour = CAR_COLOURS[T.rng.int(0, CAR_COLOURS.length - 1)], cruise = T.rng.range(8, 10);
  T.loading++;
  return loadMesh('assets/sedan.json').then((mesh) => {
    T.loading--;
    if (gen !== T.gen || !ctx.world.vehicles) return null;
    recolourBody(mesh, colour);
    mesh.name = 'trafficSedan';
    const v = placeVehicle(ctx.world, ctx.world.root, ctx.entities, 'sedan', mesh, new THREE.Vector3(spot.x, 0, spot.z), spot.yaw);
    v.civilian = true; v.parked = false; v.asleep = false;
    v.driver = { kind: 'aiDriver', civilian: true, pos: new THREE.Vector3() };
    v.tr = { from: spot.a, to: spot.b, next: nextNode(G, spot.a, spot.b, T.rng), cruise, poly: null, stopT: 0 };
    makePoly(v, G, v.tr);
    T.cars.push(v);
    return v;
  }).catch((err) => { T.loading--; console.warn('[CMF] traffic car failed', err); return null; });
}

// Run start: COUNT cars on streets within two blocks (none closer than 25 m).
export function beginTraffic(ctx) {
  clearTraffic(ctx);
  const T = ctx.traffic;
  const jobs = [];
  for (let k = 0; k < T.count; k++) {
    const s = pickSpot(ctx, 25, NEAR, false);
    if (s) jobs.push(spawnCar(ctx, s));
  }
  return Promise.all(jobs);
}

export function clearTraffic(ctx) {
  const T = ctx.traffic;
  T.gen++;
  for (const v of T.cars) removeCar(ctx, v);
  T.cars.length = 0;
}

function removeCar(ctx, v) {
  const L = ctx.world.vehicles, i = L ? L.indexOf(v) : -1;
  if (i >= 0) L.splice(i, 1);
  removeEntity(ctx.entities, v);
  clearDriverRig(v);
  if (v.mesh.parent) v.mesh.parent.remove(v.mesh);
  v.removed = true;
}

// Carjacked: no longer traffic (the vehicle stays, as a stolen car; it goes at the next reset).
export function takeCivilian(ctx, v) {
  const T = ctx.traffic, i = T.cars.indexOf(v);
  if (i >= 0) T.cars.splice(i, 1);
  v.civilian = false; v.tr = null;
}

// Is anything in the lane just ahead of v?
function blocked(ctx, v) {
  const s = Math.sin(v.yaw), c = Math.cos(v.yaw), reach = v.spec.halfL + LOOK;
  // rf: the obstacle's reach toward us, rl: its half width across the lane.
  const test = (x, z, rf, rl) => {
    const rx = x - v.pos.x, rz = z - v.pos.z, f = rx * s + rz * c, l = -rx * c + rz * s;
    return f > 0 && f < reach + rf && Math.abs(l) < v.spec.halfW + rl + 0.1;
  };
  const p = ctx.player;
  if (!p.vehicle && test(p.pos.x, p.pos.z, 0.4, 0.6)) return 'person';
  for (const e of ctx.npcs) if (test(e.pos.x, e.pos.z, 0.4, 0.6)) return 'person';
  for (const o of ctx.world.vehicles) {
    if (o === v || o.removed) continue;
    const across = Math.abs(Math.sin(o.yaw - v.yaw));   // a car side-on to us is long across the lane
    const rl = o.spec.halfW * (1 - across) + o.spec.halfL * across;
    if (test(o.pos.x, o.pos.z, o.spec.halfL * (1 - across) + o.spec.halfW * across, rl)) return o.driver && o.driver.civilian ? 'traffic' : 'car';
  }
  return null;
}

function drive(ctx, v, dt) {
  const G = ctx.world.roads, tr = v.tr;
  if (!v.driver || v.driver.kind !== 'aiDriver') return;
  // Waits behind anything; two civilians nose to nose at a corner give way after a few seconds.
  const b = blocked(ctx, v);
  if (b && !(b === 'traffic' && tr.stopT > 4 + (v.id % 3))) { brake(v); tr.stopT += dt; return; }
  if (!b) tr.stopT = 0;
  followPoly(v, tr.poly, dt, driveAt, tr.cruise, tr.cruise, BEND);
  if (tr.poly.seg >= 1) {                         // past the intersection: on to the next street
    tr.from = tr.to; tr.to = tr.next; tr.next = nextNode(G, tr.from, tr.to, ctx.traffic.rng);
    makePoly(v, G, tr);
  }
}

export function updateTraffic(ctx, dt) {
  const T = ctx.traffic;
  if (!T || !ctx.world.roads) return;
  for (const v of T.cars) drive(ctx, v, dt);
  T.t -= dt;
  if (T.t > 0) return;
  T.t = EVERY;
  const at = ctx.player.vehicle ? ctx.player.vehicle.pos : ctx.player.pos;
  for (const v of T.cars) {
    if (v.driver !== null && v.driver.kind !== 'aiDriver') continue;
    const d = Math.hypot(v.pos.x - at.x, v.pos.z - at.z);
    // Past 2.5 blocks, or out of sight and stuck behind something parked in its lane.
    if (d <= FAR && !(v.tr.stopT > 8 && d > 60)) continue;
    const s = pickSpot(ctx, AHEAD0, AHEAD1, true);
    if (!s) continue;
    T.log.push({ t: +ctx.time.toFixed(1), id: v.id, from: [Math.round(v.pos.x), Math.round(v.pos.z)], to: [Math.round(s.x), Math.round(s.z)] });
    v.pos.set(s.x, 0, s.z); v.yaw = s.yaw; v.vel.set(0, 0, 0); v.speed = 0; v.steer = 0; v.yawRate = 0;
    v.hp = 100; v.aiBackT = 0; v.aiStuckT = 0;
    v.tr.from = s.a; v.tr.to = s.b; v.tr.next = nextNode(ctx.world.roads, s.a, s.b, T.rng); v.tr.stopT = 0;
    makePoly(v, ctx.world.roads, v.tr);
    v.mesh.position.copy(v.pos); v.mesh.rotation.y = v.yaw;
  }
  // Keep the count: a car lost to a carjack is replaced ahead of the player.
  while (T.cars.length + T.loading < T.count) {
    const s = pickSpot(ctx, AHEAD0, AHEAD1, true);
    if (!s) break;
    spawnCar(ctx, s);
  }
}

