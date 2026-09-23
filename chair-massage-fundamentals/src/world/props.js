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
