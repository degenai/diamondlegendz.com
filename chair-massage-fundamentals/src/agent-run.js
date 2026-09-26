// The RUN half of CMF.agent's hands (DESIGN.md "Playtesting with Jev", milestone 3; docs/playtest-jev.md
// 4a): the on-foot and driving macros a model picks from, and the code reflexes behind the ones Jev
// cannot do itself (bearings, routes, steering). A reflex runs before every stepped tick until its
// ticks run out, it arrives, or the next decision cancels it: `goto` points the camera at a target
// and holds W (+Shift), the exit target being a carrot on the ped nav graph (a straight line to an
// exit 400 m off runs into a wall); `drive` follows the street graph (run/driver.js planRoute) with
// digital A/D/W/S, backing up when stuck. Everything is a key or a mouse move a player could make.
import { heading, bearing } from './session-log.js';
import { chairWorldPos } from './entities/chair.js';
import { navInfo, nearestNav, nextHop, walkable } from './entities/npc-nav.js';
import { planRoute } from './run/driver.js';
import { nearestNode } from './world/roads.js';

const MOUSE_SENS = 0.0025;
const RAD = Math.PI / 180;
function wrap(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }

// Macros that run under the usual interrupts (a telegraph, a call, a knockdown...): the loop steps
// them with the default stopOn so a wind-up mid-walk still reaches the model. The rest run whole.
export const INTERRUPTIBLE = new Set(['walk_fwd_1s', 'sprint_fwd_2s', 'back_off_1s', 'strafe_left_1s', 'strafe_right_1s',
  'go_to_chair', 'go_to_car', 'run_to_exit', 'drive_fwd_2s', 'drive_fwd_left_1s', 'drive_fwd_right_1s', 'brake_reverse_1s',
  'face_exit_steer', 'drive_to_chair', 'hold_E_massage', 'keep_massaging', 'load_chair', 'pick_up_chair']);

export function createRunHands(ctx, io) {
  const R = { reflex: null, held: new Set() };
  const setKeys = (want) => {
    for (const k of [...R.held]) if (!want.includes(k)) { io.key(k, false); R.held.delete(k); }
    for (const k of want) if (!R.held.has(k)) { io.key(k, true); R.held.add(k); }
  };
  function stop() { setKeys([]); R.reflex = null; }
  const escape = () => { const e = ctx.world.spawns && ctx.world.spawns.escape; return e ? e.centre : null; };
  const chairAt = () => { const c = chairWorldPos(ctx); return c ? { x: c.x, z: c.z } : null; };
  // A chair loaded in a vehicle: the spot just outside its rack or trunk, 1 m out from the vehicle's
  // centre through the chair, so the walk ends beside the chair instead of against the bodywork.
  const chairTakeSpot = () => {
    const c = chairWorldPos(ctx), v = ctx.world.chairState && ctx.world.chairState.vehicle;
    if (!c || !v) return c ? { x: c.x, z: c.z } : null;
    const dx = c.x - v.pos.x, dz = c.z - v.pos.z, d = Math.hypot(dx, dz) || 1;
    return { x: c.x + (dx / d) * 1.0, z: c.z + (dz / d) * 1.0 };
  };
  // The car to walk to: the one holding the chair when it is parked, else the nearest takeable. The
  // target is its driver's door (the side exitVehicle uses first), not the centre: at the rack or
  // the trunk E takes the chair out instead of getting in (2026-09-25.9).
  function takeable() {
    const cv = ctx.world.chairState && ctx.world.chairState.where === 'vehicle' ? ctx.world.chairState.vehicle : null;
    if (cv && !cv.driver && !cv.removed) return door(cv);
    const v = nearestFree();
    return v ? door(v) : null;
  }
  function door(v) {
    const side = ((v.spec && v.spec.halfW) || 1) + 0.6, s = Math.sin(v.yaw), c = Math.cos(v.yaw);
    return { x: v.pos.x + c * side, z: v.pos.z - s * side };
  }
  function nearestFree() {
    const p = ctx.player; let best = null, bd = Infinity;
    for (const v of ctx.world.vehicles || []) {
      if (v.removed || (v.driver && !(v.civilian && Math.abs(v.speed) < 3))) continue;
      const d = (v.pos.x - p.pos.x) ** 2 + (v.pos.z - p.pos.z) ** 2;
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }
  // A walkable carrot toward (gx, gz) along the ped nav graph: the farthest of the next hops the
  // player can walk straight to. Straight at the goal once it is close and in the clear.
  function navCarrot(gx, gz) { return navCarrotFrom(ctx.player.pos, gx, gz); }
  function navCarrotFrom(p0, gx, gz) {
    const W = ctx.world, p = { pos: p0 }, info = navInfo(W);
    if (Math.hypot(gx - p.pos.x, gz - p.pos.z) < 25 && walkable(W, p.pos.x, p.pos.y, p.pos.z, gx, p.pos.y, gz)) return { x: gx, z: gz };
    const goal = nearestNav(W, gx, gz);
    let k = nearestNav(W, p.pos.x, p.pos.z, p.pos.y), best = info.points[k];
    for (let i = 0; i < 8; i++) {
      const n = nextHop(W, k, goal);
      if (n < 0 || n === k) break;
      k = n; const q = info.points[k];
      if (!walkable(W, p.pos.x, p.pos.y, p.pos.z, q.x, q.y, q.z)) break;
      best = q;
    }
    return best;
  }

  function goto(target, ticks, { sprint = true, stopAt = 1.2 } = {}) {
    R.reflex = { kind: 'goto', target, until: ctx.tick + ticks, sprint, stopAt };
    return ticks;
  }
  function drive(goal, ticks) {
    R.reflex = { kind: 'drive', goal, until: ctx.tick + ticks, plan: null, planAt: -1e9, stuck: 0, back: 0 };
    return ticks;
  }

  function gotoTick(F) {
    const p = ctx.player;
    if (p.vehicle || p.massaging) return stop();
    const T = F.target();
    if (!T) return stop();
    if (Math.hypot(T.x - p.pos.x, T.z - p.pos.z) < F.stopAt) return stop();
    const b = bearing(heading(p), p.pos.x, p.pos.z, T.x, T.z);
    if (Math.abs(b) > 2) io.look((b * RAD) / MOUSE_SENS);
    setKeys(F.sprint ? ['KeyW', 'ShiftLeft'] : ['KeyW']);
  }

  // Where the car sits on the route polyline: the along-distance of its projection and how far off.
  function project(P, x, z) {
    let best = { s: 0, off: Infinity, x: P.pts[0].x, z: P.pts[0].z };
    for (let i = 1; i < P.pts.length; i++) {
      const A = P.pts[i - 1], B = P.pts[i], ex = B.x - A.x, ez = B.z - A.z, l2 = ex * ex + ez * ez || 1;
      const t = Math.max(0, Math.min(1, ((x - A.x) * ex + (z - A.z) * ez) / l2));
      const qx = A.x + ex * t, qz = A.z + ez * t, off = Math.hypot(qx - x, qz - z);
      if (off < best.off) best = { s: P.cum[i - 1] + t * Math.sqrt(l2), off, x: qx, z: qz };
    }
    return best;
  }
  function along(P, d) {
    let i = 1;
    while (i < P.pts.length - 1 && P.cum[i] < d) i++;
    const A = P.pts[i - 1], B = P.pts[i], L = P.cum[i] - P.cum[i - 1] || 1, t = Math.max(0, Math.min(1, (d - P.cum[i - 1]) / L));
    return { x: A.x + (B.x - A.x) * t, z: A.z + (B.z - A.z) * t };
  }

  // Pure pursuit on the street-graph route with keys: a carrot 9 m along the route past the car's
  // projection (off the streets, as on the plaza, a carrot on the ped walkways toward the route
  // instead); A/D when it is off the nose, W up to a speed that drops with the turn and never tops
  // 11 m/s (an impact over 12 throws a loaded chair out), S to brake over it; stuck 1 s, reverse.
  function driveTick(F) {
    const v = ctx.player.vehicle;
    if (!v) return stop();
    const G = ctx.world.roads, goal = F.goal();
    if (!G || !goal) return stop();
    if (ctx.tick - F.planAt >= 30 || !F.plan) { F.plan = planRoute(v, G, nearestNode(G, goal.x, goal.z)); F.planAt = ctx.tick; }
    const P = F.plan, pr = project(P, v.pos.x, v.pos.z);
    let c = pr.off > 8 ? navCarrotFrom(v.pos, pr.x, pr.z) : along(P, pr.s + 9);
    if (Math.hypot(goal.x - v.pos.x, goal.z - v.pos.z) < 30 || pr.s >= P.total - 2) c = goal;
    const err = wrap(Math.atan2(c.x - v.pos.x, c.z - v.pos.z) - v.yaw), spd = v.speed || 0;
    if (F.back > 0) { F.back--; setKeys(['KeyS', err > 0 ? 'KeyD' : 'KeyA']); return; }
    const steer = err > 0.06 ? 'KeyA' : err < -0.06 ? 'KeyD' : null;
    const want = Math.abs(err) > 0.7 ? 4 : Math.abs(err) > 0.3 ? 7 : pr.off > 8 ? 6 : 11;
    const keys = steer ? [steer] : [];
    if (spd < want) keys.push('KeyW'); else if (spd > want + 2) keys.push('KeyS');
    if (keys.includes('KeyW') && Math.abs(spd) < 0.6) F.stuck++; else F.stuck = Math.max(0, F.stuck - 2);
    if (F.stuck > 60) { F.stuck = 0; F.back = 48; }
    setKeys(keys);
  }

  return {
    get reflex() { return R.reflex && R.reflex.kind; },
    // Before each stepped tick.
    tick() {
      const F = R.reflex;
      if (!F) return;
      if (ctx.tick >= F.until) return stop();
      if (F.kind === 'goto') gotoTick(F); else driveTick(F);
    },
    stop,
    // id -> ticks, or undefined when the id is not a reflex macro (agent.js has the plain keys).
    macro(id, s) {
      switch (id) {
        // A chair loaded in a vehicle is taken from its rack or trunk (TAKE_DIST 1.5 m, and nearer than the
        // car's body): walk right up to it.
        case 'go_to_chair': return s.p && s.p.chair === 'vehicle' ? goto(chairTakeSpot, 90, { stopAt: 0.3 }) : goto(chairAt, 90, { stopAt: 1.4 });
        case 'go_to_car': return goto(takeable, 90, { stopAt: 0.5 });
        case 'run_to_exit': return goto(() => { const e = escape(); return e && navCarrot(e.x, e.z); }, 120, { stopAt: 0.6 });
        case 'face_exit_steer': return drive(escape, 120);
        case 'drive_to_chair': return drive(chairAt, 120);
        default: return undefined;
      }
    },
  };
}
