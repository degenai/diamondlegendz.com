// The district: buildDistrict(seed, scene) -> world. A GRID x GRID tiling of the seeded block
// (block.js). The chair's plaza block sits at grid PLAZA_IJ and keeps the origin; the other
// fifteen get a plain centre picked by their own seed (the run seed mixed with the block index,
// so the district is deterministic). Link streets join neighbouring rings, walls stand only on
// the district edge, and the one escape street leaves the corner block farthest from the plaza,
// on one of its two outer sides. Also the lighting plan, the backdrop outside the walls, the
// merged pedestrian nav graph and the street graph for AI drivers (roads.js).
import * as THREE from '../../vendor/three.module.js';
import { makeRng } from '../rng.js';
import { buildBlockPart, plazaLink } from './block.js';
import { createBatch, buildBatch } from './batch.js';
import { addSpur } from './nav.js';
import { buildRoads } from './roads.js';
import { sideSlab, BACKDROP } from './streets.js';
import { CENTRES } from './centres.js';
import { SIZE, HALF, GAP_HALF, OUTER_WALK, toXZ } from './layout.js';
import { GRID, PLAZA_IJ, blockCentre, neighbourEdges, DMIN, DMAX, escapeCorner } from './district-layout.js';

const DEG = Math.PI / 180;
const ASPHALT = 0x3d3f43;

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
    fogNear: 75 * rng.range(0.8, 1.2), fogFar: 315 * rng.range(0.8, 1.2), // 1.5x (2026-09-24): landmarks read across the district
  };
}

export function blockSeed(seed, index) {
  let h = (seed ^ Math.imul(index + 1, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  return (h ^ (h >>> 15)) >>> 0;
}

// Pedestrian links through a link street: a sidewalk line down each side (u = +-5), from this
// block's outer walk to the block edge, where the neighbour's matching spur meets it.
function linkSpurs(part) {
  const [cx, cz] = part.centre;
  for (const q of part.gaps) {
    if (q.kind !== 'link') continue;
    for (const s of [-5, 5]) {
      const P = (d) => { const [x, z] = toXZ(q.edge, q.g + s, d); return { x: x + cx, z: z + cz }; };
      addSpur(part.nav, P(OUTER_WALK), [P(66), P(73), P(HALF)]);
    }
  }
}

// Merge the per-block graphs; points within 5 cm (the shared link-spur ends) become one.
function mergeNav(parts) {
  const points = [], edges = [], index = new Map(), set = new Set();
  for (const P of parts) {
    const map = P.nav.points.map((p) => {
      const k = `${Math.round(p.x * 20)},${Math.round(p.z * 20)},${Math.round(p.y * 10)}`;
      let i = index.get(k);
      if (i === undefined) { i = points.length; points.push(p); index.set(k, i); }
      return i;
    });
    for (const [a, b] of P.nav.edges) {
      const i = map[a], j = map[b];
      if (i === j) continue;
      const k = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (set.has(k)) continue;
      set.add(k); edges.push(i < j ? [i, j] : [j, i]);
    }
    P.navMap = map;
  }
  return { points, edges };
}

// Plain massing with ribbon windows outside the district walls (no colliders).
function buildBackdrop(rng, escape, lo = DMIN, hi = DMAX) {
  const b = createBatch();
  const c = (lo + hi) / 2, H = (hi - lo) / 2;
  for (const e of ['N', 'E', 'S', 'W']) {
    let u = -H - 50;
    while (u < H + 50) {
      const w = Math.min(rng.range(14, 30), H + 50 - u);
      const u0 = u, u1 = u + w;
      u = u1 + rng.range(0, 1.5);
      if (w < 4) continue;
      if (escape && escape.edge === e) {
        const g = (e === 'N' || e === 'S' ? escape.centre.x : escape.centre.z) - c;
        if (u1 > g - GAP_HALF - 2 && u0 < g + GAP_HALF + 2) continue;
      }
      const d0 = H + 4 + rng.range(0, 5), d1 = d0 + rng.range(12, 30);
      const floors = rng.int(2, 8), h = floors * 3.2;
      sideSlab(b, e, u0, u1, d0, d1, 0, h, BACKDROP[Math.floor(rng.next() * BACKDROP.length)]);
      for (let f = 0; f < floors; f++) sideSlab(b, e, u0 + 1, u1 - 1, d0 - 0.06, d0, f * 3.2 + 1.1, f * 3.2 + 2.4, 0x3a4450);
    }
  }
  const m = buildBatch(b, 'backdrop');
  m.position.set(c, 0, c);
  m.updateMatrix();
  return m;
}

// single (or ?blocks=1 in the page URL): just the plaza block, walled all round with its own
// escape street, as the game was before the district (for comparison).
export function buildDistrict(seed, scene, single = typeof location !== 'undefined' && new URLSearchParams(location.search).get('blocks') === '1') {
  seed = seed >>> 0;
  const sub = (k) => makeRng((seed ^ Math.imul(k, 0x9e3779b1)) >>> 0 || k);
  const root = new THREE.Group();
  root.name = 'district';
  scene.add(root);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: ASPHALT }));
  ground.name = 'ground';
  ground.position.set((DMIN + DMAX) / 2, 0, (DMIN + DMAX) / 2);
  root.add(ground);

  // The escape block: the corner farthest from the plaza block; its outer sides are candidates.
  const [ei, ej] = escapeCorner();
  // Links: the middle of every interior side, except round the plaza, whose one link street is its
  // old escape gap (the neighbour on that side meets it at the same offset).
  const pl = plazaLink(seed), OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
  const STEP = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
  const linksOf = (i, j) => neighbourEdges(i, j).flatMap((e) => {
    const ni = i + STEP[e][0], nj = j + STEP[e][1];
    if (ni === PLAZA_IJ[0] && nj === PLAZA_IJ[1]) return OPP[e] === pl.edge ? [{ edge: e, g: pl.g }] : [];
    return [{ edge: e, g: 0 }];
  });
  const parts = [];
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const index = j * GRID + i;
      const plaza = i === PLAZA_IJ[0] && j === PLAZA_IJ[1];
      if (single && !plaza) continue;
      const bseed = plaza ? seed : blockSeed(seed, index);
      const links = single ? [] : linksOf(i, j);
      const wallEdges = single ? ['N', 'E', 'S', 'W'] : ['N', 'E', 'S', 'W'].filter((e) => !neighbourEdges(i, j).includes(e));
      const kind = plaza ? 'plaza' : CENTRES[makeRng(bseed ^ 0x51ed27).int(0, CENTRES.length - 1)];
      const escEdges = single || (i === ei && j === ej) ? wallEdges : [];
      const part = buildBlockPart({ seed: bseed, kind, centre: blockCentre(i, j), links, wallEdges, escEdges, index, single });
      part.ij = [i, j];
      linkSpurs(part);
      root.add(part.group);
      parts.push(part);
    }
  }
  const plazaPart = parts.find((p) => p.kind === 'plaza');
  const escPart = parts.find((p) => p.escape);
  root.add(single ? buildBackdrop(sub(12), escPart.escape, -HALF, HALF) : buildBackdrop(sub(12), escPart.escape));

  const colliders = [];
  for (const P of parts) for (const c of P.colliders) colliders.push(c);
  const nav = mergeNav(parts);
  const roads = buildRoads(parts);
  const pedIdx = plazaPart.pedIdx.map((i) => plazaPart.navMap[i]);
  for (const P of parts) {                     // spur ids into the merged graph's numbering
    for (const A of P.alleys) if (A.nav) A.nav = A.nav.map((i) => P.navMap[i]);
    if (P.pavilion && P.pavilion.nav) P.pavilion.nav = P.pavilion.nav.map((i) => P.navMap[i]);
  }

  const world = {
    seed, size: SIZE, root, ground, colliders, nav, roads, blocks: parts, single,
    chairSpot: plazaPart.chairSpot.clone(),
    spawns: {
      parking: parts.flatMap((P) => P.parking.map((p) => ({ pos: p.pos.clone(), yaw: p.yaw, edge: p.edge, colour: p.colour, block: P.index, lot: !!p.lot }))),
      peds: pedIdx.map((i) => nav.points[i].clone()),
      vanEntry: plazaPart.vanEntry,
      escape: escPart.escape,
    },
    escapeEdge: escPart.escape.edge,
    serenity: plazaPart.serenity,
    sun: planSun(sub(7)),
    layout: plazaPart.layout,
    lots: plazaPart.lots, alleys: plazaPart.alleys, pavilion: plazaPart.pavilion,
    carts: plazaPart.carts, benches: plazaPart.benches, trees: plazaPart.trees,
    parked: [],
    ready: null,
  };
  return world;
}
