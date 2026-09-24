// Every person spawn goes through spawnPerson(kind, colours).
// The rig is code, the skin is the asset: spawnPerson builds the pivot hierarchy synchronously
// (joint offsets copied from tools/blender/make_person.py), then hangs the baked meshes from
// assets/person.json under the matching pivots as soon as the asset is available. Pivots never
// change, so callers holding userData.limbs / torso / head / back stay valid across the swap.
import * as THREE from '../../vendor/three.module.js';
import { preload } from '../assets.js';

const PERSON_URL = 'assets/person.json';

// ---- joint offsets (parent-local, metres, three.js axes; L = the person's left = +X) ----
const BODY_Y = 1.15;                       // bob root; player.js writes body.position.y = 1.15 + bob
const HIP_Y = 0.95;                        // HIP_Z: pelvis above the feet
const WAIST = [0, 0.07, 0];                // WAIST_Z - HIP_Z, torso pivot under hips
const NECK = [0, 0.48, 0];                 // NECK_Z - WAIST_Z, head pivot under torso
const SHOULDER = [0.215, 0.42, 0];         // SHOULDER_Z - WAIST_Z, upperArm pivots under torso
const SPLAY = THREE.MathUtils.degToRad(9); // arm splay baked into the arm geometry
const UA = 0.30, LA = 0.25;                // upper / lower arm lengths
const ELBOW = [Math.sin(SPLAY) * UA, -Math.cos(SPLAY) * UA, 0]; // lowerArm pivot under upperArm
const HAND_REACH = LA + 0.06;              // elbow -> hand centre
const HIP_JOINT = [0.095, 0, 0];           // upperLeg pivots under hips
const THIGH = 0.45;                        // HIP_Z - KNEE_Z
const KNEE = [0, -THIGH, 0];               // lowerLeg pivot under upperLeg
const KNEE_TO_SOLE = 0.5;                  // knee -> sole (placeholder only)

const PARTS = ['hips', 'torso', 'head', 'upperArmL', 'upperArmR', 'lowerArmL', 'lowerArmR',
  'upperLegL', 'upperLegR', 'lowerLegL', 'lowerLegR'];

// ---- colours (sRGB hex; converted to linear for the vertex colours) ----
const SKINS = [0xf1c9a5, 0xe0ac86, 0xc68e62, 0xa46b43, 0x8d5a3b, 0x5e3b26];
const HAIRS = [0x1b1511, 0x3a2a1e, 0x6b4a2b, 0xa8793e, 0xd6c28a, 0xb9b6b0];
const SHIRTS = [0xe0533d, 0x3f6fb0, 0x9a8cc4, 0xe8b83a, 0x4f9a8a, 0xd8d4c8, 0x7a2f3b, 0x2f5d3a];
const PANTS = [0x23262e, 0x3b4a66, 0x6b5d4f, 0x8a7556, 0x4a4e57, 0x2e2a26];
const SHOES = [0x1e1e1e, 0xe8e8e8, 0x5a3a24, 0x2b2b35];

export const PALETTES = {
  therapist: { shirt: 0x006937, pants: 0x23262e, skin: 0xc68e62, hair: 0x3a2a1e, shoes: 0x1e1e1e },
  player: { shirt: 0x006937, pants: 0x23262e, skin: 0xc68e62, hair: 0x3a2a1e, shoes: 0x1e1e1e },
  jogger: { shirt: 0xe0533d, pants: 0x23262e, skin: 0xd9a47a, hair: 0x6b4a2b, shoes: 0xe8e8e8 },
  retiree: { shirt: 0x9a8cc4, pants: 0x6b5d4f, skin: 0xe8c4a0, hair: 0xb9b6b0, shoes: 0x5a3a24 },
  dad: { shirt: 0x3f6fb0, pants: 0x8a7556, skin: 0x8d5a3b, hair: 0x1b1511, shoes: 0x2b2b35 },
  goon: { shirt: 0x111214, pants: 0x111214, shoes: 0x0a0a0a, hair: 0x1b1511 },
  cop: { shirt: 0x1c2a4a, pants: 0x141c30, shoes: 0x0a0a0a },
};
// Perk shirts (meta.perks().shirt): the loaner scrubs are the PE gold. Only the player and the
// therapist (the same person, in and out of the course) wear them.
export const PERK_SHIRTS = { gold: 0xffcc00 };
export function shirtFor(kind, perk) { return PERK_SHIRTS[perk] ?? PALETTES[kind].shirt; }
const RANDOM_SKIN = new Set(['client', 'ped', 'goon', 'cop']);

let seed = 0x5eed;
function rand() { // mulberry32, deterministic per page load
  seed = (seed + 0x6d2b79f5) | 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (a) => a[Math.floor(rand() * a.length)];

function coloursFor(kind) {
  const base = PALETTES[kind];
  if (kind === 'ped' || (kind === 'client' && !base)) {
    return { shirt: pick(SHIRTS), pants: pick(PANTS), skin: pick(SKINS), hair: pick(HAIRS), shoes: pick(SHOES) };
  }
  const c = { ...(base || {}) };
  if (RANDOM_SKIN.has(kind) || !base) { c.skin ??= pick(SKINS); c.hair ??= pick(HAIRS); }
  return c;
}

// ---- asset state ----
let template = null; // Group from assets.js (pristine, never added to a scene)
const waiting = [];  // persons spawned before the asset arrived
const ready = preload([PERSON_URL]).then(([g]) => {
  template = g;
  waiting.splice(0).forEach(skin);
}).catch((err) => console.warn('[CMF] person.json failed, keeping placeholder people', err));

// ---- placeholder parts for the loading gap (removed once the mesh attaches) ----
const phGeo = new Map();
const phMat = new Map();
function placeholder(pivot, w, h, d, y, hex) {
  const key = `${w}:${h}:${d}`;
  if (!phGeo.has(key)) phGeo.set(key, new THREE.BoxGeometry(w, h, d));
  if (!phMat.has(hex)) phMat.set(hex, new THREE.MeshLambertMaterial({ color: hex, flatShading: true }));
  const m = new THREE.Mesh(phGeo.get(key), phMat.get(hex));
  m.name = '_placeholder';
  m.position.y = y;
  pivot.add(m);
}

function pivot(name, parent, [x, y, z]) {
  const p = new THREE.Group();
  p.name = name;
  p.position.set(x, y, z);
  parent.add(p);
  return p;
}

export function spawnPerson(kind, colours) {
  const cols = { ...coloursFor(kind), ...(colours || {}) };
  const g = new THREE.Group();
  g.name = 'person';
  const body = pivot('body', g, [0, BODY_Y, 0]);
  const hips = pivot('hips', body, [0, HIP_Y - BODY_Y, 0]);
  const torso = pivot('torso', hips, WAIST);
  const head = pivot('head', torso, NECK);
  const j = { hips, torso, head };
  for (const [s, side] of [[1, 'L'], [-1, 'R']]) {
    j['upperArm' + side] = pivot('upperArm' + side, torso, [SHOULDER[0] * s, SHOULDER[1], 0]);
    j['lowerArm' + side] = pivot('lowerArm' + side, j['upperArm' + side], [ELBOW[0] * s, ELBOW[1], 0]);
    j['upperLeg' + side] = pivot('upperLeg' + side, hips, [HIP_JOINT[0] * s, 0, 0]);
    j['lowerLeg' + side] = pivot('lowerLeg' + side, j['upperLeg' + side], KNEE);
  }
  // Back frame: origin on the mid back, +Z out of the back, +Y up the spine.
  const back = new THREE.Object3D();
  back.name = 'back';
  back.position.set(0, 0.26, -0.115);
  back.rotation.y = Math.PI;
  torso.add(back);

  g.userData = {
    kind, colours: cols, joints: j, body, hips, torso, head, back,
    inner: torso, // legacy alias: the hip-pivot inner group of the capsule person
    limbs: { armL: j.upperArmL, armR: j.upperArmR, legL: j.upperLegL, legR: j.upperLegR },
    skinned: false,
    ready,
  };

  if (template) skin(g);
  else {
    const sh = cols.shirt ?? 0x9a9a94, pa = cols.pants ?? 0x4a4e57, sk = cols.skin ?? 0xc69c7b;
    placeholder(hips, 0.33, 0.19, 0.2, -0.015, pa);
    placeholder(torso, 0.38, 0.48, 0.2, 0.24, sh);
    placeholder(head, 0.19, 0.28, 0.22, 0.15, sk);
    for (const s of ['L', 'R']) {
      placeholder(j['upperArm' + s], 0.1, UA, 0.1, -UA / 2, sh);
      placeholder(j['lowerArm' + s], 0.08, HAND_REACH, 0.08, -HAND_REACH / 2, sk);
      placeholder(j['upperLeg' + s], 0.15, THIGH, 0.15, -THIGH / 2, pa);
      placeholder(j['lowerLeg' + s], 0.12, KNEE_TO_SOLE, 0.12, -KNEE_TO_SOLE / 2, pa);
    }
    waiting.push(g);
  }
  return g;
}

// Swap placeholders for the baked meshes, recoloured per person (own colour buffers).
function skin(g) {
  const { joints, colours } = g.userData;
  const regions = template.userData.materials || {};
  const swaps = [];
  for (const [name, m] of Object.entries(regions)) {
    if (colours[name] === undefined || !m.color) continue;
    const to = new THREE.Color(colours[name]); // sRGB hex -> linear working space
    swaps.push([m.color, [to.r, to.g, to.b]]);
  }
  for (const name of PARTS) {
    const src = template.getObjectByName(name);
    const p = joints[name];
    if (!src || !src.isMesh || !p) continue;
    for (const c of [...p.children]) if (c.name === '_placeholder') p.remove(c);
    const geo = src.geometry.clone();
    const col = geo.getAttribute('color');
    if (col) {
      const a = col.array;
      for (let i = 0; i < a.length; i += 3) {
        for (const [from, to] of swaps) {
          if (Math.abs(a[i] - from[0]) < 1e-3 && Math.abs(a[i + 1] - from[1]) < 1e-3 && Math.abs(a[i + 2] - from[2]) < 1e-3) {
            a[i] = to[0]; a[i + 1] = to[1]; a[i + 2] = to[2];
            break;
          }
        }
      }
      col.needsUpdate = true;
    }
    const mesh = new THREE.Mesh(geo, src.material);
    mesh.name = name + 'Mesh';
    p.add(mesh); // the node's origin is its joint, so identity under the pivot
  }
  g.userData.skinned = true;
}

// Change a spawned person's colours (e.g. { shirt }). A skinned person re-skins from the template
// (fresh colour buffers through the same region swap); one still waiting for the asset gets them
// when it is skinned. No-op when nothing changes.
export function setPersonColours(g, patch) {
  const cols = g.userData.colours;
  if (Object.keys(patch).every((k) => cols[k] === patch[k])) return false;
  Object.assign(cols, patch);
  if (!g.userData.skinned || !template) return true;
  for (const name of PARTS) {
    const p = g.userData.joints[name];
    if (!p) continue;
    for (const c of [...p.children]) if (c.isMesh && c.name === name + 'Mesh') { p.remove(c); c.geometry.dispose(); }
  }
  skin(g);
  return true;
}

export function disposePerson(g) {
  if (!g) return;
  const i = waiting.indexOf(g);
  if (i >= 0) waiting.splice(i, 1);
  // Only the rig's own part meshes (skin() clones one geometry per part). A bat or a hat hung on a
  // joint comes from loadMesh(), whose geometry every other clone of that asset shares.
  g.traverse((o) => { if (o.isMesh && o.parent && o.name === o.parent.name + 'Mesh') o.geometry.dispose(); });
}

// ---- posing ----
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _e = new THREE.Vector3();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const DOWN = new THREE.Vector3(0, -1, 0);
const ARM_REST = { L: new THREE.Vector3(Math.sin(SPLAY), -Math.cos(SPLAY), 0), R: new THREE.Vector3(-Math.sin(SPLAY), -Math.cos(SPLAY), 0) };

// Rotate a pivot so its rest direction points at a world-space target (matrices must be current).
function aimAt(p, rest, target) {
  p.getWorldPosition(_p);
  _v.copy(target).sub(_p);
  p.parent.getWorldQuaternion(_q).invert();
  _v.applyQuaternion(_q).normalize();
  p.quaternion.setFromUnitVectors(rest, _v);
  p.updateMatrixWorld(true);
}

// Two-bone chain (upper, lower) to world target, elbow/knee bent toward world `pole`.
function reach(upper, lower, rest, a, b, target, pole) {
  upper.getWorldPosition(_w);
  _v.copy(target).sub(_w);
  const d = THREE.MathUtils.clamp(_v.length(), Math.abs(a - b) + 1e-3, a + b - 1e-3);
  _v.normalize();
  const x = (a * a - b * b + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, a * a - x * x));
  _e.copy(pole).addScaledVector(_v, -pole.dot(_v)).normalize(); // pole ⟂ reach axis
  _e.multiplyScalar(h).addScaledVector(_v, x).add(_w);          // elbow / knee
  const tgt = _v.multiplyScalar(d).add(_w).clone();
  aimAt(upper, rest, _e);
  aimAt(lower, rest, tgt);
}

export function resetPose(m) {
  const { joints, body, hips } = m.userData;
  for (const k of Object.keys(joints)) joints[k].rotation.set(0, 0, 0);
  body.position.set(0, BODY_Y, 0);
  hips.position.set(0, HIP_Y - BODY_Y, 0);
}

// Kneeling-chair pose, person-local (facing +Z, feet origin). Tunable live via window.CMF.
// Chair pads in this frame (chair.json, chair faces the client's +Z): seat top y 0.656 at
// z -0.25..0.15; kneeler top surface (z 0.11, y 0.38) -> (z 0.35, y 0.51); chest pad face
// z 0.19 at y 0.73 leaning to z 0.29 at y 1.1; face cradle (z 0.41, y 1.25); armrest top y 0.77.
export const KNEEL = {
  hipY: 0.77, hipZ: -0.04, hipPitch: 0.35, lean: 0.22, head: 0.58,
  knee: [0.12, 0.575, 0.33], foot: [0.12, 0.40, 0.0],
  hand: [0.16, 0.81, 0.52],
};
const _t = new THREE.Vector3();
const POLE_ELBOW_L = new THREE.Vector3(0.6, -0.8, 0);
const POLE_ELBOW_R = new THREE.Vector3(-0.6, -0.8, 0);

export function poseKneeling(m, lean = KNEEL.lean) {
  resetPose(m);
  const { joints: j, hips, torso, head } = m.userData;
  const K = KNEEL;
  hips.position.set(0, K.hipY - BODY_Y, K.hipZ);
  hips.rotation.x = K.hipPitch;
  torso.rotation.x = lean;
  head.rotation.x = K.head;
  m.updateMatrixWorld(true);
  const toWorld = (x, y, z) => m.localToWorld(_t.set(x, y, z));
  for (const [s, side] of [[1, 'L'], [-1, 'R']]) {
    aimAt(j['upperLeg' + side], DOWN, toWorld(K.knee[0] * s, K.knee[1], K.knee[2]));
    aimAt(j['lowerLeg' + side], DOWN, toWorld(K.foot[0] * s, K.foot[1], K.foot[2]));
  }
  for (const [s, side, pole] of [[1, 'L', POLE_ELBOW_L], [-1, 'R', POLE_ELBOW_R]]) {
    const wp = _w.copy(pole).transformDirection(m.matrixWorld).clone();
    reach(j['upperArm' + side], j['lowerArm' + side], ARM_REST[side], UA, HAND_REACH,
      toWorld(K.hand[0] * s, K.hand[1], K.hand[2]).clone(), wp);
  }
}

// Bent forward, both hands reaching to world-space points.
export function poseReaching(m, lean, handL, handR) {
  const { joints: j, torso } = m.userData;
  torso.rotation.set(lean, 0, 0);
  m.updateMatrixWorld(true);
  _t.set(0, -1, -0.3).transformDirection(m.matrixWorld); // elbows down and back
  const pole = _t.clone();
  reach(j.upperArmL, j.lowerArmL, ARM_REST.L, UA, HAND_REACH, handL, pole);
  reach(j.upperArmR, j.lowerArmR, ARM_REST.R, UA, HAND_REACH, handR, pole);
}
