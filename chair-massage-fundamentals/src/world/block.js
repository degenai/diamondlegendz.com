// Phase 1 placeholder block. Phase 3 replaces this with the seeded generator.
import * as THREE from '../../vendor/three.module.js';
import { mat } from './props.js';
import { makeRng } from '../rng.js';

const SIZE = 160;
const INNER = 120;
const ROAD_W = 10;

function addBox(scene, w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  scene.add(m);
  return m;
}

function aabbOf(x, z, w, d, h = Infinity) {
  return { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, maxY: h };
}

export function buildBlock(seed, scene) {
  const rng = makeRng(seed);
  const colliders = [];

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), mat(0x5d9b4a));
  ground.rotation.x = -Math.PI / 2;
  ground.name = 'ground';
  scene.add(ground);

  // Ring road: four flat strips hugging the outside of the inner square.
  const half = INNER / 2 + ROAD_W / 2;
  const len = INNER + ROAD_W * 2;
  addBox(scene, len, 0.04, ROAD_W, 0x3a3d42, 0, 0.02, -half);
  addBox(scene, len, 0.04, ROAD_W, 0x3a3d42, 0, 0.02, half);
  addBox(scene, ROAD_W, 0.04, INNER, 0x3a3d42, -half, 0.02, 0);
  addBox(scene, ROAD_W, 0.04, INNER, 0x3a3d42, half, 0.02, 0);

  // Corner placeholder buildings just inside the ring.
  const c = INNER / 2 - 10;
  const colors = [0xb9a58c, 0x8c9bb0, 0xa98b7a, 0x9aa28a];
  [[-c, -c], [c, -c], [-c, c], [c, c]].forEach(([x, z], i) => {
    const w = 14, d = 14, h = rng.range(8, 20);
    addBox(scene, w, h, d, colors[i], x, h / 2, z);
    colliders.push(aabbOf(x, z, w, d, h));
  });

  // Invisible perimeter walls keep the player on the block.
  const edge = SIZE / 2;
  colliders.push({ minX: -edge - 2, maxX: edge + 2, minZ: -edge - 2, maxZ: -edge, maxY: Infinity });
  colliders.push({ minX: -edge - 2, maxX: edge + 2, minZ: edge, maxZ: edge + 2, maxY: Infinity });
  colliders.push({ minX: -edge - 2, maxX: -edge, minZ: -edge, maxZ: edge, maxY: Infinity });
  colliders.push({ minX: edge, maxX: edge + 2, minZ: -edge, maxZ: edge, maxY: Infinity });

  // Chair spot at origin (the massage module places the baked chair here).
  const chairSpot = new THREE.Vector3(0, 0, 0);

  return { ground, colliders, chairSpot, size: SIZE };
}
