// The street graph that AI drivers use in place of the old single ring road: intersections and
// ring corners are nodes, street segments are edges. Per block, the ring road's centreline
// (RING_C out) gives four corners and four side midpoints; link streets join the midpoints of
// neighbouring blocks; the escape block adds a node where the escape street leaves its ring and
// one at the escape zone. Right-hand traffic: a route's polyline keeps to the right (laneOffset).
import { RING_C, SIZE, toXZ } from './layout.js';

export function buildRoads(parts) {
  const nodes = [], edges = [], index = new Map(), set = new Set();
  const node = (x, z) => {
    const k = `${Math.round(x * 10)},${Math.round(z * 10)}`;
    let i = index.get(k);
    if (i === undefined) { i = nodes.length; nodes.push({ x, z }); index.set(k, i); }
    return i;
  };
  const link = (a, b) => {
    if (a === b) return;
    const k = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (set.has(k)) return;
    set.add(k); edges.push([a, b]);
  };
  let escapeNode = -1, exitNode = -1;
  for (const P of parts) {
    const [cx, cz] = P.centre;
    const at = (edge, u, d) => { const [x, z] = toXZ(edge, u, d); return node(x + cx, z + cz); };
    for (const e of ['N', 'E', 'S', 'W']) {
      // Stops along this side of the ring, west->east / north->south: corner, [escape], mid, corner.
      const us = [-RING_C, 0, RING_C];
      const esc = P.gaps.find((q) => q.edge === e && q.kind === 'escape');
      if (esc && Math.abs(esc.g) > 1) us.push(esc.g);
      us.sort((a, b) => a - b);
      const ids = us.map((u) => at(e, u, RING_C));
      for (let k = 1; k < ids.length; k++) link(ids[k - 1], ids[k]);
      if (esc) {
        escapeNode = at(e, Math.abs(esc.g) > 1 ? esc.g : 0, RING_C);
        exitNode = at(e, esc.g, 76);
        link(escapeNode, exitNode);
      }
    }
    // Link streets: this block's side midpoint to the neighbour's (the neighbour adds the same edge).
    for (const q of P.gaps) {
      if (q.kind !== 'link') continue;
      link(at(q.edge, 0, RING_C), at(q.edge, 0, 160 - RING_C));
    }
  }
  const adj = nodes.map(() => []);
  for (const [a, b] of edges) { adj[a].push(b); adj[b].push(a); }
  nodes.forEach((n, i) => { n.deg = adj[i].length; });
  return { nodes, edges, adj, escapeNode, exitNode };
}

export function nearestNode(G, x, z, filter) {
  let best = -1, bd = Infinity;
  for (let i = 0; i < G.nodes.length; i++) {
    if (filter && !filter(i)) continue;
    const n = G.nodes[i], d = (n.x - x) ** 2 + (n.z - z) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

// Nearest street segment to (x, z): { a, b, t (0 at a), d (metres off the centreline) }.
export function nearestEdge(G, x, z) {
  let best = null, bd = Infinity;
  for (const [a, b] of G.edges) {
    const A = G.nodes[a], B = G.nodes[b];
    const ex = B.x - A.x, ez = B.z - A.z, l2 = ex * ex + ez * ez || 1;
    const t = Math.max(0, Math.min(1, ((x - A.x) * ex + (z - A.z) * ez) / l2));
    const d = (A.x + ex * t - x) ** 2 + (A.z + ez * t - z) ** 2;
    if (d < bd) { bd = d; best = { a, b, t }; }
  }
  if (best) best.d = Math.sqrt(bd);
  return best;
}

// The node a body at (x, z) moving along (vx, vz) reaches next on its street (or the nearer end).
export function nodeAhead(G, x, z, vx = 0, vz = 0) {
  const e = nearestEdge(G, x, z);
  if (!e) return -1;
  const A = G.nodes[e.a], B = G.nodes[e.b];
  const dot = (B.x - A.x) * vx + (B.z - A.z) * vz;
  if (Math.abs(dot) < 1e-3) return e.t < 0.5 ? e.a : e.b;
  return dot > 0 ? e.b : e.a;
}

const dist = (G, a, b) => Math.hypot(G.nodes[a].x - G.nodes[b].x, G.nodes[a].z - G.nodes[b].z);

// Shortest node path from -> to (Dijkstra; the graph is ~130 nodes). [] when unreachable.
export function route(G, from, to) {
  const N = G.nodes.length, d = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), done = new Uint8Array(N);
  d[from] = 0;
  for (;;) {
    let u = -1, bu = Infinity;
    for (let i = 0; i < N; i++) if (!done[i] && d[i] < bu) { bu = d[i]; u = i; }
    if (u < 0 || u === to) break;
    done[u] = 1;
    for (const w of G.adj[u]) {
      const nd = bu + dist(G, u, w);
      if (nd < d[w]) { d[w] = nd; prev[w] = u; }
    }
  }
  if (!Number.isFinite(d[to])) return [];
  const out = [];
  for (let k = to; k >= 0; k = prev[k]) out.push(k);
  return out.reverse();
}

// Lane offset for travel a -> b, right of the centreline. The ring road is 8 m with parked cars
// along its outer kerb, so the lane whose right side faces out (the kerb, the parked cars) keeps
// 0.7 m off the centreline and the one facing in runs 1.8 m in (clear of the kerb trees); link and escape streets have
// no parking and split evenly. `lane` given: that offset everywhere.
export const LANE_OUT = 0.7, LANE_IN = 1.8, LANE_LINK = 1.5;
export function laneOffset(G, a, b, lane) {
  if (lane !== undefined) return lane;
  const A = G.nodes[a], B = G.nodes[b];
  const mx = (A.x + B.x) / 2, mz = (A.z + B.z) / 2;
  const lx = mx - Math.round(mx / SIZE) * SIZE, lz = mz - Math.round(mz / SIZE) * SIZE;
  if (Math.max(Math.abs(lx), Math.abs(lz)) > RING_C + 6) return LANE_LINK;
  const dx = B.x - A.x, dz = B.z - A.z;
  return (-dz * lx + dx * lz) > 0 ? LANE_OUT : LANE_IN;          // right vector . outward
}

// Polyline through node ids, each street offset to the right of travel by its lane (corners at
// the crossing of the two offset lines).
export function lanePoints(G, ids, lane) {
  const P = ids.map((i) => G.nodes[i]);
  const out = [];
  const right = (a, b) => { const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1; return [-dz / l, dx / l]; };
  for (let k = 0; k < P.length; k++) {
    const r0 = k > 0 ? right(P[k - 1], P[k]) : null, r1 = k < P.length - 1 ? right(P[k], P[k + 1]) : null;
    const o0 = k > 0 ? laneOffset(G, ids[k - 1], ids[k], lane) : 0, o1 = k < P.length - 1 ? laneOffset(G, ids[k], ids[k + 1], lane) : 0;
    let mx, mz;
    if (r0 && r1) {
      const det = r0[0] * r1[1] - r0[1] * r1[0];
      if (Math.abs(det) > 0.1) { mx = (o0 * r1[1] - o1 * r0[1]) / det; mz = (r0[0] * o1 - r1[0] * o0) / det; }
      else if (r0[0] * r1[0] + r0[1] * r1[1] > 0) { const o = (o0 + o1) / 2; mx = r0[0] * o; mz = r0[1] * o; }
      else { mx = 0; mz = 0; }                                   // a U-turn: through the node
    } else { const r = r0 || r1 || [0, 0], o = r0 ? o0 : o1; mx = r[0] * o; mz = r[1] * o; }
    out.push({ x: P[k].x + mx, z: P[k].z + mz });
  }
  return out;
}

// A spot on edge a->b, `along` m from a, offset `lane` right of a->b travel, facing a->b.
export function edgeSpot(G, a, b, along, lane) {
  lane = laneOffset(G, a, b, lane);
  const A = G.nodes[a], B = G.nodes[b];
  const dx = B.x - A.x, dz = B.z - A.z, l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l;
  const s = Math.min(along, l);
  return { x: A.x + ux * s - uz * lane, z: A.z + uz * s + ux * lane, yaw: Math.atan2(ux, uz) };
}
