// A warm wall lamp over each alley mouth (DESIGN.md "Places to hide"): an unlit bright box on a
// bracket across the mouth, and a soft additive glow disc facing the street. No real lights.
// Per block: one mesh for the lamps, one for the glows (block-local coordinates).
import * as THREE from '../../vendor/three.module.js';
import { createBatch, addBox } from './batch.js';
import { SIDE, DECK_Y, toXZ } from './layout.js';

const LAMP = 0xffd08a, GLOW = 0xffb050, LAMP_Y = DECK_Y + 3.55;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
let glowGeo = null;
const GLOW_R = 1.0;
const _v = new THREE.Vector3(), _g = new THREE.Color();

// A disc whose colour falls from the glow colour at the centre to black at the rim; with additive
// blending black adds nothing, so it reads as a soft halo.
function addGlow(b, matrix) {
  const p = glowGeo.attributes.position;
  _g.set(GLOW);
  for (let i = 0; i < p.count; i++) {
    _v.fromBufferAttribute(p, i);
    const k = Math.max(0, 1 - Math.hypot(_v.x, _v.y) / GLOW_R) ** 1.5;
    _v.applyMatrix4(matrix);
    b.pos.push(_v.x, _v.y, _v.z);
    b.col.push(_g.r * k, _g.g * k, _g.b * k);
  }
}

function mesh(b, mat, name) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, mat);
  m.name = name;
  return m;
}

// alleys: [{ edge, u, mouth }]. Adds the bracket to the static batch `sb`; returns the two meshes
// (none when the block has no alleys) and records each lamp's local position on its alley.
export function alleyLamps(sb, alleys) {
  if (!alleys.length) return [];
  if (!glowGeo) glowGeo = new THREE.CircleGeometry(GLOW_R, 20).toNonIndexed();
  const lb = createBatch(), gb = createBatch();
  for (const A of alleys) {
    const yaw = SIDE[A.edge].yaw, d = A.mouth + 0.25;
    const [bx, bz] = toXZ(A.edge, A.u, d);
    addBox(sb, 2.5, 0.08, 0.08, 0x2a2a2a, bx, LAMP_Y + 0.28, bz, yaw);           // bracket, wall to wall
    addBox(sb, 0.05, 0.24, 0.05, 0x2a2a2a, bx, LAMP_Y + 0.14, bz, yaw);          // drop rod
    addBox(lb, 0.42, 0.2, 0.3, LAMP, bx, LAMP_Y, bz, yaw);
    const [gx, gz] = toXZ(A.edge, A.u, d - 0.2);
    _e.set(0, yaw + Math.PI, 0);                                               // facing the street
    addGlow(gb, _m.compose(_p.set(gx, LAMP_Y - 0.1, gz), _q.setFromEuler(_e), _s));
    A.lamp = { x: bx, y: LAMP_Y, z: bz };
  }
  const lamps = mesh(lb, new THREE.MeshBasicMaterial({ vertexColors: true }), 'alleyLamps');
  const glow = mesh(gb, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), 'alleyGlow');
  lamps.userData.count = glow.userData.count = alleys.length;
  return [lamps, glow];
}
