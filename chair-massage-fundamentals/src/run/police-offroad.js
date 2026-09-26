// Cop cars drive the plaza and the alleys too (DESIGN.md "The fight tilts toward Arkham", ruling 4,
// 2026-09-25). A driving police unit (the parks cart, the cop cars, the SWAT van) leaves the street
// graph when the player is off it (not on a carriageway, npc-nav.js isRoad) within RANGE m: it
// joins the pedestrian nav graph (the plaza paths, the walkways through the lots and alleys) at the
// best entry point, follows it toward the nav point nearest him at SPEED m/s, cutting corners when
// the way to a later point is clear for its width, drives straight at him once that is clear, and
// brakes for anyone in its path (goons, cops, peds: van-yield.js yieldStep with its own filter,
// creeping through after 2 s). When he is back on the road (or out of range) it goes back to the
// graph: police-units.js driveUnit resumes its street route. Roadblocks are parked: untouched.
// Watcher: `police` { act: 'offroad' | 'onroad', unit }.
import { isRoad, nearestNav, entryNav, nextHop, navInfo, walkable } from '../entities/npc-nav.js';
import { driveAt } from './driver.js';
import { yieldStep } from './van-yield.js';
import { emit } from '../events.js';

const RANGE = 60;            // m: a player off the road this close pulls the unit off the graph
const SPEED = 6;             // m/s across the plaza
const REACH = 2.5;           // m: a waypoint this close is passed
const SKIP = 4;              // look this many points ahead for a clear straight line
const REGOAL = 0.5;          // s between goal (nearest nav to him) updates
const PEOPLE = new Set(['goon', 'cop', 'ped']);
const people = (e) => PEOPLE.has(e.kind);

// Clear for the vehicle's width: the centre line and both sides at knee height.
function clear(world, v, x, y, z) {
  const dx = x - v.pos.x, dz = z - v.pos.z, d = Math.hypot(dx, dz) || 1;
  const ox = (dz / d) * v.spec.halfW, oz = (-dx / d) * v.spec.halfW, vy = v.pos.y;
  return walkable(world, v.pos.x, vy, v.pos.z, x, y, z)
    && walkable(world, v.pos.x + ox, vy, v.pos.z + oz, x + ox, y, z + oz)
    && walkable(world, v.pos.x - ox, vy, v.pos.z - oz, x - ox, y, z - oz);
}

// Per tick from driveUnit (the unit is driving, not standing down, not bailing). Returns true when
// it drove off the graph this tick (driveUnit then does nothing else).
export function offroadStep(ctx, u, tgt, dt) {
  const v = u.v, world = ctx.world;
  const d = Math.hypot(tgt.x - v.pos.x, tgt.z - v.pos.z);
  const off = world.nav && d <= RANGE && !isRoad(tgt.x, tgt.z);
  if (!off) {
    if (u.off) { u.off = null; emit('police', { act: 'onroad', unit: u.type }); }
    return false;
  }
  const pts = navInfo(world).points;
  let O = u.off;
  if (!O) {
    O = u.off = { goal: -1, wp: -1, regoal: 0 };
    u.yieldTag = 'police';                   // van-yield.js logs `police` { act: 'yield' }
    emit('police', { act: 'offroad', unit: u.type, d: Math.round(d) });
  }
  O.regoal -= dt;
  if (O.goal < 0 || O.regoal <= 0) {
    const g = nearestNav(world, tgt.x, tgt.z, tgt.y);
    if (g !== O.goal) { O.goal = g; O.wp = -1; }
    O.regoal = REGOAL;
  }
  if (O.wp < 0) O.wp = entryNav(world, v.pos.x, v.pos.y, v.pos.z, O.goal);
  // Straight at him once the way is clear; else along the nav points.
  let tx = tgt.x, tz = tgt.z;
  if (!(d < 25 && clear(world, v, tgt.x, tgt.y, tgt.z))) {
    let p = pts[O.wp];
    if (Math.hypot(p.x - v.pos.x, p.z - v.pos.z) < REACH && O.wp !== O.goal) { const n = nextHop(world, O.wp, O.goal); if (n >= 0) O.wp = n; }
    for (let k = 0, w = O.wp; k < SKIP && w !== O.goal; k++) {   // cut the corner when a later point is in plain view
      w = nextHop(world, w, O.goal);
      if (w < 0) break;
      if (clear(world, v, pts[w].x, pts[w].y, pts[w].z)) O.wp = w;
    }
    p = pts[O.wp]; tx = p.x; tz = p.z;
  }
  driveAt(v, tx, tz, SPEED, dt);
  yieldStep(ctx, u, v, dt, people);          // brake for anyone in its path
  return true;
}
