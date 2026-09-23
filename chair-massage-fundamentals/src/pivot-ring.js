// The plaza block's own ring road as a closed loop (centreline 52 m out, perimeter 416 m), for the
// pivot's van route only (pivot.js, pivot-path.js): the van enters from the plaza's ring as it
// always has. AI driving on the district's streets uses the street graph (run/driver.js).
const H = 52;                 // ring centreline half size
const PER = 8 * H;            // perimeter

function modP(s) { return ((s % PER) + PER) % PER; }

// Perimeter parameter of the nearest ring point: N side (z=-H) west->east, E, S east->west, W.
export function ringS(x, z) {
  const cx = Math.max(-H, Math.min(H, x)), cz = Math.max(-H, Math.min(H, z));
  const dN = Math.abs(z + H), dS = Math.abs(z - H), dE = Math.abs(x - H), dW = Math.abs(x + H);
  const m = Math.min(dN, dS, dE, dW);
  if (m === dN) return cx + H;
  if (m === dE) return 2 * H + (cz + H);
  if (m === dS) return 4 * H + (H - cx);
  return 6 * H + (H - cz);
}
export function ringPoint(s, out) {
  s = modP(s);
  if (s < 2 * H) { out.x = s - H; out.z = -H; }
  else if (s < 4 * H) { out.x = H; out.z = s - 3 * H; }
  else if (s < 6 * H) { out.x = 5 * H - s; out.z = H; }
  else { out.x = -H; out.z = 7 * H - s; }
  return out;
}
// Signed shortest perimeter delta from a to b.
export function ringDelta(a, b) {
  let d = modP(b - a);
  if (d > PER / 2) d -= PER;
  return d;
}
// Tangent yaw of travel at s in direction dir (+1 / -1).
export function ringYaw(s, dir) {
  const a = ringPoint(s, { x: 0, z: 0 }), b = ringPoint(s + dir * 1, { x: 0, z: 0 });
  return Math.atan2(b.x - a.x, b.z - a.z);
}

