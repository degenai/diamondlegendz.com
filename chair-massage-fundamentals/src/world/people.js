// Every person spawn goes through spawnPerson(kind, colours). Today it wraps the
// procedural makePerson; swapping to assets/person.json is an edit to this file only.
// Adds a hip-pivoted torso group so poses can bend at the waist.
import * as THREE from '../../vendor/three.module.js';
import { makePerson, mat } from './props.js';

const HIP_Y = 0.74;
const ARM_LEN = 0.55;
const _v = new THREE.Vector3();
const _X = new THREE.Vector3(1, 0, 0);

export const PALETTES = {
  player: { shirt: 0x2e9e4f, pants: 0x2a3140, skin: 0xc68e62 },
  therapist: { shirt: 0x2e9e4f, pants: 0x2a3140, skin: 0xc68e62 },
  jogger: { shirt: 0xe0533d, pants: 0x23262e, skin: 0xd9a47a },
  retiree: { shirt: 0x9a8cc4, pants: 0x6b5d4f, skin: 0xe8c4a0 },
  dad: { shirt: 0x3f6fb0, pants: 0x8a7556, skin: 0x8d5a3b },
};

export function spawnPerson(kind, colours) {
  const cols = colours || PALETTES[kind] || {};
  const m = makePerson(cols);
  m.userData.kind = kind;
  m.userData.colours = cols;
  // torso pivots at the hip; inner undoes the offset so parts keep their original coords
  const torso = new THREE.Group();
  torso.name = 'torso';
  torso.position.set(0, HIP_Y, 0);
  const inner = new THREE.Group();
  inner.position.set(0, -HIP_Y, 0);
  torso.add(inner);
  const { limbs, body, head } = m.userData;
  for (const part of [body, head, limbs.armL, limbs.armR]) inner.add(part);
  m.add(torso);
  m.userData.torso = torso;
  m.userData.inner = inner;
  // Back frame: origin on the mid back, +Z out of the back, +Y up the spine.
  const back = new THREE.Object3D();
  back.position.set(0, 1.15, -0.29);
  back.rotation.y = Math.PI;
  inner.add(back);
  m.userData.back = back;
  return m;
}

// Point a limb pivot (rest direction -Y) along d (in the pivot's parent space).
function aimLimb(pivot, d) {
  const len = d.length() || 1;
  const x = d.x / len, y = d.y / len, z = d.z / len;
  pivot.rotation.set(Math.atan2(-z, -y), 0, Math.asin(Math.max(-1, Math.min(1, x))));
}

export function resetPose(m) {
  const { limbs, torso } = m.userData;
  torso.rotation.set(0, 0, 0);
  for (const k of Object.keys(limbs)) {
    limbs[k].rotation.set(0, 0, 0); limbs[k].scale.set(1, 1, 1);
    if (limbs[k].children[1]) limbs[k].children[1].visible = true;
  }
  if (m.userData.shins) m.userData.shins.forEach((s) => { s.visible = false; });
}

// Kneeling in the massage chair, face down in the cradle. Person-local, facing +Z.
export function poseKneeling(m, lean = 1.05) {
  resetPose(m);
  const { limbs, torso } = m.userData;
  torso.rotation.x = lean;
  for (const leg of [limbs.legL, limbs.legR]) { leg.rotation.x = -0.93; leg.scale.y = 0.62; }
  if (!m.userData.shins) {
    const pants = m.userData.colours.pants ?? 0x2a3140;
    m.userData.shins = [-0.14, 0.14].map((x) => {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.41, 0.14), mat(pants));
      s.position.set(x, 0.375, 0.18);
      s.rotation.x = 1.086;
      m.add(s);
      return s;
    });
  }
  m.userData.shins.forEach((s) => { s.visible = true; });
  // forearms hang onto the armrest: direction given in person space, converted into torso space
  for (const [arm, sx] of [[limbs.armL, 1], [limbs.armR, -1]]) {
    _v.set(sx * -0.17, -0.3, 0.03).applyAxisAngle(_X, -lean);
    aimLimb(arm, _v);
    arm.scale.y = 0.65;
  }
}

// Bent forward, both arms reaching to world-space points (hands are drawn separately).
export function poseReaching(m, lean, handL, handR) {
  const { limbs, torso, inner } = m.userData;
  torso.rotation.set(lean, 0, 0);
  m.updateMatrixWorld(true);
  for (const [arm, target] of [[limbs.armL, handL], [limbs.armR, handR]]) {
    _v.copy(target);
    inner.worldToLocal(_v);
    _v.sub(arm.position);
    const len = _v.length();
    aimLimb(arm, _v);
    arm.scale.y = Math.max(0.3, (len - 0.15) / ARM_LEN); // stop short so the hand boxes show
    if (arm.children[1]) arm.children[1].visible = false;
  }
}
