// Parked sedans across the district (kerbside and in the parking-lot centres). Every spot shows
// as an instanced proxy (one InstancedMesh per sedan part, one per paint colour for the body)
// with a box collider, so ~200 parked cars cost a dozen draw calls and no ticks. A spot within
// LIVE_R of the player becomes a real drivable vehicle (the proxy hides, the box collider goes;
// the vehicle collides dynamically); a vehicle nobody has touched goes back to its proxy past
// DROP_R. Anything driven, pushed, dented or stolen stays a vehicle for the rest of the session.
import * as THREE from '../../vendor/three.module.js';
import { loadMesh } from '../assets.js';
import { addCollider, removeCollider } from '../physics-grid.js';
import { removeEntity } from '../entities/index.js';
import { carCollider, recolourBody, placeVehicle } from './cars.js';

const LIVE_R = 100;
const DROP_R = 140;
const EVERY = 0.25;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const _up = new THREE.Vector3(0, 1, 0);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

// Builds the proxies and their colliders. Resolves when the sedan template has loaded.
export function initParked(world) {
  const spots = world.spawns.parking.map((s, i) => ({ ...s, i, state: 'proxy', collider: carCollider(s), vehicle: null }));
  const P = world.parkedSpots = { spots, parts: [], t: 0 };
  for (const s of spots) addCollider(world.colliders, s.collider);
  return loadMesh('assets/sedan.json').then((car) => {
    car.updateMatrixWorld(true);
    const colours = [...new Set(spots.map((s) => s.colour))];
    car.traverse((o) => {
      if (!o.isMesh) return;
      const local = o.matrixWorld.clone();
      const groups = o.name === 'Body' ? colours : [null];
      for (const colour of groups) {
        let geo = o.geometry;
        if (colour !== null) { const c = car.clone(true); c.userData = car.userData; recolourBody(c, colour); geo = c.getObjectByName('Body').geometry; }
        const members = colour === null ? spots : spots.filter((s) => s.colour === colour);
        const im = new THREE.InstancedMesh(geo, o.material, Math.max(1, members.length));
        im.name = 'parkedProxy';
        members.forEach((s, k) => {
          _q.setFromAxisAngle(_up, s.yaw);
          _m.compose(_p.copy(s.pos), _q, _s).multiply(local);
          im.setMatrixAt(k, _m);
          (s.slots || (s.slots = [])).push({ im, k, m: _m.clone() });
        });
        im.count = members.length;
        im.instanceMatrix.needsUpdate = true;
        im.computeBoundingSphere();
        world.root.add(im);
        P.parts.push(im);
      }
    });
    return spots;
  });
}

function showProxy(s, on) {
  for (const { im, k, m } of s.slots || []) { im.setMatrixAt(k, on ? m : ZERO); im.instanceMatrix.needsUpdate = true; }
}

function goLive(world, entities, s) {
  s.state = 'loading';
  loadMesh('assets/sedan.json').then((car) => {
    if (s.state !== 'loading' || !world.vehicles) { s.state = 'proxy'; return; }
    recolourBody(car, s.colour);
    car.name = 'parkedSedan';
    removeCollider(world.colliders, s.collider);
    showProxy(s, false);
    const v = placeVehicle(world, world.root, entities, 'sedan', car, s.pos, s.yaw);
    v.home = { pos: s.pos.clone(), yaw: s.yaw };
    v.spot = s;
    s.vehicle = v; s.state = 'live';
    world.parked.push({ mesh: car, collider: s.collider, spawn: s, vehicle: v });
  }).catch((err) => { s.state = 'proxy'; console.warn('[CMF] parked car failed to load', err); });
}

// Untouched since it went live: still at its spot, never driven, not stolen, not dented.
export function pristine(v, ctx) {
  const s = v.spot;
  return !!s && !v.driver && v.parked && !v.stolen && !v.chairLoaded && v.hp >= 100 && v !== (ctx.player && ctx.player.vehicle)
    && (v.pos.x - s.pos.x) ** 2 + (v.pos.z - s.pos.z) ** 2 < 0.09 && Math.abs(v.yaw - s.yaw) < 0.05 && Math.hypot(v.vel.x, v.vel.z) < 0.05;
}

function goProxy(world, ctx, s) {
  const v = s.vehicle;
  const L = world.vehicles, i = L.indexOf(v);
  if (i >= 0) L.splice(i, 1);
  removeEntity(ctx.entities, v);
  if (v.mesh.parent) v.mesh.parent.remove(v.mesh);
  const k = world.parked.findIndex((e) => e.vehicle === v);
  if (k >= 0) world.parked.splice(k, 1);
  addCollider(world.colliders, s.collider);
  showProxy(s, true);
  s.vehicle = null; s.state = 'proxy';
}

// Per tick (any state): wake the spots near the player, put untouched far ones back.
export function updateParked(ctx, dt) {
  const world = ctx.world, P = world.parkedSpots;
  if (!P || !world.vehicles) return;
  P.t -= dt;
  if (P.t > 0) return;
  P.t = EVERY;
  const at = ctx.player.vehicle ? ctx.player.vehicle.pos : ctx.player.pos;
  for (const s of P.spots) {
    const d2 = (s.pos.x - at.x) ** 2 + (s.pos.z - at.z) ** 2;
    if (s.state === 'proxy' && d2 < LIVE_R * LIVE_R) goLive(world, ctx.entities, s);
    else if (s.state === 'live' && d2 > DROP_R * DROP_R && pristine(s.vehicle, ctx)) goProxy(world, ctx, s);
  }
}

export function liveCount(world) {
  return world.parkedSpots ? world.parkedSpots.spots.filter((s) => s.state === 'live').length : 0;
}
