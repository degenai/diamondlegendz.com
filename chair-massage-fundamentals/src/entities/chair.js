// The massage chair as a carryable object. It lives in the massage station (named
// 'massageChair'); E folds it onto the player's back, E by a vehicle straps it in, a hard crash
// throws it onto the road. world.chairState = { where: 'ground'|'player'|'vehicle', vehicle }
// is what Phase 6's escape check reads.
import * as THREE from '../../vendor/three.module.js';
import { loadMesh } from '../assets.js';
import { floorHeightAt, overlapsFootprint } from '../physics.js';
import { STATION_YAW } from '../massage/stage.js';
import { sfx } from '../juice.js';
import { emit } from '../events.js';

const FOLD = 0.22;                  // folded depth factor (the chair collapses to a slab)
const BACK_MOUNT = { pos: [0, -0.5, 0.12], rot: [0, 0, 0], scale: 0.85 };
const THROW_BACK = 3;               // metres behind the vehicle's tail
const _v = new THREE.Vector3();

export function chairState(world) {
  if (!world.chairState) world.chairState = { where: 'ground', vehicle: null };
  return world.chairState;
}

export function findChair(ctx) {
  const w = ctx.world;
  if (w._chair) return w._chair;
  const c = (ctx.station && ctx.station.getObjectByName('massageChair')) || ctx.scene.getObjectByName('massageChair');
  if (!c) return null;
  w._chair = c;
  w._chairHome = { parent: c.parent, pos: c.position.clone(), quat: c.quaternion.clone(), scale: c.scale.clone() };
  return c;
}

// RUN without a MASSAGE first (debug entry): stand a chair at the spot so it can be carried.
export function ensureChair(ctx) {
  if (findChair(ctx) || ctx.station || ctx.world._chairLoading) return;
  ctx.world._chairLoading = true;
  loadMesh('assets/chair.json').then((c) => {
    if (findChair(ctx)) return;
    c.name = 'massageChair';
    c.userData.standalone = true;
    c.position.copy(ctx.world.chairSpot);
    c.rotation.y = STATION_YAW;
    ctx.scene.add(c);
    findChair(ctx);
  }).catch((err) => console.warn('[CMF] chair load failed', err)).finally(() => { ctx.world._chairLoading = false; });
}

function mount(chair, parent, m) {
  parent.add(chair);
  chair.position.fromArray(m.pos);
  chair.rotation.set(m.rot[0], m.rot[1], m.rot[2]);
  chair.scale.set(m.scale, m.scale, m.scale * FOLD);
}

export function chairWorldPos(ctx, out = _v) {
  const c = findChair(ctx);
  if (!c) return null;
  return c.getWorldPosition(out);
}

export function pickUpChair(ctx, p) {
  const c = findChair(ctx);
  const back = p.mesh.userData.back;
  if (!c || !back) return false;
  const cs = chairState(ctx.world);
  emit('chair', { act: cs.vehicle ? 'take' : 'pickup', where: 'player', vehicle: cs.vehicle ? cs.vehicle.spec.label : null });
  if (cs.vehicle) cs.vehicle.chairLoaded = false;
  mount(c, back, BACK_MOUNT);
  Object.assign(chairState(ctx.world), { setDown: false, where: 'player', vehicle: null });
  sfx(ctx, 'chairFold', p.pos.x, p.pos.z);
  return true;
}

export function loadChair(ctx, v) {
  const c = findChair(ctx);
  if (!c) return false;
  mount(c, v.body, v.spec.chair);
  v.chairLoaded = true;
  emit('chair', { act: 'load', where: 'vehicle', vehicle: v.spec.label });
  Object.assign(chairState(ctx.world), { setDown: false, where: 'vehicle', vehicle: v });
  sfx(ctx, 'chairFold', v.pos.x, v.pos.z);
  return true;
}

// Hard crash: the chair lands unfolded on the road 3 m behind the vehicle's tail.
export function throwChair(ctx, v) {
  const c = findChair(ctx);
  v.chairLoaded = false;
  if (!c) return false;
  const colliders = ctx.world.colliders || [];
  // Land behind the tail; if that spot is inside a wall or prop, walk back toward the car.
  let back = v.spec.halfL + THROW_BACK, x = v.pos.x, z = v.pos.z;
  const blocked = (px, pz, py) => colliders.some((k) => !k.camOnly && k.maxY > py + 0.2 && overlapsFootprint({ x: px, z: pz }, 0.5, k));
  for (; back >= v.spec.halfL * 0.5; back -= 0.5) {
    x = v.pos.x - Math.sin(v.yaw) * back; z = v.pos.z - Math.cos(v.yaw) * back;
    if (!blocked(x, z, floorHeightAt(x, z, colliders, v.pos.y + 0.3))) break;
  }
  const y = floorHeightAt(x, z, colliders, v.pos.y + 0.3);
  ctx.scene.add(c);
  c.position.set(x, y, z);
  c.rotation.set(0, v.yaw + 2.2, 0);
  const home = ctx.world._chairHome;
  if (home) c.scale.copy(home.scale); else c.scale.set(1, 1, 1);
  Object.assign(chairState(ctx.world), { setDown: false, where: 'ground', vehicle: null, thrownAt: ctx.time });
  emit('chair', { act: 'throw', where: 'ground', vehicle: v.spec.label, throw: true });
  return true;
}

// Back to the station (MASSAGE between runs). Clears any vehicle's load.
export function resetChair(ctx) {
  const w = ctx.world;
  if (w.vehicles) for (const v of w.vehicles) v.chairLoaded = false;
  const c = w._chair;
  if (c && c.userData.standalone && ctx.station) {
    c.parent && c.parent.remove(c);            // the station brings its own chair
    w._chair = null; w._chairHome = null;
  } else if (c && w._chairHome) {
    const h = w._chairHome;
    h.parent.add(c);
    c.position.copy(h.pos); c.quaternion.copy(h.quat); c.scale.copy(h.scale);
  }
  Object.assign(chairState(w), { where: 'ground', vehicle: null });
}
