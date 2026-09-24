// ---- District (feature/district): a GRID x GRID tiling of the block (layout.js). Block (i, j) is
// centred at ((i - PLAZA_IJ[0]) * SIZE, (j - PLAZA_IJ[1]) * SIZE), so the plaza block keeps the
// origin (every plaza coordinate, the pivot and the chair are unchanged) and the district runs
// mostly away from it, +X / +Z. Neighbours meet lot-back to lot-back at the block edges; LINK
// streets (a GAP_HALF gap at u = 0 on every interior side) join their ring roads.
import { SIZE, HALF } from './layout.js';

export const GRID = 4;
export const PLAZA_IJ = [1, 1];
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

// The escape block: the grid corner farthest from the plaza block (district.js).
export function escapeCorner() {
  return [PLAZA_IJ[0] < GRID / 2 ? GRID - 1 : 0, PLAZA_IJ[1] < GRID / 2 ? GRID - 1 : 0];
}
