// PIVOT (DESIGN.md "Phases of a session"): about 20 s, all in world space. The black van leaves
// vanEntry, drives along the road and onto the plaza (grid path over the colliders, driven by
// run/driver.js), stops about 8 m from the chair; three goons get out and say their lines in
// bubbles; the ranger jogs in from the sidewalk and sides with them. Mid-sentence, controls
// unlock: RUN begins, the course HUD tears off, the client walks off, the camera blends into
// the third-person view, and the goons start pursuing 1.5 s later.
// The lines read the record (pivot-lines.js); on the third run and some late ones the passenger
// door opens too. Every pivot that reaches the van stop is a viewing (meta.pivotsSeen); ten earn
// the skipPivot hall pass, and with it a key or click during the drive-up cuts to the stop (pivot-skip.js).
import * as THREE from '../vendor/three.module.js';
import * as stage from './massage/stage.js';
import { STATES, setState } from './state.js';
import { updateVehicle } from './entities/vehicle.js';
import { driveAt, brake, followPoly } from './run/driver.js';
import { ringS, ringPoint, ringYaw, ringDelta } from './pivot-ring.js';
import { clear as clearSpawner } from './run/spawner.js';
import { spawnGoons } from './run/goon-waves.js';
import { seek, stepBody, poseRig } from './entities/npc-common.js';
import { say as bubble } from './bubbles.js';
import * as massage from './massage/index.js';
import { planVanPath, planEntry, buildPoly } from './pivot-path.js';
import { pivotLines } from './pivot-lines.js';
import { spawnBoss, dropBoss, hideSkip, spawnRanger, pivotCamera } from './pivot-cast.js';
import { showDriveSkip, checkDriveSkip } from './pivot-skip.js';
import { has, save as saveMeta } from './meta.js';
import { emit } from './events.js';

const STOP_AT = 8;          // metres from the chair
const CRUISE = 12;
const RING_CRUISE = 16;
const DRIVE_MAX = 20;       // seconds before the van just stops where it is
const RUN_BLEND = 1.2;
const PURSUE_AFTER = 1.5;
const HANG_LINE = "I'm calling this in.";   // the ranger hangs back at the chair (police.js)
const LINE_GAP = 0.2;                        // goon lines follow each other; one voice each

const _a = new THREE.Vector3();

let P = null;

export function pivotState() { return P; }

// The pursuing crew; the boss is a goon-kind NPC too but never one of them.
function goons(ctx) { return ctx.npcs.filter((e) => e.kind === 'goon' && !e.boss); }

export function start(ctx) {
  clearSpawner(ctx);
  stage.removeLeaver(massage.station(), ctx.scene); // no frozen leaver from a prior pivot (the stage, not ctx.station)
  const world = ctx.world, chair = world.chairSpot, cam = ctx.camera;
  const van = world.vehicles && world.vehicles.find((v) => v.franchise);
  P = {
    t: 0, phase: 'drive', arriveT: -1, next: 0, lineIdx: 0, runAt: -1, van, path: [], poly: null,
    ranger: null, rangerGoal: null, trace: [],
    cam0: cam.position.clone(), q0: cam.quaternion.clone(),
    camPos: new THREE.Vector3(), camLook: new THREE.Vector3(), dest: new THREE.Vector3(),
    runT: -1, wide: null, released: false,
    lines: pivotLines(ctx.meta), boss: null, bossDoor: null, bossBackAt: Infinity,
    canSkip: has(ctx.meta, 'skipPivot'), skipped: false, skipEl: null,
  };
  if (P.canSkip) showDriveSkip(P);
  // The hidden player stands where the therapist is (the van must not find it on the road).
  const p = ctx.player;
  if (p && !p.vehicle) { p.pos.set(chair.x, chair.y, chair.z + 1); p.vel.set(0, 0, 0); }
  if (van) {
    const ring = { ringS, ringPoint, ringYaw, ringDelta };
    // Ring road then across the plaza; else a plaza grid route (or the free spot nearest the chair).
    const route = planEntry(world, van, chair, STOP_AT, ring) || { points: planVanPath(world, van, chair, STOP_AT) };
    P.poly = buildPoly(van, route, ring);
    P.path = P.poly.pts;
    van.driver = { kind: 'aiDriver', pos: new THREE.Vector3() };
    van.parked = false; van.asleep = false; van.aiBackT = 0; van.aiStuckT = 0;
    // The franchise driver knows this plaza: tighter lock for the cutscene only (restored at RUN).
    P.spec = van.spec;
    van.spec = { ...van.spec, steerMax: 0.7, steerFall: 25, steerRate: 4 };
    P.start = van.pos.clone();
    P.dest.copy(P.path.length ? P.path[P.path.length - 1] : van.pos);
  } else {
    P.dest.copy(world.spawns.vanEntry.pos);
  }
  P.dest.y = 0;
}

// The spa loop detunes and collapses the moment the van appears: on screen and close enough to
// read as a van (CUE_DIST from the camera), or parked unseen.
const CUE_DIST = 40;
function musicCue(ctx) {
  if (P.cue) return;
  let seen = !P.van || P.phase === 'parked';
  if (!seen && P.van.pos.distanceTo(ctx.camera.position) < CUE_DIST) {
    _a.copy(P.van.pos).setY(P.van.pos.y + 1).project(ctx.camera);
    seen = _a.z < 1 && Math.abs(_a.x) < 1 && Math.abs(_a.y) < 1;
  }
  if (!seen) return;
  P.cue = true; P.cueT = P.t;
  if (ctx.audio && typeof ctx.audio.pivot === 'function') ctx.audio.pivot();
}

function driveVan(dt, ctx) {
  const v = P.van;
  if (!v) { if (P.phase !== 'parked') arrive(ctx); return; } // once: arriving every tick kept pushing the script back
  if (P.phase === 'drive') {
    const left = followPoly(v, P.poly, dt, driveAt, RING_CRUISE, CRUISE);
    const dc = Math.hypot(v.pos.x - ctx.world.chairSpot.x, v.pos.z - ctx.world.chairSpot.z);
    if (left < 1.2 || dc < STOP_AT + 0.8 || P.t > DRIVE_MAX) P.phase = 'stop';
  }
  if (P.phase === 'stop') {
    brake(v);
    if (Math.abs(v.speed) < 0.3) arrive(ctx);
  }
  updateVehicle(v, dt, ctx);
  if (Math.floor(P.t * 2) !== Math.floor((P.t - dt) * 2)) P.trace.push([+v.pos.x.toFixed(1), +v.pos.z.toFixed(1)]);
}

function arrive(ctx) {
  P.phase = 'parked';
  P.arriveT = P.t;
  P.next = P.t + 0.3;
  emit('pivot', { beat: 'vanStop', at: Math.round(P.t * 10) / 10 });
  hideSkip(P);                                   // the drive-up is over: no line, no skip
  // A viewing, whatever comes next (meta.js: the tenth earns the hall pass at the run's end).
  const m = ctx.meta;
  if (m) { m.pivotsSeen = (m.pivotsSeen || 0) + 1; saveMeta(m); emit('pivot', { beat: 'seen', n: m.pivotsSeen }); }
  if (P.van) { brake(P.van); P.van.vel.set(0, 0, 0); P.van.speed = 0; }
}

// Each goon walks from the door to a spot 5.5 m from the chair (jogging if the van could not
// get close), fanned out 1.3 m apart, then faces the chair.
function spawnCrew(ctx) {
  spawnGoons(ctx, 3);
  const c = ctx.world.chairSpot;
  goons(ctx).forEach((g, i) => {
    g.state = 'hold';
    const dx = g.pos.x - c.x, dz = g.pos.z - c.z, d = Math.hypot(dx, dz) || 1;
    const side = (i - 1) * 1.3;
    g.goal = { x: c.x + (dx / d) * 5.5 - (dz / d) * side, z: c.z + (dz / d) * 5.5 + (dx / d) * side };
  });
  P.crewT = P.t;
  if (P.lines.boss) spawnBoss(ctx, P);
}

function walkNpc(e, goal, speed, dt, ctx) {
  const c = ctx.world.chairSpot;
  e.wishX = e.wishZ = 0; e.speed = 0; e.faceX = undefined;
  if (goal && !seek(e, goal.x, goal.y ?? e.pos.y, goal.z, dt, ctx, 0.4)) e.speed = speed;
  else { e.wishX = e.wishZ = 0; e.faceX = c.x; e.faceZ = c.z; }
  e.pose = 'walk';
  stepBody(e, dt, ctx);
  poseRig(e, dt);
}

function line(ctx, speaker, text, preset) {
  emit('pivot', { beat: 'line', speaker: preset, text });
  const b = bubble(ctx, speaker, text, { skin: 'run', preset });
  return b ? b.life - 0.8 : 2;
}

function script(ctx) {
  if (P.phase !== 'parked' || P.t < P.next) return;
  const gs = goons(ctx);
  if (P.lineIdx === 0 && !gs.length) { spawnCrew(ctx); P.next = P.t + 0.5; P.lineIdx = 0.5; return; }
  if (P.lineIdx === 0.5) {
    const c = ctx.world.chairSpot, lead = gs[0];
    const far = lead && Math.hypot(lead.pos.x - c.x, lead.pos.z - c.z) > 12;
    if (far && P.t - P.crewT < 10) return;     // the van stopped short: they walk up first
    P.lineIdx = 1; spawnRanger(ctx, P);
  }
  const k = Math.floor(P.lineIdx) - 1, LINES = P.lines.goons;
  if (k < LINES.length) {
    // Whoever has walked up closest to the chair and has not spoken yet takes the next line
    // (the boss, when he is out, takes the first).
    const c = ctx.world.chairSpot, d = (e) => Math.hypot(e.pos.x - c.x, e.pos.z - c.z);
    const g = k === 0 && P.boss ? P.boss : gs.filter((e) => !e.spoke).sort((a, b) => d(a) - d(b))[0] || gs[0];
    if (g) g.spoke = true;
    const dur = line(ctx, g || P.van && P.van.mesh, LINES[k], 'goon');
    if (g && g === P.boss) P.bossBackAt = P.t + dur;
    P.lineIdx++;
    P.next = P.t + (k === LINES.length - 1 ? 1.0 : dur + LINE_GAP);  // the silent '...' is short; the ranger cuts in
  } else if (k === LINES.length) {
    const dur = line(ctx, P.ranger, P.lines.ranger, 'ranger');
    P.rangerEnd = P.t + dur;
    P.lineIdx++;
    P.runAt = P.t + dur * 0.45;          // controls unlock mid-sentence
    P.next = Infinity;
  }
}

export function update(dt, ctx) {
  if (!P) return;
  P.t += dt;
  checkDriveSkip(ctx, P, arrive);                // hall pass: a key during the drive-up cuts to the stop
  driveVan(dt, ctx);
  script(ctx);
  for (const g of goons(ctx)) walkNpc(g, g.goal, g.goal && Math.hypot(g.goal.x - g.pos.x, g.goal.z - g.pos.z) > 6 ? 3.5 : 1.6, dt, ctx);
  if (P.ranger) walkNpc(P.ranger, P.rangerGoal, 4.5, dt, ctx);
  if (P.boss) {
    const b = P.boss;
    if (P.t >= P.bossBackAt) b.goal = P.bossDoor;
    walkNpc(b, b.goal, 1.6, dt, ctx);
    if (b.goal === P.bossDoor && Math.hypot(b.pos.x - b.goal.x, b.pos.z - b.goal.z) < 0.6) dropBoss(ctx, P); // back in the van
  }
  pivotCamera(dt, ctx, P);
  musicCue(ctx);
  if (P.runAt >= 0 && P.t >= P.runAt) { emit('pivot', { beat: 'unlock', at: Math.round(P.t * 10) / 10 }); setState(STATES.RUN); }
}

// RUN entered from PIVOT: tear the course off and hand the player the controls.
export function beginRun(ctx) {
  if (!P) return;
  hideSkip(P);
  dropBoss(ctx, P);                              // still walking back to the door: he got in
  const p = ctx.player, hud = ctx.hud, v = P.van;
  if (v) { v.driver = null; v.ai = null; if (P.spec) v.spec = P.spec; }
  const at = P.dest;
  massage.releaseToRun(ctx, at.x, at.z);
  p.mesh.visible = true;
  const dx = at.x - p.pos.x, dz = at.z - p.pos.z;
  p.camYaw = Math.atan2(-dx, -dz);            // looking at the van and the goons
  p.camPitch = 0.3; p.yaw = Math.atan2(dx, dz);
  p.camInit = false;
  P.wide = { pos: ctx.camera.position.clone(), q: ctx.camera.quaternion.clone() };
  P.runT = 0;
  musicCue(ctx);
  if (P.ranger) {
    // Hangs back at the chair: no pursuit at wanted 0, the 1-star unit once wanted reaches 1.
    const r = P.ranger, at = P.rangerGoal || r.pos;
    r.state = 'hang'; r.hang = true; r.standDown = false; r.post = { x: at.x, y: at.y ?? r.pos.y, z: at.z };
    if (ctx.police) ctx.police.units.push({ kind: 'foot', cops: [r], hang: true, t: 0 });
    P.hangAt = Math.max(0, (P.rangerEnd ?? P.t) - P.t) + 0.3;  // after his permit line finishes
  }
  for (const g of goons(ctx)) { g.goal = null; }
  hud.tearOffMassageHud();
  hud.setRunTitle(true, true);
}

// Per RUN tick after updateAll: camera blend, the goons' leash, the client walking off.
export function runTick(dt, ctx) {
  massage.updateLeaving(dt, ctx);
  if (!P || P.runT < 0) return;
  P.runT += dt;
  if (P.runT >= PURSUE_AFTER && !P.released) {
    P.released = true;
    for (const g of goons(ctx)) if (g.state === 'hold') g.state = 'chase';
  }
  if (P.wide && P.runT < RUN_BLEND && !ctx.player.vehicle) {
    const e = P.runT / RUN_BLEND, s = e * e * (3 - 2 * e), cam = ctx.camera;
    cam.position.lerpVectors(P.wide.pos, cam.position, s);
    cam.quaternion.slerpQuaternions(P.wide.q, cam.quaternion, s);
    cam.updateMatrixWorld();
    ctx.player.camInit = false;               // the player camera snaps; the blend smooths it
  } else if (P.wide) { P.wide = null; ctx.player.camInit = true; }
  if (P.hangAt >= 0 && P.runT >= P.hangAt) {
    P.hangAt = -1;
    if (P.ranger && P.ranger.hang && ctx.npcs.includes(P.ranger)) line(ctx, P.ranger, HANG_LINE, 'ranger');
  }
  if (P.released && !P.wide && !(P.hangAt >= 0)) P.runT = -1;
}

export function reset() {
  hideSkip(P);
  if (P && P.van && P.spec) P.van.spec = P.spec;
  P = null;
}
