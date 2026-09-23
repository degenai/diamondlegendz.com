// "Wasted"-style run end (DESIGN.md ARREST / DEATH / ESCAPE): time scale 0.25 for 2 s of real
// time with input ignored, the camera tilts 12 degrees and drifts back, the canvas desaturates
// (CSS filter), and a red stamp slams in. main.js scales the fixed-step dt by ctx.timeScale.
import * as THREE from '../../vendor/three.module.js';

export const SLOW = 0.25;
export const DURATION = 2;
const TILT = THREE.MathUtils.degToRad(12);
const DRIFT = 1.6;            // metres the camera backs off over the slow motion
const STAMPS = { arrest: 'ARRESTED', death: 'OVERWORKED', escape: 'ESCAPED', left: 'LEFT THE CHAIR' };

// Input while the slow motion plays: nothing held, nothing pressed.
export const NEUTRAL = Object.freeze({
  keys: new Set(), pressed: new Set(), released: new Set(), forward: false, back: false, left: false,
  right: false, shift: false, space: false, spacePressed: false, e: false, ePressed: false,
  mouseButtons: new Set(), mouseLeft: false, mouseRight: false, clicked: new Set(), leftClicked: false,
  dx: 0, dy: 0, mouseX: -1, mouseY: -1, locked: false,
});

let S = null;
const _back = new THREE.Vector3();

export function startSlowmo(ctx, reason) {
  const cam = ctx.camera;
  S = { t: 0, reason, pos: cam.position.clone(), q: cam.quaternion.clone(), log: [] };
  cam.getWorldDirection(_back).multiplyScalar(-1);
  _back.y = Math.abs(_back.y) + 0.35;
  S.dir = _back.clone().normalize();
  ctx.timeScale = SLOW;
  document.body.classList.add('slowmo');
  ctx.hud.showStamp(STAMPS[reason] || 'ESCAPED', reason === 'escape' || reason === 'left' ? 'escape' : 'bad');
}

// Per fixed tick (real dt), after the slowed simulation. Returns true when it is over.
export function tickSlowmo(dt, ctx) {
  if (!S) return true;
  S.t += dt;
  const k = Math.min(1, S.t / DURATION), e = 1 - (1 - k) * (1 - k);
  const cam = ctx.camera;
  cam.position.copy(S.pos).addScaledVector(S.dir, DRIFT * e);
  cam.quaternion.copy(S.q);
  cam.rotateZ(TILT * e);
  cam.updateMatrixWorld();
  if (S.log.length < 64 && Math.floor(S.t * 10) !== Math.floor((S.t - dt) * 10)) S.log.push([+S.t.toFixed(2), ctx.timeScale]);
  if (S.t >= DURATION) { ctx.timeScale = 1; return true; }
  return false;
}

export function slowmoLog() { return S ? S.log.slice() : []; }

export function clearSlowmo(ctx) {
  ctx.timeScale = 1;
  document.body.classList.remove('slowmo');
  ctx.hud.hideStamp();
}
