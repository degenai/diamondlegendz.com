// Plaza furniture: food carts, benches (batched part lists from props.js) and trees in grates
// (two InstancedMeshes: trunks and cones). Every piece gets a collider.
import * as THREE from '../../vendor/three.module.js';
import { addBox, addSlab } from './batch.js';
import { benchParts, cartParts, placeParts } from './props.js';
import { DECK_Y, DECK_HALF, RING_R, EDGES, SIDE, toXZ } from './layout.js';

const AWNINGS = [0xd9534f, 0x2f8f5b, 0xe0a030, 0x3a6fb5, 0xc2457a];
const LEAF = [0x3f7a3a, 0x4d8a3c, 0x356b33, 0x5c8f3a];
const GRATE = 0x3a3a38;

// World footprint of a local w x d rect turned by yaw.
function footprint(w, d, yaw) {
  const c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw));
  return [w * c + d * s, w * s + d * c];
}

function shuffle(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// B.furn (optional, district centres): { carts: [lo, hi], benches: [lo, hi], trees: [lo, hi] }
// counts; B.trees0: trees a centre already placed (they share the block's two InstancedMeshes).
export function buildFurniture(B) {
  const { batch: b, colliders, rng, variant, placer } = B;
  const F = B.furn || { carts: [3, 4], benches: [8, 12], trees: [8, 12] };
  const carts = [], benches = [], trees = (B.trees0 || []).slice();

  // Food carts beside the axis walks, serving side toward the walk.
  const cartSpots = [];
  for (const e of EDGES) {
    const [ux, uz] = toXZ(e, 1, 0), [ox, oz] = toXZ(e, 0, 0);
    for (const d of [18, 24, 31, 37]) for (const s of [-1, 1]) {
      const [x, z] = toXZ(e, s * 4.4, d);
      cartSpots.push({ x, z, yaw: Math.atan2(-s * (ux - ox), -s * (uz - oz)) });
    }
  }
  let nCarts = rng.int(F.carts[0], F.carts[1]);
  for (const c of shuffle(rng, cartSpots)) {
    if (!nCarts) break;
    const [w, d] = footprint(2.4, 1.6, c.yaw);
    if (!placer.free(c.x, c.z, w, d, 1.0, 4)) continue;
    placer.take(c.x, c.z, w, d);
    const awning = AWNINGS[Math.floor(rng.next() * AWNINGS.length)];
    placeParts(addBox, b, cartParts({ awning }), c.x, DECK_Y, c.z, c.yaw);
    colliders.push({ minX: c.x - w / 2, maxX: c.x + w / 2, minZ: c.z - d / 2, maxZ: c.z + d / 2, maxY: DECK_Y + 2.35, tag: 'cart' });
    carts.push({ pos: new THREE.Vector3(c.x, DECK_Y, c.z), yaw: c.yaw, awning });
    nCarts--;
  }

  // Benches facing the walks.
  const spots = [];
  for (const e of EDGES) {
    const [ux, uz] = toXZ(e, 1, 0), [ox, oz] = toXZ(e, 0, 0);
    for (const d of [16, 21, 33, 39]) for (const s of [-1, 1]) {
      const [x, z] = toXZ(e, s * 2.9, d);
      spots.push({ x, z, yaw: Math.atan2(-s * (ux - ox), -s * (uz - oz)) });
    }
    for (const u of [-28, -16, 16, 28]) {
      const [x, z] = toXZ(e, u, 42.6);
      spots.push({ x, z, yaw: Math.atan2(-SIDE[e].out[0], -SIDE[e].out[1]) });
    }
  }
  if (variant.includes('ring')) {
    for (let k = 0; k < 8; k++) {
      const a = ((k + 0.5) / 8) * Math.PI * 2, r = RING_R + 2.4;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      spots.push({ x, z, yaw: Math.atan2(-x, -z) });
    }
  }
  if (variant.includes('diag')) {
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) for (const t of [22, 34]) for (const s of [-1, 1]) {
      const px = -sz * s * 2.4 / Math.SQRT2, pz = sx * s * 2.4 / Math.SQRT2; // perpendicular offset
      spots.push({ x: sx * t + px, z: sz * t + pz, yaw: Math.atan2(-px, -pz) });
    }
  }
  let nBench = rng.int(F.benches[0], F.benches[1]);
  for (const s of shuffle(rng, spots)) {
    if (!nBench) break;
    const [w, d] = footprint(1.8, 0.6, s.yaw);
    if (!placer.free(s.x, s.z, w, d, 0.9, 0.8)) continue;
    placer.take(s.x, s.z, w, d);
    placeParts(addBox, b, benchParts(), s.x, DECK_Y, s.z, s.yaw);
    colliders.push({ minX: s.x - w / 2, maxX: s.x + w / 2, minZ: s.z - d / 2, maxZ: s.z + d / 2, maxY: DECK_Y + 0.49, tag: 'bench' });
    benches.push({ pos: new THREE.Vector3(s.x, DECK_Y, s.z), yaw: s.yaw });
    nBench--;
  }

  // Trees in grates: scattered in the plaza + a row along the inner sidewalk.
  let nTree = rng.int(F.trees[0], F.trees[1]);
  for (let t = 0; t < 400 && nTree > 0; t++) {
    const x = rng.range(-41, 41), z = rng.range(-41, 41);
    if (!placer.free(x, z, 1.4, 1.4, 1.8, 1.5)) continue;
    placer.take(x, z, 1.4, 1.4);
    trees.push({ x, z, s: rng.range(0.85, 1.2) });
    nTree--;
  }
  for (const e of EDGES) {
    for (let u = -40; u <= 40; u += 10) {
      if (Math.abs(u) < (B.plaza ? 5 : 15)) continue;   // clear of the link street's turns at u = 0
      const [x, z] = toXZ(e, u + rng.range(-1, 1), DECK_HALF - 0.9);
      trees.push({ x, z, s: rng.range(0.85, 1.15) });
    }
  }
  for (const t of trees) {
    const g = t.landmark ? 1.6 : 0.7;         // the block's landmark tree (landmarks.js): 16 m, a wide trunk
    addSlab(b, t.x - g, t.x + g, t.z - g, t.z + g, DECK_Y - 0.01, DECK_Y + 0.012, GRATE);
    if (t.landmark) colliders.push({ kind: 'cyl', x: t.x, z: t.z, r: t.r, maxY: DECK_Y + t.h, tag: 'landmark' });
    else colliders.push({ kind: 'cyl', x: t.x, z: t.z, r: 0.3, maxY: DECK_Y + 2.2, tag: 'tree', noCam: true });
  }
  return { carts, benches, trees, meshes: treeMeshes(trees, rng) };
}

export function treeMeshes(trees, rng) {
  const trunkGeo = new THREE.CylinderGeometry(0.15, 0.2, 2.2, 6).translate(0, 1.1, 0);
  const coneGeo = new THREE.ConeGeometry(1.5, 3.4, 7).translate(0, 3.6, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x6b4a32, flatShading: true }), trees.length);
  const cones = new THREE.InstancedMesh(coneGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), trees.length);
  trunks.name = 'treeTrunks'; cones.name = 'treeCones';
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
  const up = new THREE.Vector3(0, 1, 0);
  trees.forEach((t, i) => {
    q.setFromAxisAngle(up, rng.range(0, Math.PI * 2));
    p.set(t.x, DECK_Y, t.z);
    trunks.setMatrixAt(i, m.compose(p, q, s.set(t.w || 1, t.s, t.w || 1)));
    cones.setMatrixAt(i, m.compose(p, q, s.set(t.s, t.s, t.s)));
    cones.setColorAt(i, c.set(LEAF[Math.floor(rng.next() * LEAF.length)]));
  });
  for (const im of [trunks, cones]) {
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
  }
  return [trunks, cones];
}

