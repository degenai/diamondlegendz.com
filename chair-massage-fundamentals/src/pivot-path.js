// The pivot van's route: a 1 m occupancy grid over the block (colliders a van cannot climb, plus
// the other vehicles, inflated by the van's half width), a BFS from the van to the reachable
// spot STOP_AT metres from the chair with the shortest route, then string-pulled waypoints.
// If nothing near the chair is reachable, the free cell nearest the chair wins (the kerb).
import * as THREE from '../vendor/three.module.js';

const CELL = 1;
const HALF = 64;
const N = (HALF * 2) / CELL;
const INFLATE = 1.6;
const AHEAD = 7;             // the route starts this far in front of the van (no U-turn off the kerb)
const CLIMB = 0.45;          // deck (0.15) + one step riser; anything taller blocks the van

function blocked(world, self) {
  const g = new Uint8Array(N * N);
  const mark = (minX, maxX, minZ, maxZ) => {
    const i0 = Math.max(0, Math.floor((minX - INFLATE + HALF) / CELL)), i1 = Math.min(N - 1, Math.floor((maxX + INFLATE + HALF) / CELL));
    const j0 = Math.max(0, Math.floor((minZ - INFLATE + HALF) / CELL)), j1 = Math.min(N - 1, Math.floor((maxZ + INFLATE + HALF) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) g[j * N + i] = 1;
  };
  let terrace = null;
  for (const c of world.colliders) {
    if (c.tag === 'terrace') { terrace = c; continue; }
    if (c.camOnly || !(c.maxY > CLIMB)) continue;
    if (c.kind === 'cyl') mark(c.x - c.r, c.x + c.r, c.z - c.r, c.z + c.r);
    else mark(c.minX, c.maxX, c.minZ, c.maxZ);
  }
  // The fountain terrace is a 0.5 m ledge except up its two flights of steps (two 0.25 m
  // risers, which the wheels climb): only its rim blocks, with a gap at each flight.
  if (terrace) {
    const T = terrace.maxX, steps = (world.layout && world.layout.stepEdges) || [];
    for (const e of ['N', 'E', 'S', 'W']) {
      const pieces = steps.includes(e) ? [[-T, -5], [5, T]] : [[-T, T]];
      for (const [u0, u1] of pieces) {
        if (e === 'N' || e === 'S') { const z = e === 'N' ? -T : T; mark(u0, u1, z - 0.3, z + 0.3); }
        else { const x = e === 'W' ? -T : T; mark(x - 0.3, x + 0.3, u0, u1); }
      }
    }
  }
  for (const v of world.vehicles || []) {
    if (v === self) continue;
    const r = v.spec.halfL * 0.9;
    mark(v.pos.x - r, v.pos.x + r, v.pos.z - r, v.pos.z + r);
  }
  return g;
}

const cellOf = (x, z) => [Math.floor((x + HALF) / CELL), Math.floor((z + HALF) / CELL)];
const centre = (i, j) => new THREE.Vector3(-HALF + (i + 0.5) * CELL, 0, -HALF + (j + 0.5) * CELL);
const inside = (i, j) => i >= 0 && j >= 0 && i < N && j < N;

function clearLine(g, a, b) {
  const steps = Math.ceil(a.distanceTo(b) / (CELL * 0.5));
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    const [i, j] = cellOf(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t);
    if (!inside(i, j) || g[j * N + i]) return false;
  }
  return true;
}

export function planVanPath(world, van, chair, stopAt) {
  const g = blocked(world, van);
  const ahead = new THREE.Vector3(van.pos.x + Math.sin(van.yaw) * AHEAD, 0, van.pos.z + Math.cos(van.yaw) * AHEAD);
  let [si, sj] = cellOf(ahead.x, ahead.z);
  const useAhead = inside(si, sj) && !g[sj * N + si];
  if (!useAhead) [si, sj] = cellOf(van.pos.x, van.pos.z);
  if (!inside(si, sj)) return [];
  g[sj * N + si] = 0;
  const prev = new Int32Array(N * N).fill(-2);
  const q = new Int32Array(N * N);
  let head = 0, tail = 0;
  q[tail++] = sj * N + si; prev[sj * N + si] = -1;
  let best = -1, bestScore = Infinity;
  while (head < tail) {
    const k = q[head++];
    const i = k % N, j = (k - i) / N;
    const c = centre(i, j);
    const d = Math.hypot(c.x - chair.x, c.z - chair.z);
    // BFS order = route length; prefer the ring STOP_AT m out, else get as close as possible.
    const score = Math.abs(d - stopAt) < 0.8 ? 0 : d < stopAt ? 1e6 : d;
    if (score < bestScore) { bestScore = score; best = k; }
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = i + di, nj = j + dj;
        if (!inside(ni, nj)) continue;
        const nk = nj * N + ni;
        if (g[nk] || prev[nk] !== -2) continue;
        if (di && dj && (g[j * N + ni] || g[nj * N + i])) continue; // no corner cutting
        prev[nk] = k; q[tail++] = nk;
      }
    }
  }
  if (best < 0) return [];
  const cells = [];
  for (let k = best; k >= 0; k = prev[k]) cells.push(k);
  cells.reverse();
  const pts = cells.map((k) => centre(k % N, (k - (k % N)) / N));
  // String pulling: keep a point only when the straight line past it is blocked.
  const out = useAhead ? [ahead] : [];
  let a = useAhead ? ahead : new THREE.Vector3(van.pos.x, 0, van.pos.z);
  let idx = 0;
  while (idx < pts.length - 1) {
    let far = idx + 1;
    for (let k = pts.length - 1; k > idx + 1; k--) if (clearLine(g, a, pts[k])) { far = k; break; }
    out.push(pts[far]);
    a = pts[far]; idx = far;
  }
  if (!out.length) out.push(pts[pts.length - 1]);
  return out;
}

// Distance field (BFS steps) from every free cell stopAt m (+-0.8) from the chair.
function field(g, chair, stopAt) {
  const dist = new Int32Array(N * N).fill(-1);
  const q = new Int32Array(N * N);
  let head = 0, tail = 0;
  for (let k = 0; k < N * N; k++) {
    if (g[k]) continue;
    const i = k % N, c = centre(i, (k - i) / N);
    if (Math.abs(Math.hypot(c.x - chair.x, c.z - chair.z) - stopAt) < 0.8) { dist[k] = 0; q[tail++] = k; }
  }
  while (head < tail) {
    const k = q[head++], i = k % N, j = (k - i) / N;
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        const ni = i + di, nj = j + dj;
        if ((!di && !dj) || !inside(ni, nj)) continue;
        const nk = nj * N + ni;
        if (g[nk] || dist[nk] >= 0 || (di && dj && (g[j * N + ni] || g[nj * N + i]))) continue;
        dist[nk] = dist[k] + 1; q[tail++] = nk;
      }
    }
  }
  return dist;
}

// Downhill on the field from A to a stop cell, string-pulled.
function descend(g, dist, A) {
  let [i, j] = cellOf(A.x, A.z);
  const pts = [];
  for (let guard = 0; guard < 400 && dist[j * N + i] > 0; guard++) {
    let bi = i, bj = j;
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        const ni = i + di, nj = j + dj;
        if (!inside(ni, nj)) continue;
        const d = dist[nj * N + ni];
        if (d >= 0 && d < dist[bj * N + bi]) { bi = ni; bj = nj; }
      }
    }
    if (bi === i && bj === j) break;
    i = bi; j = bj;
    pts.push(centre(i, j));
  }
  const out = [A];
  let a = A, idx = -1;
  while (idx < pts.length - 1) {
    let far = idx + 1;
    for (let k = pts.length - 1; k > idx + 1; k--) if (clearLine(g, a, pts[k])) { far = k; break; }
    out.push(pts[far]);
    a = pts[far]; idx = far;
  }
  return out;
}

// Preferred route: stay on the ring road in the van's direction of travel (up to 200 m, so the
// driver never turns round), turn in at the point E whose plaza leg (A, 5..9 m inside the kerb,
// then downhill on the distance field) is cheapest overall, and stop stopAt m from the chair.
// Returns { entryS, dir, points: [A, ..., S] } or null (then planVanPath's grid route is used).
export function planEntry(world, van, chair, stopAt, ring) {
  const g = blocked(world, van);
  const dist = field(g, chair, stopAt);
  const s0 = ring.ringS(van.pos.x, van.pos.z);
  const dir = Math.cos(ring.ringYaw(s0, 1) - van.yaw) >= 0 ? 1 : -1;
  const p = { x: 0, z: 0 };
  const at = (v) => { const [i, j] = cellOf(v.x, v.z); return inside(i, j) && !g[j * N + i] ? dist[j * N + i] : -1; };
  let best = null, bestCost = Infinity;
  for (let ds = 14; ds <= 200; ds += 2) {
    const s = s0 + dir * ds;
    ring.ringPoint(s, p);
    if (Math.min(Math.abs(p.x), Math.abs(p.z)) > 40) continue;   // no turning in at a corner
    const E = new THREE.Vector3(Math.max(-50, Math.min(50, p.x)), 0, Math.max(-50, Math.min(50, p.z)));
    const nx = Math.abs(p.x) >= Math.abs(p.z) ? -Math.sign(p.x) : 0, nz = nx ? 0 : -Math.sign(p.z);
    const ty = ring.ringYaw(s, dir);
    const B = new THREE.Vector3(E.x - Math.sin(ty) * 6, 0, E.z - Math.cos(ty) * 6); // the turn starts early
    for (const inset of [7, 5, 9]) {
      const A = new THREE.Vector3(E.x + nx * inset, 0, E.z + nz * inset);
      const d = at(A);
      if (d < 0 || !clearLine(g, B, A) || !clearLine(g, E, A)) continue;
      const cost = ds + d * CELL * 1.6;
      if (cost < bestCost) { bestCost = cost; best = { entryS: s, dir, A }; }
      break;
    }
  }
  if (!best) return null;
  return { entryS: best.entryS, dir: best.dir, points: descend(g, dist, best.A), cost: bestCost };
}

// ---- the route as a polyline for run/driver.js followPoly (pure pursuit on it; it lived here
// until refactor/split and is re-exported below for one release). ----

// route from planEntry (ring leg + plaza leg) or planVanPath (plaza leg only).
export function buildPoly(van, route, ring) {
  const pts = [new THREE.Vector3(van.pos.x, 0, van.pos.z)];
  let ringEnd = 0;
  if (route.entryS !== undefined) {
    const s0 = ring.ringS(van.pos.x, van.pos.z), p = { x: 0, z: 0 };
    const n = Math.floor(Math.abs(ring.ringDelta(s0, route.entryS)) / 4);
    for (let k = 1; k <= n; k++) {
      ring.ringPoint(s0 + route.dir * k * 4, p);
      pts.push(new THREE.Vector3(Math.max(-50, Math.min(50, p.x)), 0, Math.max(-50, Math.min(50, p.z))));
    }
    ringEnd = pts.length - 1;
  }
  for (const q of route.points) pts.push(q.clone());
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
  return { pts, cum, total: cum[cum.length - 1], ringEnd, prog: 0, seg: 0 };
}

// followPoly moved to run/driver.js (refactor/split); re-exported here for one release.
export { followPoly } from './run/driver.js';
