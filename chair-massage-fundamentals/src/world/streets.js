// Deck (centre + inner sidewalk), ring road markings, crosswalks, outer sidewalks cut at every
// gap (link streets to the neighbours, the escape street), the escape street's own sidewalks and
// walls, and the perimeter walls on the sides that face the district edge. Block-local coords.
// The backdrop ring outside the district is district.js's.
import { addBox, addSlab } from './batch.js';
import {
  HALF, PLAZA_HALF, DECK_HALF, ROAD_OUT, DECK_Y, GAP_HALF, ESC_WALL, EDGES,
  toXZ, sideBox, aabb, SIDE, cutGaps, gapAt,
} from './layout.js';

const PLAZA = 0xc9bca3;
const WALK = 0xb3b0a8;
const KERB = 0xd3d0c8;
const PAINT = 0xe9e6dc;
const DASH = 0xe8c65a;
export const BACKDROP = [0x8f7f72, 0x9d9588, 0x7d6a60, 0xa89c86, 0x8a8a84, 0x96806e];

// Side-frame slab: u0..u1 along the street, d0..d1 outward, y0..y1.
export function sideSlab(b, edge, u0, u1, d0, d1, y0, y1, color) {
  const box = sideBox(edge, u0, u1, d0, d1, 0);
  addSlab(b, box.minX, box.maxX, box.minZ, box.maxZ, y0, y1, color);
}

export function buildStreets(B) {
  const { batch: b, colliders, gaps, esc } = B;

  // Deck: centre square + inner sidewalk ring, one standable slab collider.
  addSlab(b, -PLAZA_HALF, PLAZA_HALF, -PLAZA_HALF, PLAZA_HALF, 0, DECK_Y, B.deckColor ?? PLAZA);
  for (const e of EDGES) {
    sideSlab(b, e, -DECK_HALF, DECK_HALF, PLAZA_HALF, DECK_HALF - 0.3, 0, DECK_Y, WALK);
    sideSlab(b, e, -DECK_HALF, DECK_HALF, DECK_HALF - 0.3, DECK_HALF, 0, DECK_Y + 0.005, KERB);
  }
  colliders.push(aabb(-DECK_HALF, DECK_HALF, -DECK_HALF, DECK_HALF, DECK_Y, { floor: true, tag: 'deck' }));

  // Outer sidewalks run under the buildings to the block edge (N/S own the corners). Each gap
  // keeps a 2 m sidewalk down both sides of its street.
  for (const e of EDGES) {
    const span = e === 'N' || e === 'S' ? HALF : ROAD_OUT;
    for (const [u0, u1] of cutGaps(gaps, e, -span, span, 2)) {
      sideSlab(b, e, u0, u1, ROAD_OUT + 0.3, HALF, 0, DECK_Y, WALK);
      sideSlab(b, e, u0, u1, ROAD_OUT, ROAD_OUT + 0.3, 0, DECK_Y + 0.005, KERB);
      colliders.push(sideBox(e, u0, u1, ROAD_OUT, HALF, DECK_Y, { floor: true, tag: 'walk' }));
    }
  }
  // The escape street: sidewalks either side of the 8 m road, running out of the block.
  if (esc) {
    for (const [u0, u1] of [[esc.g - GAP_HALF, esc.g - GAP_HALF + 2], [esc.g + GAP_HALF - 2, esc.g + GAP_HALF]]) {
      sideSlab(b, esc.edge, u0, u1, HALF, 140, 0, DECK_Y, WALK);
      colliders.push(sideBox(esc.edge, u0, u1, HALF, ESC_WALL, DECK_Y, { floor: true, tag: 'walk' }));
    }
  }

  // Centre dashes on the ring road, skipping crosswalks, corners and the gap mouths.
  const mid = (DECK_HALF + ROAD_OUT) / 2;
  for (const e of EDGES) {
    const yaw = SIDE[e].yaw + Math.PI / 2; // local Z along the street
    for (let u = -46; u <= 46; u += 4) {
      if (Math.abs(u) < 5) continue;
      if (gapAt(gaps, e, u)) continue;
      const [x, z] = toXZ(e, u, mid);
      addBox(b, 0.15, 0.02, 2, DASH, x, 0.01, z, yaw);
    }
    // Zebra crosswalk at the axis: bars along the street, repeated across the road.
    for (let d = DECK_HALF + 0.6; d < ROAD_OUT - 0.3; d += 0.9) {
      const [x, z] = toXZ(e, 0, d);
      addBox(b, 4, 0.02, 0.45, PAINT, x, 0.01, z, SIDE[e].yaw);
    }
  }
  // Dashes down each gap street (a link street's other half is the neighbour's), and a stop line
  // where it meets the ring road.
  for (const q of gaps) {
    const eyaw = SIDE[q.edge].yaw;
    const end = q.kind === 'escape' ? 140 : HALF;
    for (let d = ROAD_OUT + 3; d < end; d += 4) {
      const [x, z] = toXZ(q.edge, q.g, d);
      addBox(b, 0.15, 0.02, 2, DASH, x, 0.01, z, eyaw);
    }
    const [x, z] = toXZ(q.edge, q.g + 2, ROAD_OUT + 0.6);
    addBox(b, 4, 0.02, 0.4, PAINT, x, 0.01, z, eyaw);
  }

  // Invisible walls on the sides facing the district edge; pushed out to ESC_WALL along the
  // escape street. Sides facing a neighbour have none (its lots are the wall).
  const W = 2;
  for (const e of B.wallEdges || []) {
    for (const [u0, u1] of cutGaps(gaps, e, -HALF, HALF)) colliders.push(sideBox(e, u0, u1, HALF, HALF + W, Infinity, { invisible: true }));
  }
  if (esc) {
    const g0 = esc.g - GAP_HALF, g1 = esc.g + GAP_HALF;
    colliders.push(sideBox(esc.edge, g0 - W, g0, HALF, ESC_WALL, Infinity, { invisible: true }));
    colliders.push(sideBox(esc.edge, g1, g1 + W, HALF, ESC_WALL, Infinity, { invisible: true }));
    colliders.push(sideBox(esc.edge, g0 - W, g1 + W, ESC_WALL, ESC_WALL + W, Infinity, { invisible: true }));
  }
}
