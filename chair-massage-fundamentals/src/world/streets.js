// Deck (plaza + inner sidewalk), ring road markings, crosswalks, outer sidewalks, the escape
// street through the gap, perimeter walls, and a ring of backdrop buildings outside the block.
import { addBox, addSlab } from './batch.js';
import {
  HALF, PLAZA_HALF, DECK_HALF, ROAD_OUT, DECK_Y, GAP_HALF, ESC_WALL, EDGES,
  toXZ, sideBox, aabb, SIDE,
} from './layout.js';

const PLAZA = 0xc9bca3;
const WALK = 0xb3b0a8;
const KERB = 0xd3d0c8;
const PAINT = 0xe9e6dc;
const DASH = 0xe8c65a;
const BACKDROP = [0x8f7f72, 0x9d9588, 0x7d6a60, 0xa89c86, 0x8a8a84, 0x96806e];

// Side-frame slab: u0..u1 along the street, d0..d1 outward, y0..y1.
function sideSlab(b, edge, u0, u1, d0, d1, y0, y1, color) {
  const box = sideBox(edge, u0, u1, d0, d1, 0);
  addSlab(b, box.minX, box.maxX, box.minZ, box.maxZ, y0, y1, color);
}

export function buildStreets(B) {
  const { batch: b, colliders, esc } = B;

  // Deck: plaza square + inner sidewalk ring, one standable slab collider.
  addSlab(b, -PLAZA_HALF, PLAZA_HALF, -PLAZA_HALF, PLAZA_HALF, 0, DECK_Y, PLAZA);
  for (const e of EDGES) {
    sideSlab(b, e, -DECK_HALF, DECK_HALF, PLAZA_HALF, DECK_HALF - 0.3, 0, DECK_Y, WALK);
    sideSlab(b, e, -DECK_HALF, DECK_HALF, DECK_HALF - 0.3, DECK_HALF, 0, DECK_Y + 0.005, KERB);
  }
  colliders.push(aabb(-DECK_HALF, DECK_HALF, -DECK_HALF, DECK_HALF, DECK_Y, { floor: true, tag: 'deck' }));

  // Outer sidewalks run under the buildings to the block edge (N/S own the corners).
  for (const e of EDGES) {
    const span = e === 'N' || e === 'S' ? HALF : ROAD_OUT;
    const pieces = e === esc.edge
      ? [[-span, esc.g - GAP_HALF + 2], [esc.g + GAP_HALF - 2, span]]
      : [[-span, span]];
    for (const [u0, u1] of pieces) {
      sideSlab(b, e, u0, u1, ROAD_OUT + 0.3, HALF, 0, DECK_Y, WALK);
      sideSlab(b, e, u0, u1, ROAD_OUT, ROAD_OUT + 0.3, 0, DECK_Y + 0.005, KERB);
      colliders.push(sideBox(e, u0, u1, ROAD_OUT, HALF, DECK_Y, { floor: true, tag: 'walk' }));
    }
  }
  // The escape street: sidewalks either side of the 8 m road, running out of the block.
  for (const [u0, u1] of [[esc.g - GAP_HALF, esc.g - GAP_HALF + 2], [esc.g + GAP_HALF - 2, esc.g + GAP_HALF]]) {
    sideSlab(b, esc.edge, u0, u1, HALF, 140, 0, DECK_Y, WALK);
    colliders.push(sideBox(esc.edge, u0, u1, HALF, ESC_WALL, DECK_Y, { floor: true, tag: 'walk' }));
  }

  // Centre dashes on the ring road, skipping crosswalks, corners and the gap mouth.
  const mid = (DECK_HALF + ROAD_OUT) / 2;
  for (const e of EDGES) {
    const yaw = SIDE[e].yaw + Math.PI / 2; // local Z along the street
    for (let u = -46; u <= 46; u += 4) {
      if (Math.abs(u) < 5) continue;
      if (e === esc.edge && Math.abs(u - esc.g) < GAP_HALF) continue;
      const [x, z] = toXZ(e, u, mid);
      addBox(b, 0.15, 0.02, 2, DASH, x, 0.01, z, yaw);
    }
    // Zebra crosswalk at the axis: bars along the street, repeated across the road.
    for (let d = DECK_HALF + 0.6; d < ROAD_OUT - 0.3; d += 0.9) {
      const [x, z] = toXZ(e, 0, d);
      addBox(b, 4, 0.02, 0.45, PAINT, x, 0.01, z, SIDE[e].yaw);
    }
  }
  // Dashes down the escape street.
  const eyaw = SIDE[esc.edge].yaw;
  for (let d = ROAD_OUT + 3; d < 140; d += 4) {
    const [x, z] = toXZ(esc.edge, esc.g, d);
    addBox(b, 0.15, 0.02, 2, DASH, x, 0.01, z, eyaw);
  }
  // Stop line where the escape street meets the ring road.
  {
    const [x, z] = toXZ(esc.edge, esc.g + 2, ROAD_OUT + 0.6);
    addBox(b, 4, 0.02, 0.4, PAINT, x, 0.01, z, eyaw);
  }

  // Invisible perimeter walls at the block edge; pushed out to ESC_WALL along the escape street.
  const W = 2;
  for (const e of EDGES) {
    const pieces = e === esc.edge
      ? [[-HALF - W, esc.g - GAP_HALF], [esc.g + GAP_HALF, HALF + W]]
      : [[-HALF - W, HALF + W]];
    for (const [u0, u1] of pieces) colliders.push(sideBox(e, u0, u1, HALF, HALF + W, Infinity, { invisible: true }));
  }
  const g0 = esc.g - GAP_HALF, g1 = esc.g + GAP_HALF;
  colliders.push(sideBox(esc.edge, g0 - W, g0, HALF, ESC_WALL, Infinity, { invisible: true }));
  colliders.push(sideBox(esc.edge, g1, g1 + W, HALF, ESC_WALL, Infinity, { invisible: true }));
  colliders.push(sideBox(esc.edge, g0 - W, g1 + W, ESC_WALL, ESC_WALL + W, Infinity, { invisible: true }));

  buildBackdrop(B);
}

// Neighbouring blocks: plain massing with ribbon windows, no colliders (the walls stop the player).
function buildBackdrop(B) {
  const { batch: b, rng, esc } = B;
  for (const e of EDGES) {
    const span = e === 'N' || e === 'S' ? 130 : HALF + 4;
    let u = -span;
    while (u < span) {
      const w = Math.min(rng.range(12, 28), span - u);
      const u0 = u, u1 = u + w;
      u = u1 + rng.range(0, 1.5);
      if (e === esc.edge && u1 > esc.g - GAP_HALF - 2 && u0 < esc.g + GAP_HALF + 2) continue;
      if (w < 4) continue;
      const d0 = HALF + 4 + rng.range(0, 5);
      const d1 = d0 + rng.range(12, 30);
      const floors = rng.int(2, 8);
      const h = floors * 3.2;
      const col = BACKDROP[Math.floor(rng.next() * BACKDROP.length)];
      sideSlab(b, e, u0, u1, d0, d1, 0, h, col);
      for (let f = 0; f < floors; f++) {
        sideSlab(b, e, u0 + 1, u1 - 1, d0 - 0.06, d0, f * 3.2 + 1.1, f * 3.2 + 2.4, 0x3a4450);
      }
    }
  }
}
