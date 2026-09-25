// Stroke guide: a world-anchored ring on the client's back that moves per modality.
// The mouse test projects the ring to screen each tick and checks the projected ellipse.
import * as THREE from '../../vendor/three.module.js';
import { MODALITIES } from './clients.js';

const WHITE = new THREE.Color(0xfdf8ea);
const GREEN = new THREE.Color(0x9be08a);
const RED = new THREE.Color(0xe0322c);
// Motion per modality (owner ruling 2026-09-23, third play: the rings were wide and barely moved).
// Distances are back-frame metres, times seconds at 1x travel speed; clients scale the speed.
const SWEDISH = { a: 0.22, b: 0.10, period: 3, top: 0.06 }; // long ellipse across the whole back
// 12 cm peak to peak across the fibres, worked slowly up and down the band (8 cm, 3 s): the jitter
// alone is narrower than the ring, so a parked cursor at its middle would never fall out.
const CROSS = { amp: 0.06, period: 0.5, sweep: 0.08, sweepPeriod: 3, top: 0.08 };
const TRIGGER = { speed: 0.02, box: 0.03, shrink: 4, turn: 5 }; // 2 cm/s walk in a 6 cm box
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
    mesh, modalityIdx: 0, t: 0, clock: 0, speed: 1, baseRadius: 0.09, radius: 0.09, u: 0, v: 0, spineV: 0,
    walk: { x: 0, y: 0, h: 0.7, seed: 12345 },
    inside: false, screen: { x: 0, y: 0, r: 0, ax: 0, ay: 0, bx: 0, by: 0, inside: false }, world: new THREE.Vector3(),
  };
}

export function modality(g) { return MODALITIES[g.modalityIdx]; }

// A = back (-1), D = forward (+1) through Swedish, Cross-fiber, Trigger point (wraps).
export function cycleModality(g, dir = 1) {
  const n = MODALITIES.length;
  g.modalityIdx = (g.modalityIdx + (dir < 0 ? n - 1 : 1)) % n;
  resetPattern(g);
}

// Space: straight to the named modality (the one the client asked for). No-op when already there.
export function setModality(g, name) {
  const i = MODALITIES.indexOf(name);
  if (i < 0 || i === g.modalityIdx) return false;
  g.modalityIdx = i;
  resetPattern(g);
  return true;
}

// Fresh pattern: clocks at zero, the trigger point walk back at the centre of its box.
export function resetPattern(g) {
  g.t = 0; g.clock = 0;
  g.walk.x = 0; g.walk.y = 0;
}

// The ring's colour is the last call's result (owner ruling 2026-09-24, call and response): green
// for a second after a right answer, red after a wrong or late one, white otherwise. Off the ring
// (cursor outside) it dims instead. flash: 'ok' | 'bad' | null.
export function toneGuide(g, flash) {
  g.mesh.material.color.copy(flash === 'bad' ? RED : flash === 'ok' ? GREEN : WHITE);
  g.mesh.material.opacity = g.inside ? 0.95 : 0.35;
}

export function disposeGuide(g, scene) {
  scene.remove(g.mesh);
  g.mesh.geometry.dispose();
  g.mesh.children[0].geometry.dispose();
  g.mesh.material.dispose();
}

// Deterministic per-guide noise for the trigger point walk (no Math.random: tests stay repeatable).
function rnd(w) {
  w.seed = (Math.imul(w.seed, 1664525) + 1013904223) >>> 0;
  return w.seed / 4294967296;
}

// g.clock runs at the client's travel speed (0.8x / 1x / 1.2x); g.t is real time for the shrink.
function pattern(g, dt) {
  const m = modality(g);
  if (m === 'Swedish') { // long ellipse across the back, centred low enough to stay off the neck
    const w = (g.clock / SWEDISH.period) * Math.PI * 2;
    g.u = SWEDISH.a * Math.sin(w);
    g.v = Math.min(g.spineV, SWEDISH.top) - g.spineV + SWEDISH.b * Math.cos(w);
    g.radius = g.baseRadius;
  } else if (m === 'Cross-fiber') { // fast back-and-forth across the fibres, slowly along them
    g.u = CROSS.amp * Math.sin((g.clock / CROSS.period) * Math.PI * 2);
    g.v = Math.min(g.spineV, CROSS.top) - g.spineV + CROSS.sweep * Math.sin((g.clock / CROSS.sweepPeriod) * Math.PI * 2);
    g.radius = g.baseRadius;
  } else { // trigger point: a slow random walk in a small box while it shrinks over 4 s, then resets
    const w = g.walk, step = TRIGGER.speed * g.speed * dt, b = TRIGGER.box;
    w.h += (rnd(w) - 0.5) * 2 * TRIGGER.turn * dt;
    w.x += Math.cos(w.h) * step; w.y += Math.sin(w.h) * step;
    if (Math.abs(w.x) > b) { w.x = Math.sign(w.x) * (2 * b - Math.abs(w.x)); w.h = Math.PI - w.h; }
    if (Math.abs(w.y) > b) { w.y = Math.sign(w.y) * (2 * b - Math.abs(w.y)); w.h = -w.h; }
    g.u = w.x; g.v = w.y;
    g.radius = g.baseRadius * (1 - 0.45 * ((g.t % TRIGGER.shrink) / TRIGGER.shrink)); // shrinks to 55%, never a pinhole
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
  g.clock += dt * g.speed;
  pattern(g, dt);
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
  g.screen.inside = inside;
  g.screen.x = _sc.x; g.screen.y = _sc.y;
  g.screen.r = (Math.hypot(ax, ay) + Math.hypot(bx, by)) / 2;
  g.screen.ax = ax; g.screen.ay = ay; g.screen.bx = bx; g.screen.by = by; // for the HUD labels
  return inside;
}
