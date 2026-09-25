// Trigger point is a held click (DESIGN.md "Stroke tracking", ruled 2026-09-25, round two of the
// open-ended Opus): hold left click with the cursor inside the ring while it closes, let go when it
// resets. In trigger point only held-and-inside time counts as on the ring (without the hold it is
// off the ring: half credit), the client says their "Hold it. Don't let go." once per segment after
// NAG_AFTER s of a matched, live trigger point segment without the hold, the ring fills and tightens
// while held (guide.js fillGuide) and pulses green on the reset after a full held close. A full held
// close (FULL of one shrink cycle held inside) is what the guided client's prompt e waits for.
// Swedish and cross-fiber stay mouse-only. session.js owns the calls; this file only says what
// counts as on the ring and when the ring closed.
import { modality } from './guide.js';

export const TP = 'Trigger point';
export const SHRINK = 4;      // s per close: guide.js TRIGGER.shrink
const FULL = 0.9;             // share of a close held inside for it to count as a full held close
const NAG_AFTER = 2;          // s of a matched live trigger point segment without the hold
const PULSE = 0.35;           // s of green on the reset after a full held close

export function createHold() {
  return { held: false, cycle: -1, cycIn: 0, fill: 0, pulseT: 0, closes: 0, closed: false, nagT: 0, nagged: false };
}

// A new segment (or client): the client may say the line once more.
export function resetHoldNag(H) { H.nagT = 0; H.nagged = false; }

// Per session tick, before updateGuide: is the hold on (for the ring's tighten)?
export function holding(H, g, input) {
  H.held = !!(input && input.mouseLeft);
  return H.held && modality(g) === TP;
}

// Per session tick, after updateGuide. Returns whether this tick counts as on the ring for the
// tracking credit. H.closed is true on the tick a full held close ends; H.nag on the tick the client
// should say the line (the caller says it and it is not raised again this segment).
export function holdTick(H, g, dt, inside, live, want) {
  H.pulseT = Math.max(0, H.pulseT - dt);
  H.closed = false; H.nag = false;
  if (modality(g) !== TP) { H.cycle = -1; H.cycIn = 0; H.fill = 0; return inside; }
  const cyc = Math.floor(g.t / SHRINK);
  if (cyc !== H.cycle) {
    if (H.cycle >= 0 && H.cycIn >= FULL * SHRINK) { H.closes++; H.closed = true; H.pulseT = PULSE; }
    H.cycle = cyc; H.cycIn = 0;
  }
  const on = inside && H.held;
  if (on) H.cycIn += dt;
  H.fill = on ? (g.t % SHRINK) / SHRINK : 0;
  if (live && want === TP && !H.held && !H.nagged) {
    H.nagT += dt;
    if (H.nagT >= NAG_AFTER) { H.nagged = true; H.nag = true; }
  }
  return on;
}
