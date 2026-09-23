// E interactions on foot and in a vehicle: enter/exit (steal), pick up / load the chair.
// Also the RUN HUD strings (hint, vehicle line, chair strip) and the Healing Palm on bodywork.
import { boxDistance, dentVehicle, vehicleCircles } from './vehicle-collide.js';
import { overlapsFootprint, floorHeightAt } from '../physics.js';
import { chairState, chairWorldPos, pickUpChair, loadChair, findChair } from './chair.js';

export const ENTER_DIST = 2.5;   // metres from the vehicle's footprint box
export const CHAIR_DIST = 2;
export const TAKE_DIST = 1.5;   // standing at a loaded chair (trunk, rack, passenger door) takes it back out
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

// What E would do right now: { act, v } with act in enter|exit|load|pickup|null.
export function interaction(p, ctx) {
  if (p.vehicle) return { act: 'exit', v: p.vehicle };
  if (p.knockedT > 0) return { act: null };
  const nv = nearestVehicle(p, ctx);
  const cs = chairState(ctx.world);
  if (cs.where === 'player') return nv ? { act: 'load', v: nv.v } : { act: null };
  const cd = chairDistance(p, ctx);
  if (cs.where === 'vehicle') {
    if (cd <= TAKE_DIST && (!nv || cd < nv.d)) return { act: 'take' };
  } else if (cd <= CHAIR_DIST && (!nv || cd < nv.d)) return { act: 'pickup' };
  return nv ? { act: 'enter', v: nv.v } : { act: null };
}

export function handleInteract(p, ctx) {
  const it = interaction(p, ctx);
  if (it.act === 'exit') exitVehicle(p, ctx);
  else if (it.act === 'enter') enterVehicle(p, it.v, ctx);
  else if (it.act === 'load') loadChair(ctx, it.v);
  else if (it.act === 'pickup' || it.act === 'take') pickUpChair(ctx, p);
  return it.act;
}

export function enterVehicle(p, v, ctx) {
  if (p.knockedT > 0 || v.driver) return false;
  if (v.parked) v.stolen = true;       // Phase 5 reads this for the wanted level
  v.parked = false;
  v.driver = p;
  v.asleep = false;
  p.vehicle = v;
  p.vel.set(0, 0, 0);
  p.mesh.visible = false;
  p.chaseYaw = p.camYaw;               // the chase camera starts from the on-foot orbit
  p.orbitYaw = 0; p.orbitPitch = 0; p.orbitIdle = 9;
  p.camBlendT = 0;
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
  p.mesh.visible = true;
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

const HINTS = { enter: 'E enter vehicle', exit: 'E exit vehicle', load: 'E load chair', pickup: 'E pick up chair', take: 'E take the chair' };

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
    hint: (it.act && it.act !== 'exit') ? HINTS[it.act] : '',
    vehicle: v ? `${v.spec.label.toUpperCase()}  ${Math.round(Math.abs(v.speed) * 3.6)} km/h  hp ${Math.ceil(v.hp)}` : '',
    chair,
  };
}
