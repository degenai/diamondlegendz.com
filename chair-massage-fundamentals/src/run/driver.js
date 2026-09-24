// AI drivers on the street graph (world/roads.js): a route of intersections, pure pursuit on a
// lookahead point along its lane (followPoly below, which also brakes for bends), a
// direct chase when close, and a back-up-and-turn when stuck. Writes v.ai = { throttle, steer,
// handbrake }; vehicle.js reads it.
import * as THREE from '../../vendor/three.module.js';
import { nodeAhead, nearestEdge, route, lanePoints } from '../world/roads.js';
const REPLAN = 1.0;
// Street corners are 90 degrees with parked cars 2 m outside the lane: brake early, turn slowly.
const STREET_BEND = [18, 26, 6, [6, 11]];   // fast cars (cops, the van)
const TOWN_BEND = [12, 18, 6, [6, 9]];

function wrap(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
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
  // Stuck again soon after the last back-up (a lot corner on a tight turn): back up longer each time.
  v.aiStuckN = Math.max(0, (v.aiStuckN || 0) - dt * 0.05);
  if (v.aiStuckT > 1.4) { v.aiStuckT = 0; v.aiBackT = 1.2 + 0.8 * Math.min(3, Math.floor(v.aiStuckN)); v.aiStuckN += 1; }
  a.steer = Math.max(-1, Math.min(1, err * 2.2));
  const turnK = Math.abs(err) > 0.5 ? 0.45 : Math.abs(err) > 0.2 ? 0.75 : 1;
  const want = Math.min(cruise * turnK, 4 + (left ?? d) * 0.9);
  a.throttle = Math.max(-1, Math.min(1, (want - v.speed) * 0.6));
  a.handbrake = false;
  return d;
}

// ---- the street graph (world/roads.js): route to a node, then pure pursuit on the lane ----
function makePoly(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  return { pts, cum, total: cum[cum.length - 1], ringEnd: pts.length, prog: 0, seg: 0 };
}

// Lane polyline to node `goal`: the street the vehicle is on (from the node behind it, so the
// pursuit carrot sits on the lane and pulls it back in after a wide corner), then the shortest route.
export function planRoute(v, G, goal, lane) {
  const e = nearestEdge(G, v.pos.x, v.pos.z);
  const start = nodeAhead(G, v.pos.x, v.pos.z, Math.sin(v.yaw), Math.cos(v.yaw));
  const ids = start < 0 ? [] : route(G, start, goal);
  if (e && ids.length && e.d < 12) { const back = start === e.a ? e.b : e.a; if (ids[1] !== back) ids.unshift(back); }
  const pts = ids.length > 1 ? lanePoints(G, ids, lane) : [{ x: v.pos.x, z: v.pos.z }, ...lanePoints(G, ids, lane)];
  if (pts.length < 2) pts.push({ x: v.pos.x + Math.sin(v.yaw), z: v.pos.z + Math.cos(v.yaw) });
  return makePoly(pts);
}

// Follow the street graph to node `goal` at up to `cruise`; returns the metres left on the route.
export function driveRoute(v, G, goal, cruise, dt, lane) {
  const R = v.route;
  if (!R || R.goal !== goal || R.t <= 0 || R.lane !== lane) {
    v.route = { goal, lane, t: REPLAN, poly: planRoute(v, G, goal, lane) };
  } else R.t -= dt;
  return followPoly(v, v.route.poly, dt, driveAt, cruise, cruise, cruise > 11 ? STREET_BEND : TOWN_BEND);
}

// ---- following a route: pure pursuit on a polyline (carrot LOOK m ahead of the vehicle's
// projected progress, which only moves forward), speed from driveAt. Polylines come from
// makePoly here or pivot-path.js buildPoly (the pivot van). Moved from pivot-path.js in
// refactor/split, so driver.js and pivot-path.js no longer call into each other. The driveAt
// parameter stays for the callers (pivot.js, traffic.js, driveRoute), which all pass this
// module's driveAt.
const LOOK = 6;
const BEND_AT = [8, 14, 6];

function pointAt(P, d, out) {
  const { pts, cum } = P;
  let i = 1;
  while (i < pts.length - 1 && cum[i] < d) i++;
  const a = pts[i - 1], b = pts[i], L = cum[i] - cum[i - 1] || 1;
  const t = Math.max(0, Math.min(1, (d - cum[i - 1]) / L));
  return out.set(a.x + (b.x - a.x) * t, 0, a.z + (b.z - a.z) * t);
}

const _c = new THREE.Vector3();
const _p0 = new THREE.Vector3();
const _p1 = new THREE.Vector3();
// Returns the metres left; the caller brakes when it is small.
// bendAt: [from, to] m ahead where the bend brake looks, the speed for a sharp bend, and
// (optional) [min, max] of a speed-scaled carrot distance.
export function followPoly(v, P, dt, driveAt, ringCruise, plazaCruise, bendAt = BEND_AT) {
  const { pts, cum } = P;
  // Progress: best projection on the current segment or the next two.
  let bestD = Infinity;
  for (let i = P.seg; i < Math.min(pts.length - 1, P.seg + 3); i++) {
    const a = pts[i], b = pts[i + 1], L = cum[i + 1] - cum[i] || 1;
    const t = Math.max(0, Math.min(1, ((v.pos.x - a.x) * (b.x - a.x) + (v.pos.z - a.z) * (b.z - a.z)) / (L * L)));
    const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, d = Math.hypot(v.pos.x - x, v.pos.z - z);
    if (d < bestD) { bestD = d; const pr = cum[i] + t * L; if (pr >= P.prog) { P.prog = pr; P.seg = i; } }
  }
  const left = P.total - P.prog;
  // Street driving (bendAt[3]): the carrot runs further ahead with speed, so it is on the next
  // street before the corner and the car turns in early and wide instead of late and tight.
  const look = bendAt[3] ? Math.max(bendAt[3][0], Math.min(bendAt[3][1], 3 + Math.abs(v.speed) * 0.6)) : LOOK;
  pointAt(P, Math.min(P.total, P.prog + look), _c);
  let cruise = P.seg < P.ringEnd ? ringCruise : plazaCruise;
  // Brake for the bend ahead: heading change between the next 4 m and 8..14 m on.
  pointAt(P, P.prog, _p0); pointAt(P, Math.min(P.total, P.prog + 4), _p1);
  const h0 = Math.atan2(_p1.x - _p0.x, _p1.z - _p0.z);
  pointAt(P, Math.min(P.total, P.prog + bendAt[0]), _p0); pointAt(P, Math.min(P.total, P.prog + bendAt[1]), _p1);
  let bend = Math.abs(Math.atan2(_p1.x - _p0.x, _p1.z - _p0.z) - h0);
  if (bend > Math.PI) bend = Math.PI * 2 - bend;
  if (bend > 1.0) cruise = Math.min(cruise, bendAt[2] ?? 6); else if (bend > 0.5) cruise = Math.min(cruise, 9);
  driveAt(v, _c.x, _c.z, cruise, dt, left);
  return left;
}
