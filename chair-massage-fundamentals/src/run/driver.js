// AI drivers on the street graph (world/roads.js): a route of intersections, pure pursuit on a
// lookahead point along its lane (pivot-path.js followPoly, which also brakes for bends), a
// direct chase when close, and a back-up-and-turn when stuck. Writes v.ai = { throttle, steer,
// handbrake }; vehicle.js reads it.
import { nodeAhead, nearestEdge, route, lanePoints } from '../world/roads.js';
import { followPoly } from '../pivot-path.js';
const REPLAN = 1.0;
// Street corners are 90 degrees with parked cars 2 m outside the lane: brake early, turn slowly.
const STREET_BEND = [16, 24, 3.5];   // fast cars (cops, the van)
const TOWN_BEND = [10, 16, 3.5];

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
  if (v.aiStuckT > 1.4) { v.aiStuckT = 0; v.aiBackT = 1.2; }
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
