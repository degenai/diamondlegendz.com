// Hostile NPCs, the vocabulary the goons, the cops, the Healing Palm and the mini-massage share:
// who counts as a threat right now (hostile, copHostile), the goon pack's shared memory and its
// radio alert (pack, alertPack), and what a hit does to the player (hurtPlayer). Split out of
// goon.js, cop.js and palm.js (refactor/split) so goon.js, palm.js, interact.js and
// run/minimassage.js stop importing each other in a ring. Its one import from that ring, palm.js
// (cancelCharge), imports nothing back.
import { cancelCharge, SHAKE } from './palm.js';
import { emit } from '../events.js';

const ALERT_GO = 75;         // radioed to a spot (alertPack): they keep going the long way round
export const PERCEIVE = new Set(['chase', 'windup', 'recover', 'search', 'return']);

// A goon who is a threat: up and on him (chasing, winding up a swing, recovering from one).
export function hostile(e) {
  return e.knockedT <= 0 && (e.state === 'chase' || e.state === 'windup' || e.state === 'recover');
}

// A cop who is a threat: up, on duty, chasing.
export function copHostile(e) {
  return e.knockedT <= 0 && !e.standDown && e.state === 'chase';
}

// The pack's shared memory lives on ctx (spawner.js clears it with each run).
export function pack(ctx) {
  return ctx.goonPack || (ctx.goonPack = { seen: null, saidFor: -1 });
}

// Word comes in over the radio (minimassage.js, the chair drawing attention): every goon up and
// working who is not on him already runs to (x, z) and searches there. Returns how many.
export function alertPack(ctx, x, y, z) {
  const L = { x, y, z, t: ctx.time };
  pack(ctx).seen = { ...L };
  let n = 0;
  for (const o of ctx.npcs) {
    if (o.kind !== 'goon' || o.knockedT > 0 || !PERCEIVE.has(o.state) || o.state === 'windup' || o.state === 'recover') continue;
    if (o.state === 'chase' && o.sees) continue;
    o.lastSeen = { ...L };
    o.state = 'search'; o.phase = 'go'; o.stateT = ALERT_GO; o.alerted = true; o.idle = false;
    o.seek.nav = -1; o.seek.t = 0;
    n++;
  }
  return n;
}

// Damage the player (goon bat / shove). knockT > 0 knocks them down.
export function hurtPlayer(ctx, dmg, knockT, dirX, dirZ, push, src = 'hit') {
  const p = ctx.player;
  if (p.vehicle) return;
  p.hurtSrc = src;                            // the watcher's damage event names it (updateHealth)
  if (knockT > 0 && !(p.knockedT > 0)) emit('knockdown', { who: 'player', cause: src });
  p.hp = Math.max(0, p.hp - dmg);
  p.hurtAt = ctx.time;
  if (knockT > 0) { p.knockedT = Math.max(p.knockedT, knockT); p.palmT = 0; }
  if (dmg > 0) cancelCharge(p, src);            // the wind-up is the risk
  p.vel.x += dirX * push; p.vel.z += dirZ * push;
  p.shakeT = SHAKE;
}
