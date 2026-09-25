// The Serenity Group's goons: the opening pack of three and the van's 90 s waves (GOON_CAP alive).
// The first three come out of the van during the PIVOT (pivot.js calls spawnGoons); spawner.begin()
// only spawns them itself on the debug path that skips the pivot (openingPack). Every WAVE s the
// van driver (van-ai.js) breaks off whatever he is doing, returns to vanEntry and drops three more.
import * as THREE from '../../vendor/three.module.js';
import { floorHeightAt } from '../physics.js';
import { addEntity } from '../entities/index.js';
import { createGoon } from '../entities/goon.js';
import { driveRoute, driveAt, brake } from './driver.js';
import { nearestNode } from '../world/roads.js';
import { setOnboard } from '../hud-run.js';
import { emit, onEvent } from '../events.js';
import { chairState } from '../entities/chair.js';

export const WAVE = 90;
export const GOON_CAP = 9;
export const VAN_CRUISE = 14;

export function countKind(ctx, kind) {
  let n = 0;
  for (const e of ctx.npcs) if (e.kind === kind) n++;
  return n;
}

// Out of the van's side door (the side facing the plaza), or at vanEntry without a van.
// wave: the van's drop (waveStep); the opening three (pivot.js) are not a wave.
export function spawnGoons(ctx, n, wave = false) {
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
    g.wave = wave;
    addEntity(ctx.entities, g);
    ctx.npcs.push(g);
  }
  return n;
}

// The debug path that skips the pivot: begin() spawns the opening three itself.
export function openingPack(ctx) {
  if (countKind(ctx, 'goon') === 0) spawnGoons(ctx, 3);
}

// The van's wave clock (A = ctx.vanAI, v its van). Returns true while a drop owns the van this
// tick: to vanEntry by the street graph, then three goons out of the side door.
export function waveStep(ctx, A, v, dt) {
  A.waveT += dt;
  if (A.waveT >= WAVE && A.mode !== 'drop') { A.mode = 'drop'; A.dropT = 0; A.parked = false; A.shoves = 0; }
  if (A.mode !== 'drop') return false;
  A.dropT += dt;
  const e = ctx.world.spawns.vanEntry.pos;
  const d = Math.hypot(e.x - v.pos.x, e.z - v.pos.z);
  if (d > 16) driveRoute(v, ctx.world.roads, nearestNode(ctx.world.roads, e.x, e.z), VAN_CRUISE, dt);
  else if (d > 3.5) driveAt(v, e.x, e.z, 7, dt);
  else brake(v);
  if ((d <= 3.5 && Math.abs(v.speed) < 0.5) || A.dropT > 30) {
    spawnGoons(ctx, 3, true);
    A.mode = 'wait'; A.waveT = 0; A.spawnedAt = ctx.time; A.parked = false;
  }
  return true;
}

// First-run prompts in the grab window (ruled 2026-09-24: Andy got swarmed before he knew he could
// fight or drive). Only on the run that set meta.firstRunSeen (wiring.js arms it). When the grab
// window opens (first goon contact; or a palm or gun hit that skipped it), three prompts show above
// the player one at a time, each for ONBOARD_SHOW s or until performed; past the window's end the
// rest still show in order. An action already performed this run before its turn is skipped.
// Watcher: `tutorial` events, where 'run', act shown | done | timeout | skipped | cut.
export const ONBOARD = [
  { step: 'palm', text: 'Hold left click: HEALING PALM', chair: 'Left click: swing the chair' },   // a charge, a quick palm or a swing
  { step: 'drive', text: 'E at any car: drive' },            // he is in a vehicle
  { step: 'sprint', text: 'Shift: sprint. It runs out.' },   // stamina draws down on foot
];
export const ONBOARD_SHOW = 4;
// Carrying the chair, left click swings it instead (ruled 2026-09-25): the palm step reads the swing
// while the chair is on his back, checked each tick it is up; the step and its events are the same.
function stepText(ctx, k) {
  const s = ONBOARD[k];
  return s.chair && chairState(ctx.world).where === 'player' ? s.chair : s.text;
}
const ONBOARD_Y = 2.35;      // m above his feet

let heard = null;            // the armed run's state, for the event tap below
export function armOnboard(ctx, on) {
  if (heard === null) onEvent((type, d) => {
    const O = heard && heard.onboard;
    if (O && ((type === 'palm' && d.phase === 'charge') || type === 'swing')) O.did.palm = true;
  });
  heard = ctx;
  ctx.onboard = on ? { k: -1, t: -1, did: { palm: false, drive: false, sprint: false }, stam: null, log: [] } : null;
  ctx.onboardLog = ctx.onboard ? ctx.onboard.log : null;
  setOnboard(null);
}

function onboardAct(ctx, O, k, act) {
  const p = ONBOARD[k], text = stepText(ctx, k);
  O.log.push({ step: p.step, act, at: ctx.time, text });
  emit('tutorial', { where: 'run', step: p.step, act, text });
}

// Per RUN tick (spawner.update), after the entities moved.
export function onboardStep(ctx, dt) {
  const O = ctx.onboard;
  if (!O) return;
  const p = ctx.player;
  if (ctx.runEnd) {                              // the run is over: close the open prompt as cut
    if (O.t >= 0) onboardAct(ctx, O, O.k, 'cut');
    setOnboard(null); ctx.onboard = null; return;
  }
  if (p.chargeT >= 0 || p.palmT > 0 || p.lungeT > 0 || p.swingT >= 0) O.did.palm = true;   // a charge, a quick click's palm, or a swing
  if (p.vehicle) O.did.drive = true;
  if (!p.vehicle && O.stam !== null && p.stamina < O.stam - 1e-4) O.did.sprint = true;
  O.stam = p.stamina ?? null;
  if (O.k < 0) {
    if (ctx.grabStart == null && ctx.grabUntil === Infinity) return;   // no contact yet
    O.k = 0;
  }
  if (O.t >= 0) {                                // a prompt is up
    O.t += dt;
    const did = O.did[ONBOARD[O.k].step];
    if (!did && O.t < ONBOARD_SHOW) { setOnboard(stepText(ctx, O.k), p.pos.x, p.pos.y + ONBOARD_Y, p.pos.z); return; }
    onboardAct(ctx, O, O.k, did ? 'done' : 'timeout');
    O.k++; O.t = -1;
  }
  while (O.k < ONBOARD.length && O.did[ONBOARD[O.k].step]) {   // already performed: no need to say it
    onboardAct(ctx, O, O.k, 'skipped'); O.k++;
  }
  if (O.k >= ONBOARD.length) { setOnboard(null); ctx.onboard = null; return; }
  O.t = 0;
  onboardAct(ctx, O, O.k, 'shown');
  setOnboard(stepText(ctx, O.k), p.pos.x, p.pos.y + ONBOARD_Y, p.pos.z);
}
