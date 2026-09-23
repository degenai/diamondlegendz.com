// NPC navigation helpers: nearby colliders from the physics grid (physics-grid.js), shortest
// paths over the pedestrian nav graph (one Dijkstra per goal node, computed when first asked and
// kept in a small LRU; the district's graph is far too big for the old all-pairs table), a
// bucket grid over the nav points for nearest-point queries, knee-height walkability and
// head-height line of sight.
import { segmentHit } from '../physics.js';
import { query } from '../physics-grid.js';
import { DECK_HALF, ROAD_OUT, SIZE, HALF } from '../world/layout.js';

// ---- nearby colliders ----
const _near = [];
// Colliders that can touch a body at (x, z). Returns a reused array (valid until the next call).
export function nearColliders(world, x, z) {
  const r = query(world.colliders, x - 2, x + 2, z - 2, z + 2, _near);
  if (r !== _near) { _near.length = 0; for (let i = 0; i < r.length; i++) _near.push(r[i]); }
  return _near;
}

// ---- nav graph: adjacency, point buckets, per-goal shortest-path fields ----
const BUCKET = 16;
const FIELDS = 48;
export function navInfo(world) {
  if (world._navInfo) return world._navInfo;
  const { points, edges } = world.nav;
  const N = points.length;
  const adj = Array.from({ length: N }, () => []);
  for (const [a, b] of edges) { adj[a].push(b); adj[b].push(a); }
  const buckets = new Map();
  points.forEach((p, i) => {
    const k = `${Math.floor(p.x / BUCKET)},${Math.floor(p.z / BUCKET)}`;
    let l = buckets.get(k);
    if (!l) buckets.set(k, (l = []));
    l.push(i);
  });
  world._navInfo = { N, adj, points, buckets, fields: new Map() };
  return world._navInfo;
}

// Dijkstra (typed binary heap) from `goal`: next[i] = neighbour of i one step closer (-1
// unreachable, goal itself at the goal), cost[i] = path length i -> goal.
let hk = new Float64Array(1024), hv = new Int32Array(1024);
function field(info, goal) {
  let f = info.fields.get(goal);
  if (f) { info.fields.delete(goal); info.fields.set(goal, f); return f; }
  const { N, adj, points } = info;
  const next = new Int32Array(N).fill(-1), cost = new Float64Array(N).fill(Infinity);
  if (hk.length < N * 4) { hk = new Float64Array(N * 4); hv = new Int32Array(N * 4); }
  let n = 0;
  const push = (d, i) => {
    let k = n++;
    while (k > 0) { const p = (k - 1) >> 1; if (hk[p] <= d) break; hk[k] = hk[p]; hv[k] = hv[p]; k = p; }
    hk[k] = d; hv[k] = i;
  };
  cost[goal] = 0; next[goal] = goal; push(0, goal);
  while (n) {
    const d = hk[0], u = hv[0];
    const ld = hk[--n], lv = hv[n];
    let k = 0;
    for (;;) { const l = 2 * k + 1; if (l >= n) break; const r = l + 1, m = r < n && hk[r] < hk[l] ? r : l; if (hk[m] >= ld) break; hk[k] = hk[m]; hv[k] = hv[m]; k = m; }
    hk[k] = ld; hv[k] = lv;
    if (d > cost[u]) continue;
    const pu = points[u];
    for (const w of adj[u]) {
      const pw = points[w], nd = d + Math.hypot(pu.x - pw.x, pu.y - pw.y, pu.z - pw.z);
      if (nd < cost[w]) { cost[w] = nd; next[w] = u; push(nd, w); }
    }
  }
  f = { next, cost };
  info.fields.set(goal, f);
  if (info.fields.size > FIELDS) info.fields.delete(info.fields.keys().next().value);
  return f;
}

// Nav point ids in the buckets within `r` of (x, z), into `out`.
function around(info, x, z, r, out) {
  out.length = 0;
  const i0 = Math.floor((x - r) / BUCKET), i1 = Math.floor((x + r) / BUCKET);
  const j0 = Math.floor((z - r) / BUCKET), j1 = Math.floor((z + r) / BUCKET);
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    const l = info.buckets.get(`${i},${j}`);
    if (l) for (let k = 0; k < l.length; k++) out.push(l[k]);
  }
  return out;
}
const _ids = [];

// With y given, prefers points on the target's level (within 0.5 m) over nearer ones across a lip.
export function nearestNav(world, x, z, y) {
  const info = navInfo(world), pts = info.points;
  let best = 0, bd = Infinity;
  for (let r = BUCKET; ; r *= 2) {
    around(info, x, z, r, _ids);
    for (const i of _ids) {
      const dx = pts[i].x - x, dz = pts[i].z - z;
      let d = dx * dx + dz * dz;
      if (y !== undefined && Math.abs(pts[i].y - y) > 0.5) d += 1e6;
      if (d < bd) { bd = d; best = i; }
    }
    if ((bd < 1e6 && bd <= r * r) || r > 2048) break;
  }
  return best;
}

// Best nav point to join the graph at from (x, z) heading for goal: among the few nearest that
// can be walked to straight, the one with the shortest walk-in + path length.
const _cand = new Int32Array(6);
const _cd = new Float32Array(6);
export function entryNav(world, x, y, z, goal) {
  const info = navInfo(world), pts = info.points;
  let n = 0;
  let ids = around(info, x, z, BUCKET, _ids);
  if (ids.length < 6) ids = around(info, x, z, BUCKET * 4, _ids);
  const cost = field(info, goal).cost;
  for (let k = 0; k < ids.length; k++) {
    const i = ids[k];
    const d = (pts[i].x - x) ** 2 + (pts[i].z - z) ** 2;
    if (n < 6) { _cand[n] = i; _cd[n] = d; n++; continue; }
    let worst = 0;
    for (let k = 1; k < 6; k++) if (_cd[k] > _cd[worst]) worst = k;
    if (d < _cd[worst]) { _cand[worst] = i; _cd[worst] = d; }
  }
  let best = -1, bc = Infinity, fallback = _cand[0], fd = Infinity;
  for (let k = 0; k < n; k++) {
    const i = _cand[k], d = Math.sqrt(_cd[k]);
    if (d < fd) { fd = d; fallback = i; }
    const c = d + cost[i];
    if (c >= bc) continue;
    if (!walkable(world, x, y, z, pts[i].x, pts[i].y, pts[i].z)) continue;
    bc = c; best = i;
  }
  return best >= 0 ? best : fallback;
}

export function nextHop(world, from, goal) {
  return field(navInfo(world), goal).next[from];
}

// ---- line tests ----
const _a = { x: 0, y: 0, z: 0 };
const _b = { x: 0, y: 0, z: 0 };
export const KNEE = 0.32;            // anything taller than a step blocks walking straight at it
// Can a body at (ax, ay, az) walk straight to (bx, by, bz)? Anything taller than a step blocks.
export function walkable(world, ax, ay, az, bx, by, bz) {
  _a.x = ax; _a.y = ay + KNEE; _a.z = az;
  _b.x = bx; _b.y = by + KNEE; _b.z = bz;
  const len = Math.hypot(bx - ax, _b.y - _a.y, bz - az);
  return segmentHit(_a, _b, world.colliders) >= len - 1e-3;
}

// Head-to-head line of sight (vehicles are not colliders, so they never block it).
export function lineOfSight(world, a, b, h = 1.6) {
  _a.x = a.x; _a.y = a.y + h; _a.z = a.z;
  _b.x = b.x; _b.y = b.y + h; _b.z = b.z;
  const len = Math.hypot(_b.x - _a.x, _b.y - _a.y, _b.z - _a.z);
  return segmentHit(_a, _b, world.colliders) >= len - 1e-3;
}

// Carriageway: a block's ring road (between the inner sidewalk slab and the outer kerb) or a
// street through the lots at a side's middle (link and escape streets alike; lots elsewhere).
export function isRoad(x, z) {
  const lx = x - Math.round(x / SIZE) * SIZE, lz = z - Math.round(z / SIZE) * SIZE;
  const m = Math.max(Math.abs(lx), Math.abs(lz));
  if (m > DECK_HALF + 0.2 && m < ROAD_OUT - 0.2) return true;
  return m >= ROAD_OUT - 0.2 && m <= HALF && Math.min(Math.abs(lx), Math.abs(lz)) < 3.8;
}
