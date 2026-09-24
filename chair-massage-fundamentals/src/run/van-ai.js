// The Serenity van's driver: pursue, cut, ram, park across the plaza exit, the shoves that drive it
// off to vanEntry, and back. spawner.update() calls updateVan; vehicle-collide.js calls ctx.vanHit
// (wired to vanHit by spawner.initSpawner). The wave drops are goon-waves.js.
import * as THREE from '../../vendor/three.module.js';
import { emitChaos } from './wanted.js';
import { routeDist } from './police.js';
import { driveRoute, driveAt, brake } from './driver.js';
import { nearestNode, nodeAhead, route, edgeSpot } from '../world/roads.js';
import { toXZ, SIZE, RING_C } from '../world/layout.js';
import { emit } from '../events.js';
import { shake, sfx, burst } from '../juice.js';
import { collideStatic } from '../entities/vehicle-collide.js';
import { lineOfSight } from '../entities/npc-nav.js';
import { waveStep, VAN_CRUISE } from './goon-waves.js';

const CUT_LOG = 15;          // s between `van cut` events at most

// The van driver (ruled 2026-09-24 after run 5, "the van pursues"): from the moment the player
// drives off in any vehicle it pursues his vehicle on the street graph at van speed, heads for a
// node on his route to the escape it can reach first (the cut: it waits there), and rams when
// alongside (a shove: 10 hp and a wobble, never a wreck). Once he has been on foot for 10 s it
// drives back and parks across the plaza's single exit street, one lane blocked. Every 90 s it
// still returns to vanEntry to drop fresh goons (goon-waves.js waveStep).
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

export function updateVan(ctx, dt) {
  const A = ctx.vanAI;
  if (!A) return;
  if (!A.v) {
    const v = ctx.world.vehicles && ctx.world.vehicles.find((x) => x.franchise);
    if (!v || v.driver) return;
    A.v = v; v.driver = { kind: 'aiDriver', pos: new THREE.Vector3() }; v.parked = false;
  }
  const v = A.v, p = ctx.player;
  if (v.driver === p || !v.driver) return;
  shoveStep(A, v, dt, ctx);
  A.ramCd = Math.max(0, (A.ramCd || 0) - dt);
  if (waveStep(ctx, A, v, dt)) return;       // the 90 s wave call owns the van (goon-waves.js)
  if (A.mode === 'entry') { toEntry(ctx, A, v, dt); return; }
  // Parked, the driver dozes (ruled 2026-09-24, "ram the van"): the van keeps its post while he
  // drives until three shoves wake the driver, or the next wave call.
  if (A.parked && A.mode === 'park' && p.vehicle && p.vehicle !== v) { A.footT = 0; brake(v); return; }
  if (p.vehicle && p.vehicle !== v && v.hp > 0) {
    A.footT = 0; A.parked = false;
    if (A.mode !== 'pursue' && A.mode !== 'cut') { A.mode = 'pursue'; A.planT = 0; }
    // One `pursue` per pursuit: a wave drop mid-chase does not start a new one; getting out does.
    if (!A.pursuing) { A.pursuing = true; emit('van', { act: 'pursue', vehicle: p.vehicle.type }); }
    pursue(ctx, A, v, p.vehicle, dt);
    return;
  }
  A.footT = (A.footT || 0) + dt;
  A.pursuing = false;
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
    // Log a cut only when the node changes and at most every CUT_LOG s: re-planning every
    // PLAN_EVERY s flips between neighbouring nodes (fifteen `cut` a minute in run 7).
    if (A.goal.cut && A.cutAt !== A.goal.node && ctx.time - (A.cutLogT ?? -1e9) >= CUT_LOG) {
      A.cutAt = A.goal.node; A.cutLogT = ctx.time; emit('van', { act: 'cut', node: A.goal.node });
    }
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

// Ramming the parked van (ruled 2026-09-24): the player's vehicle hitting it above SHOVE_MIN
// shoves it SHOVE_DIST along the hit (a slide over SHOVE_T, walls still stop it), with a wobble,
// a thud, sparks and SHOVE_HP off his vehicle. The third shove wakes the driver: he drives off to
// vanEntry and parks there. Any vehicle can do it. vehicle-collide.js calls ctx.vanHit on contact.
const SHOVE_MIN = 3, SHOVE_DIST = 2, SHOVE_T = 0.35, SHOVE_HP = 5, SHOVE_CD = 0.6, SHOVES = 3;
export function vanHit(ctx, van, hitter, speed) {
  const A = ctx.vanAI, p = ctx.player;
  if (!A || A.v !== van || !A.parked || (A.mode !== 'park' && A.mode !== 'entry')) return false;
  if (!(hitter.driver === p || (!hitter.driver && hitter === p.lastVehicle)) || speed <= SHOVE_MIN) return false;
  if (ctx.time - (A.shoveAt ?? -1e9) < SHOVE_CD) return false;
  A.shoveAt = ctx.time;
  const dx = hitter.vel.x / speed, dz = hitter.vel.z / speed;
  A.shove = { dx, dz, left: SHOVE_DIST };
  A.shoves = (A.shoves || 0) + 1;
  van.wobbleT = Math.max(van.wobbleT || 0, 0.6);
  hitter.hp = Math.max(0, hitter.hp - SHOVE_HP);
  hitter._hpSeen = hitter.hp;                 // his shove is not property damage for the wanted level
  hitter.wobbleT = Math.max(hitter.wobbleT || 0, 0.3);
  const mx = (van.pos.x + hitter.pos.x) / 2, mz = (van.pos.z + hitter.pos.z) / 2;
  burst(ctx, 'sparks', mx, van.pos.y + 0.6, mz, 16, dx, dz);
  sfx(ctx, 'thud', mx, mz, 1);
  shake(ctx, 0.4, mx, mz);
  emit('van', { act: 'shoved', n: A.shoves, speed: Math.round(speed * 10) / 10, vehicle: hitter.type, hp: Math.round(hitter.hp) });
  if (A.shoves >= SHOVES) {
    A.mode = 'entry'; A.parked = false; A.shoves = 0; A.entryT = 0;
    emit('van', { act: 'driven_off', to: 'vanEntry' });
  }
  return true;
}

// The shove's slide: the van is braked, so it moves only by the shove, not the impulse.
function shoveStep(A, v, dt, ctx) {
  const S = A.shove;
  if (!S) return;
  const step = Math.min(S.left, (SHOVE_DIST / SHOVE_T) * dt);
  v.pos.x += S.dx * step; v.pos.z += S.dz * step;
  S.left -= step;
  v.vel.set(0, 0, 0); v.speed = 0;
  v.asleep = false;
  collideStatic(v, ctx);
  if (S.left <= 1e-6) A.shove = null;
}

// Woken: to vanEntry by the street graph, then parked there (dozing again) until he is on foot
// long enough to send it back to the exit, or the wave call.
function toEntry(ctx, A, v, dt) {
  if (A.parked) {
    brake(v);
    A.footT = ctx.player.vehicle ? 0 : (A.footT || 0) + dt;
    if (A.footT >= FOOT_PARK) { A.mode = 'wait'; A.parked = false; }   // back to the exit next tick
    return;
  }
  if (A.shove) { brake(v); return; }          // the third shove finishes its slide first
  A.entryT = (A.entryT || 0) + dt;
  const e = ctx.world.spawns.vanEntry.pos;
  const d = Math.hypot(e.x - v.pos.x, e.z - v.pos.z);
  if (d > 16) driveRoute(v, ctx.world.roads, nearestNode(ctx.world.roads, e.x, e.z), VAN_CRUISE, dt);
  else if (d > 3.5) driveAt(v, e.x, e.z, 7, dt);
  else brake(v);
  if ((d <= 3.5 && Math.abs(v.speed) < 0.5) || A.entryT > 40) {
    A.parked = true; A.footT = 0;
    emit('van', { act: 'park', at: 'vanEntry', x: Math.round(v.pos.x * 10) / 10, z: Math.round(v.pos.z * 10) / 10, after: Math.round(A.entryT * 10) / 10 });
  }
}
