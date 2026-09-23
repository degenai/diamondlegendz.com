// Pooled particle puffs (Phase 7 juice): one InstancedMesh of tiny unlit boxes with per-instance
// colour, so every puff in the game is a single draw call. No textures, no transparency: a
// particle fades by shrinking. State lives in flat typed arrays; nothing allocates per tick.
import * as THREE from '../vendor/three.module.js';

const N = 256;
const F = 10; // x y z vx vy vz t life size grav
const KINDS = {
  // count, speed, up, life, size (m), gravity, drag, spread (m, start jitter), pop (full size at birth), colours
  dust:   { n: 8, sp: [0.6, 1.8], up: [0.6, 1.6], life: [0.45, 0.8], size: 0.16, grav: 1.5, drag: 2.5, spread: 0.1, pop: 0, cols: [0xb9a88a, 0xa39478, 0xcfc3a8] },
  sparks: { n: 14, sp: [3.5, 8], up: [1.5, 5], life: [0.22, 0.45], size: 0.07, grav: 16, drag: 0.6, spread: 0.15, pop: 1, cols: [0xffd35a, 0xffa030, 0xfff4c8] },
  impact: { n: 18, sp: [2, 5], up: [0.5, 3.5], life: [0.2, 0.4], size: 0.1, grav: 6, drag: 1.5, spread: 0.3, pop: 1, cols: [0xfff4c8, 0xffe14a, 0xffa030] },
  relief: { n: 16, sp: [0.6, 1.6], up: [1.4, 2.8], life: [0.7, 1.1], size: 0.09, grav: -0.8, drag: 1.8, spread: 0.25, pop: 0, cols: [0x7ff0c0, 0x9cf29a, 0xd8ffe8] },
};

export function createParticles(scene) {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), N);
  mesh.name = 'particles';
  mesh.frustumCulled = false;
  mesh.count = 0;
  mesh.visible = false;
  const col = new THREE.Color(1, 1, 1);
  for (let i = 0; i < N; i++) mesh.setColorAt(i, col);
  scene.add(mesh);
  return { mesh, d: new Float32Array(N * F), drag: new Float32Array(N), pop: new Uint8Array(N), next: 0, top: 0, alive: 0, m: new THREE.Matrix4(), c: new THREE.Color() };
}

const rnd = (r) => r[0] + Math.random() * (r[1] - r[0]);

// A burst of `kind` at (x, y, z). dirX/dirZ bias the spray (sparks off a wall, dust behind a tyre).
export function burst(P, kind, x, y, z, count, dirX = 0, dirZ = 0) {
  const K = KINDS[kind];
  if (!P || !K) return;
  const n = count || K.n, d = P.d;
  for (let k = 0; k < n; k++) {
    let i = P.next;
    // Pool full: take the slot nearest death instead of clobbering a fresh particle.
    if (P.alive >= N && d[i * F + 7] > 0) {
      let best = i, bl = Infinity;
      for (let q = 0; q < N; q++) { const l = d[q * F + 7]; if (l <= 0) { best = q; break; } if (l < bl) { bl = l; best = q; } }
      i = best;
    }
    P.next = (i + 1) % N;
    const o = i * F, a = Math.random() * Math.PI * 2, s = rnd(K.sp);
    const j = K.spread;
    d[o] = x + (Math.random() - 0.5) * 2 * j; d[o + 1] = y + (Math.random() - 0.5) * 2 * j; d[o + 2] = z + (Math.random() - 0.5) * 2 * j;
    d[o + 3] = Math.cos(a) * s + dirX * s; d[o + 4] = rnd(K.up); d[o + 5] = Math.sin(a) * s + dirZ * s;
    d[o + 6] = 0; d[o + 7] = rnd(K.life); d[o + 8] = K.size * (0.7 + Math.random() * 0.6); d[o + 9] = K.grav;
    P.c.setHex(K.cols[k % K.cols.length]);
    P.mesh.setColorAt(i, P.c);
    if (i + 1 > P.top) P.top = i + 1;
    P.drag[i] = K.drag; P.pop[i] = K.pop;
  }
  P.mesh.instanceColor.needsUpdate = true;
  P.alive += n;
}

// Per sim tick: integrate, shrink, write matrices for the live range only.
export function updateParticles(P, dt) {
  if (!P || P.alive <= 0) { if (P && P.mesh.visible) { P.mesh.count = 0; P.mesh.visible = false; } return; }
  const d = P.d, m = P.m.elements;
  let alive = 0, top = 0;
  for (let i = 0; i < P.top; i++) {
    const o = i * F;
    if (d[o + 7] <= 0) { P.mesh.setMatrixAt(i, ZERO); continue; }
    d[o + 6] += dt;
    const k = d[o + 6] / d[o + 7];
    if (k >= 1) { d[o + 7] = 0; P.mesh.setMatrixAt(i, ZERO); continue; }
    const drag = Math.exp(-P.drag[i] * dt);
    d[o + 3] *= drag; d[o + 5] *= drag;
    d[o + 4] -= d[o + 9] * dt;
    d[o] += d[o + 3] * dt; d[o + 1] += d[o + 4] * dt; d[o + 2] += d[o + 5] * dt;
    if (d[o + 1] < 0.02 && d[o + 4] < 0) { d[o + 1] = 0.02; d[o + 4] *= -0.3; d[o + 3] *= 0.6; d[o + 5] *= 0.6; }
    const s = d[o + 8] * (k < 0.2 ? (P.pop[i] ? 1 : 0.6 + 2 * k) : 1 - (k - 0.2) / 0.8);
    m[0] = s; m[1] = 0; m[2] = 0; m[3] = 0; m[4] = 0; m[5] = s; m[6] = 0; m[7] = 0;
    m[8] = 0; m[9] = 0; m[10] = s; m[11] = 0; m[12] = d[o]; m[13] = d[o + 1]; m[14] = d[o + 2]; m[15] = 1;
    P.mesh.setMatrixAt(i, P.m);
    alive++; top = i + 1;
  }
  P.alive = alive; P.top = top;
  P.mesh.count = top;
  P.mesh.visible = top > 0;               // no draw call at all while nothing is live
  P.mesh.instanceMatrix.needsUpdate = true;
}

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export function clearParticles(P) {
  if (!P) return;
  for (let i = 0; i < N; i++) P.d[i * F + 7] = 0;
  P.alive = 0; P.top = 0; P.mesh.count = 0; P.mesh.visible = false;
}
