// The massage set: station group at world.chairSpot holding the baked chair, the kneeling
// client, the therapist and the therapist's two visible hands; plus the over-the-shoulder camera.
import * as THREE from '../../vendor/three.module.js';
import { loadMesh } from '../assets.js';
import { makeChair, mat } from '../world/props.js';
import { spawnPerson, poseKneeling, poseReaching, resetPose, disposePerson, PALETTES, KNEEL } from '../world/people.js';

export const STATION_YAW = 0.7;     // chair faces station -Z; the camera looks out across the park
const THERAPIST_LEAN = 0.32;
const SWAY = THREE.MathUtils.degToRad(0.5);
const SWAY_PERIOD = 4;
const FLINCH_TIME = 0.4;
const HAND_T = 0.05; // palm box thickness
// station-local placements (exported so they can be tuned live from window.CMF)
export const CAM_POS = new THREE.Vector3(0.6, 2.0, 2.3);
export const CAM_LOOK = new THREE.Vector3(-0.05, 1.1, -0.3);
export const THERAPIST = { x: -0.55, z: 0.25, yaw: 2.19 }; // off the client's left, facing the back

const _v = new THREE.Vector3();
const _l = new THREE.Vector3();
const _r = new THREE.Vector3();
const _q = new THREE.Quaternion();

export function createStage(ctx) {
  const station = new THREE.Group();
  station.name = 'massageStation';
  station.position.copy(ctx.world.chairSpot);
  station.rotation.y = STATION_YAW;
  ctx.scene.add(station);
  station.updateMatrixWorld(true);
  loadMesh('assets/chair.json')
    .catch((err) => {
      console.warn('[CMF] chair.json failed, using procedural chair', err);
      const c = makeChair(); c.rotation.y = Math.PI; return c; // procedural chair faces +Z
    })
    .then((chair) => {
      if (station.getObjectByName('massageChair')) return; // a chair already exists (debug RUN-first path)
      chair.name = 'massageChair'; station.add(chair);
    });
  return { station, client: null, therapist: null, hands: [], flinchT: 0, leaveT: 0 };
}

export function addCast(st, scene) {
  st.therapist = spawnPerson('therapist');
  st.therapist.position.set(THERAPIST.x, 0, THERAPIST.z);
  st.therapist.rotation.y = THERAPIST.yaw;
  st.station.add(st.therapist);
  // flat palms on the back (back frame: x across, y up the spine, z out), big enough to read
  const hg = new THREE.BoxGeometry(0.12, 0.12, HAND_T);
  const skin = mat(st.therapist.userData.colours.skin ?? PALETTES.therapist.skin);
  st.hands = [0, 1].map(() => { const h = new THREE.Mesh(hg, skin); h.visible = false; scene.add(h); return h; });
}

export function removeCast(st, scene) {
  removeClient(st);
  if (st.therapist) { st.station.remove(st.therapist); disposePerson(st.therapist); }
  st.therapist = null;
  st.hands.forEach((h) => scene.remove(h));
  if (st.hands[0]) st.hands[0].geometry.dispose();
  st.hands = [];
}

export function seatClient(st, kind) {
  removeClient(st);
  const m = spawnPerson(kind);
  m.position.set(0, 0, 0);
  m.rotation.y = Math.PI; // person faces +Z, the chair's face cradle is at station -Z
  st.station.add(m);
  poseKneeling(m);
  st.client = m;
  st.flinchT = 0;
  st.hands.forEach((h) => { h.visible = true; });
  return m;
}

export function removeClient(st) {
  if (st.client) { st.station.remove(st.client); disposePerson(st.client); }
  st.client = null;
}

// Client stands beside the chair; walkOff() moves them away. Therapist straightens up.
export function standClient(st) {
  resetPose(st.client);
  st.client.position.set(0.55, 0, -0.75);
  st.client.rotation.y = Math.PI / 2;
  resetPose(st.therapist);
  st.hands.forEach((h) => { h.visible = false; });
  st.leaveT = 0;
}

export function walkOff(st, dt) {
  st.leaveT += dt;
  if (!st.client || st.leaveT < 1.2) return;
  st.client.position.x += 1.1 * dt;
  const sw = Math.sin(st.leaveT * 9) * 0.6;
  st.client.userData.limbs.legL.rotation.x = sw;
  st.client.userData.limbs.legR.rotation.x = -sw;
  if (st.leaveT > 5) removeClient(st);
}

export function flinch(st) { st.flinchT = FLINCH_TIME; }

export function updateCamera(st, camera, time) {
  st.station.localToWorld(camera.position.copy(CAM_POS));
  camera.lookAt(st.station.localToWorld(_v.copy(CAM_LOOK)));
  camera.rotateY(SWAY * Math.sin((time / SWAY_PERIOD) * Math.PI * 2));
  camera.updateMatrixWorld();
}

// Flinch jerk on the client; leaves matrices current for the guide projection.
export function poseClient(st, dt, time) {
  const m = st.client;
  if (st.flinchT > 0) st.flinchT = Math.max(0, st.flinchT - dt);
  const k = st.flinchT / FLINCH_TIME;
  const jerk = Math.sin(k * Math.PI) * (0.5 + 0.5 * Math.sin(time * 60));
  m.userData.torso.rotation.x = KNEEL.lean - 0.22 * jerk;
  m.position.x = 0.03 * jerk;
  m.updateMatrixWorld(true);
}

// Hands sit on the back at the working spot (A/D), pressed in a little by pressure (W/S).
export function placeHands(st, spot, pressure, v) {
  const back = st.client.userData.back;
  back.getWorldQuaternion(_q);
  const centreU = spot * 0.14;
  [-0.07, 0.07].forEach((du, i) => {
    const u = centreU + du;
    const curve = 0.9 * u * u; // the baked torso is a flat-backed taper; ease off at the sides
    back.localToWorld(st.hands[i].position.set(u, v, HAND_T / 2 + 0.005 - curve - pressure * 0.00018));
    st.hands[i].quaternion.copy(_q);
  });
  st.therapist.position.set(THERAPIST.x, 0, THERAPIST.z);
  st.therapist.rotation.y = THERAPIST.yaw;
  // the mesh hands land just outside the palm boxes
  _v.set(0, 0, 0.05).applyQuaternion(_q);
  _l.copy(st.hands[0].position).add(_v); _r.copy(st.hands[1].position).add(_v);
  // the therapist faces the client's back, so the client's left-of-spine hand is the therapist's right
  poseReaching(st.therapist, THERAPIST_LEAN, _r, _l);
}
