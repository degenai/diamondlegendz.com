// Run population, orchestration only: begin() on entering RUN, update() after updateAll, clear() on
// MASSAGE, plus the wanted bookkeeping from vehicles (wrecks, property). The parts live in
// peds-budget.js (the per-block ped budget), goon-waves.js (the opening pack, the 90 s waves),
// van-ai.js (the Serenity van's driver), police.js and traffic.js.
// The first three goons come out of the van during the PIVOT (pivot.js calls spawnGoons);
// begin() only spawns them itself on the debug path that skips the pivot.
import { makeRng } from '../rng.js';
import { preload } from '../assets.js';
import { clearDriverRig } from '../entities/seated.js';
import { updateWanted, emitChaos } from './wanted.js';
import { createPolice, updatePolice } from './police.js';
import { clearPolice } from './police-units.js';
import { spawnPeds, spawnRegular, recyclePeds, disposeNpc } from './peds-budget.js';
import { openingPack, onboardStep } from './goon-waves.js';
import { updateVan, vanHit } from './van-ai.js';
import { createTraffic, beginTraffic, clearTraffic, updateTraffic } from './traffic.js';
import { resetVehicles } from './reset.js';
import { spawnPassCar, clearPassCar } from '../world/cars.js';

// Moved to goon-waves.js (refactor/split); re-exported here for one release.
export { countKind, spawnGoons } from './goon-waves.js';

const _cops = [];

export function initSpawner(ctx) {
  ctx.npcs = ctx.npcs || [];
  ctx.police = createPolice();
  ctx.traffic = createTraffic(ctx.world.seed);
  ctx.runCash = 0;
  ctx.vanHit = (van, hitter, speed) => vanHit(ctx, van, hitter, speed);   // vehicle-collide.js
  preload(['assets/bat.json', 'assets/ranger.json', 'assets/copcar.json', 'assets/swatvan.json', 'assets/cart.json'])
    .catch((err) => console.warn('[CMF] NPC asset preload failed', err));
}

export function clear(ctx) {
  clearPolice(ctx.police, ctx);
  clearTraffic(ctx);
  for (const e of ctx.npcs) disposeNpc(ctx, e);
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
  ctx.runSpent = 0;                           // repairs at the food carts (interact.js)
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
  openingPack(ctx);
  if (ctx.world.vehicles && ctx.perks && ctx.perks.parkingPass) spawnPassCar(ctx.world, ctx.world.root, ctx.entities);
  if (ctx.world.vehicles) beginTraffic(ctx);
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
  recyclePeds(ctx, dt);
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
  onboardStep(ctx, dt);                       // first-run prompts in the grab window (goon-waves.js)
}
