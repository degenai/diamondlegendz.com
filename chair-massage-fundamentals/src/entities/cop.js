// Cops on foot: the park ranger (campaign hat, tan and green), city cops, SWAT. They chase and
// arrest by touch (the arrest rule itself lives in run/spawner.js). A Healing Palm knocks one
// down; he gets up loose and walks off pursuit for 10 s with a human line. Wanted does not drop.
import { spawnPerson, disposePerson } from '../world/people.js';
import { loadMesh } from '../assets.js';
import { createNpc, stepBody, poseRig, cull, say, seek } from './npc-common.js';
import { emitChaos } from '../run/wanted.js';

const SPEED = { ranger: 5, cop: 5.5, swat: 5.5 };
const OUTFIT = {
  ranger: { shirt: 0xc2a878, pants: 0x3f5a36, shoes: 0x3a2a1e },
  cop: null,
  swat: { shirt: 0x1f2226, pants: 0x1f2226, shoes: 0x0a0a0a },
};
const WALK_OFF = 10;
const GUARD_R = 20;
const LINES = ['...you know what, take five.', 'I\'m not paid enough for this.', '...is that what that feels like?'];

export function createCop(scene, pos, rank = 'cop', guard = false) {
  const mesh = spawnPerson('cop', OUTFIT[rank] || undefined);
  scene.add(mesh);
  const e = createNpc('cop', mesh, pos, {
    rank, update: updateCop, onPalm, onVehicleHit, radius: 0.38, standDown: false, standT: 0,
  });
  e.state = guard ? 'guard' : 'chase';
  if (rank === 'ranger') {
    loadMesh('assets/ranger.json').then((g) => {
      const hat = g.getObjectByName('hat') || g;
      hat.position.set(0, 0.25, 0.01);
      mesh.userData.head.add(hat);
    }).catch((err) => console.warn('[CMF] ranger hat failed', err));
  }
  return e;
}

export function disposeCop(e, scene) { scene.remove(e.mesh); disposePerson(e.mesh); }

export function copHostile(e) {
  return e.knockedT <= 0 && !e.standDown && e.state === 'chase';
}

export function updateCop(e, dt, ctx) {
  const p = ctx.player;
  e.wishX = e.wishZ = 0; e.speed = 0; e.faceX = undefined;
  e.noRoad = !!p.vehicle;
  const tgt = p.vehicle ? p.vehicle.pos : p.pos;
  if (e.knockedT > 0) {
    e.knockedT -= dt;
    if (e.knockedT <= 0) getUp(e, ctx);
  } else if (e.standDown) {
    e.standT += dt;
    walkAway(e, tgt, 1.3);
  } else if (e.state === 'walkoff') {
    e.stateT -= dt;
    walkAway(e, tgt, 1.3);
    if (e.stateT <= 0) { e.state = e.hang ? 'hang' : 'chase'; e.loose = 0; }
  } else if (e.state === 'hang') {
    // The pivot ranger hanging back by the chair (police.js decides when he pursues).
    const post = e.post || e.pos;
    if (seek(e, post.x, post.y ?? e.pos.y, post.z, dt, ctx, 0.6)) { e.faceX = tgt.x; e.faceZ = tgt.z; } else e.speed = 2.2;
  } else if (e.state === 'guard') {
    e.faceX = tgt.x; e.faceZ = tgt.z;
    if (!p.vehicle && (tgt.x - e.pos.x) ** 2 + (tgt.z - e.pos.z) ** 2 < GUARD_R * GUARD_R) e.state = 'chase';
  } else if (e.state === 'chase') {
    e.speed = SPEED[e.rank] || 5.5;
    if (p.vehicle && (tgt.x - e.pos.x) ** 2 + (tgt.z - e.pos.z) ** 2 < 4 * 4) { e.speed = 0; e.faceX = tgt.x; e.faceZ = tgt.z; }
    else seek(e, tgt.x, tgt.y, tgt.z, dt, ctx, 0.7);
    if (!e.wishX && !e.wishZ) { e.faceX = tgt.x; e.faceZ = tgt.z; }
  }
  e.pose = e.knockedT > 0 ? 'down' : e.loose > 0 ? 'loose' : (e.state === 'chase' && !p.vehicle &&
    (tgt.x - e.pos.x) ** 2 + (tgt.z - e.pos.z) ** 2 < 2.5 * 2.5) ? 'reach' : 'walk';
  stepBody(e, dt, ctx);
  poseRig(e, dt);
  cull(e, ctx);
}

function walkAway(e, tgt, speed) {
  const dx = e.pos.x - tgt.x, dz = e.pos.z - tgt.z, d = Math.hypot(dx, dz) || 1;
  e.wishX = dx / d; e.wishZ = dz / d; e.speed = speed;
}

function getUp(e, ctx) {
  e.knockedT = 0;
  if (e.knockCause === 'palm') {
    e.state = 'walkoff'; e.stateT = WALK_OFF; e.loose = 1;
    say(ctx, e, LINES[e.id % LINES.length]);
  } else if (!e.standDown) e.state = 'chase';
}

function onPalm(e, p, ctx) {
  say(ctx, e, 'TENSION RELEASED', 'released');
}

function onVehicleHit(e, v, ctx) {
  e.knockCause = 'vehicle';
  e.knockedT = 3;
  if (v.driver === ctx.player && ctx.wanted) ctx.wanted.report('pedHurt');
  emitChaos(ctx, e.pos.x, e.pos.z, 'vehicleHit');
}
