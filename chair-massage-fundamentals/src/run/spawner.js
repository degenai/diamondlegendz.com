// Run population: seeded peds on the nav graph, the Serenity Group goons and their van driver,
// the police (police.js), wanted bookkeeping from vehicles (wrecks, property), and the per-run
// reset. main.js calls begin() on entering RUN, update() after updateAll, clear() on MASSAGE.
// The first three goons come out of the van during the PIVOT (pivot.js calls spawnGoons);
// begin() only spawns them itself on the debug path that skips the pivot.
import * as THREE from '../../vendor/three.module.js';
import { makeRng } from '../rng.js';
import { floorHeightAt } from '../physics.js';
import { preload } from '../assets.js';
import { addEntity, removeEntity } from '../entities/index.js';
import { disposePed } from '../entities/ped.js';
import { createGoon, disposeGoon } from '../entities/goon.js';
import { disposeCop } from '../entities/cop.js';
import { clearDriverRig } from '../entities/seated.js';
import { updateWanted, emitChaos } from './wanted.js';
import { createPolice, updatePolice, clearPolice, routeDist } from './police.js';
import { driveRoute, driveAt, brake } from './driver.js';
import { nearestNode, nodeAhead, route, edgeSpot } from '../world/roads.js';
import { toXZ, SIZE, RING_C } from '../world/layout.js';
import { emit } from '../events.js';
import { shake, sfx } from '../juice.js';
import { spawnPeds, spawnRegular, recyclePeds } from './peds.js';
import { lineOfSight } from '../entities/npc-nav.js';
import { createTraffic, beginTraffic, clearTraffic, updateTraffic } from './traffic.js';
import { resetVehicles } from './reset.js';
import { spawnPassCar, clearPassCar } from '../world/cars.js';

const WAVE = 90;
const GOON_CAP = 9;
const VAN_CRUISE = 14;
const _cops = [];

export function initSpawner(ctx) {
  ctx.npcs = ctx.npcs || [];
  ctx.police = createPolice();
  ctx.traffic = createTraffic(ctx.world.seed);
  ctx.runCash = 0;
  preload(['assets/bat.json', 'assets/ranger.json', 'assets/copcar.json', 'assets/swatvan.json', 'assets/cart.json'])
    .catch((err) => console.warn('[CMF] NPC asset preload failed', err));
}

function dispose(ctx, e) {
  removeEntity(ctx.entities, e);
  if (e.kind === 'ped') disposePed(e, ctx.scene);
  else if (e.kind === 'goon') disposeGoon(e, ctx.scene);
  else disposeCop(e, ctx.scene);
}

export function clear(ctx) {
  clearPolice(ctx.police, ctx);
  clearTraffic(ctx);
  for (const e of ctx.npcs) dispose(ctx, e);
  ctx.npcs.length = 0;
  ctx.goonPack = null;                        // the pack forgets the last run's sightings (goon.js)
  const van = ctx.vanAI && ctx.vanAI.v;
  if (van && van.driver && van.driver !== ctx.player) { van.driver = null; van.ai = null; }
  if (van) clearDriverRig(van);               // no vehicle ticks in MASSAGE to drop the driver
  ctx.vanAI = null;
  clearPassCar(ctx.world);                    // the reset (resetVan) removes the car itself: no home
}

// MASSAGE re-entry: every vehicle goes home, repaired, engine off (run/reset.js).
export function resetVan(ctx) { resetVehicles(ctx); }

export function begin(ctx, fromPivot = false) {
  if (!fromPivot) clear(ctx);
  ctx.wanted.reset();
  ctx.runCash = 0;
  ctx.runEnd = null;
  ctx.lastChaos = null;
  ctx.goonPack = null;
  ctx.grabUntil = Infinity; ctx.grabStart = null;   // the opening beat starts on first contact (goon.js)
  const p = ctx.player;
  p.hp = 100; p.prevHp = 100; p.hurtAt = -1e9; p.knockedT = 0; p.icePackUsed = false;
  const rng = makeRng((ctx.world.seed ^ 0x9ed5) >>> 0);
  spawnPeds(ctx, rng);
  if (ctx.perks && ctx.perks.regular) spawnRegular(ctx, rng);
  ctx.vanAI = { v: null, mode: 'wait', waveT: 0, dropT: 0, spawnedAt: -1, footT: 0, ramCd: 0, parked: false };
  if (countKind(ctx, 'goon') === 0) spawnGoons(ctx, 3);
  if (ctx.world.vehicles && ctx.perks && ctx.perks.parkingPass) spawnPassCar(ctx.world, ctx.world.root, ctx.entities);
  if (ctx.world.vehicles) beginTraffic(ctx);
}

export function countKind(ctx, kind) {
  let n = 0;
  for (const e of ctx.npcs) if (e.kind === kind) n++;
  return n;
}

// Out of the van's side door (the side facing the plaza), or at vanEntry without a van.
export function spawnGoons(ctx, n) {
  const alive = countKind(ctx, 'goon');
  n = Math.min(n, GOON_CAP - alive);
  const van = ctx.world.vehicles && ctx.world.vehicles.find((v) => v.franchise);
  const at = van ? van.pos : ctx.world.spawns.vanEntry.pos;
  const yaw = van ? van.yaw : ctx.world.spawns.vanEntry.yaw;
  const s = Math.sin(yaw), c = Math.cos(yaw);
  const off = (van ? van.spec.halfW : 1) + 0.9;
  const side = (at.x + c * off) ** 2 + (at.z - s * off) ** 2 < (at.x - c * off) ** 2 + (at.z + s * off) ** 2 ? 1 : -1;
  for (let k = 0; k < n; k++) {
    const along = (k - 1) * 1.1;
    const x = at.x + c * off * side + s * along, z = at.z - s * off * side + c * along;
    const pos = new THREE.Vector3(x, floorHeightAt(x, z, ctx.world.colliders, (at.y || 0) + 0.3), z); // the van may be up on the terrace
    const idx = alive + k;
    const g = createGoon(ctx.scene, pos, idx % 3 === 2 ? 'flank' : 'direct', idx % 3 === 0);
    g.yaw = yaw + (side > 0 ? Math.PI / 2 : -Math.PI / 2);
    addEntity(ctx.entities, g);
    ctx.npcs.push(g);
  }
  return n;
}

// The van driver (ruled 2026-09-24 after run 5, "the van pursues"): from the moment the player
// drives off in any vehicle it pursues his vehicle on the street graph at van speed, heads for a
// node on his route to the escape it can reach first (the cut: it waits there), and rams when
// alongside (a shove: 10 hp and a wobble, never a wreck). Once he has been on foot for 10 s it
// drives back and parks across the plaza's single exit street, one lane blocked. Every 90 s it
// still returns to vanEntry to drop fresh goons.
const VAN_TOP = 16;          // the van's top speed (vehicle-types.js)
const FOOT_PARK = 10;        // s on foot before it goes to block the exit
const RAM_CD = 2.5;
const RAM_HP = 10;
const RAM_PUSH = 5;
const PLAN_EVERY = 0.5;
const PARK_ALONG = 20;       // m out along the link street from the plaza ring
const PARK_LANE = 2.4;       // m right of the centreline for outbound travel: one lane of two

// The plaza's exit street: its ring node, the neighbour's, and the parking pose across one lane.
function exitPark(ctx) {
  const W = ctx.world;
  if (W._vanPark !== undefined) return W._vanPark;
  const G = W.roads, P = (W.blocks || []).find((b) => b.kind === 'plaza');
  const q = P && P.gaps.find((g) => g.kind === 'link');
  if (!q) return (W._vanPark = null);
  const [cx, cz] = P.centre;
  const at = (d) => { const [x, z] = toXZ(q.edge, q.g, d); return nearestNode(G, x + cx, z + cz); };
  const a = at(RING_C), b = at(SIZE - RING_C);
  const s = edgeSpot(G, a, b, PARK_ALONG, PARK_LANE);
  // Broadside across the outbound lane, nose toward the centreline.
  return (W._vanPark = { inner: a, outer: b, x: s.x, z: s.z, yaw: s.yaw - Math.PI / 2, street: s.yaw });
}

function updateVan(ctx, dt) {
  const A = ctx.vanAI;
  if (!A) return;
  if (!A.v) {
    const v = ctx.world.vehicles && ctx.world.vehicles.find((x) => x.franchise);
    if (!v || v.driver) return;
    A.v = v; v.driver = { kind: 'aiDriver', pos: new THREE.Vector3() }; v.parked = false;
  }
  const v = A.v, p = ctx.player;
  if (v.driver === p || !v.driver) return;
  A.waveT += dt;
  A.ramCd = Math.max(0, (A.ramCd || 0) - dt);
  if (A.waveT >= WAVE && A.mode !== 'drop') { A.mode = 'drop'; A.dropT = 0; }
  if (A.mode === 'drop') {
    A.dropT += dt;
    const e = ctx.world.spawns.vanEntry.pos;
    const d = Math.hypot(e.x - v.pos.x, e.z - v.pos.z);
    if (d > 16) driveRoute(v, ctx.world.roads, nearestNode(ctx.world.roads, e.x, e.z), VAN_CRUISE, dt);
    else if (d > 3.5) driveAt(v, e.x, e.z, 7, dt);
    else brake(v);
    if ((d <= 3.5 && Math.abs(v.speed) < 0.5) || A.dropT > 30) {
      spawnGoons(ctx, 3);
      A.mode = 'wait'; A.waveT = 0; A.spawnedAt = ctx.time; A.parked = false;
    }
    return;
  }
  if (p.vehicle && p.vehicle !== v && v.hp > 0) {
    A.footT = 0; A.parked = false;
    if (A.mode !== 'pursue' && A.mode !== 'cut') { A.mode = 'pursue'; A.planT = 0; emit('van', { act: 'pursue', vehicle: p.vehicle.type }); }
    pursue(ctx, A, v, p.vehicle, dt);
    return;
  }
  A.footT = (A.footT || 0) + dt;
  if (A.mode === 'pursue' || A.mode === 'cut') A.mode = 'wait';
  if (A.footT < FOOT_PARK || !exitPark(ctx)) { brake(v); return; }
  if (A.mode !== 'park') { A.mode = 'park'; A.settleT = 0; A.parkT = 0; A.lane = false; emit('van', { act: 'return' }); }
  park(ctx, A, v, dt);
}

// Pursuit: straight at his vehicle when close, else the cut (the first node on his route to the
// escape the van reaches before him; it waits there), else his street node.
function pursue(ctx, A, v, pv, dt) {
  const G = ctx.world.roads;
  const d = Math.hypot(pv.pos.x - v.pos.x, pv.pos.z - v.pos.z);
  if (d < v.spec.halfL + pv.spec.halfL + 0.8 && A.ramCd <= 0) ram(ctx, A, v, pv, d);
  const lead = Math.min(0.8, d / 20), tx = pv.pos.x + pv.vel.x * lead, tz = pv.pos.z + pv.vel.z * lead;
  if (d < 30 && clearRun(ctx.world, v, tx, tz)) {
    // Direct, slowing hard for a sharp turn: a 5.5 m van taking a corner at speed ploughs into the lots.
    let err = Math.atan2(tx - v.pos.x, tz - v.pos.z) - v.yaw;
    while (err > Math.PI) err -= Math.PI * 2;
    while (err < -Math.PI) err += Math.PI * 2;
    const cruise = Math.abs(err) > 0.5 ? 9 : Math.abs(err) > 0.2 ? 12 : VAN_TOP;
    A.mode = 'pursue';
    driveAt(v, tx, tz, cruise, dt, 30);
    return;
  }
  A.planT = (A.planT || 0) - dt;
  if (A.planT <= 0 || !A.goal) {
    A.planT = PLAN_EVERY;
    A.goal = cutNode(G, v, pv);
    A.mode = A.goal.cut ? 'cut' : 'pursue';
    if (A.goal.cut && A.cutAt !== A.goal.node) { A.cutAt = A.goal.node; emit('van', { act: 'cut', node: A.goal.node }); }
  }
  const n = G.nodes[A.goal.node];
  if (A.goal.cut && Math.hypot(n.x - v.pos.x, n.z - v.pos.z) < 6) brake(v);
  else driveRoute(v, G, A.goal.node, VAN_TOP, dt);
}

// A straight run at (tx, tz) the van's width clears (both flanks at bonnet height): a direct chase
// that would clip a lot corner or a tree goes by the street graph instead.
const _fa = new THREE.Vector3(), _fb = new THREE.Vector3();
function clearRun(world, v, tx, tz) {
  const dx = tx - v.pos.x, dz = tz - v.pos.z, l = Math.hypot(dx, dz) || 1, rx = -dz / l, rz = dx / l;
  for (const o of [-1.1, 1.1]) {
    _fa.set(v.pos.x + rx * o, v.pos.y, v.pos.z + rz * o);
    _fb.set(tx + rx * o, v.pos.y, tz + rz * o);
    if (!lineOfSight(world, _fa, _fb, 0.8)) return false;
  }
  return true;
}

// The first node on his route to the escape (after the one he is driving at) that the van can
// reach before him; none: the node he is driving at.
function cutNode(G, v, pv) {
  const from = nodeAhead(G, pv.pos.x, pv.pos.z, pv.vel.x, pv.vel.z);
  const path = route(G, from, G.exitNode);
  const vd = routeDist(G, nearestNode(G, v.pos.x, v.pos.z));
  const ps = Math.max(8, Math.hypot(pv.vel.x, pv.vel.z));
  let acc = Math.hypot(G.nodes[from].x - pv.pos.x, G.nodes[from].z - pv.pos.z);
  for (let k = 1; k < path.length; k++) {
    acc += Math.hypot(G.nodes[path[k]].x - G.nodes[path[k - 1]].x, G.nodes[path[k]].z - G.nodes[path[k - 1]].z);
    if (path[k] === G.exitNode) break;
    if (vd[path[k]] / (VAN_TOP * 0.7) < acc / ps) return { node: path[k], cut: true };
  }
  return { node: from, cut: false };
}

// Alongside: a shove away from the van, 10 hp and a wobble; never below 1 hp (no wreck).
function ram(ctx, A, v, pv, d) {
  A.ramCd = RAM_CD;
  const nx = (pv.pos.x - v.pos.x) / (d || 1), nz = (pv.pos.z - v.pos.z) / (d || 1);
  pv.vel.x += nx * RAM_PUSH; pv.vel.z += nz * RAM_PUSH;
  pv.hp = Math.max(Math.min(pv.hp, 1), pv.hp - RAM_HP);
  pv._hpSeen = pv.hp;                          // his own crash bookkeeping ignores the van's shove
  pv.wobbleT = Math.max(pv.wobbleT || 0, 0.6);
  pv.asleep = false;
  shake(ctx, 0.45, pv.pos.x, pv.pos.z);
  sfx(ctx, 'thud', pv.pos.x, pv.pos.z, 0.9);
  emitChaos(ctx, pv.pos.x, pv.pos.z, 'vanRam');
  A.rams = (A.rams || 0) + 1;
  emit('van', { act: 'ram', hp: Math.round(pv.hp), vehicle: pv.type, n: A.rams });
}

// Back to the plaza's exit street by the plaza ring (the route to the street's inner end, then out
// along the lane), then broadside across the outbound lane: the last metres are a slow shuffle
// into the pose, a driver backing and filling. Passing within 4 m of the spot from either side
// settles it at once; if it has not got there in 60 s it settles from within 20 m.
function park(ctx, A, v, dt) {
  const G = ctx.world.roads, K = exitPark(ctx);
  if (A.parked) { brake(v); return; }
  A.parkT = (A.parkT || 0) + dt;
  const d = Math.hypot(K.x - v.pos.x, K.z - v.pos.z);
  if (A.settleT === 0 && d > 4 && !(A.parkT > 60 && d < 20)) {
    const a = G.nodes[K.inner];
    if (!A.lane && Math.hypot(a.x - v.pos.x, a.z - v.pos.z) < 10) A.lane = true;
    if (A.lane) driveAt(v, K.x, K.z, 6, dt);
    else driveRoute(v, G, K.inner, VAN_CRUISE, dt);
    return;
  }
  brake(v);
  A.settleT += dt;
  const k = Math.min(1, dt * 1.5);
  v.pos.x += (K.x - v.pos.x) * k; v.pos.z += (K.z - v.pos.z) * k;
  let dy = K.yaw - v.yaw;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  v.yaw += dy * k;
  v.vel.set(0, 0, 0); v.speed = 0;
  if (A.settleT > 2.5 || (Math.abs(dy) < 0.03 && d < 0.3)) {
    A.parked = true;
    emit('van', { act: 'park', x: Math.round(v.pos.x * 10) / 10, z: Math.round(v.pos.z * 10) / 10, after: Math.round(A.parkT * 10) / 10 });
  }
}

// Vehicle bookkeeping for the wanted level: wrecks near the player's car, property damage.
function watchVehicles(ctx, dt) {
  const p = ctx.player, list = ctx.world.vehicles || [];
  const pv = p.vehicle;
  for (const v of list) {
    if (v.hp > 0 || v.wreckSeen) continue;
    v.wreckSeen = true;
    if (pv && (v === pv || (v.pos.x - pv.pos.x) ** 2 + (v.pos.z - pv.pos.z) ** 2 < 64)) {
      ctx.wanted.report('vehicleWreck');
      emitChaos(ctx, v.pos.x, v.pos.z, 'wreck');
    }
  }
  if (pv) {
    if (pv._hpSeen !== undefined && pv.hp < pv._hpSeen - 3 && ctx.time - (pv._propT || -9) > 1) {
      pv._propT = ctx.time;
      ctx.wanted.report('propertyHit');
      emitChaos(ctx, pv.pos.x, pv.pos.z, 'crash');
    }
    pv._hpSeen = pv.hp;
  }
}

export function update(dt, ctx) {
  updateVan(ctx, dt);
  updateTraffic(ctx, dt);
  recyclePeds(ctx, dt, dispose);
  watchVehicles(ctx, dt);
  _cops.length = 0;
  for (const e of ctx.npcs) if (e.kind === 'cop') _cops.push(e);
  // Cruisers still driving in (crew not yet bailed) watch the player too.
  for (const u of ctx.police.units) {
    if (u.kind !== 'drive' || !u.v || u.v.removed) continue;
    const q = u.los || (u.los = { pos: null, knockedT: 0, standDown: false });
    q.pos = u.v.pos; q.standDown = !!u.standDown;
    _cops.push(q);
  }
  updateWanted(ctx.wanted, dt, ctx, _cops);
  updatePolice(ctx.police, dt, ctx);
}
