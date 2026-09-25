// Goons versus a vehicle (DESIGN.md RUN, "Goons versus a vehicle", ruled 2026-09-25): moves 1 to 3,
// only ever against the vehicle the player drives (never an AI or empty one).
// 1. Pull-out: a goon without a bat (or any goon in the opening grab window) within reach of the
//    body while it moves under 2 m/s winds up 0.6 s in the shove pose, then the player is out on
//    the road by the driver's door (exitVehicle), knocked down 3 s. The chair stays where it was;
//    the vehicle rolls to a stop driverless. "Out." Cooldown 3 s.
// 2. Bat on bodywork: a bat goon within bat reach of the body while it moves under 6 m/s swings
//    at it: 12 hp, a dent, sparks, a clang and a wobble. 0 hp wrecks it and throws the chair out.
// 3. Cling: a goon within 1 m of the tail of a vehicle moving forward at 2 to 12 m/s jumps on,
//    his rig parented to the body at the tail; 2 hp/s and a camera rumble. A handbrake swerve
//    (|yaw rate| > 1.2 for 0.4 s in all) or a wall hit above 8 m/s throws him off (down 3 s).
//    At most two at once. The player getting out drops them (no knockdown) back into the chase.
// None of this is the player's doing, so none of it counts toward the wanted level: the bat's hp
// is not property damage and a bat or cling wreck is not his wreck (the van's shove rule).
import { boxDistance, dentVehicle } from './vehicle-collide.js';
import { exitVehicle } from './interact.js';
import { throwChair } from './chair.js';
import { say, seek, poseRig, cull, knockdown } from './npc-common.js';
import { floorHeightAt } from '../physics.js';
import { emitChaos } from '../run/wanted.js';
import { burst, shake, rumble, sfx } from '../juice.js';
import { emit } from '../events.js';

const ENGAGE = 10;                        // m from the vehicle's centre: the moves take over the chase
const PULL_SPEED = 2, PULL_REACH = 1.3, PULL_WIND = 0.6, PULL_CD = 3, PULL_KNOCK = 3;
const BAT_SPEED = 6, BAT_REACH = 1.6, BAT_WIND = 0.4, BAT_HP = 12, BAT_CD = 1.5;
const CLING_MIN = 2, CLING_MAX = 12, CLING_R = 1, CLING_DPS = 2, CLING_MOST = 2;
const SWERVE_YAW = 1.2, SWERVE_T = 0.4, THROW_KNOCK = 3;
const CLING_BACK = 0.12, CLING_UP = 0.28, CLING_SLOT = 0.3;  // rig on the tail, vehicle local
const RUMBLE = 0.3, POUND = 0.55;                            // camera trauma floor, s between thumps

const driving = (ctx, v) => !!v && v.driver === ctx.player && !v.removed;
const clingers = (ctx, v) => ctx.npcs.filter((o) => o.cling === v);

// From goon.js chase() while the player is in a vehicle. bat: swings the bat (not in the grab
// window). True when this took the goon's move for the tick.
export function vehicleMoves(e, dt, ctx, bat) {
  const v = ctx.player.vehicle;
  e.vTarget = v;                                      // the strike lands only on this one
  if (!driving(ctx, v) || Math.abs(v.pos.y - e.pos.y) > 1.2) return false;
  const d2 = (v.pos.x - e.pos.x) ** 2 + (v.pos.z - e.pos.z) ** 2;
  if (d2 > ENGAGE * ENGAGE) return false;
  e.noRoad = false;                                   // the road is where the vehicle is
  const T = v.spec, s = Math.sin(v.yaw), c = Math.cos(v.yaw);
  const spd = Math.hypot(v.vel.x, v.vel.z);
  const tx = v.pos.x - s * T.halfL, tz = v.pos.z - c * T.halfL;
  const t2 = (tx - e.pos.x) ** 2 + (tz - e.pos.z) ** 2;
  if (spd >= CLING_MIN && spd <= CLING_MAX && v.speed > 0 && t2 < CLING_R * CLING_R && clingers(ctx, v).length < CLING_MOST) {
    startCling(e, v, ctx);
    return true;
  }
  const bd = boxDistance(v, e.pos.x, e.pos.z);
  if (e.cooldown <= 0 && bat && spd < BAT_SPEED && bd < BAT_REACH) return windup(e, 'bat', BAT_WIND);
  if (e.cooldown <= 0 && !bat && spd < PULL_SPEED && bd < PULL_REACH) return windup(e, 'pull', PULL_WIND);
  // Close in: on a moving vehicle, run for the tail; on a slow one, the driver's door (no bat)
  // or straight at the bodywork (bat, the body's pushout stops him beside it).
  let gx = v.pos.x, gz = v.pos.z;
  if (spd >= PULL_SPEED && !(bat && spd < BAT_SPEED)) { gx = tx - s * 0.5; gz = tz - c * 0.5; }
  else if (!bat) { const off = T.halfW + 0.5; gx = v.pos.x + c * off; gz = v.pos.z - s * off; }
  seek(e, gx, v.pos.y, gz, dt, ctx, 0.2);
  if (!e.wishX && !e.wishZ) { e.faceX = v.pos.x; e.faceZ = v.pos.z; }
  return true;
}

function windup(e, move, t) {
  e.state = 'windup'; e.vmove = move; e.grab = false; e.stateT = t;
  emit('telegraph', { who: 'goon', id: e.id, act: move === 'pull' ? 'pulloutWindup' : 'batWindup', on: 'vehicle', t });   // Jev milestone 0
  e.wishX = e.wishZ = 0; e.speed = 0;
  return true;
}

// From goon.js at the end of a wind-up: true when it was a vehicle move (handled here).
export function vehicleStrike(e, ctx) {
  if (!e.vmove) return false;
  const v = ctx.player.vehicle, pull = e.vmove === 'pull';
  e.state = 'recover'; e.stateT = 0.5;
  e.cooldown = pull ? PULL_CD : BAT_CD;
  if (!pull) emitChaos(ctx, e.pos.x, e.pos.z, 'batSwing');
  if (!driving(ctx, v) || v !== e.vTarget || Math.abs(v.pos.y - e.pos.y) > 1.2) return true;   // he changed cars mid wind-up: nothing lands
  const spd = Math.hypot(v.vel.x, v.vel.z), bd = boxDistance(v, e.pos.x, e.pos.z);
  if (pull && spd < PULL_SPEED + 0.5 && bd < PULL_REACH + 0.4) pullOut(e, v, ctx);
  else if (!pull && spd < BAT_SPEED + 1 && bd < BAT_REACH + 0.4) batHit(e, v, ctx);
  return true;
}

function pullOut(e, v, ctx) {
  const p = ctx.player;
  exitVehicle(p, ctx);                     // driver's door first; v.driver = null, parked/stolen as they were
  p.knockedT = PULL_KNOCK; p.palmT = 0;
  emit('knockdown', { who: 'player', cause: 'pullout', by: 'goon' });
  say(ctx, e, 'Out.');
  shake(ctx, 0.4);
  sfx(ctx, 'thud', p.pos.x, p.pos.z, 0.7);
  emit('goon', { act: 'pullout', vehicle: v.type });
}

function batHit(e, v, ctx) {
  const was = v.hp;
  dentVehicle(v, BAT_HP);
  v.wobbleT = Math.max(v.wobbleT, 0.6);
  v._hpSeen = v.hp;                        // not property damage for the wanted level
  const x = e.pos.x + (v.pos.x - e.pos.x) * 0.35, z = e.pos.z + (v.pos.z - e.pos.z) * 0.35;
  burst(ctx, 'sparks', x, v.pos.y + 0.8, z, 12);
  shake(ctx, 0.35, x, z);
  sfx(ctx, 'clang', x, z, 1);
  emit('vehicle', { act: 'batHit', hp: Math.round(v.hp), type: v.spec.label });
  if (was > 0 && v.hp <= 0) wrecked(v, ctx);
}

// A goon wrecked it: the hard-crash chair rule, and not his wreck for the wanted level.
function wrecked(v, ctx) {
  v.wreckSeen = true;
  if (v.chairLoaded) throwChair(ctx, v);
}

// ---- cling ----
function startCling(e, v, ctx) {
  const taken = clingers(ctx, v).map((o) => o.clingSlot);
  e.clingSlot = taken.includes(-1) ? 1 : -1;
  e.cling = v; e.state = 'cling'; e.fixed = true;
  e.clingAt = ctx.time; e.swerveT = 0; e.poundT = POUND;
  e.vmove = null; e.wishX = e.wishZ = 0; e.speed = 0;
  (v.body || v.mesh).add(e.mesh);
  follow(e, v);
  sfx(ctx, 'thud', e.pos.x, e.pos.z, 0.5);
  emit('goon', { act: 'cling', vehicle: v.type, n: clingers(ctx, v).length });
}

// World position at the tail, so everything else sees him moving with the vehicle; the rig sits
// there in the body's frame, facing +Z (the vehicle's back). Every tick: the tick he jumps on,
// goon.js's stepBody still writes the world position into the mesh after this.
function follow(e, v) {
  const s = Math.sin(v.yaw), c = Math.cos(v.yaw), back = v.spec.halfL + CLING_BACK, side = e.clingSlot * CLING_SLOT;
  e.pos.set(v.pos.x - s * back + c * side, v.pos.y + CLING_UP, v.pos.z - c * back - s * side);
  e.vel.copy(v.vel); e.yaw = v.yaw; e.grounded = true;
  e.mesh.position.set(side, CLING_UP, -back);
  e.mesh.rotation.set(0, 0, 0);
}

// From goon.js every tick while e.cling: the whole update for a clinging goon.
export function clingTick(e, dt, ctx) {
  const v = e.cling;
  if (!driving(ctx, v) || e.knockedT > 0) { letGo(e, ctx, false); return; }
  if (v.handbrake && Math.abs(v.yawRate) > SWERVE_YAW) e.swerveT += dt;
  if (e.swerveT >= SWERVE_T || (v.hardHitT !== undefined && v.hardHitT > e.clingAt)) { letGo(e, ctx, true); return; }
  follow(e, v);
  const was = v.hp;
  v.hp = Math.max(0, v.hp - CLING_DPS * dt); v._hpSeen = v.hp;   // theirs, not his property damage (spawner.js)
  if (was > 0 && v.hp <= 0) wrecked(v, ctx);
  rumble(ctx, RUMBLE);
  e.poundT -= dt;
  if (e.poundT <= 0) { e.poundT = POUND; sfx(ctx, 'thud', e.pos.x, e.pos.z, 0.25); }
  e.pose = 'cling';
  poseRig(e, dt);
  cull(e, ctx);
}

// Off the tail onto the road behind: thrown (knocked down 3 s) or dropped (the player got out).
function letGo(e, ctx, thrown) {
  const v = e.cling, s = Math.sin(v.yaw), c = Math.cos(v.yaw);
  const back = v.spec.halfL + (thrown ? 1.0 : 0.6), side = e.clingSlot * CLING_SLOT;
  const x = v.pos.x - s * back + c * side, z = v.pos.z - c * back - s * side;
  e.cling = null; e.fixed = false; e.state = 'chase'; e.pose = 'walk';
  ctx.scene.add(e.mesh);
  e.pos.set(x, floorHeightAt(x, z, ctx.world.colliders, v.pos.y + 0.3), z);
  e.vel.set(0, 0, 0);
  e.mesh.position.copy(e.pos); e.mesh.rotation.set(0, e.yaw, 0);
  if (!thrown) return;
  knockdown(e, THROW_KNOCK, 'thrown', -s, -c, 3);
  shake(ctx, 0.3);
  sfx(ctx, 'thud', x, z, 0.8);
  emit('goon', { act: 'thrown', vehicle: v.type, swerve: e.swerveT >= SWERVE_T });
}
