// Mini-massage during the run: set the chair down (E while carrying, on foot), the nearest willing
// ped within 12 m walks over and kneels, hold E for 5 s (10 s on a bent chair). The ped calls like a
// course client (ruled 2026-09-25, "same calls, faster"): every 2 to 3 s "Ow. Lighter." (tap S),
// "Harder." (hold W 0.6 s), "That's it, right there." (no W / S), judged by massage/meter.js with
// shorter windows (MINI_CALLS). A miss adds 1 s to the hold and gets "Not that."; a third miss and
// they get up ("Forget it.", no pay, the chair stays down). Success pays ($15, $30 for a sore back,
// +$5 with the tip jar), drops wanted one star, and the client walks off relaxed. A hostile goon/cop
// within 6 m, letting go of E, or chaos within 15 m interrupts (an open call dies with it). Doing the
// actual work is how you cool heat.
import * as THREE from '../../vendor/three.module.js';
import { chairState, chairBent } from '../entities/chair.js';
import { poseKneeling, poseReaching, resetPose } from '../world/people.js';
import { seek, say } from '../entities/npc-common.js';
import { hostile, copHostile, alertPack } from '../entities/hostile.js';
import { dispatchTo } from './police.js';
import { sfx } from '../juice.js';
import { emit } from '../events.js';
import { say as bubble } from '../bubbles.js';
import { MINI_CALLS, nextGap, pickCall, makeCall, openCall, judge } from '../massage/meter.js';
// E's two mini-massage actions moved to mini-start.js (refactor/split); re-exported for one release.
export { setChairDown, canStart, startMassage } from './mini-start.js';

const CALL_R2 = 12 * 12;
const THREAT_R2 = 6 * 6;
const CHAOS_R2 = 15 * 15;
const HOLD = 5;
const BENT_MUL = 2;           // a bent chair (worn out by swings, chair.js): the massage takes twice as long
const MISS_ADD = 1;           // s a wrong or late answer puts back on the hold
const MISSES = 3;             // the third miss in one massage and the ped gets up
const FLASH = 1;              // s the strip stays green or red after an answer
const _l = new THREE.Vector3();
const _r = new THREE.Vector3();

export function createMini() {
  return { phase: 'idle', client: null, t: 0, cool: 0, progress: 0, chairYaw: 0, pos: new THREE.Vector3(),
    startT: 0, done: 0, caller: null, misses: 0, flash: null, flashT: 0, tries: 0 };
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
    if (line) say(ctx, e, line, 'speech replace');   // over any call line still speaking (bubbles.js speechHud)
  }
  M.client = null;
  if (M.caller) M.caller.call = null;       // an open call dies with the massage: no late miss after it
  M.caller = null; M.flash = null; M.flashT = 0;
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
  if (cs.where !== 'ground' || !cs.setDown) { cancel(ctx, null, 'idle', 'chair moved'); if (ctx.hud.setMini) ctx.hud.setMini(null); return; }
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
      const hold = HOLD * (chairBent(ctx.world) ? BENT_MUL : 1);
      M.progress += dt / hold;                 // progress runs on E alone
      if (M.flashT > 0) { M.flashT -= dt; if (M.flashT <= 0) M.flash = null; }
      if (M.caller) tickCalls(dt, ctx, M, e, hold);
      if (M.phase === 'massage' && M.progress >= 1) succeed(ctx);
    }
  }
  if (ctx.hud.setMini) ctx.hud.setMini(M.phase === 'massage' ? miniView(M) : M.phase === 'ready' ? { ready: true } : null);
}

// What the HUD strip shows: the hold's progress, the open call (its window left, 1 -> 0), the flash.
function miniView(M) {
  const c = M.caller && M.caller.call;
  return { progress: M.progress, flash: M.flash, misses: M.misses,
    call: c && c.open ? { name: c.name, frac: Math.max(0, 1 - c.t / c.window) } : null };
}

// The calls: one at a time, 2 to 3 s after the last answer; the window opens when the line starts.
function tickCalls(dt, ctx, M, e, hold) {
  const k = M.caller;
  if (!k.call) { k.wait -= dt; if (k.wait <= 0) askCall(ctx, M, e); return; }
  if (!k.call.open) return;
  const r = judge(k.call, ctx.input, dt);
  if (r) answerCall(ctx, M, e, r, hold);
}

function askCall(ctx, M, e) {
  const k = M.caller, name = pickCall(k);
  const call = makeCall(name, MINI_CALLS.calls[name]);
  k.call = call;
  emit('call', { act: 'asked', where: 'run', prompt: call.text, call: call.name, key: call.key || 'none', window: call.window, client: e.id });
  const r = bubble(ctx, e, call.text, { skin: 'run', preset: 'client', kind: 'request', onStart: () => {
    if (M.phase === 'massage' && M.client === e && M.caller === k && k.call === call && !call.open) openCall(call);
  } });
  if (!r && !call.open) openCall(call);        // no bubble to speak in: never strand the call
}

function answerCall(ctx, M, e, r, hold) {
  const k = M.caller, call = k.call;
  k.call = null;
  k.wait = nextGap(k);
  if (r.correct) M.flash = 'ok';
  else {
    M.misses++;
    M.flash = 'bad';
    M.progress = Math.max(0, M.progress - MISS_ADD / hold);
  }
  M.flashT = FLASH;
  const rec = { call: call.name, prompt: call.text, key: call.key || 'none', answer: r.answer, correct: r.correct, late: r.late,
    after: Math.round(call.t * 100) / 100, at: Math.round(ctx.time * 100) / 100, next: Math.round(k.wait * 100) / 100 };
  k.log.push(rec);
  emit('call', { act: 'answer', where: 'run', ...rec, misses: M.misses, client: e.id });
  if (r.correct) return;
  if (M.misses >= MISSES) cancel(ctx, 'Forget it.', 'waiting', 'three misses');
  else say(ctx, e, e.miss || 'Not that.');
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
  emit('mini', { phase: 'ready', client: e.id, sore: !!e.sore });   // Jev milestone 0: hold E now
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
  const push = 0.04, wob = Math.sin(ctx.time * 3) * 0.03;
  e.mesh.updateMatrixWorld(true);
  _l.set(-0.08, wob, push).applyMatrix4(back.matrixWorld);
  _r.set(0.08, -wob, push).applyMatrix4(back.matrixWorld);
  poseReaching(p.mesh, 0.32, _l, _r);
}

