// Arcade juice (Phase 7): hit-stop, impact-scaled screen shake, particle puffs (dust, sparks, a
// green relief burst), the FOV kick on sprint and handbrake, and the sfx helper every gameplay
// module calls. Hooks are cheap no-ops until initJuice ran (headless module tests, MASSAGE).
import { createParticles, burst as spawnBurst, updateParticles, clearParticles } from './particles.js';
import { segmentHit } from './physics.js';
import * as THREE from '../vendor/three.module.js';
const _from = new THREE.Vector3(), _to = new THREE.Vector3();

const STOP = 0.08;             // hit-stop, seconds of frozen simulation
const SHAKE_MAX = 0.5;         // metres of camera offset at full trauma (offset = trauma^2 * max)
const SHAKE_DECAY = 1.8;       // trauma per second
const FOV_SPRINT = 6, FOV_HANDBRAKE = 4;
const FOV_IN = 14, FOV_OUT = 9; // 1/s: fast kick, fast return

let J = null;

export function initJuice(ctx) {
  J = { stopT: 0, trauma: 0, off: { x: 0, y: 0, z: 0 }, fov: 0, baseFov: ctx.camera.fov, parts: createParticles(ctx.scene), t: 0, drift: 0 };
  ctx.juice = J;
  return J;
}

// ---- hooks for gameplay modules ----
export function sfx(ctx, name, x, z, volume) {
  const a = ctx && ctx.audio;
  if (!a || (ctx.audioCtx && ctx.audioCtx.state !== 'running')) return; // nothing piles up while suspended
  if (x === undefined) a.sfx(name, volume === undefined ? undefined : { volume });
  else a.sfx(name, { x, z, volume: volume === undefined ? 1 : volume });
}

export function hitStop(ctx, s = STOP) { if (J && ctx) J.stopT = Math.max(J.stopT, s); }

// Trauma model: amount 0..1, attenuated by distance from the player (or their car) when a
// position is given, so your own crash shakes fully and one across the plaza barely does.
export function shake(ctx, amount, x, z) {
  if (!J || !ctx || !ctx.camera) return;
  let k = amount;
  const p = ctx.player, at = p ? (p.vehicle ? p.vehicle.pos : p.pos) : ctx.camera.position;
  if (x !== undefined) k /= 1 + Math.max(0, Math.hypot(x - at.x, z - at.z) - 3) / 10;
  J.trauma = Math.min(1, J.trauma + k);
}

export function burst(ctx, kind, x, y, z, n, dirX, dirZ) { if (J) spawnBurst(J.parts, kind, x, y, z, n, dirX, dirZ); }

// A knockdown from the palm or the gun: freeze, spark, thump. The burst sits between the two
// bodies (a third of the way from the target toward `from`), at chest height.
export function knockFx(ctx, e, from) {
  hitStop(ctx);
  const k = from ? 0.35 : 0;
  burst(ctx, 'impact', e.pos.x + (from ? (from.pos.x - e.pos.x) * k : 0), e.pos.y + 1.25, e.pos.z + (from ? (from.pos.z - e.pos.z) * k : 0));
  shake(ctx, 0.25);
}

// Vehicle impact at (x, z), speed in m/s into the obstacle.
export function crashFx(ctx, v, impact, x, z) {
  if (!J || !ctx || impact < 4 || ctx.time - (v._fxT ?? -9) < 0.2) return;
  v._fxT = ctx.time;
  const k = Math.min(1, (impact - 4) / 14);
  burst(ctx, 'sparks', x, v.pos.y + 0.55, z, 6 + Math.round(14 * k));
  shake(ctx, 0.25 + 0.75 * k, x, z);
  sfx(ctx, 'thud', x, z, 0.35 + 0.5 * k);
}

// ---- per tick / per frame ----
export function frozen() { return !!J && J.stopT > 0; }
export function clearHitStop() { if (J) { J.stopT = 0; J.trauma = 0; } }
export function tickFrozen(dt) { if (J) J.stopT = Math.max(0, J.stopT - dt); }

// Before the simulation moves the camera: take the last shake offset back out.
export function preTick(ctx) {
  if (!J) return;
  const o = J.off, c = ctx.camera.position;
  c.x -= o.x; c.y -= o.y; c.z -= o.z;
  o.x = o.y = o.z = 0;
}

// Per sim tick in RUN and the end states: particles, landings, drifts, relief bursts.
export function juiceTick(dt, ctx) {
  if (!J) return;
  J.t += dt;
  const p = ctx.player;
  if (p && !p.vehicle) {
    if (p.grounded && p._wasAir && p._vy < -4.5) burst(ctx, 'dust', p.pos.x, p.pos.y + 0.05, p.pos.z, 7);
    p._wasAir = !p.grounded; p._vy = p.vel.y;
  }
  const npcs = ctx.npcs || [];
  for (let i = 0; i < npcs.length; i++) {
    const e = npcs[i];
    if (e.loose > 0 && !e._relief) { e._relief = true; if (e.mesh.visible) burst(ctx, 'relief', e.pos.x, e.pos.y + 1.4, e.pos.z); }
    else if (!(e.loose > 0)) e._relief = false;
    if (e.knockedT > 0 && e.grounded && e._wasAir) burst(ctx, 'dust', e.pos.x, e.pos.y + 0.05, e.pos.z, 5);
    e._wasAir = !e.grounded;
  }
  const vs = ctx.world.vehicles || [];
  J.drift = (J.drift + 1) % 3;
  if (J.drift === 0) {
    for (let i = 0; i < vs.length; i++) {
      const v = vs[i];
      if (!v.driver || Math.abs(v.slip || 0) < 2.5 || Math.abs(v.speed) < 4) continue;
      const s = Math.sin(v.yaw), c = Math.cos(v.yaw), b = v.spec.circleOff + v.spec.circleR * 0.5;
      burst(ctx, 'dust', v.pos.x - s * b, v.pos.y + 0.1, v.pos.z - c * b, 3, -s * 0.3, -c * 0.3);
    }
  }
  updateParticles(J.parts, dt);
  J.trauma = Math.max(0, J.trauma - SHAKE_DECAY * dt);
}

// Per rendered frame, after the simulation: shake offset and FOV kick (RUN only).
export function juiceCamera(ctx, dt, running) {
  if (!J) return;
  preTick(ctx);                        // frames without a sim tick (hit-stop) must not stack offsets
  const cam = ctx.camera, p = ctx.player, input = ctx.input;
  let want = 0;
  if (running && p && input) {
    if (!p.vehicle && input.shift && Math.hypot(p.vel.x, p.vel.z) > 5) want = FOV_SPRINT;
    else if (p.vehicle && p.vehicle.handbrake && Math.abs(p.vehicle.speed) > 3) want = FOV_HANDBRAKE;
  }
  J.fov += (want - J.fov) * (1 - Math.exp(-(want > J.fov ? FOV_IN : FOV_OUT) * dt));
  if (Math.abs(J.fov) < 0.01 && want === 0) J.fov = 0;
  const fov = J.baseFov + J.fov;
  if (Math.abs(cam.fov - fov) > 0.005) { cam.fov = fov; cam.updateProjectionMatrix(); }
  if (running && J.trauma > 0) {
    const a = J.trauma * J.trauma * SHAKE_MAX, t = performance.now() / 1000;
    const o = J.off;
    o.x = a * Math.sin(t * 47.3); o.y = a * 0.6 * Math.sin(t * 53.1 + 1.3); o.z = a * Math.sin(t * 41.7 + 2.1);
    // Never let the shake carry the camera through a wall the clamp just kept it out of.
    const colliders = ctx.world && ctx.world.colliders;
    let k = 1;
    if (colliders) {
      _from.copy(cam.position); _to.set(cam.position.x + o.x, cam.position.y + o.y, cam.position.z + o.z);
      const len = _from.distanceTo(_to);
      if (len > 1e-4) { const hit = segmentHit(_from, _to, colliders); if (hit < len) k = Math.max(0, (hit - 0.05) / len); }
    }
    cam.position.x += o.x * k; cam.position.y += o.y * k; cam.position.z += o.z * k;
  }
}

export function resetJuice(ctx) {
  if (!J) return;
  preTick(ctx);
  J.stopT = 0; J.trauma = 0; J.fov = 0;
  ctx.camera.fov = J.baseFov; ctx.camera.updateProjectionMatrix();
  clearParticles(J.parts);
}
