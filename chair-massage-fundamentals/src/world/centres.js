// The plain centres of the fifteen non-plaza blocks (district.js), chosen by the block's seed:
//  parking - the deck is an asphalt lot with painted bays and parked sedans (cars.js turns the
//            spots into parked cars like the kerbside ones);
//  green   - grass, sand paths (axis, diagonals, ring), many trees and benches;
//  square  - grass round a smaller paved square ringed with planters, benches and a few trees.
// All block-local and batched; trees go to the block's shared InstancedMeshes (furniture.js).
import * as THREE from '../../vendor/three.module.js';
import { addBox, addSlab } from './batch.js';
import { planterAt, drawPaths } from './plaza.js';
import { DECK_Y } from './layout.js';

export const CENTRES = ['parking', 'green', 'square'];
const LOT = 0x55575b, GRASS = 0x6f8f4a, SAND = 0xcdbb94, PAVE = 0xc9bca3, PAINT = 0xe6e3da;

// Deck colour and nav flags per kind (the nav is built before the centre, block.js).
export function centreSpec(kind, rng) {
  if (kind === 'parking') return { deckColor: LOT, variant: [], nav: { diag: false, ring: false } };
  if (kind === 'green') return { deckColor: GRASS, variant: ['diag', 'ring'], nav: { diag: true, ring: true } };
  const diag = rng.next() < 0.5;
  return { deckColor: GRASS, variant: diag ? ['diag'] : [], nav: { diag, ring: false } };
}

const CAR_L = 4.4, CAR_W = 1.9;
// Parking bays: in each quadrant two back-to-back pairs of rows along X, cars nose-in along Z.
function buildParking(B) {
  const { batch: b, rng, placer } = B;
  const spots = [];
  const rows = [[11, 1], [17, -1], [30, 1], [36, -1]];   // |z| of the row centre, facing (+1 = toward +|z|)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    for (const [rz, face] of rows) {
      const z = sz * rz;
      for (let ax = 8.5; ax <= 40; ax += 3) {
        const x = sx * ax;
        // Bay lines either side of the bay (a painted T at the aisle end).
        addBox(b, 0.12, 0.02, 5.2, PAINT, x - 1.5, DECK_Y + 0.005, z);
        if (ax + 3 > 40) addBox(b, 0.12, 0.02, 5.2, PAINT, x + 1.5, DECK_Y + 0.005, z);
        if (rng.next() < 0.17) {
          const yaw = (face * sz > 0 ? 0 : Math.PI) + rng.range(-0.04, 0.04);
          spots.push({ pos: new THREE.Vector3(x, DECK_Y, z), yaw, edge: null, lot: true });
          placer.take(x, z, CAR_W + 0.4, CAR_L + 0.4);
        }
      }
    }
    // Wheel-stop kerb between the back-to-back rows.
    for (const rz of [14, 33]) addSlab(b, sx > 0 ? 7 : -41.5, sx > 0 ? 41.5 : -7, sz * rz - 0.1, sz * rz + 0.1, DECK_Y, DECK_Y + 0.1, 0x8d8a84);
  }
  return { spots };
}

function buildGreen(B) {
  drawPaths(B.batch, ['diag', 'ring'], 0, [SAND, SAND, SAND]);
  return { spots: [] };
}

// A 48 m paved square in the middle, planters round its rim (off the walking lines).
function buildSquare(B) {
  const { batch: b, colliders, rng, placer, variant } = B;
  drawPaths(b, variant, 24, [SAND, SAND, SAND]);
  addSlab(b, -24, 24, -24, 24, 0.1, DECK_Y + 0.02, PAVE);
  for (const [x, z] of [[-16, -16], [16, -16], [16, 16], [-16, 16], [-20, -8], [20, 8], [8, -20], [-8, 20], [-20, 8], [20, -8], [8, 20], [-8, -20]]) {
    const w = rng.next() < 0.5 ? 3.2 : 2.2, d = 5.4 - w;
    if (!placer.free(x, z, w, d, 1.3)) continue;
    placer.take(x, z, w, d);
    planterAt(b, colliders, x, z, w, d, rng.range(0.5, 0.75));
  }
  return { spots: [] };
}

// Returns { spots (parking only), furn (counts for buildFurniture) }.
export function buildCentre(kind, B) {
  if (kind === 'parking') return { ...buildParking(B), furn: { carts: [0, 0], benches: [2, 4], trees: [0, 0] } };
  if (kind === 'green') return { ...buildGreen(B), furn: { carts: [0, 1], benches: [10, 14], trees: [18, 26] } };
  return { ...buildSquare(B), furn: { carts: [1, 2], benches: [8, 12], trees: [5, 8] } };
}
