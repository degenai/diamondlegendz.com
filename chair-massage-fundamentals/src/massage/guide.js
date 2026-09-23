// Stroke guide: a world-anchored ring on the client's back that moves per modality.
// The mouse test projects the ring to screen each tick and checks the projected ellipse.
import * as THREE from '../../vendor/three.module.js';
import { MODALITIES } from './clients.js';

const WHITE = new THREE.Color(0xfdf8ea);
const GREEN = new THREE.Color(0x9be08a);
const RED = new THREE.Color(0xe0322c);
const SWEDISH_PERIOD = 4;    // s: the warm-up is the slow one
const SWEDISH_SCALE = 1.3;   // and the big one
const _c = new THREE.Vector3();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _sc = { x: 0, y: 0 }, _sa = { x: 0, y: 0 }, _sb = { x: 0, y: 0 };

export function createGuide(scene) {
  const material = new THREE.MeshBasicMaterial({
    color: WHITE, transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 40), material);
  mesh.renderOrder = 10;
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.08, 12), material);
  dot.renderOrder = 10;
  mesh.add(dot);
  scene.add(mesh);
  return {
    mesh, modalityIdx: 0, t: 0, baseRadius: 0.18, radius: 0.18, u: 0, v: 0, spineV: 0,
    inside: false, screen: { x: 0, y: 0, r: 0, ax: 0, ay: 0, bx: 0, by: 0 }, world: new THREE.Vector3(),
  };
}

export function modality(g) { return MODALITIES[g.modalityIdx]; }

// A = back (-1), D = forward (+1) through Swedish, Cross-fiber, Trigger point (wraps).
export function cycleModality(g, dir = 1) {
  const n = MODALITIES.length;
  g.modalityIdx = (g.modalityIdx + (dir < 0 ? n - 1 : 1)) % n;
  g.t = 0;
}

// The ring is the pressure gauge's colour too: red over the band, green in it, white under.
// Off the ring (cursor outside) it dims instead of turning red, so red only ever means "too hard".
export function toneGuide(g, zone) {
  g.mesh.material.color.copy(zone === 'over' ? RED : zone === 'in' ? GREEN : WHITE);
  g.mesh.material.opacity = g.inside ? 0.9 : 0.4;
}

export function disposeGuide(g, scene) {
  scene.remove(g.mesh);
  g.mesh.geometry.dispose();
  g.mesh.children[0].geometry.dispose();
  g.mesh.material.dispose();
}

function pattern(g) {
  const t = g.t;
  const m = modality(g);
  if (m === 'Swedish') { // long slow ellipse, long axis up the spine; the easy warm-up
    const w = (t / SWEDISH_PERIOD) * Math.PI * 2;
    g.u = 0.09 * Math.sin(w); g.v = 0.16 * Math.cos(w); g.radius = g.baseRadius * SWEDISH_SCALE;
  } else if (m === 'Cross-fiber') { // short fast back-and-forth, 8 cm travel, 0.6 s period
    g.u = 0.04 * Math.sin((t / 0.6) * Math.PI * 2); g.v = 0; g.radius = g.baseRadius;
  } else { // trigger point: stationary, shrinks over 4 s then releases
    g.u = 0; g.v = 0;
    g.radius = g.baseRadius * (1 - 0.55 * ((t % 4) / 4));
  }
}

function toScreen(v, camera, w, h, out) {
  _p.copy(v).project(camera);
  out.x = (_p.x + 1) * 0.5 * w;
  out.y = (1 - _p.y) * 0.5 * h;
  return out;
}

// back: Object3D whose +Z points out of the client's back (its matrixWorld must be current,
// and so must the camera's). w/h: viewport size in CSS pixels; mouse is absolute client coords.
export function updateGuide(g, dt, back, camera, mouseX, mouseY, w, h) {
  g.t += dt;
  pattern(g);
  _c.set(g.u, g.spineV + g.v, 0.04);
  back.localToWorld(_c);
  g.world.copy(_c);
  back.getWorldQuaternion(_q);
  g.mesh.position.copy(_c);
  g.mesh.quaternion.copy(_q);
  g.mesh.scale.setScalar(g.radius);

  // Projected ellipse: centre plus the two in-plane axes scaled by the radius.
  toScreen(_c, camera, w, h, _sc);
  toScreen(_p.set(g.radius, 0, 0).applyQuaternion(_q).add(_c), camera, w, h, _sa);
  toScreen(_p.set(0, g.radius, 0).applyQuaternion(_q).add(_c), camera, w, h, _sb);
  const ax = _sa.x - _sc.x, ay = _sa.y - _sc.y, bx = _sb.x - _sc.x, by = _sb.y - _sc.y;
  const dx = mouseX - _sc.x, dy = mouseY - _sc.y;
  const det = ax * by - ay * bx;
  let inside = false;
  if (Math.abs(det) > 1e-6) {
    const s = (dx * by - dy * bx) / det;
    const t = (ax * dy - ay * dx) / det;
    inside = s * s + t * t <= 1;
  }
  g.inside = inside;
  g.screen.x = _sc.x; g.screen.y = _sc.y;
  g.screen.r = (Math.hypot(ax, ay) + Math.hypot(bx, by)) / 2;
  g.screen.ax = ax; g.screen.ay = ay; g.screen.bx = bx; g.screen.by = by; // for the HUD gauge
  return inside;
}
