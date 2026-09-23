// Procedural mesh factories. Flat-shaded MeshLambertMaterial, shared via cache.
import * as THREE from '../../vendor/three.module.js';

const matCache = new Map();
const geoCache = new Map();

export function mat(color) {
  const key = typeof color === 'number' ? color : new THREE.Color(color).getHex();
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color: key, flatShading: true });
    matCache.set(key, m);
  }
  return m;
}

function geo(key, make) {
  let g = geoCache.get(key);
  if (!g) { g = make(); geoCache.set(key, g); }
  return g;
}

function box(w, h, d) {
  return geo(`box:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d));
}

function cyl(rt, rb, h, seg = 8) {
  return geo(`cyl:${rt}:${rb}:${h}:${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
}

function part(geometry, color, x, y, z) {
  const m = new THREE.Mesh(geometry, mat(color));
  m.position.set(x, y, z);
  return m;
}

// A person ~1.8m tall, origin at the feet, facing +Z (local).
// Limbs are wrapped in pivot groups at the shoulder/hip so rotation.x swings them.
export function makePerson({ shirt = 0x2e9e4f, pants = 0x2a3140, skin = 0xc68e62 } = {}) {
  const g = new THREE.Group();
  g.name = 'person';

  const body = part(geo('person:body', () => new THREE.CapsuleGeometry(0.28, 0.5, 4, 8)), shirt, 0, 1.15, 0);
  g.add(body);

  const head = part(box(0.32, 0.34, 0.32), skin, 0, 1.68, 0);
  g.add(head);

  const limbs = {};
  const makeLimb = (name, geomLen, color, x, y, handColor) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const limb = part(box(0.14, geomLen, 0.14), color, 0, -geomLen / 2, 0);
    pivot.add(limb);
    if (handColor !== undefined) pivot.add(part(box(0.12, 0.12, 0.12), handColor, 0, -geomLen - 0.04, 0));
    g.add(pivot);
    limbs[name] = pivot;
  };
  makeLimb('armL', 0.55, shirt, -0.38, 1.4, skin);
  makeLimb('armR', 0.55, shirt, 0.38, 1.4, skin);
  makeLimb('legL', 0.72, pants, -0.14, 0.74);
  makeLimb('legR', 0.72, pants, 0.14, 0.74);

  g.userData.limbs = limbs;
  g.userData.head = head;
  g.userData.body = body;
  return g;
}

// Folding massage chair silhouette: kneeler, seat, chest pad, face cradle, armrest, A-frame legs.
export function makeChair({ pad = 0x1d2a3a, frame = 0x9aa3ad } = {}) {
  const g = new THREE.Group();
  g.name = 'chair';
  const leg = cyl(0.025, 0.025, 1.05, 6);

  const legF1 = part(leg, frame, -0.22, 0.5, 0.25); legF1.rotation.x = 0.45; g.add(legF1);
  const legF2 = part(leg, frame, 0.22, 0.5, 0.25); legF2.rotation.x = 0.45; g.add(legF2);
  const legB1 = part(leg, frame, -0.22, 0.5, -0.2); legB1.rotation.x = -0.45; g.add(legB1);
  const legB2 = part(leg, frame, 0.22, 0.5, -0.2); legB2.rotation.x = -0.45; g.add(legB2);

  g.add(part(box(0.44, 0.08, 0.38), pad, 0, 0.62, -0.25));            // seat
  const knee = part(box(0.4, 0.07, 0.26), pad, 0, 0.3, 0.3); knee.rotation.x = -0.6; g.add(knee);
  const chest = part(box(0.36, 0.08, 0.4), pad, 0, 0.95, 0.1); chest.rotation.x = 1.0; g.add(chest);
  g.add(part(box(0.44, 0.06, 0.2), pad, 0, 0.9, 0.38));               // armrest
  const cradle = part(box(0.24, 0.06, 0.22), pad, 0, 1.2, 0.3); cradle.rotation.x = 0.5; g.add(cradle);
  g.add(part(cyl(0.02, 0.02, 0.5, 6), frame, 0, 0.95, 0.22));          // center post
  return g;
}

// --- Street furniture. Each factory is a list of box parts in a local frame (facing +Z, origin
// on the ground), used both by the Group factories and by the static batcher (one draw call).

// Bench: seat slab, back, two legs. Seat front faces +Z. Footprint 1.8 x 0.6, seat 0.45 high.
export function benchParts({ wood = 0x8a5a36, iron = 0x2f3336 } = {}) {
  return [
    { w: 1.8, h: 0.08, d: 0.5, c: wood, x: 0, y: 0.45, z: 0.02 },               // seat slab
    { w: 1.8, h: 0.42, d: 0.07, c: wood, x: 0, y: 0.72, z: -0.24, tilt: -0.12 }, // back
    { w: 0.08, h: 0.45, d: 0.5, c: iron, x: -0.75, y: 0.22, z: 0 },             // legs
    { w: 0.08, h: 0.45, d: 0.5, c: iron, x: 0.75, y: 0.22, z: 0 },
  ];
}

// Food cart: body, wheels, corner posts, roof, awning over the serving side (+Z).
// Footprint 2.2 x 1.3 (x by z), roof at 2.3 m.
export function cartParts({ awning = 0xd9534f, body = 0xdad7cf } = {}) {
  const parts = [
    { w: 2.2, h: 1.0, d: 1.2, c: body, x: 0, y: 0.85, z: 0 },
    { w: 2.24, h: 0.08, d: 1.28, c: 0x8d9296, x: 0, y: 1.39, z: 0 },          // counter top
    { w: 0.12, h: 0.5, d: 0.5, c: 0x222222, x: -0.8, y: 0.25, z: 0 },          // wheels
    { w: 0.12, h: 0.5, d: 0.5, c: 0x222222, x: 0.8, y: 0.25, z: 0 },
    { w: 2.4, h: 0.1, d: 1.5, c: awning, x: 0, y: 2.3, z: 0 },                 // roof
    { w: 2.4, h: 0.05, d: 0.8, c: awning, x: 0, y: 2.36, z: 1.05, tilt: 0.45 }, // awning, low edge clears 2.15 m
    { w: 2.2, h: 0.18, d: 0.03, c: 0xf4f1e8, x: 0, y: 1.1, z: 0.62 },         // menu stripe
  ];
  for (const [x, z] of [[-1.05, -0.6], [1.05, -0.6], [-1.05, 0.6], [1.05, 0.6]]) {
    parts.push({ w: 0.05, h: 0.9, d: 0.05, c: 0x8d9296, x, y: 1.85, z });
  }
  return parts;
}

function groupFromParts(parts, name) {
  const g = new THREE.Group();
  g.name = name;
  for (const p of parts) {
    const m = part(box(p.w, p.h, p.d), p.c, p.x, p.y, p.z);
    if (p.tilt) m.rotation.x = p.tilt;
    g.add(m);
  }
  return g;
}

export function makeBench(opts) { return groupFromParts(benchParts(opts), 'bench'); }
export function makeFoodCart(opts) { return groupFromParts(cartParts(opts), 'foodCart'); }

// Place a part list into a batch at (x, y, z) turned by yaw. addBoxFn = batch.addBox.
export function placeParts(addBoxFn, batch, parts, x, y, z, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  for (const p of parts) {
    const wx = x + p.x * c + p.z * s;
    const wz = z - p.x * s + p.z * c;
    addBoxFn(batch, p.w, p.h, p.d, p.c, wx, y + p.y, wz, yaw, p.tilt || 0);
  }
}
