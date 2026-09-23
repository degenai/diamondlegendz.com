// Pedestrian waypoint graph: both sidewalk rings, the crosswalks, the plaza paths and the terrace.
// Returns { points: Vector3[], edges: [i, j][] }. Deterministic given the layout flags.
import * as THREE from '../../vendor/three.module.js';
import { DECK_Y, TERRACE_Y, TERRACE_HALF, INNER_WALK, OUTER_WALK, RING_R } from './layout.js';

export function buildNav({ stepAxis, diag, ring }) {
  const points = [];
  const edges = [];
  const index = new Map();
  const edgeSet = new Set();

  const pt = (x, z, y = DECK_Y) => {
    const key = `${Math.round(x * 10)},${Math.round(z * 10)}`;
    let i = index.get(key);
    if (i === undefined) { i = points.length; points.push(new THREE.Vector3(x, y, z)); index.set(key, i); }
    return i;
  };
  const link = (a, b) => {
    if (a === b) return;
    const k = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (edgeSet.has(k)) return;
    edgeSet.add(k);
    edges.push(a < b ? [a, b] : [b, a]);
  };
  const chain = (ids, closed = false) => {
    for (let i = 1; i < ids.length; i++) link(ids[i - 1], ids[i]);
    if (closed && ids.length > 2) link(ids[ids.length - 1], ids[0]);
  };
  // Square ring with half size h, n points per half side (so every axis crossing is a point).
  const square = (h, n, y) => {
    const ids = [];
    const s = h / n;
    for (let k = -n; k < n; k++) ids.push(pt(k * s, -h, y));   // N side, west -> east
    for (let k = -n; k < n; k++) ids.push(pt(h, k * s, y));    // E side, north -> south
    for (let k = n; k > -n; k--) ids.push(pt(k * s, h, y));    // S side, east -> west
    for (let k = n; k > -n; k--) ids.push(pt(-h, k * s, y));   // W side, south -> north
    chain(ids, true);
  };
  const AX = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N E S W unit directions

  square(INNER_WALK, 6, DECK_Y);
  square(OUTER_WALK, 7, DECK_Y);
  square(TERRACE_HALF + 2, 1, DECK_Y); // path around the terrace foot

  // Crosswalks + axis paths from the inner sidewalk to the terrace foot.
  const axisD = ring ? [INNER_WALK, 37, RING_R, 19, TERRACE_HALF + 2] : [INNER_WALK, 38, 30, 22, TERRACE_HALF + 2];
  for (const [ax, az] of AX) {
    link(pt(ax * INNER_WALK, az * INNER_WALK), pt(ax * OUTER_WALK, az * OUTER_WALK));
    chain(axisD.map((d) => pt(ax * d, az * d)));
  }

  if (ring) {
    const ids = [];
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      ids.push(pt(Math.cos(a) * RING_R, Math.sin(a) * RING_R));
    }
    chain(ids, true);
  }

  if (diag) {
    const dr = RING_R * Math.SQRT1_2;
    const diagD = ring ? [INNER_WALK, 37, 28, dr, TERRACE_HALF + 2] : [INNER_WALK, 37, 28, 20, TERRACE_HALF + 2];
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      chain(diagD.map((d) => (d === dr ? pt(Math.cos(Math.atan2(sz, sx)) * RING_R, Math.sin(Math.atan2(sz, sx)) * RING_R) : pt(sx * d, sz * d))));
    }
  }

  // Terrace: up the steps to a ring around the fountain.
  const top = [];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    top.push(pt(Math.round(Math.cos(a) * 6 * 100) / 100, Math.round(Math.sin(a) * 6 * 100) / 100, TERRACE_Y));
  }
  chain(top, true);
  const stepDirs = stepAxis === 'NS' ? [AX[0], AX[2]] : [AX[1], AX[3]];
  for (const [ax, az] of stepDirs) {
    chain([pt(ax * (TERRACE_HALF + 2), az * (TERRACE_HALF + 2)), pt(ax * (TERRACE_HALF - 2), az * (TERRACE_HALF - 2), TERRACE_Y), pt(ax * 6, az * 6, TERRACE_Y)]);
  }

  return { points, edges };
}

// Shortest XZ distance from (x, z) to any nav edge. Used to keep props off the walking lines.
export function distToNav(nav, x, z) {
  let best = Infinity;
  for (const [i, j] of nav.edges) {
    const a = nav.points[i], b = nav.points[j];
    const ex = b.x - a.x, ez = b.z - a.z;
    const l2 = ex * ex + ez * ez || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * ex + (z - a.z) * ez) / l2));
    const dx = a.x + ex * t - x, dz = a.z + ez * t - z;
    best = Math.min(best, dx * dx + dz * dz);
  }
  return Math.sqrt(best);
}
