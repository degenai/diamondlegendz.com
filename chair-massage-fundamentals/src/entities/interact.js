// E interactions on foot and in a vehicle: enter/exit (steal), pick up / load the chair.
// Also the RUN HUD strings (hint, vehicle line, chair strip) and the Healing Palm on bodywork.
import { boxDistance, dentVehicle, vehicleCircles } from './vehicle-collide.js';
import { overlapsFootprint, floorHeightAt } from '../physics.js';
import { chairState, chairWorldPos, pickUpChair, loadChair, findChair } from './chair.js';
import { setChairDown, canStart, startMassage } from '../run/minimassage.js';
import { emitChaos } from '../run/wanted.js';
import { seatRig, unseatRig, clearDriverRig } from './seated.js';
import { createPed } from './ped.js';
import { addEntity } from './index.js';
import { nearestNav } from './npc-nav.js';
import { takeCivilian } from '../run/traffic.js';
import { makeRng } from '../rng.js';
import { emit } from '../events.js';
import { sfx } from '../juice.js';

export const ENTER_DIST = 2.5;   // metres from the vehicle's footprint box
export const CHAIR_DIST = 2;
export const TAKE_DIST = 1.5;
export const JACK_SPEED = 3;     // a civilian car moving faster than this ignores E   // standing at a loaded chair (trunk, rack, passenger door) takes it back out
const PALM_REACH = 1.3;

export function nearestVehicle(p, ctx, maxD = ENTER_DIST) {
  const list = ctx.world && ctx.world.vehicles;
  let best = null, bestD = maxD;
  if (!list) return null;
  for (const v of list) {
    if (v.driver || Math.abs(v.pos.y - p.pos.y) > 1.5) continue;
    const d = boxDistance(v, p.pos.x, p.pos.z);
    if (d <= bestD) { best = v; bestD = d; }
  }
  return best ? { v: best, d: bestD } : null;
}

function chairDistance(p, ctx) {
  const cs = chairState(ctx.world);
  if (cs.where === 'player' || (cs.where === 'vehicle' && (!cs.vehicle || cs.vehicle.driver))) return Infinity;
  const w = chairWorldPos(ctx);
  if (!w || Math.abs(w.y - p.pos.y) > 1.5) return Infinity;
  return Math.hypot(w.x - p.pos.x, w.z - p.pos.z);
}

// A civilian car in traffic, slow enough to pull its driver out of.
export function jackableVehicle(p, ctx, maxD = ENTER_DIST) {
  let best = null, bestD = maxD;
  for (const v of (ctx.world && ctx.world.vehicles) || []) {
    if (!v.civilian || !v.driver || v.driver === p || Math.abs(v.speed) >= JACK_SPEED || Math.abs(v.pos.y - p.pos.y) > 1.5) continue;
    const d = boxDistance(v, p.pos.x, p.pos.z);
    if (d <= bestD) { best = v; bestD = d; }
  }
  return best;
}

// Repairs at a food cart (ruled 2026-09-24): $20 of the player's cash puts his vehicle back to
// 100 hp, driving within REPAIR_DIST of any cart or standing beside the vehicle he last drove.
// The cash is his half: it comes off the massage phase's `you` share, so the host's ledger
// (half the run's cash plus the massage host share, summary.js) never pays for his bodywork.
export const REPAIR_COST = 20;
export const REPAIR_DIST = 4;
export function playerCash(ctx) { return (ctx.massageTotals ? ctx.massageTotals.you : 0) + (ctx.runCash || 0); }
function allCarts(world) {
  if (!world._carts) world._carts = (world.blocks || []).flatMap((b) => b.carts || []);
  return world._carts;
}
function nearCart(v, ctx) {
  for (const c of allCarts(ctx.world)) {
    if (Math.abs(c.pos.y - v.pos.y) < 1.5 && boxDistance(v, c.pos.x, c.pos.z) <= REPAIR_DIST) return c;
  }
  return null;
}
// null, or { v, cart, afford } for a damaged vehicle of his beside a cart.
export function repairOffer(p, ctx, v) {
  if (!v || !(v.hp < 100) || !ctx.world || !ctx.runStats) return null;
  const cart = nearCart(v, ctx);
  return cart ? { v, cart, afford: playerCash(ctx) >= REPAIR_COST } : null;
}
export function repairVehicle(p, ctx, v) {
  const o = repairOffer(p, ctx, v);
  if (!o || !o.afford) return false;
  const before = v.hp;
  if (!ctx.massageTotals) ctx.massageTotals = { you: 0, host: 0 };
  ctx.massageTotals.you -= REPAIR_COST;
  ctx.runSpent = (ctx.runSpent || 0) + REPAIR_COST;
  v.hp = 100; v._hpSeen = 100; v.wreckSeen = false; v.wobbleT = 0;
  if (v.smoke) v.smoke.group.visible = false;
  sfx(ctx, 'pay', v.pos.x, v.pos.z);
  if (ctx.hud && ctx.hud.floater) ctx.hud.floater(`REPAIRED -$${REPAIR_COST}`, v.pos.x, v.pos.y + v.spec.height + 0.6, v.pos.z, 'cash');
  emit('repair', { vehicle: v.type, hpBefore: Math.round(before), cost: REPAIR_COST, cash: Math.round(playerCash(ctx)), driving: p.vehicle === v });
  return true;
}

// What E would do right now: { act, v } with act in
// enter|exit|repair|load|setdown|massage|pickup|take|carjack|null. In a vehicle beside a cart that
// he cannot pay, E still gets him out; `broke` puts the price in the hint.
export function interaction(p, ctx) {
  if (p.vehicle) {
    const o = repairOffer(p, ctx, p.vehicle);
    if (o && o.afford) return { act: 'repair', v: p.vehicle };
    return { act: 'exit', v: p.vehicle, broke: !!o };
  }
  if (p.knockedT > 0 || p.massaging) return { act: null };
  const nv = nearestVehicle(p, ctx);
  const cs = chairState(ctx.world);
  if (cs.where === 'player') return nv ? { act: 'load', v: nv.v } : { act: ctx.mini ? 'setdown' : null };
  if (ctx.mini && canStart(p, ctx)) return { act: 'massage' };
  const cd = chairDistance(p, ctx);
  if (cs.where === 'vehicle') {
    if (cd <= TAKE_DIST && (!nv || cd < nv.d)) return { act: 'take' };
  } else if (cd <= CHAIR_DIST && (!nv || cd < nv.d)) return { act: 'pickup' };
  if (nv && nv.v === p.lastVehicle) {
    const o = repairOffer(p, ctx, nv.v);
    if (o) return o.afford ? { act: 'repair', v: nv.v } : { act: 'enter', v: nv.v, broke: true };
  }
  if (nv) return { act: 'enter', v: nv.v };
  const jv = jackableVehicle(p, ctx);
  return jv ? { act: 'carjack', v: jv } : { act: null };
}

export function handleInteract(p, ctx) {
  const it = interaction(p, ctx);
  if (it.act === 'exit') exitVehicle(p, ctx);
  else if (it.act === 'repair') repairVehicle(p, ctx, it.v);
  else if (it.act === 'enter') enterVehicle(p, it.v, ctx);
  else if (it.act === 'carjack') carjack(p, it.v, ctx);
  else if (it.act === 'load') loadChair(ctx, it.v);
  else if (it.act === 'pickup' || it.act === 'take') pickUpChair(ctx, p);
  else if (it.act === 'setdown') setChairDown(p, ctx);
  else if (it.act === 'massage') startMassage(p, ctx);
  return it.act;
}

export function enterVehicle(p, v, ctx, how = 'enter') {
  if (p.knockedT > 0 || v.driver) return false;
  emit('vehicle', { act: how, type: v.spec.label, stolen: how === 'carjack' || !!v.parked || !!v.stolen });
  if (v.parked) {                      // stealing: wanted +1 the first time, +0.5 after
    v.stolen = true;
    if (ctx.wanted) ctx.wanted.report('stealVehicle');
    emitChaos(ctx, v.pos.x, v.pos.z, 'steal');
  }
  v.parked = false;
  v.driver = p;
  v.asleep = false;
  p.vehicle = v;
  p.lastVehicle = v;                   // "your vehicle" for a repair on foot
  p.vel.set(0, 0, 0);
  // Sit at the wheel: the rig rides on the vehicle's body (leans with it), visible.
  p.seatHome = p.seatHome || p.mesh.parent || ctx.scene;
  p.knockTilt = 0;
  seatRig(p.mesh, v);
  p.chaseYaw = p.camYaw;               // the chase camera starts from the on-foot orbit
  p.orbitYaw = 0; p.orbitPitch = 0; p.orbitIdle = 9;
  p.camBlendT = 0;
  return true;
}

// Pull the civilian out of the driver's door: he lands sore (up in ~1 s holding his back) and is
// an ordinary ped from then on; wanted +1 as a stolen vehicle, a chaos event, and the player is
// at the wheel of a car that is his (stolen) from now on.
export function carjack(p, v, ctx) {
  if (p.knockedT > 0 || !v.civilian || !v.driver || Math.abs(v.speed) >= JACK_SPEED) return false;
  const s = Math.sin(v.yaw), c = Math.cos(v.yaw), off = v.spec.halfW + 0.7;
  const x = v.pos.x + c * off, z = v.pos.z - s * off;
  clearDriverRig(v);
  takeCivilian(ctx, v);
  v.driver = null; v.ai = null; v.route = null; v.jacked = true;
  const rng = makeRng((ctx.world.seed ^ Math.floor(ctx.time * 1000)) >>> 0);
  const pos = { x, y: floorHeightAt(x, z, ctx.world.colliders, v.pos.y + 0.3), z };
  const e = createPed(ctx.scene, v.pos.clone().set(pos.x, pos.y, pos.z), nearestNav(ctx.world, x, z), rng);
  e.yaw = v.yaw + Math.PI / 2; e.knockedT = 1.2; e.knockCause = 'vehicle'; e.jackedFrom = v;
  e.vel.set(c * 1.5, 1.2, -s * 1.5); e.grounded = false;
  addEntity(ctx.entities, e);
  ctx.npcs.push(e);
  if (ctx.wanted) ctx.wanted.report('carjack');
  emitChaos(ctx, x, z, 'carjack');
  v.parked = false; v.stolen = true;
  enterVehicle(p, v, ctx, 'carjack');
  ctx.lastCarjack = { t: ctx.time, v: v.id, ped: e.id };
  return true;
}

function spotFree(x, z, y, ctx, self) {
  const q = { x, z };
  for (const c of ctx.world.colliders) {
    if (c.camOnly || c.maxY <= y + 0.35) continue;
    if (overlapsFootprint(q, 0.45, c)) return false;
  }
  for (const v of ctx.world.vehicles || []) {
    if (v === self) continue;
    for (const k of vehicleCircles(v)) if ((k.x - x) ** 2 + (k.z - z) ** 2 < (v.spec.circleR + 0.45) ** 2) return false;
  }
  return true;
}

// Out the driver's door (left, +X local), else the right, else front or rear.
export function exitVehicle(p, ctx) {
  const v = p.vehicle;
  if (!v) return false;
  const s = Math.sin(v.yaw), c = Math.cos(v.yaw), T = v.spec;
  const side = T.halfW + 0.6, end = T.halfL + 0.6;
  const cands = [[c * side, -s * side], [-c * side, s * side], [s * end, c * end], [-s * end, -c * end]];
  let spot = null;
  for (const cand of cands) {
    if (spotFree(v.pos.x + cand[0], v.pos.z + cand[1], v.pos.y, ctx, v)) { spot = cand; break; }
  }
  // Boxed in on all four sides: search outward in a ring until something is free.
  if (!spot) {
    outer: for (let rad = end + 1; rad <= end + 6 && !spot; rad += 1) {
      for (let k = 0; k < 12; k++) {
        const a = v.yaw + (k / 12) * Math.PI * 2;
        const cand = [Math.sin(a) * rad, Math.cos(a) * rad];
        if (spotFree(v.pos.x + cand[0], v.pos.z + cand[1], v.pos.y, ctx, v)) { spot = cand; break outer; }
      }
    }
  }
  if (!spot) spot = cands[0];
  const x = v.pos.x + spot[0], z = v.pos.z + spot[1];
  p.pos.set(x, floorHeightAt(x, z, ctx.world.colliders, v.pos.y + 0.3), z);
  p.vel.set(0, 0, 0);
  // Bailing out of a moving car: the car you just left cannot run you over for a moment.
  p.exitGrace = { v, t: 1.0 };
  p.grounded = true;
  p.yaw = v.yaw;
  p.camYaw = (p.chaseYaw ?? v.yaw + Math.PI) + (p.orbitYaw || 0);
  p.camPitch = 0.25;
  p.camBlendT = 0;
  unseatRig(p.mesh, p.seatHome || ctx.scene, p.pos, p.yaw);
  emit('vehicle', { act: 'exit', type: v.spec.label, stolen: !!v.stolen });
  v.driver = null;
  p.vehicle = null;
  return true;
}

// Healing Palm: a vehicle just in front of the strike gets dented.
export function palmVehicles(p, ctx) {
  const list = ctx.world && ctx.world.vehicles;
  if (!list) return null;
  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
  const hx = p.pos.x + fx * 0.6, hz = p.pos.z + fz * 0.6;
  for (const v of list) {
    if (v.driver === p || boxDistance(v, hx, hz) > PALM_REACH) continue;
    dentVehicle(v, 3);
    return v;
  }
  return null;
}

const BROKE = `Repair $${REPAIR_COST} (not enough cash)`;
const HINTS = { repair: `E: repair here ($${REPAIR_COST})`, enter: 'E enter vehicle', carjack: 'E pull the driver out', exit: 'E exit vehicle', load: 'E load chair', pickup: 'E pick up chair', take: 'E take the chair',
  setdown: 'E set chair down', massage: 'Hold E: start massage (W/S pressure)' };

// RUN HUD strings for main.js: { hint, vehicle, chair }.
export function runHudText(p, ctx) {
  const it = interaction(p, ctx);
  const cs = chairState(ctx.world);
  const v = p.vehicle;
  let chair = "Don't leave the chair.";
  if (cs.where === 'player') chair = 'Chair: on you';
  else if (cs.where === 'vehicle' && cs.vehicle) chair = `Chair: in the ${cs.vehicle.spec.label}`;
  else if (!findChair(ctx)) chair = "Don't leave the chair.";
  return {
    hint: it.broke ? (it.act === 'enter' ? `${HINTS.enter}  |  ${BROKE}` : BROKE) : (it.act && it.act !== 'exit') ? HINTS[it.act] : '',
    vehicle: v ? `${v.spec.label.toUpperCase()}  ${Math.round(Math.abs(v.speed) * 3.6)} km/h  hp ${Math.ceil(v.hp)}` : '',
    chair,
  };
}
