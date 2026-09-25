// Goon cars (DESIGN.md RUN, "Goons versus a vehicle" move 4, ruled 2026-09-25): from the van's
// second wave drop on (goon-waves.js waveStep calls dropCar), a sedan in Serenity livery (black,
// the van's colour) comes with the drop, behind the van, and two of that wave's three goons ride
// it: one at the wheel, one beside him, both seated in the glass (they leave ctx.npcs while
// aboard; GOON_CAP still counts them). The car chases his vehicle the way the van does (van-ai.js
// pursue: straight when close, else the cut) and rams at 8 hp with the van's cooldown. It spares
// goons and cops and brakes for them (v.spares, van-yield.js). With the player on foot it drives
// at him; within 15 m it stops and the crew bail out to chase on foot: ordinary goons from then
// on, the car left parked (takeable, stolen like any parked car). When he is back in a vehicle,
// bailed crew within 20 m of their car run back to it, get in and it resumes. At most two goon
// cars at once; a wrecked or abandoned one (taken by him, or empty for 60 s) counts until it is
// removed, once he is 80 m away. Contact with his vehicle does no crash damage (the ram is the
// hit, the van's rule). Watcher: `goon` { act: 'car', n, wave }, { act: 'bail' | 'board', car },
// { act: 'ram', car, hp }; yields log as `goon` { act: 'yield', car }.
import * as THREE from '../../vendor/three.module.js';
import { loadMesh } from '../assets.js';
import { VEHICLE_TYPES, SERENITY_BLACK } from '../entities/vehicle-types.js';
import { placeVehicle, recolourBody } from '../world/cars.js';
import { removeVehicle } from './police-units.js';
import { addEntity, removeEntity } from '../entities/index.js';
import { seatRig, unseatRig } from '../entities/seated.js';
import { disposeGoon } from '../entities/goon.js';
import { seek, stepBody, poseRig, cull } from '../entities/npc-common.js';
import { boxDistance, vehicleCircles } from '../entities/vehicle-collide.js';
import { floorHeightAt, overlapsFootprint } from '../physics.js';
import { driveRoute, driveAt, brake } from './driver.js';
import { nearestNode } from '../world/roads.js';
import { pursue } from './van-ai.js';
import { yieldStep } from './van-yield.js';
import { emit } from '../events.js';

export const CARS_MAX = 2;
const CREW = 2;
const RAM_HP = 8;
const BAIL_R = 15;           // m: the player on foot this close, the crew gets out
const BAIL_SPEED = 1.5;      // m/s: slow enough to open the doors
const BOARD_R = 20;          // m: bailed crew this close to the car go back to it
const BOARD_MAX = 10;        // s to reach the doors before the car leaves without them
const DOOR_R = 1.0;          // m from the body: in
const RUN = 5.5;
const FOOT_CRUISE = 10, ROUTE_CRUISE = 16;
const IDLE_LOST = 60;        // s parked with nobody coming back: abandoned
const GONE_R = 80;           // m from the player before an abandoned car is removed

const CHASE = {
  top: VEHICLE_TYPES.sedan.maxSpeed, ramHp: RAM_HP,
  onRam: (ctx, A, pv) => emit('goon', { act: 'ram', car: A.car, hp: Math.round(pv.hp), vehicle: pv.type, n: A.rams }),
};

const state = (ctx) => ctx.goonCars || (ctx.goonCars = { list: [], pending: 0, n: 0 });
const aboard = (C) => C.crew.filter((e) => e.aboard === C);
export function goonCarCount(ctx) { const G = ctx.goonCars; return G ? G.list.length + G.pending : 0; }
export function crewAboard(ctx) {
  let n = 0;
  for (const C of (ctx.goonCars && ctx.goonCars.list) || []) n += aboard(C).length;
  return n;
}

// A clear footprint for a sedan: no static collider, no other vehicle.
function free(ctx, x, y, z, yaw) {
  const T = VEHICLE_TYPES.sedan, s = Math.sin(yaw), c = Math.cos(yaw);
  for (let i = -1; i <= 1; i++) {
    const q = { x: x + s * i * T.circleOff, z: z + c * i * T.circleOff };
    for (const col of ctx.world.colliders) if (!col.camOnly && col.maxY > y + 0.35 && overlapsFootprint(q, T.circleR + 0.2, col)) return false;
    for (const v of ctx.world.vehicles || []) {
      for (const k of vehicleCircles(v)) if ((k.x - q.x) ** 2 + (k.z - q.z) ** 2 < (v.spec.circleR + T.circleR + 0.3) ** 2) return false;
    }
  }
  return true;
}

// Behind the van on its lane (further back if that is taken), else ahead of it.
function carSpot(ctx, van) {
  const s = Math.sin(van.yaw), c = Math.cos(van.yaw), y0 = van.pos.y || 0;
  const gap = van.spec.halfL + VEHICLE_TYPES.sedan.halfL + 1.2;
  for (const k of [1, 1.6, 2.3, 3.2, -1, -1.6]) {
    const x = van.pos.x - s * gap * k, z = van.pos.z - c * gap * k;
    const y = floorHeightAt(x, z, ctx.world.colliders, y0 + 0.3);
    if (Math.abs(y - y0) < 0.6 && free(ctx, x, y, z, van.yaw)) return { x, y, z, yaw: van.yaw };
  }
  return null;
}

// The wave's drop (goon-waves.js): goons are the ones it just put out; the first two take the car.
export function dropCar(ctx, van, goons, wave) {
  const G = state(ctx);
  if (goonCarCount(ctx) >= CARS_MAX || !goons.length || !van) return false;
  const spot = carSpot(ctx, van);
  if (!spot) return false;
  const crew = goons.slice(0, CREW);
  G.pending++;
  let done = false;
  const settle = () => { if (!done) { done = true; G.pending--; } };
  loadMesh(VEHICLE_TYPES.sedan.asset).then((m) => {
    settle();
    if (ctx.goonCars !== G || !ctx.world.vehicles) return;    // the run ended while it loaded
    m.name = 'serenitySedan';
    recolourBody(m, SERENITY_BLACK);
    const v = placeVehicle(ctx.world, ctx.world.root, ctx.entities, 'sedan', m, new THREE.Vector3(spot.x, spot.y, spot.z), spot.yaw);
    v.serenity = true; v.spares = 'goons';
    const C = { v, n: ++G.n, wave, crew: [], mode: 'parked', idleT: 0, lost: false, seen: null };
    C.chase = { car: C.n, ramCd: 0, rams: 0, yieldTag: 'goon' };
    G.list.push(C);
    for (const e of crew) {
      if (!ctx.npcs.includes(e) || e.knockedT > 0 || e.cling || e.state === 'treated' || e.state === 'out') continue;
      C.crew.push(e); board(ctx, C, e, false);
    }
    if (aboard(C).length) wheel(C);
    emit('goon', { act: 'car', n: C.n, wave, crew: aboard(C).length, alive: G.list.length });
  }).catch((err) => { settle(); console.warn('[CMF] goon car failed', err); });
  return true;
}

// Seat the riders: the first at the wheel, the second beside him. With a goon driver the wheel
// man's rig is the car's seatRig (so seated.js adds no cosmetic driver); without one it must not
// be (seated.js would dispose it as a driverless car's cosmetic driver).
function seat(C) {
  const v = C.v, rs = aboard(C), sx = (v.spec.seat || { x: 0 }).x;
  rs.forEach((e, k) => { seatRig(e.mesh, v); if (k > 0) e.mesh.position.x = -sx; });
  v.seatRig = rs.length && v.driver && v.driver.kind === 'aiDriver' ? rs[0].mesh : null;
}

function board(ctx, C, e, log) {
  const i = ctx.npcs.indexOf(e);
  if (i >= 0) ctx.npcs.splice(i, 1);
  removeEntity(ctx.entities, e);
  e.aboard = C; e.car = C; e.hold = null; e.boardCar = null; e.arrived = false;
  e.state = 'chase'; e.vel.set(0, 0, 0); e.wishX = e.wishZ = 0;
  seat(C);
  if (log) emit('goon', { act: 'board', car: C.n });
}

// A goon driver at the wheel: the car drives again.
function wheel(C) {
  const v = C.v;
  v.driver = { kind: 'aiDriver', pos: new THREE.Vector3() };
  v.parked = false; v.asleep = false;
  C.mode = 'drive'; C.idleT = 0;
  seat(C);
}

// Everyone aboard out of the doors, into the chase on foot; the car is left parked.
function bail(ctx, C) {
  const v = C.v, s = Math.sin(v.yaw), c = Math.cos(v.yaw), off = v.spec.halfW + 0.7;
  const rs = aboard(C);
  v.seatRig = null;                           // the riders' rigs are theirs, not seated.js's
  rs.forEach((e, k) => {
    const side = k % 2 ? -1 : 1, x = v.pos.x + c * off * side, z = v.pos.z - s * off * side;
    const pos = new THREE.Vector3(x, floorHeightAt(x, z, ctx.world.colliders, v.pos.y + 0.3), z);
    unseatRig(e.mesh, ctx.scene, pos, v.yaw + side * Math.PI / 2);
    e.pos.copy(pos); e.vel.set(0, 0, 0); e.yaw = v.yaw + side * Math.PI / 2;
    e.aboard = null; e.state = 'chase'; e.knockedT = 0; e.idle = false; e.sightT = 0; e.grounded = true;
    e.seek.nav = -1; e.seek.t = 0;
    addEntity(ctx.entities, e);
    ctx.npcs.push(e);
    emit('goon', { act: 'bail', car: C.n });
  });
  v.driver = null; v.ai = null; v.route = null; v.parked = true;
  C.mode = 'parked'; C.idleT = 0;
}

// goon.js hands a boarding goon's tick here (e.hold): run to his door; knocked, stunned, treated
// or palmed on the way, he lets go and goon.js has him again.
function boardTick(e, dt, ctx) {
  const C = e.boardCar;
  if (!C || C.v.removed || e.knockedT > 0 || e.stunT > 0 || e.state !== 'board') { release(e); return; }
  const v = C.v, s = Math.sin(v.yaw), c = Math.cos(v.yaw), off = v.spec.halfW + 0.6;
  const side = C.crew.indexOf(e) % 2 ? -1 : 1, x = v.pos.x + c * off * side, z = v.pos.z - s * off * side;
  e.speed = RUN;
  if (boxDistance(v, e.pos.x, e.pos.z) < DOOR_R) { e.arrived = true; e.wishX = e.wishZ = 0; e.speed = 0; }
  else if (seek(e, x, v.pos.y, z, dt, ctx, 0.6)) e.arrived = true;
  e.pose = 'walk';
  stepBody(e, dt, ctx); poseRig(e, dt); cull(e, ctx);
}

function release(e) {
  e.hold = null; e.boardCar = null; e.arrived = false;
  if (e.state === 'board') e.state = 'chase';
}

const UP = new Set(['chase', 'windup', 'recover', 'search', 'return']);
// Bailed crew near their car and up for it (not knocked, stunned, clinging, palmed or treated).
function callBack(ctx, C) {
  const v = C.v;
  const near = C.crew.filter((e) => e.car === C && !e.aboard && !e.boardCar && ctx.npcs.includes(e) && !(e.knockedT > 0) && !e.cling
    && !(e.stunT > 0) && UP.has(e.state) && (e.pos.x - v.pos.x) ** 2 + (e.pos.z - v.pos.z) ** 2 < BOARD_R * BOARD_R);
  for (const e of near) { e.state = 'board'; e.boardCar = C; e.arrived = false; e.hold = boardTick; e.seek.nav = -1; e.seek.t = 0; }
  return near.length;
}

// Per RUN tick (spawner.update), after the entities moved and the van drove.
export function updateGoonCars(ctx, dt) {
  const G = ctx.goonCars;
  if (!G) return;
  for (let i = G.list.length - 1; i >= 0; i--) if (!tick(ctx, G.list[i], dt)) G.list.splice(i, 1);
}

// One car; false when it is gone.
function tick(ctx, C, dt) {
  const v = C.v, p = ctx.player;
  if (v.removed) return false;
  for (const e of C.crew.slice()) if (e.aboard !== C && !ctx.npcs.includes(e)) C.crew.splice(C.crew.indexOf(e), 1);   // disposed
  if (v.driver === p && !C.lost) { C.lost = true; for (const e of C.crew) if (e.boardCar === C) release(e); }
  if (v.hp <= 0 && !C.lost) {                 // wrecked: the crew climbs out
    if (aboard(C).length) bail(ctx, C);
    C.lost = true; C.mode = 'parked';
  }
  const d = Math.hypot(p.pos.x - v.pos.x, p.pos.z - v.pos.z);
  if (C.lost) {
    if (v.driver !== p && !v.chairLoaded && d > GONE_R) { v.removed = true; removeVehicle(ctx, v); for (const e of C.crew) e.car = null; return false; }
    return true;
  }
  const pv = p.vehicle;
  if (C.mode === 'drive') {
    C.chase.ramCd = Math.max(0, (C.chase.ramCd || 0) - dt);
    refund(C, v, pv);
    if (!pv) {
      if (d < BAIL_R) { brake(v); if (Math.abs(v.speed) < BAIL_SPEED) bail(ctx, C); }
      else drive(ctx, v, p.pos, dt);
    } else pursue(ctx, C.chase, v, pv, dt, CHASE);
    if (v.driver) yieldStep(ctx, C.chase, v, dt);
    C.seen = pv ? { v: pv, hp: pv.hp } : null;
    return true;
  }
  if (C.mode === 'boarding') {
    C.boardT += dt;
    if (pv && C.boardT <= BOARD_MAX) callBack(ctx, C);          // one who was mid-swing joins in
    const going = C.crew.filter((e) => e.boardCar === C);
    for (const e of going) if (e.arrived) board(ctx, C, e, true);
    const left = C.crew.filter((e) => e.boardCar === C);
    if (!pv || C.boardT > BOARD_MAX) for (const e of left) release(e);
    if (pv && left.length && C.boardT <= BOARD_MAX) return true;
    if (aboard(C).length) wheel(C);
    else C.mode = 'parked';
    return true;
  }
  // Parked with the crew out: back in when he drives again and they are near it.
  C.idleT += dt;
  if (pv && pv !== v && v.hp > 0 && callBack(ctx, C)) { C.mode = 'boarding'; C.boardT = 0; C.idleT = 0; return true; }
  if (C.idleT > IDLE_LOST) C.lost = true;
  return true;
}

// At the player on foot: the street graph, then straight in (the cops' approach, police-units.js).
function drive(ctx, v, t, dt) {
  const G = ctx.world.roads, goal = nearestNode(G, t.x, t.z), n = G.nodes[goal];
  const d = Math.hypot(t.x - v.pos.x, t.z - v.pos.z);
  if (d < 30 || Math.hypot(n.x - v.pos.x, n.z - v.pos.z) < 12) driveAt(v, t.x, t.z, FOOT_CRUISE, dt);
  else driveRoute(v, G, goal, ROUTE_CRUISE, dt);
}

// The goon car's contact with his vehicle is not crash damage (the ram is the hit, like the van's
// shove): hp his vehicle lost since the last tick while touching the car comes back.
function refund(C, v, pv) {
  const S = C.seen;
  if (!pv || !S || S.v !== pv || !(pv.hp > 0) || pv.hp >= S.hp) return;
  if (Math.hypot(pv.pos.x - v.pos.x, pv.pos.z - v.pos.z) > v.spec.halfL + pv.spec.halfL + 0.5) return;
  pv.hp = S.hp; pv._hpSeen = pv.hp;
}

// Between runs (spawner.clear): the riders and every goon car go; bailed crew are ordinary npcs.
export function clearGoonCars(ctx) {
  const G = ctx.goonCars;
  ctx.goonCars = null;
  if (!G) return;
  for (const C of G.list) {
    for (const e of aboard(C)) { e.aboard = null; disposeGoon(e, ctx.scene); }
    for (const e of C.crew) if (e.boardCar) release(e);
    const v = C.v;
    v.seatRig = null;
    if (v.driver && v.driver !== ctx.player) { v.driver = null; v.ai = null; }
    if (!v.removed && v.driver !== ctx.player) { v.removed = true; removeVehicle(ctx, v); }
  }
}
