// Drivable vehicles: plain-object entities with arcade handling (GTA3 feel).
// Forward speed integrates throttle/brake/drag; steering narrows with speed; lateral velocity
// bleeds off with grip each tick (handbrake drops grip so the tail slides). The mesh leans in
// turns and under braking (cosmetic, the collider never rotates off the ground plane).
import * as THREE from '../../vendor/three.module.js';
import { VEHICLE_TYPES } from './vehicle-types.js';
import { collideStatic, collideVehicles, collidePlayer, collideNpc, settleHeight } from './vehicle-collide.js';
import { updateFx } from './vehicle-fx.js';

export { VEHICLE_TYPES } from './vehicle-types.js';
export { hitEntity, vehicleCircles, boxDistance, dentVehicle } from './vehicle-collide.js';

const COAST = 2.0;        // rolling resistance, m/s^2
const DRAG = 0.04;        // linear drag, 1/s
const PARKED_BRAKE = 7;   // driverless vehicles roll to a stop at this rate
const HB_YAW = 1.5;       // handbrake yaw-rate boost (kicks the tail out)
const SLEEP_V = 0.05;

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
function approach(v, target, step) {
  return v < target ? Math.min(target, v + step) : Math.max(target, v - step);
}

// mesh: the loaded asset Group (root holding one named node with Body + Wheel_*).
export function createVehicle(type, mesh, pos, yaw, opts = {}) {
  const spec = VEHICLE_TYPES[type];
  if (!spec) throw new Error(`[CMF] unknown vehicle type ${type}`);
  const body = mesh.children[0] || mesh;
  const wheels = {};
  for (const n of ['FL', 'FR', 'RL', 'RR']) {
    const w = mesh.getObjectByName('Wheel_' + n);
    if (w) { w.rotation.order = 'YXZ'; wheels[n] = w; } // steer about Y, then spin about the axle (X)
  }
  mesh.position.copy(pos);
  mesh.rotation.set(0, yaw, 0);
  return {
    id: null,
    kind: 'vehicle',
    type, spec,
    pos: pos.clone(),
    vel: new THREE.Vector3(),
    yaw,
    radius: spec.circleR,
    speed: 0,           // signed forward speed, m/s
    steer: 0,           // front wheel angle, rad (+ = left)
    yawRate: 0,
    hp: 100,
    driver: null,
    parked: true,       // engine off, never driven this run
    stolen: false,
    chairLoaded: false,
    handbrake: false,
    asleep: true,
    mesh, body, wheels,
    lean: { roll: 0, pitch: 0 },
    wobbleT: 0,
    smoke: null,
    lastImpact: 0,
    update: updateVehicle,
    ...opts,
  };
}

export const create = createVehicle;
export const update = updateVehicle;

export function updateVehicle(v, dt, ctx) {
  const T = v.spec;
  const input = v.driver && v.driver === ctx.player ? ctx.input : null;
  // AI drivers (goon van, cop cars) write v.ai = { throttle, steer, handbrake } (run/driver.js).
  const ai = !input && v.driver && v.ai ? v.ai : null;
  let throttle = 0, steerIn = 0;
  v.handbrake = false;
  if (input) {
    throttle = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
    steerIn = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    v.handbrake = !!input.space;
  } else if (ai) {
    throttle = Math.max(-1, Math.min(1, ai.throttle || 0));
    steerIn = Math.max(-1, Math.min(1, ai.steer || 0));
    v.handbrake = !!ai.handbrake;
  }
  const driven = !!(input || ai);
  v.throttle = throttle;          // the engine sound's load (audio-wire.js)
  const dead = v.hp <= 0;

  let s = Math.sin(v.yaw), c = Math.cos(v.yaw);
  // fwd = (s, c); right = (-c, s)
  let vf = v.vel.x * s + v.vel.z * c;
  let vl = -v.vel.x * c + v.vel.z * s;
  const vf0 = vf;

  if (!driven) {
    vf = approach(vf, 0, PARKED_BRAKE * dt);
  } else {
    if (throttle > 0) {
      if (vf < -0.3) vf = approach(vf, 0, T.brake * dt * throttle);
      else if (!dead) vf += T.accel * throttle * dt * Math.max(0, 1 - Math.pow(Math.max(0, vf) / T.maxSpeed, 3));
    } else if (throttle < 0) {
      if (vf > 0.3) vf = approach(vf, 0, T.brake * dt * -throttle);
      else if (!dead) vf = Math.max(-T.maxReverse, vf + T.accel * 0.6 * throttle * dt);
    } else {
      vf = approach(vf, 0, COAST * dt);
    }
    if (v.handbrake) vf = approach(vf, 0, T.brake * 0.45 * dt);
    vf -= vf * DRAG * dt;
    if (dead) vf = approach(vf, 0, COAST * dt); // a wreck coasts down whatever the pedal says
  }

  // Steering narrows with speed: tight at a crawl, wide at the top end.
  const speedK = 1 / (1 + Math.abs(vf) / T.steerFall);
  v.steer = approach(v.steer, steerIn * T.steerMax * speedK, T.steerRate * dt);
  v.yawRate = (vf * Math.tan(v.steer)) / T.wheelbase * (v.handbrake ? HB_YAW : 1);

  // Velocity stays in world space while the body turns; the new frame sees it as slip.
  v.vel.x = s * vf - c * vl;
  v.vel.z = c * vf + s * vl;
  v.yaw = wrapAngle(v.yaw + v.yawRate * dt);
  s = Math.sin(v.yaw); c = Math.cos(v.yaw);
  vf = v.vel.x * s + v.vel.z * c;
  vl = -v.vel.x * c + v.vel.z * s;
  vl *= Math.exp(-(v.handbrake ? T.hbGrip : T.grip) * dt);
  v.vel.x = s * vf - c * vl;
  v.vel.z = c * vf + s * vl;
  v.speed = vf;
  v.slip = vl;

  const moving = Math.abs(vf) > SLEEP_V || Math.abs(vl) > SLEEP_V || driven;
  if (moving) v.asleep = false;
  const colliders = ctx.world ? ctx.world.colliders : null;
  if (!v.asleep) {
    v.pos.x += v.vel.x * dt;
    v.pos.z += v.vel.z * dt;
    if (colliders) {
      settleHeight(v, dt, colliders);
      collideStatic(v, ctx);
    }
    if (!moving) v.asleep = true;
  }
  const list = ctx.world && ctx.world.vehicles;
  if (list) {
    const i = list.indexOf(v);
    for (let j = i + 1; j < list.length; j++) collideVehicles(v, list[j], ctx);
  }
  if (ctx.player && !ctx.player.vehicle) collidePlayer(v, ctx.player, ctx);
  if (ctx.npcs && !v.asleep) for (let i = 0; i < ctx.npcs.length; i++) collideNpc(v, ctx.npcs[i], ctx);
  if (v.driver && v.driver.pos) v.driver.pos.copy(v.pos);

  animate(v, dt, vf, vf0);
  updateFx(v, dt, ctx);
}

function animate(v, dt, vf, vf0) {
  const T = v.spec;
  const spin = (vf / T.wheelR) * dt;
  for (const k in v.wheels) {
    const w = v.wheels[k];
    w.rotation.x = (w.rotation.x + spin) % (Math.PI * 2);
    if (k[0] === 'F') w.rotation.y = v.steer;
  }
  // Lean out of turns (lateral accel = v * yawRate) and dip the nose under braking.
  const latA = vf * v.yawRate;
  const lonA = (vf - vf0) / Math.max(dt, 1e-4);
  const roll = THREE.MathUtils.clamp(latA * 0.01 * T.lean, -0.09 * T.lean, 0.09 * T.lean);
  const pitch = THREE.MathUtils.clamp(-lonA * 0.005 * Math.sign(vf || 1), -0.05, 0.05);
  const k = 1 - Math.exp(-6 * dt);
  v.lean.roll += (roll - v.lean.roll) * k;
  v.lean.pitch += (pitch - v.lean.pitch) * k;
  let wob = 0;
  if (v.wobbleT > 0) { v.wobbleT = Math.max(0, v.wobbleT - dt); wob = Math.sin(v.wobbleT * 45) * 0.06 * v.wobbleT; }
  v.body.rotation.z = v.lean.roll + wob;
  v.body.rotation.x = v.lean.pitch + wob * 0.5;
  v.mesh.position.copy(v.pos);
  v.mesh.rotation.y = v.yaw;
}
