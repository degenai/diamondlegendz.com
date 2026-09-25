// The van brakes for its own people (ruled 2026-09-25, "the van avoids its own people"): after the
// van driver (van-ai.js) has written v.ai for this tick, a goon or a cop standing in its path
// (a cone ahead of the nose on v.yaw) turns that into a stop; after YIELD_MAX s of waiting it
// creeps through at CREEP m/s. The contact never knocks them down (vehicle-collide.js spares);
// the body circles still push them aside. Any vehicle flagged v.spares = 'goons' with an AI
// driver can use it: the goon cars (goon-car.js) pass their chase state, with yieldTag 'goon' and
// car (their number) for the event.
import { spares } from '../entities/vehicle-collide.js';
import { emit } from '../events.js';

const AHEAD = 6;             // m ahead of the nose, at a crawl
const STOP_DECEL = 14;       // m/s^2 braking with the handbrake on: the cone grows with speed
const AHEAD_MAX = 16;
const SIDE = 0.8;            // m beyond the van's half-width either side
const YIELD_MAX = 2;         // s waiting before it creeps through
const CREEP = 1.5;           // m/s
const YIELD_LOG = 10;        // s between `van yield` events at most

// The first spared body in the van's path, or null.
export function inPath(v, npcs) {
  const s = Math.sin(v.yaw), c = Math.cos(v.yaw), sp = Math.max(0, v.speed || 0);
  const reach = v.spec.halfL + Math.min(AHEAD_MAX, AHEAD + (sp * sp) / (2 * STOP_DECEL));
  for (const e of npcs) {
    if (e.cling || e.fixed || !spares(v, e) || Math.abs(e.pos.y - v.pos.y) > 1.5) continue;
    const dx = e.pos.x - v.pos.x, dz = e.pos.z - v.pos.z;
    const f = dx * s + dz * c, l = dx * c - dz * s;
    if (f > 0 && f < reach && Math.abs(l) < v.spec.halfW + SIDE + (e.radius || 0.4)) return e;
  }
  return null;
}

// A = ctx.vanAI (or any object to keep the wait on), v the vehicle. Call after its driver has
// written v.ai this tick.
export function yieldStep(ctx, A, v, dt) {
  const a = v.ai;
  if (!a || !v.driver || v.driver.kind !== 'aiDriver' || v.spares !== 'goons') return;
  const wants = a.throttle > 0.05 && v.speed > -0.4;        // going forward (not backing, not braked)
  const e = wants || v.speed > 0.4 ? inPath(v, ctx.npcs || []) : null;
  if (!e) { A.yieldT = 0; A.yielding = false; return; }
  A.yieldT = (A.yieldT || 0) + dt;
  if (!A.yielding) {
    A.yielding = true;
    if (ctx.time - (A.yieldLogT ?? -1e9) >= YIELD_LOG) {
      A.yieldLogT = ctx.time;
      emit(A.yieldTag || 'van', { act: 'yield', who: e.kind, speed: Math.round(v.speed * 10) / 10, ...(A.car ? { car: A.car } : {}) });
    }
  }
  if (A.yieldT < YIELD_MAX) {
    a.throttle = v.speed > 0.4 ? -1 : 0;
    a.handbrake = true;
  } else {
    a.throttle = Math.max(-1, Math.min(0.6, (CREEP - v.speed) * 0.6));
    a.handbrake = false;
  }
}
