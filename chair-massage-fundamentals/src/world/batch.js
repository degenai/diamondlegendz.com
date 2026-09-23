// Static geometry batcher: many coloured boxes/cylinders -> one vertex-coloured mesh (one draw call).
// Colours are hex (sRGB); THREE.Color converts them to the linear working space like materials do.
import * as THREE from '../../vendor/three.module.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _v = new THREE.Vector3();
const _c = new THREE.Color();
const flatCache = new Map();

function flat(key, make) {
  let g = flatCache.get(key);
  if (!g) { g = make().toNonIndexed(); flatCache.set(key, g); }
  return g;
}

const UNIT_BOX = () => flat('box', () => new THREE.BoxGeometry(1, 1, 1));

export function createBatch() {
  return { pos: [], col: [] };
}

export function addGeo(b, geo, color, matrix) {
  const p = geo.attributes.position;
  _c.set(color);
  for (let i = 0; i < p.count; i++) {
    _v.fromBufferAttribute(p, i).applyMatrix4(matrix);
    b.pos.push(_v.x, _v.y, _v.z);
    b.col.push(_c.r, _c.g, _c.b);
  }
}

// Box centred at (x, y, z). Rotation: yaw (Y) then tilt (X), Euler order YXZ.
export function addBox(b, w, h, d, color, x, y, z, yaw = 0, tilt = 0) {
  _e.set(tilt, yaw, 0, 'YXZ');
  _q.setFromEuler(_e);
  _m.compose(_p.set(x, y, z), _q, _s.set(w, h, d));
  addGeo(b, UNIT_BOX(), color, _m);
}

// Axis-aligned slab from corner extents.
export function addSlab(b, minX, maxX, minZ, maxZ, y0, y1, color) {
  addBox(b, maxX - minX, y1 - y0, maxZ - minZ, color, (minX + maxX) / 2, (y0 + y1) / 2, (minZ + maxZ) / 2);
}

// Cylinder standing on y0 (base) with height h.
export function addCyl(b, rTop, rBot, h, seg, color, x, y0, z) {
  const g = flat(`cyl:${rTop}:${rBot}:${h}:${seg}`, () => new THREE.CylinderGeometry(rTop, rBot, h, seg));
  _m.makeTranslation(x, y0 + h / 2, z);
  addGeo(b, g, color, _m);
}

// Flat annulus lying on the ground at height y.
export function addRing(b, rIn, rOut, seg, color, x, y, z) {
  const g = flat(`ring:${rIn}:${rOut}:${seg}`, () => new THREE.RingGeometry(rIn, rOut, seg).rotateX(-Math.PI / 2));
  _m.makeTranslation(x, y, z);
  addGeo(b, g, color, _m);
}

let sharedMat = null;
export function batchMaterial() {
  if (!sharedMat) sharedMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  return sharedMat;
}

export function buildBatch(b, name) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, batchMaterial());
  m.name = name;
  m.matrixAutoUpdate = false;
  return m;
}
