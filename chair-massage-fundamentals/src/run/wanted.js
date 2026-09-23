// Wanted level (GTA3 curve). heat is a float; level = floor(heat) clamped 0..WANTED_CAP (5 max). Levels 4 and 5
// need real vehicle carnage (3+ ped hits or 3+ wrecks, DESIGN.md), so heat caps below 4 until then.
// Decays one level per 25 s while no cop has line of sight to the player. Also the chaos-event
// bus: emitChaos() makes nearby peds flee and interrupts a mini-massage.
import { lineOfSight } from '../entities/npc-nav.js';

// v1 cap (DESIGN.md, Version one decisions): levels 4 and 5 stay implemented; raise this later.
export const WANTED_CAP = 3;
const DECAY = 25;
const CHAOS_WINDOW = 10;
const CHAOS_RUN = 60;
const LOS_EVERY = 0.25;
const FLEE_R2 = 15 * 15;

export function createWanted() {
  const w = {
    heat: 0, level: 0, decayT: 0, chaosT: 0, lastEventT: -1e9, time: 0,
    goonHitDone: false, stolen: 0, carnage: 0, seen: false, losT: 0, risingT: 0,
    counts: {},
    report: (kind) => report(w, kind),
    drop: (n = 1) => setLevel(w, Math.max(0, w.level - n)),
    reset: () => resetWanted(w),
  };
  return w;
}

function resetWanted(w) {
  Object.assign(w, { heat: 0, level: 0, decayT: 0, chaosT: 0, lastEventT: -1e9, goonHitDone: false,
    stolen: 0, carnage: 0, seen: false, losT: 0, risingT: 0, counts: {} });
}

function setLevel(w, lvl) {
  lvl = Math.min(WANTED_CAP, lvl);
  w.heat = lvl;
  w.level = lvl;
  w.decayT = 0;
}

function add(w, amt) {
  const cap = Math.min(WANTED_CAP + 0.999, w.carnage >= 3 ? 5.999 : 3.999);
  const before = w.level;
  w.heat = Math.min(cap, Math.max(w.heat, before) + amt);
  w.level = Math.min(WANTED_CAP, Math.floor(w.heat));
  if (w.level > before) w.risingT = 3;
}

export function report(w, kind) {
  w.counts[kind] = (w.counts[kind] || 0) + 1;
  w.lastEventT = w.time;
  w.decayT = 0;
  if (kind === 'goonHit') { if (!w.goonHitDone) { w.goonHitDone = true; add(w, 1); } }
  else if (kind === 'stealVehicle') { add(w, w.stolen === 0 ? 1 : 0.5); w.stolen++; }
  else if (kind === 'pedHurt') { w.carnage += 1; add(w, 2); }
  else if (kind === 'vehicleWreck') { w.carnage += 1; add(w, 1); }
  else if (kind === 'propertyHit') add(w, 0.25);
  return w.level;
}

// Per tick in RUN. cops: the live cop NPCs plus proxies for police vehicles still driving in.
export function updateWanted(w, dt, ctx, cops) {
  w.time = ctx.time;
  if (w.risingT > 0) w.risingT = Math.max(0, w.risingT - dt);
  // Continuous chaos: wanted > 0 with an event in the last 10 s, for 60 s straight.
  if (w.level > 0 && w.time - w.lastEventT < CHAOS_WINDOW) {
    w.chaosT += dt;
    if (w.chaosT >= CHAOS_RUN) { w.chaosT = 0; add(w, 1); }
  } else w.chaosT = 0;

  w.losT -= dt;
  if (w.losT <= 0) {
    w.losT = LOS_EVERY;
    w.seen = false;
    const p = ctx.player;
    for (let i = 0; i < cops.length && !w.seen; i++) {
      const c = cops[i];
      if (c.knockedT > 0 || c.standDown || c.state === 'walkoff' || c.state === 'hang' || c.loose > 0) continue;   // relaxed cops relieve the pressure
      const dx = c.pos.x - p.pos.x, dz = c.pos.z - p.pos.z;
      if (dx * dx + dz * dz > 90 * 90) continue;
      if (lineOfSight(ctx.world, c.pos, p.pos)) w.seen = true;
    }
  }
  if (w.level > 0 && !w.seen) {
    w.decayT += dt;
    if (w.decayT >= DECAY) setLevel(w, w.level - 1);
  } else w.decayT = 0;
}

// A chaos event at (x, z): peds within 15 m flee, the mini-massage hears it, the HUD flashes.
export function emitChaos(ctx, x, z, kind = 'chaos') {
  ctx.lastChaos = { x, z, t: ctx.time, kind };
  const list = ctx.npcs || [];
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (e.kind !== 'ped' || !e.flee) continue;
    const dx = e.pos.x - x, dz = e.pos.z - z;
    if (dx * dx + dz * dz < FLEE_R2) e.flee(e, x, z, ctx);
  }
  const p = ctx.player;
  if (ctx.hud && ctx.hud.flashChaos && p && (p.pos.x - x) ** 2 + (p.pos.z - z) ** 2 < 30 * 30) ctx.hud.flashChaos();
}
