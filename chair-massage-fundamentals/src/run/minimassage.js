// Mini-massage during the run: set the chair down (E while carrying, on foot), the nearest willing
// ped within 12 m walks over and kneels, hold E for 5 s with W/S keeping a small pressure meter
// in a drifting band. Success pays ($15, $30 for a sore back, +$5 with the tip jar), drops wanted one star, and the
// client walks off relaxed. A hostile goon/cop within 6 m, letting go of E, or chaos within 15 m
// interrupts. Doing the actual work is how you cool heat.
import * as THREE from '../../vendor/three.module.js';
import { findChair, chairState } from '../entities/chair.js';
import { floorHeightAt } from '../physics.js';
import { poseKneeling, poseReaching, resetPose } from '../world/people.js';
import { seek, say } from '../entities/npc-common.js';
import { hostile, alertPack } from '../entities/goon.js';
import { dispatchTo } from './police.js';
import { copHostile } from '../entities/cop.js';
import { THERAPIST } from '../massage/stage.js';
import { sfx } from '../juice.js';
import { emit } from '../events.js';

const CALL_R2 = 12 * 12;
const THREAT_R2 = 6 * 6;
const CHAOS_R2 = 15 * 15;
const HOLD = 5;
const HALF_BAND = 0.13;
const _l = new THREE.Vector3();
const _r = new THREE.Vector3();

export function createMini() {
  return { phase: 'idle', client: null, t: 0, cool: 0, progress: 0, pressure: 0.5, lo: 0.37, hi: 0.63,
    chairYaw: 0, pos: new THREE.Vector3(), startT: 0, done: 0, zone: 'in' };
}

export function setChairDown(p, ctx) {
  const c = findChair(ctx);
  if (!c) return false;
  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
  const x = p.pos.x + fx * 1.1, z = p.pos.z + fz * 1.1;
  const y = floorHeightAt(x, z, ctx.world.colliders, p.pos.y + 0.3);
  ctx.scene.add(c);
  c.position.set(x, y, z);
  c.rotation.set(0, p.yaw + Math.PI, 0);          // face cradle (chair -Z) away from the player
  const home = ctx.world._chairHome;
  if (home) c.scale.copy(home.scale); else c.scale.set(1, 1, 1);
  Object.assign(chairState(ctx.world), { where: 'ground', vehicle: null, setDown: true });
  emit('chair', { act: 'setdown', where: 'ground' });
  const M = ctx.mini;
  M.phase = 'waiting'; M.cool = 0.5; M.chairYaw = p.yaw + Math.PI; M.pos.set(x, y, z);
  sfx(ctx, 'chairFold', x, z);
  return true;
}

// E at the chair with a client kneeling: start the hold.
export function canStart(p, ctx) {
  const M = ctx.mini;
  if (!M || M.phase !== 'ready' || p.vehicle) return false;
  return (p.pos.x - M.pos.x) ** 2 + (p.pos.z - M.pos.z) ** 2 < 2.6 * 2.6;
}

export function startMassage(p, ctx) {
  const M = ctx.mini;
  if (!canStart(p, ctx)) return false;
  M.phase = 'massage'; M.progress = 0; M.t = 0; M.pressure = 0.5; M.startT = ctx.time;
  p.massaging = true;
  emit('mini', { phase: 'start', sore: !!(M.client && M.client.sore) });
  p.vel.set(0, 0, 0);
  // Stand at the therapist's spot beside the chair, facing the client's back.
  const s = Math.sin(M.chairYaw), c = Math.cos(M.chairYaw);
  p.pos.x = M.pos.x + THERAPIST.x * c + THERAPIST.z * s;
  p.pos.z = M.pos.z - THERAPIST.x * s + THERAPIST.z * c;
  p.yaw = M.chairYaw + THERAPIST.yaw;
  return true;
}

function release(ctx, line, relaxed) {
  const M = ctx.mini, e = M.client;
  if (e) {
    e.fixed = false;
    resetPose(e.mesh);
    e.state = 'leave'; e.stateT = 3;
    const dx = e.pos.x - M.pos.x, dz = e.pos.z - M.pos.z, d = Math.hypot(dx, dz) || 1;
    e.cwX = dx / d; e.cwZ = dz / d; e.cSpeed = relaxed ? 0.9 : 1.3;
    if (e.knockedT > 0) e.state = 'wander';
    if (line) say(ctx, e, line);
  }
  M.client = null;
  if (ctx.player.massaging) { ctx.player.massaging = false; resetPose(ctx.player.mesh); }
}

function cancel(ctx, line, nextPhase = 'waiting', reason = 'client left') {
  emit('mini', { phase: 'cancel', during: ctx.mini.phase, reason });
  release(ctx, line, false);
  ctx.mini.phase = nextPhase;
  ctx.mini.cool = 4;
}

function threatNear(ctx, x, z) {
  for (const e of ctx.npcs) {
    if (e.kind === 'ped') continue;
    if (e.kind === 'goon' ? !hostile(e) : !copHostile(e)) continue;
    if ((e.pos.x - x) ** 2 + (e.pos.z - z) ** 2 < THREAT_R2) return true;
  }
  return false;
}

function callClient(ctx) {
  const M = ctx.mini;
  let best = null, bd = CALL_R2;
  for (const e of ctx.npcs) {
    if (e.kind !== 'ped' || e.paid || e.knockedT > 0 || e.soreT > 0) continue;
    if (e.state !== 'wander') continue;
    const d2 = (e.pos.x - M.pos.x) ** 2 + (e.pos.z - M.pos.z) ** 2;
    if (d2 < bd) { bd = d2; best = e; }
  }
  if (!best) return;
  M.client = best; M.phase = 'coming'; M.t = 0;
  best.state = 'toChair'; best.idleT = 0;
  say(ctx, best, best.regular ? "Hey, it's me. Priya. Forearms again?"
    : best.sore ? 'Is that a massage chair? My back is killing me.' : 'Oh, is this the free chair massage?');
}

export function updateMini(dt, ctx) {
  const M = ctx.mini, p = ctx.player, cs = chairState(ctx.world);
  if (!M || M.phase === 'idle') { if (ctx.hud.setMini) ctx.hud.setMini(null); return; }
  if (cs.where !== 'ground' || !cs.setDown) { cancel(ctx, null, 'idle', 'chair moved'); ctx.hud.setMini(null); return; }
  const e = M.client;
  if (e && (e.knockedT > 0 || e.state === 'flee' || !ctx.npcs.includes(e))) { cancel(ctx, null, 'waiting', 'client knocked or fled'); }
  M.t += dt;
  if (M.phase === 'waiting') {
    M.cool -= dt;
    if (M.cool <= 0) callClient(ctx);
  } else if (M.phase === 'coming') {
    const arrived = seek(e, M.pos.x, M.pos.y, M.pos.z, dt, ctx, 0.5);
    e.cwX = e.wishX; e.cwZ = e.wishZ; e.cSpeed = 1.4;
    const danger = threatNear(ctx, M.pos.x, M.pos.z) ||
      (ctx.lastChaos && ctx.lastChaos.t > M.startT - 0.001 && (ctx.lastChaos.x - M.pos.x) ** 2 + (ctx.lastChaos.z - M.pos.z) ** 2 < CHAOS_R2 && ctx.lastChaos.t > ctx.time - 3);
    if (danger) cancel(ctx, 'Actually... no thanks.', 'waiting', 'danger');
    else if (arrived) kneel(e, M);
    else if (M.t > 20) cancel(ctx, 'Eh, never mind.', 'waiting', 'client gave up');
  } else if (M.phase === 'ready') {
    // A kneeling client will not wait forever: the player wandering off, danger nearby,
    // or 25 s of nothing sends them on their way (and frees the chair for pickup).
    const far2 = (p.pos.x - M.pos.x) ** 2 + (p.pos.z - M.pos.z) ** 2;
    if (far2 > 8 * 8 || p.vehicle) M.awayT = (M.awayT || 0) + dt; else M.awayT = 0;
    if (M.awayT > 3 || M.t > 25 || threatNear(ctx, M.pos.x, M.pos.z)) cancel(ctx, 'Guess not.', 'waiting', 'client stopped waiting');
  } else if (M.phase === 'massage') {
    const input = ctx.input;
    const chaos = ctx.lastChaos && ctx.lastChaos.t > M.startT &&
      (ctx.lastChaos.x - M.pos.x) ** 2 + (ctx.lastChaos.z - M.pos.z) ** 2 < CHAOS_R2;
    if (!input || !input.e || p.knockedT > 0 || chaos || threatNear(ctx, M.pos.x, M.pos.z)) {
      cancel(ctx, chaos ? 'Whoa, whoa. Maybe later.' : 'Oh. Okay then.', 'waiting', chaos ? 'chaos' : p.knockedT > 0 ? 'knocked down' : !input || !input.e ? 'let go of E' : 'threat');
    } else {
      M.pressure = Math.min(1, Math.max(0, M.pressure + ((input.forward ? 1 : 0) - (input.back ? 1 : 0)) * 0.55 * dt));
      const mid = 0.5 + 0.2 * Math.sin((ctx.time - M.startT) * 1.1);
      M.lo = mid - HALF_BAND; M.hi = mid + HALF_BAND;
      M.zone = M.pressure < M.lo ? 'under' : M.pressure > M.hi ? 'over' : 'in';
      if (M.zone === 'in') M.progress += dt / HOLD;
      else if (M.zone === 'over') M.progress = Math.max(0, M.progress - dt * 0.1);
      if (M.progress >= 1) succeed(ctx);
    }
  }
  if (ctx.hud.setMini) ctx.hud.setMini(M.phase === 'massage' ? M : M.phase === 'ready' ? { ready: true } : null);
}

function kneel(e, M) {
  e.state = 'kneel'; e.fixed = true;
  e.vel.set(0, 0, 0);
  e.pos.copy(M.pos);
  e.yaw = M.chairYaw + Math.PI;
  e.knockTilt = 0;
  e.mesh.position.copy(e.pos);
  e.mesh.rotation.set(0, e.yaw, 0);
  poseKneeling(e.mesh);
  M.phase = 'ready';
}

function succeed(ctx) {
  const M = ctx.mini, e = M.client;
  const tip = (ctx.perks && ctx.perks.tipJar) || 0;   // the tip jar (consolation perk): on top, every success
  const pay = (e.sore ? 30 : 15) + tip;
  ctx.runCash = (ctx.runCash || 0) + pay;
  if (ctx.wanted) ctx.wanted.drop(1, 'massage');
  emit('mini', { phase: 'success', pay, tip, sore: !!e.sore });
  M.done++;
  e.paid = true; e.loose = 25;
  ctx.hud.floater(`+$${pay}`, M.pos.x, M.pos.y + 1.9, M.pos.z, 'cash');
  sfx(ctx, 'pay', M.pos.x, M.pos.z);
  ctx.hud.floater('TENSION RELEASED', M.pos.x, M.pos.y + 2.3, M.pos.z, 'released');
  release(ctx, e.regular ? 'Okay. I can pull shots again. Here.' : e.sore ? 'My back... it\'s fixed? Here, take double.' : 'Oh, that\'s so much better. Here.', true);
  e.soreT = 0; e.sore = false;
  M.phase = 'waiting'; M.cool = 3;
  heatOnSpot(ctx, M);
}

// Camping the chair draws attention (ruled 2026-09-24 after run 5). The first mini-massage of a
// run is free; each further success within 90 s of the previous one on the same spot (40 m) adds
// heat: at 2 the goon pack is radioed to the chair, at 3 (and on) a cop is sent to it ("We told
// you to stop that.") and wanted goes to at least one star (report 'vending', +1 once per run).
// Peds still queue.
const HEAT_WINDOW = 90;
const HEAT_R2 = 40 * 40;
function heatOnSpot(ctx, M) {
  const H = M.heat || (M.heat = { n: 0, t: -1e9, x: 0, z: 0 });
  const same = ctx.time - H.t <= HEAT_WINDOW && (M.pos.x - H.x) ** 2 + (M.pos.z - H.z) ** 2 < HEAT_R2;
  H.n = same ? H.n + 1 : 1;
  H.t = ctx.time; H.x = M.pos.x; H.z = M.pos.z;
  if (H.n < 2) return;
  if (H.n === 2) {
    const n = alertPack(ctx, M.pos.x, M.pos.y, M.pos.z);
    emit('vending', { act: 'alert', heat: H.n, goons: n });
    return;
  }
  emit('vending', { act: 'report', heat: H.n });
  if (ctx.police) dispatchTo(ctx, M.pos.x, M.pos.y, M.pos.z);
  if (ctx.wanted) ctx.wanted.report('vending');
}

// Called from updatePlayer while massaging: lean in, both palms on the client's back.
export function poseTherapist(p, ctx) {
  const M = ctx.mini, e = M && M.client;
  p.mesh.position.copy(p.pos);
  p.mesh.rotation.set(0, p.yaw, 0);
  if (!e) return;
  const back = e.mesh.userData.back;
  const push = 0.02 + M.pressure * 0.04, wob = Math.sin(ctx.time * 3) * 0.03;
  e.mesh.updateMatrixWorld(true);
  _l.set(-0.08, wob, push).applyMatrix4(back.matrixWorld);
  _r.set(0.08, -wob, push).applyMatrix4(back.matrixWorld);
  poseReaching(p.mesh, 0.32, _l, _r);
}

