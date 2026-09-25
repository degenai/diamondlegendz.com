// The massage gun (DESIGN.md "Massage gun"): the only ranged weapon, a meta unlock. Q switches
// palm / gun; right click (pointer locked, on foot) fires percussive taps at 4/s while held.
// Level 0: contact range 1.5 m. Level 1+: range 4 / 8 / 14 m with a visible shockwave ring.
// Every tap stuns the target 1.5 s (a stagger: no movement, no attack; ruled 2026-09-24, the stun
// buys the 0.7 s a charged Healing Palm needs); three taps within 3 s knock him down like the
// quick palm (relaxed rise, Chex Quest).
// Battery 100, 2 per tap; +20 per mini-massage, +5/s standing still within 3 m of the chair.
// TODO(v2): level 2 cone, level 3 "Pro" knockback that flips peds and dents cars.
import * as THREE from '../../vendor/three.module.js';
import { loadMesh } from '../assets.js';
import { knockdown } from './npc-common.js';
import { lineOfSight } from './npc-nav.js';
import { emitChaos } from '../run/wanted.js';
import { chairWorldPos } from './chair.js';
import { sfx, knockFx, burst } from '../juice.js';
import { emit } from '../events.js';

const RANGE = [1.5, 4, 8, 14];
const LOOK = [[1, 1], [1.5, 1.2], [2, 1.4], [2.6, 1.7]];   // [barrel length L, head size H] per level
const RATE = 0.25;             // s between taps
const DRAIN = 2;
const TAPS = 3;
const TAP_FORGET = 3;          // s: taps older than this stop counting toward a knockdown
const CONE_COS = Math.cos(Math.PI / 6);
const KNOCK = 3;
const KNOCK_PUSH = 5.7;
const CHAIR_R = 3;
export const STUN = 1.5;
const _v = new THREE.Vector3();

function ensureMesh(p) {
  if (p.gun) return p.gun;
  p.gun = { mesh: null, level: -1, rings: [] };
  loadMesh('assets/massagegun.json').then((g) => {
    g.scale.setScalar(1.25);
    g.rotation.set(Math.PI / 2, 0, 0);        // barrel along the forearm, grip across the palm
    g.position.set(0, -0.3, 0.03);
    g.visible = false;
    p.mesh.userData.joints.lowerArmR.add(g);
    p.gun.mesh = g;
    p.gun.level = -1;
  }).catch((err) => console.warn('[CMF] massage gun failed', err));
  return p.gun;
}

// RUN entry: full battery, palm in hand.
export function resetGun(p) {
  p.battery = 100; p.gunEquipped = false; p.gunCd = 0; p.gunFireT = 0; p.gunTaps = 0;
  p.gunMiniSeen = 0;
  if (p.gun && p.gun.mesh) p.gun.mesh.visible = false;
}

function setLook(G, level) {
  if (!G.mesh || G.level === level) return;
  G.level = level;
  const [L, H] = LOOK[Math.max(0, level)];
  const barrel = G.mesh.getObjectByName('barrel'), head = G.mesh.getObjectByName('head');
  if (barrel) barrel.scale.z = L;
  if (head) head.scale.set(H, H, H / L);
}

function target(p, ctx, range, fx, fz) {
  let best = null, bd = Infinity;
  for (const e of ctx.npcs || []) {
    if (e.knockedT > 0 || e.state === 'kneel' || e.state === 'treated' || e.state === 'out' || Math.abs(e.pos.y - p.pos.y) > 1.2) continue;
    const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z, d2 = dx * dx + dz * dz;
    const r = range + e.radius;
    if (d2 > r * r || d2 >= bd) continue;
    const d = Math.sqrt(d2);
    if (d > 0.3 && dx * fx + dz * fz < CONE_COS * d) continue;
    if (ctx.world && !lineOfSight(ctx.world, p.pos, e.pos)) continue;
    best = e; bd = d2;
  }
  return best;
}

function shockwave(p, ctx, range) {
  const G = p.gun;
  let r = G.rings.find((x) => x.t >= x.life);
  if (!r) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 32),
      new THREE.MeshBasicMaterial({ color: 0xf2d27a, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
    ctx.scene.add(m);
    r = { m, t: 0, life: 0 };
    G.rings.push(r);
  }
  r.t = 0; r.life = 0.35; r.range = range;
  r.x = p.pos.x; r.y = p.pos.y + 1.25; r.z = p.pos.z; r.fx = Math.sin(p.yaw); r.fz = Math.cos(p.yaw);
  r.m.visible = true;
  r.m.rotation.set(0, p.yaw, 0);              // ring plane faces along the shot
}

function updateRings(p, dt) {
  for (const r of p.gun.rings) {
    if (r.t >= r.life) { r.m.visible = false; continue; }
    r.t += dt;
    const k = Math.min(1, r.t / r.life);
    const d = 0.6 + r.range * k;
    r.m.position.set(r.x + r.fx * d, r.y, r.z + r.fz * d);
    r.m.scale.setScalar(0.15 + 0.9 * k);
    r.m.material.opacity = 0.6 * (1 - k);
  }
}

function tap(p, ctx, level) {
  p.gunCd = RATE; p.gunFireT = 0.3;
  p.battery = Math.max(0, p.battery - DRAIN);
  p.yaw = Math.atan2(-Math.sin(p.camYaw), -Math.cos(p.camYaw));  // fire where the camera looks
  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), range = RANGE[level];
  if (level >= 1) shockwave(p, ctx, range);
  sfx(ctx, 'tap', p.pos.x, p.pos.z);
  const e = target(p, ctx, range, fx, fz);
  p.lastGun = { t: ctx.time, hit: e ? e.kind : null, battery: p.battery };
  if (!e) return null;
  ctx.grabUntil = 0;                          // the first gun hit brings the bats out (goon.js)
  if (ctx.time - (e.gunTapT ?? -1e9) > TAP_FORGET) e.gunTaps = 0;
  e.gunTaps = (e.gunTaps || 0) + 1; e.gunTapT = ctx.time;
  // Any action on a cop is aggression (ruled 2026-09-25): +1 per volley, on its first tap. Goons and
  // peds get nothing: the gun is nonviolent.
  if (e.kind === 'cop' && e.gunTaps === 1 && ctx.wanted) ctx.wanted.report('copHit');
  const hud = ctx.hud;
  if (e.gunTaps < TAPS) {
    e.stunT = STUN;
    if (e.state === 'windup') e.state = 'chase';
    if (e.gunTaps === 1) emit('gun', { target: e.kind, stun: true });   // once per volley: the feed stays readable
    if (hud && hud.floater) hud.floater('tk', e.pos.x, e.pos.y + 1.5, e.pos.z, 'speech dim');
    burst(ctx, 'impact', e.pos.x, e.pos.y + 1.2, e.pos.z, 3);
    return e;
  }
  // Third tap: the Healing Palm's knockdown, relaxed rise and all.
  e.gunTaps = 0; e.stunT = 0;
  const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z, d = Math.hypot(dx, dz) || 1;
  knockdown(e, KNOCK, 'palm', dx / d, dz / d, KNOCK_PUSH);
  emit('gun', { target: e.kind, battery: p.battery });
  knockFx(ctx, e, p);
  sfx(ctx, 'thud', e.pos.x, e.pos.z, 0.8);
  if (hud && hud.floater) hud.floater('THUD', e.pos.x, e.pos.y + 1.6, e.pos.z, 'thud');
  e.gunKnock = true;                          // cop.js: this volley already reported its copHit
  if (e.onPalm) e.onPalm(e, p, ctx);
  e.gunKnock = false;
  emitChaos(ctx, e.pos.x, e.pos.z, 'gun');
  if (ctx.runStats) ctx.runStats.tension++;
  return e;
}

// Per tick from updatePlayer (before the vehicle early-out).
export function updateGun(p, dt, ctx) {
  const level = ctx.perks ? ctx.perks.gun : -1;
  if (level < 0) { if (p.gun && p.gun.mesh) p.gun.mesh.visible = false; p.gunEquipped = false; return; }
  const G = ensureMesh(p);
  setLook(G, level);
  if (p.battery === undefined) resetGun(p);
  const input = ctx.input;
  if (input && input.pressed && input.pressed.has('KeyQ') && !p.vehicle) p.gunEquipped = !p.gunEquipped;
  const onFoot = !p.vehicle && !p.massaging; // hidden while driving and while working the chair
  if (G.mesh) G.mesh.visible = !!p.gunEquipped && onFoot;
  if (p.gunCd > 0) p.gunCd -= dt;
  if (p.gunFireT > 0) p.gunFireT -= dt;
  // Recharge: mini-massages (the work), and the chair is the charging dock.
  const done = ctx.mini ? ctx.mini.done : 0;
  if (done > (p.gunMiniSeen || 0)) { p.battery = Math.min(100, p.battery + 20 * (done - (p.gunMiniSeen || 0))); }
  p.gunMiniSeen = done;
  if (onFoot && Math.hypot(p.vel.x, p.vel.z) < 0.2 && p.battery < 100) {
    const c = chairWorldPos(ctx, _v);
    if (c && Math.hypot(c.x - p.pos.x, c.z - p.pos.z) < CHAIR_R) p.battery = Math.min(100, p.battery + 5 * dt);
  }
  updateRings(p, dt);
  if (!p.gunEquipped || !onFoot || !input || !input.mouseRight || !input.locked) return;
  if (p.knockedT > 0 || p.massaging || p.palmT > 0 || p.chargeT >= 0 || p.lungeT > 0 || p.gunCd > 0 || p.battery < DRAIN) return;
  tap(p, ctx, level);
}

// After the walk animation: arm up while firing, a little pump of the head.
export function poseGun(p) {
  const G = p.gun;
  if (!G || !G.mesh || !G.mesh.visible) return;
  const arm = p.mesh.userData.limbs.armR;
  if (p.gunFireT > 0) { arm.rotation.x = -Math.PI / 2; arm.rotation.z = 0.1; }
  else { arm.rotation.x = -0.5; arm.rotation.z = 0; }
  const head = G.mesh.getObjectByName('head');
  if (head) head.position.z = 0.04 + (p.gunFireT > 0 ? Math.abs(Math.sin(p.gunFireT * 60)) * 0.012 : 0);
}
