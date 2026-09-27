// The automatic gearbox (DESIGN.md "Driving, three stages", stage 2). Pure functions on the vehicle
// plain object; no randomness, no audio (vehicle.js fires the shift sfx on the returned shift).
// Per type in vehicle-types.js: `shifts` = the upshift points as fractions of maxSpeed (one fewer
// than `gears`, short low gears), `gearMul` = the torque multiplier per gear (a hard first, a tall top).
// Gear k's band runs from shifts[k-2] (0 for first) to shifts[k-1] (1 for the top gear).
export const SHIFT_DIP = 0.25;     // s of no drive on an upshift
export const DOWN_HYST = 0.08;     // downshift this far (fraction of maxSpeed) below the previous point
export const RPM_IDLE = 0.1, RPM_LO = 0.25, RPM_DIP = 0.35;
const RPM_DIP_RATE = 12;           // 1/s, the note falling toward RPM_DIP through the dip
export const ORDINALS = ['', '1st', '2nd', '3rd', '4th', '5th', '6th'];
export const ordinal = (g) => ORDINALS[g] || `${g}th`;

export function gearCount(T) { return T.gears || ((T.shifts && T.shifts.length + 1) || 1); }
// Grass keeps you a gear down (never below first); pavers and asphalt get them all.
export function maxGearOn(T, surface) {
  const n = gearCount(T);
  return surface === 'grass' ? Math.max(1, n - 1) : n;
}
export function gearBand(T, gear) {
  const S = T.shifts || [], n = gearCount(T);
  return [gear <= 1 ? 0 : S[gear - 2], gear >= n ? 1 : S[gear - 1]];
}
// Position within the current gear's band, 0..1 (by speed as a fraction of maxSpeed).
export function bandPos(T, gear, vf) {
  const [lo, hi] = gearBand(T, gear);
  const f = Math.max(0, vf) / T.maxSpeed;
  return Math.min(1, Math.max(0, (f - lo) / Math.max(1e-6, hi - lo)));
}
// Torque in the gear: 0.7 at the band's low end, 1.0 at 60% of it, 0.8 at the shift point; times
// the gear's multiplier.
export function torque(T, gear, vf) {
  const p = bandPos(T, gear, vf);
  const t = p < 0.6 ? 0.7 + 0.3 * (p / 0.6) : 1.0 - 0.2 * ((p - 0.6) / 0.4);
  const M = T.gearMul;
  return t * (M && M[gear - 1] !== undefined ? M[gear - 1] : 1);
}

export function resetGear(v) { v.gear = 1; v.shiftT = 0; v.rpm = RPM_IDLE; }

// Once per tick before the drive: counts the dip down, then shifts at most one gear.
// Returns +1 (upshift), -1 (downshift) or 0.
export function stepGear(v, vf, dt, driven, surface) {
  const T = v.spec;
  if (!(v.gear >= 1)) resetGear(v);
  if (v.shiftT > 0) v.shiftT = Math.max(0, v.shiftT - dt);
  const S = T.shifts || [], f = vf / T.maxSpeed, cap = maxGearOn(T, surface);
  if (v.gear > cap) { v.gear--; return -1; }                            // onto grass in top: down one, no dip
  if (v.gear > 1 && f < S[v.gear - 2] - DOWN_HYST) { v.gear--; return -1; }
  if (driven && v.gear < cap && f >= S[v.gear - 1]) { v.gear++; v.shiftT = SHIFT_DIP; return 1; }
  return 0;
}

// The engine note (audio-wire.js): position in the gear's band mapped RPM_LO..1, idle at a standstill,
// falling toward RPM_DIP through the shift dip. Reverse reads |vf| against maxReverse.
export function stepRpm(v, vf, dt, throttle) {
  const T = v.spec;
  if (v.shiftT > 0) { v.rpm += (RPM_DIP - v.rpm) * (1 - Math.exp(-RPM_DIP_RATE * dt)); return v.rpm; }
  if (Math.abs(vf) < 0.3 && !throttle) v.rpm = RPM_IDLE;
  else if (vf < 0) v.rpm = RPM_LO + (1 - RPM_LO) * Math.min(1, -vf / (T.maxReverse || T.maxSpeed));
  else v.rpm = RPM_LO + (1 - RPM_LO) * bandPos(T, v.gear, vf);
  return v.rpm;
}
