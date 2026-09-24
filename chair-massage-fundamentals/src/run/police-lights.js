// Police light bars: unlit red and blue halves that swap bright/dim at 4 Hz. setupLights also sets
// v.lights, the hook audio-wire.js reads to run the vehicle's siren. Was run/lights.js.
import * as THREE from '../../vendor/three.module.js';

// Unlit per-vehicle light bar: red and blue halves swap bright/dim at 4 Hz.
export function setupLights(v) {
  const bar = v.mesh.getObjectByName('lightbar');
  if (!bar || !bar.geometry) return;
  const geo = bar.geometry.clone();
  const col = geo.getAttribute('color');
  const red = [], blue = [];
  for (let i = 0; i < col.count; i++) {
    const r = col.getX(i), b = col.getZ(i);
    if (r > 0.5 && b < 0.1) red.push(i); else if (b > 0.5 && r < 0.1) blue.push(i);
  }
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true });
  bar.geometry = geo; bar.material = mat;
  v.lightbar = { geo, mat, red, blue, phase: -1, toggles: 0 };
  v.lights = true;
}

export function updateLights(v, time) {
  if (!v || v.removed || !v.lightbar) return;
  const L = v.lightbar;
  const phase = v.lights ? Math.floor(time * 4) % 2 : 2;
  if (phase === L.phase) return;
  L.phase = phase; L.toggles++;
  const col = L.geo.getAttribute('color');
  const rOn = phase === 0, bOn = phase === 1;
  for (const i of L.red) col.setXYZ(i, rOn ? 1 : 0.18, rOn ? 0.08 : 0.01, rOn ? 0.06 : 0.01);
  for (const i of L.blue) col.setXYZ(i, bOn ? 0.1 : 0.01, bOn ? 0.35 : 0.03, bOn ? 1 : 0.16);
  col.needsUpdate = true;
}

// Every car of a police unit flashes (updatePolice, once per tick).
export function flashUnit(u, time) {
  for (const v of [u.v, ...(u.cars || [])]) if (v) updateLights(v, time);
}

// A police vehicle leaving the scene gives its light bar's geometry and material back.
export function disposeLights(v) {
  if (v.lightbar) { v.lightbar.geo.dispose(); v.lightbar.mat.dispose(); }
}
