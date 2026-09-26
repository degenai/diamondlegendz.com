// The crowd takes turns (DESIGN.md "The fight tilts toward Arkham", ruling 2, 2026-09-25): an attack
// token. Only a goon holding a token may wind up on the player on foot; one token, two from the
// van's second wave on (the goon cars' rule, goon-waves.js A.waves). The rest circle at 3 to 4 m,
// face him, and now and then jeer with lines they already have. The token passes to the nearest
// ready goon when the holder is countered or hit (knocked, stunned, treated: no longer eligible),
// when his swing is done (back from recover into his cooldown), or when he has held it HOLD_MAX s
// without winding up (he cannot reach him). The grab window's shoves are wind-ups, so they come
// from the holder; goon-car crews on foot are goons like the rest. Cops are outside it; vehicle
// moves (pull-out, bat on the bodywork, cling) are not wind-ups on foot and are not gated.
// goon.js chase() asks mayWind() before a wind-up and hands a non-holder near him to circle().
import { seek, say } from './npc-common.js';
import { stream } from '../rng.js';

const HOLD_MAX = 5;          // s a holder may keep the token without swinging
const PICK_R = 25;           // m: only goons this close to him can be handed the token
export const CIRCLE_NEAR = 10;   // m: a goon without the token this close circles instead of closing in
const RING = [3, 3.5, 4];    // m: circle radius by goon id, so the ring spreads
const ORBIT = 0.35;          // rad ahead on the ring per target (the circling drift)
const WALK = 2.2, RUN = 5.5;
const JEER_GAP = [6, 10];    // s between jeers, pack-wide
// Their existing lines (goon.js, pivot-lines.js): no new writing.
const JEERS = ['Come with us.', "You're operating without a brand.", 'You should let someone work on you.', "It's a good chair. It deserves a brand."];

const UP = new Set(['chase', 'windup', 'recover']);
const state = (ctx) => ctx.goonTurns || (ctx.goonTurns = { holders: [], t: -1, jeerAt: -1 });
export function tokens(ctx) { return ctx.vanAI && ctx.vanAI.waves >= 2 ? 2 : 1; }

function eligible(e, ctx) {
  return e.kind === 'goon' && !e.boss && !e.removed && ctx.npcs.includes(e) && !(e.knockedT > 0) && !(e.stunT > 0)
    && !e.cling && !e.hold && UP.has(e.state);
}
const d2p = (e, p) => (e.pos.x - p.pos.x) ** 2 + (e.pos.z - p.pos.z) ** 2;

// Once per tick (the first goon to ask runs it): drop holders whose turn is over, fill the slots.
function tick(ctx) {
  const T = state(ctx);
  if (T.t === ctx.time) return T;
  T.t = ctx.time;
  const p = ctx.player;
  T.holders = T.holders.filter((e) => {
    if (e.state === 'windup' || e.state === 'recover') e.turnSwung = true;
    const over = !eligible(e, ctx) || (e.turnSwung && e.state === 'chase') || e.turnDone
      || (e.state === 'chase' && ctx.time - e.turnAt > HOLD_MAX) || d2p(e, p) > PICK_R * PICK_R;
    if (over) { e.turnSwung = false; e.turnDone = false; e.lastTurn = ctx.time; }
    return !over;
  });
  const n = tokens(ctx);
  if (T.holders.length >= n || p.vehicle) return T;
  const ready = ctx.npcs.filter((e) => eligible(e, ctx) && e.state === 'chase' && !(e.cooldown > 0) && !T.holders.includes(e) && d2p(e, p) < PICK_R * PICK_R);
  ready.sort((a, b) => d2p(a, p) - d2p(b, p) || a.id - b.id);
  // The one who just swung waits his turn when anyone else is ready.
  const fresh = ready.filter((e) => ctx.time - (e.lastTurn ?? -1e9) > 0.5);
  for (const e of (fresh.length ? fresh : ready)) {
    if (T.holders.length >= n) break;
    T.holders.push(e); e.turnAt = ctx.time; e.turnSwung = false; e.turnDone = false;
  }
  return T;
}

// goon.js chase(): may this goon wind up now?
export function mayWind(e, ctx) { return tick(ctx).holders.includes(e); }

// The circle: a point on his ring a little ahead of where the goon stands, faced toward the player.
export function circle(e, dt, ctx) {
  const p = ctx.player, T = tick(ctx);
  const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z, d = Math.hypot(dx, dz) || 1;
  const R = RING[e.id % RING.length], dir = e.id % 2 ? 1 : -1;
  const a = Math.atan2(dx, dz) + dir * ORBIT;
  const tx = p.pos.x + Math.sin(a) * R, tz = p.pos.z + Math.cos(a) * R;
  e.speed = d > R + 1.5 ? RUN : WALK;
  seek(e, tx, p.pos.y, tz, dt, ctx, 0.3);
  e.faceX = p.pos.x; e.faceZ = p.pos.z; e.strafe = ctx.tick;   // npc-common.js stepBody: face him while moving
  if (d < R + 1 && ctx.time >= T.jeerAt) {
    const r = stream('goon.jeer');
    if (T.jeerAt >= 0) say(ctx, e, JEERS[Math.floor(r.next() * JEERS.length)]);
    T.jeerAt = ctx.time + JEER_GAP[0] + r.next() * (JEER_GAP[1] - JEER_GAP[0]);
  }
}

// The holders' ids (tests, the snapshot).
export function turnHolders(ctx) { return (ctx.goonTurns ? ctx.goonTurns.holders : []).map((e) => e.id); }
