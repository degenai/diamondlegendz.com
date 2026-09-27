// What a vehicle's tyres are on (DESIGN.md "Driving, three stages", stage 1): 'asphalt' | 'pavers' |
// 'grass', read from the district geometry that is already drawn (no raycasts, no new art). Called
// once per awake vehicle per tick, so it is a few comparisons in block-local coordinates:
//   deck (m <= DECK_HALF, m = max(|lx|, |lz|)): by the block's centre kind (below); its inner
//     sidewalk (PLAZA_HALF..DECK_HALF) is pavers on every block;
//   ring road (DECK_HALF..ROAD_OUT): asphalt;
//   outer sidewalk and the lot band (ROAD_OUT..): pavers (alleys too), except the link and escape
//     streets, whose 8 m roadway (the gap less the 2 m sidewalk kept down each side, streets.js) is
//     asphalt right through, out past the block edge on the escape street.
// Centre kinds: plaza = pavers; parking = asphalt; green = grass but its sand paths (plaza.js
// drawPaths: the axis walks, the diagonals, the ring) = pavers; square = pavers inside |l| <= 24,
// grass outside but its paths (by variant) = pavers.
import { PLAZA_HALF, DECK_HALF, ROAD_OUT, GAP_HALF, RING_R } from './layout.js';
import { blockAt, GRID } from './district-layout.js';

const ROADWAY = GAP_HALF - 2;          // half the gap street's asphalt (streets.js keeps 2 m of sidewalk each side)
const SQUARE_HALF = 24;                // the square's paved middle (centres.js buildSquare)
const DIAG0 = 13, DIAG1 = PLAZA_HALF - 1.5;

// Block parts by grid index (part.index = j * GRID + i), cached on the world.
function partAt(world, x, z) {
  let byIdx = world._surfParts;
  if (!byIdx) {
    byIdx = world._surfParts = [];
    for (const P of world.blocks) byIdx[P.index] = P;
    world._surfPlaza = world.blocks.find((P) => P.kind === 'plaza') || world.blocks[0];
  }
  const [i, j] = blockAt(x, z);
  return byIdx[j * GRID + i] || world._surfPlaza;
}

// The sand paths of plaza.js drawPaths: axis walks 4 m wide from `from` out to PLAZA_HALF, the
// diagonals 3 m wide between 13 and 42.5, the ring at RING_R +- 1.5.
function onPath(ax, az, lx, lz, variant, from) {
  if ((ax <= 2 && az >= from && az <= PLAZA_HALF) || (az <= 2 && ax >= from && ax <= PLAZA_HALF)) return true;
  if (variant.includes('diag')) {
    const along = (ax + az) / 2;
    if (Math.abs(ax - az) <= 1.5 * Math.SQRT2 && along >= DIAG0 && along <= DIAG1) return true;
  }
  if (variant.includes('ring')) {
    const r = Math.hypot(lx, lz);
    if (r >= RING_R - 1.5 && r <= RING_R + 1.5) return true;
  }
  return false;
}

export function surfaceAt(world, x, z) {
  if (!world || !world.blocks || !world.blocks.length) return 'asphalt';
  const P = partAt(world, x, z);
  const lx = x - P.centre[0], lz = z - P.centre[1];
  const ax = Math.abs(lx), az = Math.abs(lz), m = Math.max(ax, az);
  if (m > ROAD_OUT) {
    // N/S own the corners (streets.js): past ROAD_OUT in z it is a N/S side, u along x.
    const ns = az > ROAD_OUT;
    const edge = ns ? (lz < 0 ? 'N' : 'S') : (lx < 0 ? 'W' : 'E');
    const u = ns ? lx : lz;
    const gaps = P.gaps;
    for (let k = 0; k < gaps.length; k++) {
      const q = gaps[k];
      if (q.edge === edge && Math.abs(u - q.g) <= ROADWAY) return 'asphalt';
    }
    return 'pavers';
  }
  if (m > DECK_HALF) return 'asphalt';
  if (m > PLAZA_HALF) return 'pavers';
  const kind = P.kind;
  if (kind === 'plaza') return 'pavers';
  if (kind === 'parking') return 'asphalt';
  const variant = (P.layout && P.layout.variant) || [];
  if (kind === 'green') return onPath(ax, az, lx, lz, variant, 0) ? 'pavers' : 'grass';
  if (kind === 'square') {
    if (m <= SQUARE_HALF) return 'pavers';
    return onPath(ax, az, lx, lz, variant, SQUARE_HALF) ? 'pavers' : 'grass';
  }
  return 'pavers';
}
