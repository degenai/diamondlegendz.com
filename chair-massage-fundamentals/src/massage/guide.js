// Stroke guide: a world-anchored ring on the client's back that moves per modality.
// The mouse test projects the ring to screen each tick and checks the projected ellipse.
import * as THREE from '../../vendor/three.module.js';
import { MODALITIES } from './clients.js';

const WHITE = new THREE.Color(0xfdf8ea);
const RED = new THREE.Color(0xe0322c);
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
    inside: false, screen: { x: 0, y: 0, r: 0 }, world: new THREE.Vector3(),
  };
}

export function modality(g) { return MODALITIES[g.modalityIdx]; }

export function cycleModality(g) {
  g.modalityIdx = (g.modalityIdx + 1) % MODALITIES.length;
  g.t = 0;
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
  if (m === 'Swedish') { // long slow ellipse, long axis up the spine, 3 s period
    const w = (t / 3) * Math.PI * 2;
    g.u = 0.09 * Math.sin(w); g.v = 0.16 * Math.cos(w); g.radius = g.baseRadius;
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
  g.mesh.material.color.copy(inside ? WHITE : RED);
  return inside;
}
