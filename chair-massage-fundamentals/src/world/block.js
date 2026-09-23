// One seeded block: buildBlockPart(opts) -> part. The plaza block is the original downtown plaza
// (fountain terrace, pavilion, carts); the others keep the same ring road, lots and alleys with a
// plain centre (centres.js). Built in block-local coordinates, then offset into the district:
// meshes ride on a Group at the block centre, colliders / nav / spawns are moved to world XZ.
// Plaza + terrace (0..44), inner sidewalk (44..48), ring road (48..56), outer sidewalk (56..60),
// low-rise lots (60..80) with two dead-end alleys and a gap per link or escape street.
import * as THREE from '../../vendor/three.module.js';
import { makeRng } from '../rng.js';
import { createBatch, buildBatch } from './batch.js';
import { buildNav } from './nav.js';
import { buildStreets } from './streets.js';
import { buildPlaza, createPlacer, CHAIR_SPOT } from './plaza.js';
import { buildFurniture } from './furniture.js';
import { buildBuildings } from './buildings.js';
import { buildCentre, centreSpec } from './centres.js';
import { planParking, CAR_COLOURS } from './cars.js';
import { EDGES, GAP_HALF, ESC_WALL, ROAD_OUT, DECK_HALF, SIDE, toXZ, sideBox } from './layout.js';

function shuffle(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function escapeMarker(edge, g) {
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

function offsetCollider(c, dx, dz) {
  if (c.kind === 'cyl') { c.x += dx; c.z += dz; }
  else { c.minX += dx; c.maxX += dx; c.minZ += dz; c.maxZ += dz; }
  return c;
}

// opts: { seed, kind ('plaza' | 'parking' | 'green' | 'square'), centre: [cx, cz], links: edges
// with a link street, wallEdges: edges on the district edge, escEdges: candidate escape edges
// (only the escape block has any), index }.
export function buildBlockPart(opts) {
  const seed = opts.seed >>> 0;
  const rng = makeRng(seed);
  const sub = (k) => makeRng((seed ^ Math.imul(k, 0x9e3779b1)) >>> 0 || k);
  const [cx, cz] = opts.centre;
  const plaza = opts.kind === 'plaza';

  // The first draws are the original block's (escape edge and offset, variant, steps), so the
  // plaza block rolls the same layout for a seed as the single block did.
  const escPick = EDGES[rng.int(0, 3)];
  const escG = rng.range(-1, 1);
  const variant0 = shuffle(rng, ['diag', 'ring', 'grid']).slice(0, 2).sort();
  const stepAxis = rng.next() < 0.5 ? 'NS' : 'EW';
  let esc = null;
  if (opts.escEdges && opts.escEdges.length) {
    const edge = opts.escEdges.includes(escPick) ? escPick : opts.escEdges[rng.int(0, opts.escEdges.length - 1)];
    esc = { edge, g: Math.round(escG * (edge === 'N' || edge === 'S' ? 30 : 22)) };
  }
  const gaps = (opts.links || []).map((edge) => ({ edge, g: 0, kind: 'link' }));
  if (esc) gaps.push({ edge: esc.edge, g: esc.g, kind: 'escape' });

  const spec = plaza ? { variant: variant0, nav: { diag: variant0.includes('diag'), ring: variant0.includes('ring') } } : centreSpec(opts.kind, sub(10));
  const variant = spec.variant;
  const colliders = [];
  const batch = createBatch();
  const nav = buildNav({ stepAxis, ...spec.nav, plain: !plaza });
  const placer = createPlacer(nav, plaza);
  const B = { batch, colliders, esc, gaps, wallEdges: opts.wallEdges || [], variant, stepAxis, placer, nav, deckColor: spec.deckColor };

  buildStreets({ ...B, rng: sub(1) });
  let plazaInfo = null, centre = { spots: [], furn: undefined };
  if (plaza) plazaInfo = buildPlaza({ ...B, rng: sub(2), pavRng: sub(9) });
  else centre = buildCentre(opts.kind, { ...B, rng: sub(2) });
  const furn = buildFurniture({ ...B, rng: sub(3), furn: centre.furn });
  const bld = buildBuildings({ ...B, rng: sub(4), alleyRng: sub(8) });

  const group = new THREE.Group();
  group.name = 'block' + (opts.index ?? '');
  group.position.set(cx, 0, cz);
  const mesh = buildBatch(batch, 'blockStatic');
  group.add(mesh, bld.windows, bld.sign, ...furn.meshes);
  group.updateMatrixWorld(true);
  mesh.matrixAutoUpdate = false;

  // Into world coordinates.
  for (const c of colliders) offsetCollider(c, cx, cz);
  for (const p of nav.points) { p.x += cx; p.z += cz; }
  const W = (v) => { v.x += cx; v.z += cz; return v; };
  const colourRng = sub(11);
  const lotCars = centre.spots.map((s) => ({ ...s, colour: CAR_COLOURS[colourRng.int(0, CAR_COLOURS.length - 1)] }));
  const parking = [...planParking(sub(5), gaps), ...lotCars];
  for (const s of parking) { W(s.pos); s.block = opts.index; }
  const prng = sub(6);

  const part = {
    index: opts.index, kind: opts.kind, centre: [cx, cz], seed, group, colliders, nav, parking, gaps, esc,
    lots: bld.lots, alleys: bld.alleys, carts: furn.carts.map((c) => ({ ...c, pos: W(c.pos) })),
    benches: furn.benches.map((b) => ({ ...b, pos: W(b.pos) })), trees: furn.trees.map((t) => ({ ...t, x: t.x + cx, z: t.z + cz })),
    layout: { variant, stepAxis, stepEdges: plazaInfo ? plazaInfo.stepEdges : [], gap: esc ? esc.g : null },
    pedIdx: shuffle(prng, nav.points.map((_, i) => i)).slice(0, 16),
  };
  if (plaza) {
    part.chairSpot = CHAIR_SPOT.clone().add(new THREE.Vector3(cx, 0, cz));
    part.pavilion = plazaInfo.pavilion;
    part.serenity = bld.serenity ? { aabb: offsetCollider({ ...bld.serenity.aabb }, cx, cz), sign: W(bld.serenity.sign), door: W(bld.serenity.door), edge: bld.serenity.edge } : null;
    // The franchise van waits on the inner lane of a side (not the old escape draw's side).
    const vanEdge = prng.pick(EDGES.filter((e) => e !== escPick));
    const [vx, vz] = toXZ(vanEdge, prng.pick([-30, 30]), (DECK_HALF + ROAD_OUT) / 2 - 2);
    const [fx, fz] = SIDE[vanEdge].out;
    part.vanEntry = { pos: new THREE.Vector3(vx + cx, 0, vz + cz), yaw: Math.atan2(-fz, fx), edge: vanEdge };
  }
  if (esc) {
    const marker = escapeMarker(esc.edge, esc.g);
    group.add(marker);
    marker.updateMatrixWorld(true);
    part.escape = {
      edge: esc.edge,
      zone: offsetCollider(sideBox(esc.edge, esc.g - GAP_HALF, esc.g + GAP_HALF, 66, ESC_WALL, Infinity), cx, cz),
      marker,
      centre: marker.getWorldPosition(new THREE.Vector3()),
    };
  }
  return part;
}
