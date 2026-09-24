// Shared block dimensions (metres, block centred at origin, +Z south) and side-frame helpers.
// A side frame: u runs along the street, d is the distance outward from the centre.
// Split 2026-09-24 (refactor/split): the street graph's constants and gap helpers are
// street-layout.js, the district grid and block indices district-layout.js.

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

