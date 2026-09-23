// Shared block dimensions (metres, block centred at origin, +Z south) and side-frame helpers.
// A side frame: u runs along the street, d is the distance outward from the centre.

export const SIZE = 160;
export const HALF = 80;
export const PLAZA_HALF = 44;     // paved plaza
export const DECK_HALF = 48;      // plaza + inner sidewalk slab
export const ROAD_OUT = 56;       // road is DECK_HALF..ROAD_OUT
export const LOT_FRONT = 60;      // outer sidewalk ROAD_OUT..LOT_FRONT, buildings LOT_FRONT..HALF
export const INNER_WALK = 46;     // nav line on the inner sidewalk
export const OUTER_WALK = 58;     // nav line on the outer sidewalk
export const TERRACE_HALF = 12;   // raised fountain terrace
export const RING_R = 26;         // ring path radius
export const DECK_Y = 0.15;       // kerb height; plaza and sidewalks sit at this level
export const TERRACE_Y = 0.65;    // two 0.25 m risers above the deck
export const GAP_HALF = 6;        // escape street gap is 12 m wide
export const ESC_WALL = 92;       // invisible wall distance at the escape gap
export const ALLEY_HALF = 1.2;    // alleys are a 2.4 m gap between two lots
export const ALLEY_END = 78;      // an alley dead-ends at a wall 2 m short of the perimeter (HALF)
export const EDGES = ['N', 'E', 'S', 'W'];

// out = unit outward vector; yaw turns a local +Z to point outward.
export const SIDE = {
  N: { out: [0, -1], yaw: Math.PI },
  E: { out: [1, 0], yaw: Math.PI / 2 },
  S: { out: [0, 1], yaw: 0 },
  W: { out: [-1, 0], yaw: -Math.PI / 2 },
};

// Along-street axis for a side (N/S streets run along X, E/W along Z).
export function toXZ(edge, u, d) {
  const [ox, oz] = SIDE[edge].out;
  return ox !== 0 ? [ox * d, u] : [u, oz * d];
}

// AABB of the side-frame rectangle u0..u1, d0..d1.
export function sideBox(edge, u0, u1, d0, d1, maxY, extra) {
  const [ax, az] = toXZ(edge, u0, d0);
  const [bx, bz] = toXZ(edge, u1, d1);
  return {
    minX: Math.min(ax, bx), maxX: Math.max(ax, bx),
    minZ: Math.min(az, bz), maxZ: Math.max(az, bz),
    maxY, ...extra,
  };
}

export function aabb(minX, maxX, minZ, maxZ, maxY, extra) {
  return { minX, maxX, minZ, maxZ, maxY, ...extra };
}

// Box collider around a centre; w along X, d along Z.
export function boxAt(x, z, w, d, maxY, extra) {
  return aabb(x - w / 2, x + w / 2, z - d / 2, z + d / 2, maxY, extra);
}

// Direction of traffic on the outer lane of a side (right-hand traffic).
export function laneForward(edge) {
  const [ox, oz] = SIDE[edge].out;
  return [oz, -ox];
}

// ---- District (feature/district): a GRID x GRID tiling of the block above. Block (i, j) is
// centred at ((i - PLAZA_IJ[0]) * SIZE, (j - PLAZA_IJ[1]) * SIZE), so the plaza block keeps the
// origin (every plaza coordinate, the pivot and the chair are unchanged) and the district runs
// mostly away from it, +X / +Z. Neighbours meet lot-back to lot-back at the block edges; LINK
// streets (a GAP_HALF gap at u = 0 on every interior side) join their ring roads.
export const GRID = 4;
export const PLAZA_IJ = [1, 1];
export const RING_C = (DECK_HALF + ROAD_OUT) / 2;   // ring road centreline (52)
export const LINK_U = 0;                            // link streets run through the lots at u = 0
export const DMIN = (0 - PLAZA_IJ[0]) * SIZE - HALF;           // district bounds (x and z)
export const DMAX = (GRID - 1 - PLAZA_IJ[0]) * SIZE + HALF;

export function blockCentre(i, j) {
  return [(i - PLAZA_IJ[0]) * SIZE, (j - PLAZA_IJ[1]) * SIZE];
}
// Block indices under a world point (clamped to the grid).
export function blockAt(x, z) {
  const c = (v, k) => Math.max(0, Math.min(GRID - 1, Math.round(v / SIZE) + PLAZA_IJ[k]));
  return [c(x, 0), c(z, 1)];
}
// Which sides of block (i, j) face a neighbour (link street) vs the district edge (wall).
export function neighbourEdges(i, j) {
  const out = [];
  if (j > 0) out.push('N');
  if (i < GRID - 1) out.push('E');
  if (j < GRID - 1) out.push('S');
  if (i > 0) out.push('W');
  return out;
}

// Along-street spans of `edge` from u0 to u1 with every gap on that edge cut out, each gap
// narrowed by `keep` metres at both sides (keep = 2 leaves the gap's sidewalks in the span).
export function cutGaps(gaps, edge, u0, u1, keep = 0) {
  const cuts = gaps.filter((q) => q.edge === edge).map((q) => [q.g - GAP_HALF + keep, q.g + GAP_HALF - keep]).sort((a, b) => a[0] - b[0]);
  const out = [];
  let u = u0;
  for (const [a, b] of cuts) { if (a > u) out.push([u, a]); u = Math.max(u, b); }
  if (u < u1) out.push([u, u1]);
  return out;
}
export function gapAt(gaps, edge, u, pad = 0) {
  return gaps.some((q) => q.edge === edge && Math.abs(u - q.g) < GAP_HALF + pad);
}
