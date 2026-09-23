// Seeded downtown plaza block: buildBlock(seed, scene) -> world.
// Plaza + fountain terrace (0..44), inner sidewalk (44..48), ring road (48..56), outer sidewalk
// (56..60), low-rise lots (60..80) with two dead-end alleys, one escape street through a 12 m gap,
// and the pavilion beside the terrace. See DESIGN.md "World".
import * as THREE from '../../vendor/three.module.js';
import { makeRng } from '../rng.js';
import { createBatch, buildBatch } from './batch.js';
import { buildNav } from './nav.js';
import { buildStreets } from './streets.js';
import { buildPlaza, createPlacer, CHAIR_SPOT } from './plaza.js';
import { buildFurniture } from './furniture.js';
import { buildBuildings } from './buildings.js';
import { planParking, loadParked } from './cars.js';
import { SIZE, EDGES, GAP_HALF, ESC_WALL, ROAD_OUT, DECK_HALF, SIDE, toXZ, sideBox } from './layout.js';

const DEG = Math.PI / 180;
const ASPHALT = 0x3d3f43;

function shuffle(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Late afternoon: WSW sun, seeded +-30 deg azimuth, 18..30 deg elevation, fog +-20%, warm haze.
function planSun(rng) {
  const azimuth = 247.5 + rng.range(-30, 30);   // compass degrees (0 = north = -Z, 90 = east = +X)
  const elevation = rng.range(18, 30);
  const a = azimuth * DEG, e = elevation * DEG;
  const dir = new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
  const warmth = rng.range(0.3, 0.55);
  const sky = new THREE.Color(0xbcd6e8).lerp(new THREE.Color(0xf2c690), warmth);
  const light = new THREE.Color(0xfff2dd).lerp(new THREE.Color(0xffb870), 0.15 + ((30 - elevation) / 12) * 0.3);
  return {
    azimuth, elevation, dir,
    color: light.getHex(), intensity: 1.7,
    sky: sky.getHex(),
    hemiSky: sky.clone().lerp(new THREE.Color(0xe6efff), 0.45).getHex(), ground: 0x8a7a68, hemi: 1.25,
    fogNear: 50 * rng.range(0.8, 1.2), fogFar: 210 * rng.range(0.8, 1.2),
  };
}

function escapeMarker(edge, g) {
  const group = new THREE.Group();
  group.name = 'escapeMarker';
  const [x, z] = toXZ(edge, g, 76);
  group.position.set(x, 0, z);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.6, 3.2, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xf2c230, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.position.y = 0.04;
  const pillar = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 9, 1.1),
    new THREE.MeshBasicMaterial({ color: 0xf0a818, transparent: true, opacity: 0.55, depthWrite: false }),
  );
  pillar.position.y = 4.5;
  pillar.name = 'escapePillar';
  group.add(ring, pillar);
  return group;
}

export function buildBlock(seed, scene) {
  seed = seed >>> 0;
  const rng = makeRng(seed);
  const sub = (k) => makeRng((seed ^ Math.imul(k, 0x9e3779b1)) >>> 0 || k);

  const escEdge = EDGES[rng.int(0, 3)];
  const esc = { edge: escEdge, g: Math.round(rng.range(-1, 1) * (escEdge === 'N' || escEdge === 'S' ? 30 : 22)) };
  const variant = shuffle(rng, ['diag', 'ring', 'grid']).slice(0, 2).sort();
  const stepAxis = rng.next() < 0.5 ? 'NS' : 'EW';

  const root = new THREE.Group();
  root.name = 'block';
  scene.add(root);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: ASPHALT }),
  );
  ground.name = 'ground';
  root.add(ground);

  const colliders = [];
  const batch = createBatch();
  const nav = buildNav({ stepAxis, diag: variant.includes('diag'), ring: variant.includes('ring') });
  const placer = createPlacer(nav);
  const B = { batch, colliders, esc, variant, stepAxis, placer, nav };

  buildStreets({ ...B, rng: sub(1) });
  const plaza = buildPlaza({ ...B, rng: sub(2), pavRng: sub(9) });
  const furn = buildFurniture({ ...B, rng: sub(3) });
  const bld = buildBuildings({ ...B, rng: sub(4), alleyRng: sub(8) });

  root.add(buildBatch(batch, 'blockStatic'), bld.windows, bld.sign, ...furn.meshes);
  const marker = escapeMarker(esc.edge, esc.g);
  root.add(marker);

  // Spawns.
  const parking = planParking(sub(5), esc);
  const prng = sub(6);
  const pedIdx = shuffle(prng, nav.points.map((_, i) => i)).slice(0, 16);
  const vanEdge = prng.pick(EDGES.filter((e) => e !== esc.edge));
  const [vx, vz] = toXZ(vanEdge, prng.pick([-30, 30]), (DECK_HALF + ROAD_OUT) / 2 - 2); // inner lane
  const [fx, fz] = SIDE[vanEdge].out;
  const spawns = {
    parking: parking.map((p) => ({ pos: p.pos.clone(), yaw: p.yaw, edge: p.edge, colour: p.colour })),
    peds: pedIdx.map((i) => nav.points[i].clone()),
    vanEntry: { pos: new THREE.Vector3(vx, 0, vz), yaw: Math.atan2(-fz, fx), edge: vanEdge },
    escape: {
      edge: esc.edge,
      zone: sideBox(esc.edge, esc.g - GAP_HALF, esc.g + GAP_HALF, 66, ESC_WALL, Infinity),
      marker,
      centre: marker.position.clone(),
    },
  };

  const world = {
    seed, size: SIZE, root, ground, colliders,
    chairSpot: CHAIR_SPOT.clone(),
    nav, spawns,
    escapeEdge: esc.edge,
    serenity: bld.serenity ? { aabb: bld.serenity.aabb, sign: bld.serenity.sign, door: bld.serenity.door, edge: bld.serenity.edge } : null,
    sun: planSun(sub(7)),
    layout: { variant, stepAxis, stepEdges: plaza.stepEdges, gap: esc.g },
    lots: bld.lots, alleys: bld.alleys, pavilion: plaza.pavilion, carts: furn.carts, benches: furn.benches, trees: furn.trees,
    parked: [],
    ready: null,
  };
  world.ready = loadParked(world, root, parking);
  return world;
}
