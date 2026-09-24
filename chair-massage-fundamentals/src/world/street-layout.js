// The street graph's shared numbers and helpers: the ring road centreline, where link streets
// cross the lots, lane direction, and the gaps (link and escape streets) cut into a block side.
import { DECK_HALF, ROAD_OUT, GAP_HALF, SIDE } from './layout.js';

export const RING_C = (DECK_HALF + ROAD_OUT) / 2;   // ring road centreline (52)
export const LINK_U = 0;                            // link streets run through the lots at u = 0

// Direction of traffic on the outer lane of a side (right-hand traffic).
export function laneForward(edge) {
  const [ox, oz] = SIDE[edge].out;
  return [oz, -ox];
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
