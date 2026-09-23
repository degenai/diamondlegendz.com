// Pressure meter (W/S) and working spot (A/D) with a hidden, drifting sweet-spot band.
const RATE = 40;       // pressure units per second
const SPOT_RATE = 1.2; // spot units per second
const HINT_SCALE = 1.3;

export function createMeter(bandWidth, rng, pressure = 0) {
  const c = rng.range(35, 60);
  return {
    pressure, spot: 0,
    baseWidth: bandWidth, bandWidth, bandCentre: c, bandTarget: c,
    retarget: rng.range(3, 6), phase: rng.range(0, 6.28), t: 0,
    zone: 'under',
  };
}

export function updateMeter(m, input, dt, rng) {
  m.t += dt;
  if (input) {
    if (input.forward) m.pressure += RATE * dt;
    if (input.back) m.pressure -= RATE * dt;
    if (input.right) m.spot += SPOT_RATE * dt;
    if (input.left) m.spot -= SPOT_RATE * dt;
  }
  m.pressure = Math.max(0, Math.min(100, m.pressure));
  m.spot = Math.max(-1, Math.min(1, m.spot));

  // Slow drift: centre eases toward a target re-rolled every few seconds; width breathes a little.
  m.retarget -= dt;
  if (m.retarget <= 0) {
    const half = m.baseWidth / 2;
    m.bandTarget = Math.max(half + 8, Math.min(92 - half, m.bandCentre + rng.range(-15, 15)));
    m.retarget = rng.range(3, 6);
  }
  const step = 2.5 * dt;
  m.bandCentre += Math.max(-step, Math.min(step, m.bandTarget - m.bandCentre));
  m.bandWidth = m.baseWidth * (1 + 0.12 * Math.sin(m.t * 0.4 + m.phase));

  const lo = m.bandCentre - m.bandWidth / 2, hi = m.bandCentre + m.bandWidth / 2;
  m.zone = m.pressure < lo ? 'under' : m.pressure > hi ? 'over' : 'in';
  return m.zone;
}

// The HUD hint: a zone slightly wider than the true band, so it never gives the exact edges.
export function hintRange(m) {
  const h = (m.bandWidth * HINT_SCALE) / 2;
  return [Math.max(0, m.bandCentre - h), Math.min(100, m.bandCentre + h)];
}
