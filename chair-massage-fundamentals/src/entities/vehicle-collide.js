// Vehicle collisions. The body is three circles along its length (front, middle, rear).
// Static: pushout per circle against AABB/cylinder colliders, the push becomes an impact that
// removes the velocity into the wall and costs hp above 4 m/s. Vehicle vs vehicle: circle pairs,
// mass-weighted separation and an impulse. Vehicle vs a body on foot: hitEntity (knockdown).
import { supportHeight, pushCircle, circleVsCircle } from '../physics.js';
import { throwChair } from './chair.js';
import { crashFx, shake, sfx } from '../juice.js';
import { emit } from '../events.js';

const GRAVITY = 18;
const DMG_FROM = 4;        // m/s impact before hp drops
const DMG_K = 3.5;         // hp per m/s above DMG_FROM
const THROW_AT = 12;       // m/s impact that throws a loaded chair out
const RESTITUTION = 0.15;
const HIT_SPEED = 2;       // moving faster than this knocks a body down
const SHAKE_OFF = 8;       // m/s wall impact that throws a clinging goon off

const _c = { x: 0, z: 0 };
const _push = { x: 0, z: 0 };
const _circ = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }];
const _circA = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }];

// World-space circle centres (reused scratch unless `out` is given).
export function vehicleCircles(v, out = _circ) {
  const s = Math.sin(v.yaw), c = Math.cos(v.yaw), d = v.spec.circleOff;
  for (let i = 0; i < 3; i++) {
    const off = (1 - i) * d;
    out[i].x = v.pos.x + s * off; out[i].y = v.pos.y; out[i].z = v.pos.z + c * off;
  }
  return out;
}

// Distance from a point to the vehicle's oriented footprint box (0 inside).
export function boxDistance(v, x, z) {
  const dx = x - v.pos.x, dz = z - v.pos.z;
  const s = Math.sin(v.yaw), c = Math.cos(v.yaw);
  const lf = dx * s + dz * c, ll = dx * c - dz * s;
  return Math.hypot(Math.max(0, Math.abs(lf) - v.spec.halfL), Math.max(0, Math.abs(ll) - v.spec.halfW));
}

// Wheels climb kerbs and steps (physics STEP_UP), fall off ledges under gravity.
export function settleHeight(v, dt, colliders) {
  const circ = vehicleCircles(v);
  let sup = 0;
  for (const p of circ) sup = Math.max(sup, supportHeight(p, v.spec.circleR, v.pos.y, true, colliders));
  if (sup >= v.pos.y) { v.pos.y = sup; v.vy = 0; }
  else {
    v.vy = (v.vy || 0) - GRAVITY * dt;
    v.pos.y = Math.max(sup, v.pos.y + v.vy * dt);
    if (v.pos.y === sup) v.vy = 0;
  }
}

function damage(v, impact, ctx, x = v.pos.x, z = v.pos.z) {
  if (impact > 1) v.lastImpact = impact;   // resting contact does not overwrite the last real hit
  if (ctx) crashFx(ctx, v, impact, x, z);  // sparks, shake and a thud scaled by the impact
  if (impact > DMG_FROM) {
    v.hp = Math.max(0, v.hp - (impact - DMG_FROM) * DMG_K * v.spec.hpScale);
    v.wobbleT = Math.max(v.wobbleT, Math.min(0.6, impact * 0.04));
  }
  if (impact > THROW_AT && v.chairLoaded && ctx) throwChair(ctx, v);
}

// Slide along walls; the velocity into the wall is the impact speed.
export function collideStatic(v, ctx) {
  const colliders = ctx.world.colliders;
  const s = Math.sin(v.yaw), cs = Math.cos(v.yaw), d = v.spec.circleOff, r = v.spec.circleR;
  let px = 0, pz = 0;
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (let i = 0; i < 3; i++) {
      const off = (1 - i) * d;
      _c.x = v.pos.x + s * off; _c.z = v.pos.z + cs * off;
      pushCircle(_c, r, v.pos.y, colliders, _push);
      if (_push.x === 0 && _push.z === 0) continue;
      v.pos.x += _push.x; v.pos.z += _push.z;
      px += _push.x; pz += _push.z;
      moved = true;
    }
    if (!moved) break;
  }
  const len = Math.hypot(px, pz);
  if (len < 1e-6) return false;
  const nx = px / len, nz = pz / len;
  const vn = v.vel.x * nx + v.vel.z * nz;
  if (vn < 0) {
    v.vel.x -= (1 + RESTITUTION) * vn * nx;
    v.vel.z -= (1 + RESTITUTION) * vn * nz;
    damage(v, -vn, ctx, v.pos.x - nx * r, v.pos.z - nz * r);
    if (-vn > SHAKE_OFF && ctx) v.hardHitT = ctx.time;   // throws a clinging goon off (goon-vehicle.js)
  }
  return true;
}

const rammer = (v) => !!(v.franchise && v.driver && v.driver.kind === 'aiDriver');

export function collideVehicles(a, b, ctx) {
  const reach = a.spec.halfL + b.spec.halfL;
  if (Math.abs(a.pos.x - b.pos.x) > reach || Math.abs(a.pos.z - b.pos.z) > reach) return false;
  if (Math.abs(a.pos.y - b.pos.y) > 1.2) return false;
  const ca = vehicleCircles(a, _circA);
  const cb = vehicleCircles(b);
  let px = 0, pz = 0;
  for (const p of ca) for (const q of cb) {
    const push = circleVsCircle(p, a.spec.circleR, q, b.spec.circleR);
    if (push) { px += push.x; pz += push.z; }
  }
  const len = Math.hypot(px, pz);
  if (len < 1e-6) return false;
  const nx = px / len, nz = pz / len;               // points from b toward a
  // The parked Serenity van rammed (van-ai.js vanHit): the hitter's own speed, before the impulse,
  // and only when it is closing on the van.
  const A = ctx && ctx.vanAI;
  if (A && A.parked && ctx.vanHit) {
    if (a === A.v && b.vel.x * nx + b.vel.z * nz > 0) ctx.vanHit(a, b, Math.hypot(b.vel.x, b.vel.z));
    else if (b === A.v && a.vel.x * nx + a.vel.z * nz < 0) ctx.vanHit(b, a, Math.hypot(a.vel.x, a.vel.z));
  }
  const depth = Math.min(len, a.spec.circleR);
  const ma = a.spec.mass, mb = b.spec.mass, inv = 1 / ma + 1 / mb;
  a.pos.x += nx * depth * (1 / ma) / inv; a.pos.z += nz * depth * (1 / ma) / inv;
  b.pos.x -= nx * depth * (1 / mb) / inv; b.pos.z -= nz * depth * (1 / mb) / inv;
  const vn = (a.vel.x - b.vel.x) * nx + (a.vel.z - b.vel.z) * nz;
  if (vn < 0) {
    const j = -(1 + RESTITUTION) * vn / inv;
    a.vel.x += (j / ma) * nx; a.vel.z += (j / ma) * nz;
    b.vel.x -= (j / mb) * nx; b.vel.z -= (j / mb) * nz;
    const mx = (a.pos.x + b.pos.x) / 2, mz = (a.pos.z + b.pos.z) / 2;
    // The Serenity van's ram is its own shove (van-ai.js: 10 hp, never a wreck): whatever it
    // touches while an AI drives it takes no crash damage from the contact itself.
    if (!rammer(b)) damage(a, -vn, ctx, mx, mz);
    if (!rammer(a)) damage(b, -vn, ctx, mx, mz);
    a.asleep = b.asleep = false; // only a real impulse wakes them; resting contact stays asleep
  }
  return true;
}

// A moving vehicle knocks a body down and shoves it; Phase 5 calls this for peds too
// (opts: knockT, dmgPerMs, damage:false to spare hp). Returns { speed, dirX, dirZ }.
export function hitEntity(v, e, opts = {}) {
  const speed = Math.hypot(v.vel.x, v.vel.z);
  let rx = e.pos.x - v.pos.x, rz = e.pos.z - v.pos.z;
  const rl = Math.hypot(rx, rz) || 1;
  rx /= rl; rz /= rl;
  let dx = (v.vel.x / (speed || 1)) * 0.6 + rx * 0.4, dz = (v.vel.z / (speed || 1)) * 0.6 + rz * 0.4;
  const dl = Math.hypot(dx, dz) || 1;
  dx /= dl; dz /= dl;
  if (e.vel) {
    e.vel.x = dx * speed * 0.8;
    e.vel.z = dz * speed * 0.8;
    e.vel.y = Math.min(4, speed * 0.25);
  }
  e.grounded = false;
  e.knockedT = opts.knockT ?? 1.5;
  e.hitBy = v;
  e.hitSpeed = speed;
  if (e.hp !== undefined && opts.damage !== false) e.hp = Math.max(0, e.hp - speed * (opts.dmgPerMs ?? 1.5));
  v.vel.multiplyScalar(0.92);
  return { speed, dirX: dx, dirZ: dz };
}

// Player on foot: pushed out of the body; knocked down when the vehicle is moving.
export function collidePlayer(v, p, ctx) {
  if (p.pos.y > v.pos.y + v.spec.height - 0.1) return false;
  const circ = vehicleCircles(v);
  let px = 0, pz = 0;
  for (const q of circ) {
    const push = circleVsCircle(p.pos, p.radius, q, v.spec.circleR);
    if (push) { px += push.x; pz += push.z; }
  }
  const len = Math.hypot(px, pz);
  if (len < 1e-6) return false;
  const nx = px / len, nz = pz / len;
  p.pos.x += nx * Math.min(len, 1); p.pos.z += nz * Math.min(len, 1);
  const speed = Math.hypot(v.vel.x, v.vel.z);
  const grace = p.exitGrace && p.exitGrace.v === v && p.exitGrace.t > 0;
  if (speed > HIT_SPEED && !(p.knockedT > 0) && !grace) {
    hitEntity(v, p);
    emit('knockdown', { who: 'player', cause: 'vehicle', by: v.spec.label });
    shake(ctx, Math.min(0.8, speed / 15)); sfx(ctx, 'thud', p.pos.x, p.pos.z, Math.min(1, speed / 12));
  } else {
    const vn = p.vel.x * nx + p.vel.z * nz;
    if (vn < 0) { p.vel.x -= vn * nx; p.vel.z -= vn * nz; }
  }
  return true;
}

// NPC on foot (ped, goon, cop): pushed out; knocked down (3 s, no hp) when the vehicle is moving
// faster than HIT_SPEED. e.onVehicleHit(e, v, ctx) does the wanted/flee/sore bookkeeping.
export function collideNpc(v, e, ctx) {
  const reach = v.spec.halfL + 1;
  const dx0 = e.pos.x - v.pos.x, dz0 = e.pos.z - v.pos.z;
  if (dx0 * dx0 + dz0 * dz0 > reach * reach || e.pos.y > v.pos.y + v.spec.height - 0.1 || e.fixed) return false;
  const circ = vehicleCircles(v);
  let px = 0, pz = 0;
  for (const q of circ) {
    const r = e.radius + v.spec.circleR, dx = e.pos.x - q.x, dz = e.pos.z - q.z, d2 = dx * dx + dz * dz;
    if (d2 >= r * r || d2 < 1e-8) continue;
    const d = Math.sqrt(d2);
    px += (dx / d) * (r - d); pz += (dz / d) * (r - d);
  }
  if (px === 0 && pz === 0) return false;
  e.pos.x += px; e.pos.z += pz;
  const speed = Math.hypot(v.vel.x, v.vel.z);
  if (speed > HIT_SPEED && !(e.knockedT > 0)) {
    hitEntity(v, e, { knockT: 3, damage: false });
    emit('knockdown', { who: e.kind, cause: 'vehicle', by: v.spec.label, mine: !!ctx.player && v.driver === ctx.player });
    shake(ctx, Math.min(0.5, speed / 25), e.pos.x, e.pos.z); sfx(ctx, 'thud', e.pos.x, e.pos.z, Math.min(0.8, speed / 15));
    if (e.onVehicleHit) e.onVehicleHit(e, v, ctx);
  }
  return true;
}

// Healing Palm on bodywork: small dent and a wobble. Cosmetic.
export function dentVehicle(v, amount = 3) {
  v.hp = Math.max(0, v.hp - amount);
  v.wobbleT = 0.5;
}
