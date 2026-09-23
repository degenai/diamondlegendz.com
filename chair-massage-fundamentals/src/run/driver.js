// AI drivers for the ring road: pure pursuit on a lookahead point along the square loop
// (centreline 52 m out, perimeter 416 m), a direct chase when close, and a back-up-and-turn
// when stuck. Writes v.ai = { throttle, steer, handbrake }; vehicle.js reads it.
const H = 52;                 // ring centreline half size
const PER = 8 * H;            // perimeter
const LOOK = 11;

function wrap(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
function modP(s) { return ((s % PER) + PER) % PER; }

// Perimeter parameter of the nearest ring point: N side (z=-H) west->east, E, S east->west, W.
export function ringS(x, z) {
  const cx = Math.max(-H, Math.min(H, x)), cz = Math.max(-H, Math.min(H, z));
  const dN = Math.abs(z + H), dS = Math.abs(z - H), dE = Math.abs(x - H), dW = Math.abs(x + H);
  const m = Math.min(dN, dS, dE, dW);
  if (m === dN) return cx + H;
  if (m === dE) return 2 * H + (cz + H);
  if (m === dS) return 4 * H + (H - cx);
  return 6 * H + (H - cz);
}
export function ringPoint(s, out) {
  s = modP(s);
  if (s < 2 * H) { out.x = s - H; out.z = -H; }
  else if (s < 4 * H) { out.x = H; out.z = s - 3 * H; }
  else if (s < 6 * H) { out.x = 5 * H - s; out.z = H; }
  else { out.x = -H; out.z = 7 * H - s; }
  return out;
}
// Signed shortest perimeter delta from a to b.
export function ringDelta(a, b) {
  let d = modP(b - a);
  if (d > PER / 2) d -= PER;
  return d;
}
// Tangent yaw of travel at s in direction dir (+1 / -1).
export function ringYaw(s, dir) {
  const a = ringPoint(s, { x: 0, z: 0 }), b = ringPoint(s + dir * 1, { x: 0, z: 0 });
  return Math.atan2(b.x - a.x, b.z - a.z);
}

function ai(v) { if (!v.ai) v.ai = { throttle: 0, steer: 0, handbrake: false }; return v.ai; }

export function brake(v) {
  const a = ai(v);
  a.steer = 0;
  a.throttle = v.speed > 0.4 ? -1 : v.speed < -0.4 ? 1 : 0;
  a.handbrake = Math.abs(v.speed) <= 0.4;
}

// Steer toward (tx, tz) at up to `cruise` m/s, slowing for the last `left` metres (defaults to
// the distance to the point). Returns the XZ distance to it.
export function driveAt(v, tx, tz, cruise, dt, left) {
  const a = ai(v);
  const dx = tx - v.pos.x, dz = tz - v.pos.z, d = Math.hypot(dx, dz);
  const err = wrap(Math.atan2(dx, dz) - v.yaw);
  // Stuck (wall, parked car): reverse with opposite lock for a moment.
  if (v.aiBackT > 0) {
    v.aiBackT -= dt;
    a.throttle = -1; a.steer = -Math.sign(err || 1); a.handbrake = false;
    return d;
  }
  if (a.throttle > 0.3 && Math.abs(v.speed) < 0.6) v.aiStuckT = (v.aiStuckT || 0) + dt;
  else v.aiStuckT = Math.max(0, (v.aiStuckT || 0) - dt);
  if (v.aiStuckT > 1.4) { v.aiStuckT = 0; v.aiBackT = 1.2; }
  a.steer = Math.max(-1, Math.min(1, err * 2.2));
  const turnK = Math.abs(err) > 0.5 ? 0.45 : Math.abs(err) > 0.2 ? 0.75 : 1;
  const want = Math.min(cruise * turnK, 4 + (left ?? d) * 0.9);
  a.throttle = Math.max(-1, Math.min(1, (want - v.speed) * 0.6));
  a.handbrake = false;
  return d;
}

const _p = { x: 0, z: 0 };
// Follow the loop toward perimeter parameter goalS; hands over to driveAt within `near` m.
export function driveRing(v, goalS, cruise, dt) {
  const s = ringS(v.pos.x, v.pos.z);
  const delta = ringDelta(s, goalS);
  if (Math.abs(delta) < LOOK) {
    ringPoint(goalS, _p);
    return driveAt(v, _p.x, _p.z, cruise, dt);
  }
  // Corners: the lookahead swings round them, so ease off when it bends away from the heading.
  ringPoint(s + Math.sign(delta) * LOOK, _p);
  driveAt(v, _p.x, _p.z, cruise, dt, Math.abs(delta));
  return Math.abs(delta);
}
