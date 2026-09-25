// The massage chair as a carryable object. It lives in the massage station (named
// 'massageChair'); E folds it onto the player's back, E by a vehicle straps it in, a hard crash
// throws it onto the road. world.chairState = { where: 'ground'|'player'|'vehicle', vehicle }
// is what Phase 6's escape check reads. The chair is also a weapon of last resort (the swing,
// player-actions.js) and wears: durability 100, 10 per swing, BENT at 0 (still carryable and
// loadable; a mini-massage on it takes twice as long). A cart repair straightens it; MASSAGE
// entry (resetChair) brings a fresh one.
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
export const DURABILITY = 100;
export const SWING_WEAR = 10;

export function chairState(world) {
  if (!world.chairState) world.chairState = { where: 'ground', vehicle: null, durability: DURABILITY };
  if (!(world.chairState.durability >= 0)) world.chairState.durability = DURABILITY;
  return world.chairState;
}

export function chairBent(world) { return chairState(world).durability <= 0; }

// One swing's wear. Returns the durability after; the swing that reaches 0 bends it (watcher `chair` bent).
export function wearChair(ctx, amount = SWING_WEAR) {
  const cs = chairState(ctx.world);
  const was = cs.durability;
  cs.durability = Math.max(0, was - amount);
  if (was > 0 && cs.durability <= 0) {
    emit('chair', { act: 'bent', where: cs.where, durability: 0 });
    const p = ctx.player;
    if (p && ctx.hud && ctx.hud.floater) ctx.hud.floater('bent chair', p.pos.x, p.pos.y + 2.1, p.pos.z, 'speech dim');
  }
  return cs.durability;
}

// Cart repair (interact.js repairVehicle): back to 100. Returns the durability it had.
export function repairChair(ctx) {
  const cs = chairState(ctx.world);
  const was = cs.durability;
  cs.durability = DURABILITY;
  return was;
}

// Mid-swing: the folded chair comes off his back into both hands in front of him and sweeps the
// arc; a (radians) runs from -PI/2 (his left) to +PI/2. Torso frame: +Z is forward, +X his left.
export function holdChairFront(ctx, p, a, lift = 0) {
  const c = findChair(ctx), torso = p.mesh.userData.torso;
  if (!c || !torso) return;
  if (c.parent !== torso) torso.add(c);
  const r = 0.75;
  c.position.set(Math.sin(a) * r, -0.35 + lift, Math.cos(a) * r);
  c.rotation.set(-1.2, a, 0);
}

// Back onto his back after a swing (or a swing cut short).
export function chairToBack(ctx, p) {
  const c = findChair(ctx), back = p.mesh.userData.back;
  if (c && back && chairState(ctx.world).where === 'player' && c.parent !== back) mount(c, back, BACK_MOUNT);
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
  const bent = cs.durability <= 0;
  emit('chair', { act: cs.vehicle ? 'take' : 'pickup', where: 'player', vehicle: cs.vehicle ? cs.vehicle.spec.label : null, durability: cs.durability, bent });
  if (cs.vehicle) cs.vehicle.chairLoaded = false;
  mount(c, back, BACK_MOUNT);
  Object.assign(chairState(ctx.world), { setDown: false, where: 'player', vehicle: null });
  sfx(ctx, 'chairFold', p.pos.x, p.pos.z);
  if (bent && ctx.hud && ctx.hud.floater) ctx.hud.floater('bent chair', p.pos.x, p.pos.y + 2.1, p.pos.z, 'speech dim');
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
  Object.assign(chairState(w), { where: 'ground', vehicle: null, durability: DURABILITY });
}
