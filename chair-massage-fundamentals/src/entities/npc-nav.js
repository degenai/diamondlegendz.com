// NPC navigation helpers: a uniform grid over the static colliders (so each NPC only tests the
// handful near it), an all-pairs next-hop table over the pedestrian nav graph (built once, so
// following a path costs nothing per tick), knee-height walkability and head-height line of sight.
import { segmentHit } from '../physics.js';
import { DECK_HALF, ROAD_OUT } from '../world/layout.js';

const CELL = 8;
const GRID_HALF = 100;               // covers -100..100 (the block plus the escape street)
const DIM = (GRID_HALF * 2) / CELL;

// ---- collider grid ----
function buildGrid(world) {
  const cells = new Array(DIM * DIM);
  for (let i = 0; i < cells.length; i++) cells[i] = [];
  const wide = [];                   // colliders bigger than the grid (deck, far walls)
  for (const c of world.colliders) {
    if (c.camOnly) continue;
    let minX, maxX, minZ, maxZ;
    if (c.kind === 'cyl') { minX = c.x - c.r; maxX = c.x + c.r; minZ = c.z - c.r; maxZ = c.z + c.r; }
    else { minX = c.minX; maxX = c.maxX; minZ = c.minZ; maxZ = c.maxZ; }
    const i0 = cellIx(minX - 1), i1 = cellIx(maxX + 1), j0 = cellIx(minZ - 1), j1 = cellIx(maxZ + 1);
    if ((i1 - i0 + 1) * (j1 - j0 + 1) > 60) { wide.push(c); continue; }
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) cells[j * DIM + i].push(c);
  }
  return { cells, wide, n: world.colliders.length, src: world.colliders };
}
function cellIx(v) { return Math.max(0, Math.min(DIM - 1, Math.floor((v + GRID_HALF) / CELL))); }

const _near = [];
// Colliders that can touch a body at (x, z). Returns a reused array (valid until the next call).
export function nearColliders(world, x, z) {
  let g = world._npcGrid;
  if (!g || g.n !== world.colliders.length || g.src !== world.colliders) g = world._npcGrid = buildGrid(world);
  _near.length = 0;
  const cell = g.cells[cellIx(z) * DIM + cellIx(x)];
  for (let i = 0; i < g.wide.length; i++) _near.push(g.wide[i]);
  for (let i = 0; i < cell.length; i++) _near.push(cell[i]);
  return _near;
}

// ---- nav graph: adjacency + next-hop table ----
export function navInfo(world) {
  if (world._navInfo) return world._navInfo;
  const { points, edges } = world.nav;
  const N = points.length;
  const adj = Array.from({ length: N }, () => []);
  for (const [a, b] of edges) { adj[a].push(b); adj[b].push(a); }
  // next[goal * N + i] = neighbour of i one step closer to goal (-1 unreachable, i itself at goal).
  const next = new Int16Array(N * N).fill(-1);
  const cost = new Float32Array(N * N);          // cost[goal * N + i]: path length i -> goal
  const dist = new Float32Array(N);
  const done = new Uint8Array(N);
  for (let g = 0; g < N; g++) {
    dist.fill(Infinity); done.fill(0);
    dist[g] = 0; next[g * N + g] = g;
    for (;;) {
      let u = -1, best = Infinity;
      for (let i = 0; i < N; i++) if (!done[i] && dist[i] < best) { best = dist[i]; u = i; }
      if (u < 0) break;
      done[u] = 1;
      cost[g * N + u] = best;
      for (const w of adj[u]) {
        const d = best + points[u].distanceTo(points[w]);
        if (d < dist[w]) { dist[w] = d; next[g * N + w] = u; }
      }
    }
  }
  world._navInfo = { N, adj, next, cost, points };
  return world._navInfo;
}

// With y given, prefers points on the target's level (within 0.5 m) over nearer ones across a lip.
export function nearestNav(world, x, z, y) {
  const pts = world.nav.points;
  let best = 0, bd = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const dx = pts[i].x - x, dz = pts[i].z - z;
    let d = dx * dx + dz * dz;
    if (y !== undefined && Math.abs(pts[i].y - y) > 0.5) d += 1e6;
    if (d < bd) { bd = d; best = i; }
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
  for (let i = 0; i < pts.length; i++) {
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
    const c = d + info.cost[goal * info.N + i];
    if (c >= bc) continue;
    if (!walkable(world, x, y, z, pts[i].x, pts[i].y, pts[i].z)) continue;
    bc = c; best = i;
  }
  return best >= 0 ? best : fallback;
}

export function nextHop(world, from, goal) {
  const info = navInfo(world);
  return info.next[goal * info.N + from];
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

// The ring road carriageway (between the inner sidewalk slab and the outer kerb).
export function isRoad(x, z) {
  const m = Math.max(Math.abs(x), Math.abs(z));
  return m > DECK_HALF + 0.2 && m < ROAD_OUT - 0.2 && Math.min(Math.abs(x), Math.abs(z)) < ROAD_OUT;
}
