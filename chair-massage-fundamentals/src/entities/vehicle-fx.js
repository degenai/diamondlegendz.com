// Vehicle effects: a grey smoke puff loop from the bonnet at 0 hp (a few expanding, fading
// spheres; no textures). Vehicles dent and smoke, they never explode.
import * as THREE from '../../vendor/three.module.js';

const PUFFS = 6;
const LIFE = 1.6;
let puffGeo = null;

function makeSmoke(v) {
  if (!puffGeo) puffGeo = new THREE.SphereGeometry(0.22, 7, 5);
  const group = new THREE.Group();
  group.name = 'smoke';
  const puffs = [];
  for (let i = 0; i < PUFFS; i++) {
    const m = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({
      color: 0x8c8c8c, transparent: true, opacity: 0, depthWrite: false,
    }));
    m.userData.t = (i / PUFFS) * LIFE;
    group.add(m);
    puffs.push(m);
  }
  // Bonnet: front third of the body, just above the top of the hood.
  group.position.set(0, v.spec.height * 0.75, v.spec.halfL * 0.6);
  v.body.add(group);
  return { group, puffs };
}

export function updateFx(v, dt) {
  if (v.hp > 0) {
    if (v.smoke) v.smoke.group.visible = false;
    return;
  }
  if (!v.smoke) v.smoke = makeSmoke(v);
  v.smoke.group.visible = true;
  for (let i = 0; i < v.smoke.puffs.length; i++) {
    const m = v.smoke.puffs[i];
    let t = m.userData.t + dt;
    if (t > LIFE) t -= LIFE;
    m.userData.t = t;
    const k = t / LIFE;
    m.position.set(Math.sin(i * 2.1) * 0.2, k * 1.8, Math.cos(i * 1.7) * 0.2 - k * 0.3);
    m.scale.setScalar(0.6 + k * 2.2);
    m.material.opacity = 0.55 * (1 - k);
  }
}
