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
import { createPolice, updatePolice, clearPolice } from './police.js';
import { driveRoute, driveAt, brake } from './driver.js';
import { nearestNode, nodeAhead } from '../world/roads.js';
import { spawnPeds, spawnRegular, recyclePeds } from './peds.js';
import { createTraffic, beginTraffic, clearTraffic, updateTraffic } from './traffic.js';
import { resetVehicles } from './reset.js';

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
  p.hp = 100; p.prevHp = 100; p.hurtAt = -1e9; p.knockedT = 0;
  const rng = makeRng((ctx.world.seed ^ 0x9ed5) >>> 0);
  spawnPeds(ctx, rng);
  if (ctx.perks && ctx.perks.regular) spawnRegular(ctx, rng);
  ctx.vanAI = { v: null, mode: 'park', waveT: 0, dropT: 0, spawnedAt: -1 };
  if (countKind(ctx, 'goon') === 0) spawnGoons(ctx, 3);
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

// The van driver: parks while the player is on foot, cuts ahead on the loop while they drive,
// and every 90 s returns to vanEntry to drop fresh goons.
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
      A.mode = 'park'; A.waveT = 0; A.spawnedAt = ctx.time;
    }
    return;
  }
  if (p.vehicle && v.hp > 0) {
    // Cut him off: wait at the next intersection he is driving toward.
    A.mode = 'cut';
    const G = ctx.world.roads, pv = p.vehicle;
    const goal = nodeAhead(G, pv.pos.x, pv.pos.z, pv.vel.x, pv.vel.z);
    const n = G.nodes[goal];
    if (goal >= 0 && Math.hypot(n.x - v.pos.x, n.z - v.pos.z) < 6) brake(v);
    else if (goal >= 0) driveRoute(v, G, goal, VAN_CRUISE, dt);
  } else {
    A.mode = 'park';
    brake(v);
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
