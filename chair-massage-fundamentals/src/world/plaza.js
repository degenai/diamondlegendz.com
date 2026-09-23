// The plaza: raised fountain terrace with steps, fountain, paths (seeded variant), planters and
// low walls. Furniture (carts, benches, trees) lives in furniture.js. Everything static is batched.
import * as THREE from '../../vendor/three.module.js';
import { addBox, addSlab, addCyl, addRing } from './batch.js';
import { distToNav, addSpur } from './nav.js';
import {
  PLAZA_HALF, DECK_Y, TERRACE_Y, TERRACE_HALF as TH, RING_R, EDGES, toXZ, sideBox, aabb,
} from './layout.js';

export const CHAIR_SPOT = new THREE.Vector3(0, TERRACE_Y, 8);

const TERRACE = 0xd6cbb3;
const STEP = 0xcabfa6;
const STONE = 0xbdb6a6;
const WATER = 0x4f9fc0;
const PATH_AXIS = 0xddd3bf;
const PATH_DIAG = 0xd2c3a3;
const PATH_RING = 0xb9a88c;
const CONCRETE = 0x9c948a;
const SOIL = 0x5a4632;
const GREEN = [0x4f7a3a, 0x5d8a3f, 0x3f6b35];

// Occupancy + placement test shared with furniture.js.
export function createPlacer(nav) {
  const occ = [aabb(-TH - 1.8, TH + 1.8, -TH - 1.8, TH + 1.8, 0)];
  const overlaps = (r, m) => occ.some((o) => r.minX < o.maxX + m && r.maxX > o.minX - m && r.minZ < o.maxZ + m && r.maxZ > o.minZ - m);
  return {
    occ,
    // Rect (w along X, d along Z) centred at x, z: inside the plaza, off the terrace, clear of
    // other props by `margin` and of every nav edge by `clear` (sampled over the rect).
    free(x, z, w, d, clear, margin = 0.6, bound = PLAZA_HALF) {
      const r = aabb(x - w / 2, x + w / 2, z - d / 2, z + d / 2, 0);
      if (r.minX < -bound || r.maxX > bound || r.minZ < -bound || r.maxZ > bound) return false;
      if (overlaps(r, margin)) return false;
      const nx = Math.max(1, Math.ceil(w)), nz = Math.max(1, Math.ceil(d));
      for (let i = 0; i <= nx; i++) {
        for (let j = 0; j <= nz; j++) {
          if (distToNav(nav, r.minX + (w * i) / nx, r.minZ + (d * j) / nz) < clear) return false;
        }
      }
      return true;
    },
    take(x, z, w, d) { occ.push(aabb(x - w / 2, x + w / 2, z - d / 2, z + d / 2, 0)); },
    nav,
  };
}

export function buildPlaza(B) {
  const { batch: b, colliders, rng, variant, stepAxis, placer } = B;

  // Terrace and its two flights of steps.
  addSlab(b, -TH, TH, -TH, TH, 0, TERRACE_Y, TERRACE);
  addSlab(b, -TH - 0.1, TH + 0.1, -TH - 0.1, TH + 0.1, TERRACE_Y - 0.12, TERRACE_Y - 0.02, 0xe2d9c4);
  colliders.push(aabb(-TH, TH, -TH, TH, TERRACE_Y, { floor: true, tag: 'terrace' }));
  const stepEdges = stepAxis === 'NS' ? ['N', 'S'] : ['E', 'W'];
  const wallEdges = EDGES.filter((e) => !stepEdges.includes(e));
  for (const e of stepEdges) {
    const box = sideBox(e, -5, 5, TH, TH + 1.3, DECK_Y + 0.25, { floor: true, tag: 'step' });
    addSlab(b, box.minX, box.maxX, box.minZ, box.maxZ, 0, box.maxY, STEP);
    colliders.push(box);
  }
  // Long planters on the terrace along the two stepless sides (the chair axis stays open).
  for (const e of wallEdges) {
    for (const [u0, u1] of [[-9.5, -3.5], [3.5, 9.5]]) {
      planterBox(b, colliders, sideBox(e, u0, u1, TH - 1.9, TH - 0.6, 0), TERRACE_Y, 0.55);
    }
  }

  // Fountain: basin (cylinder collider r = 4), water disc, column, upper bowl.
  const y0 = TERRACE_Y;
  addCyl(b, 4, 4.1, 0.6, 28, STONE, 0, y0, 0);
  addCyl(b, 3.6, 3.6, 0.02, 28, WATER, 0, y0 + 0.6, 0);
  addCyl(b, 0.45, 0.55, 1.9, 10, STONE, 0, y0 + 0.6, 0);
  addCyl(b, 1.3, 0.6, 0.35, 14, STONE, 0, y0 + 2.5, 0);
  addCyl(b, 1.12, 1.12, 0.02, 14, WATER, 0, y0 + 2.85, 0);
  addCyl(b, 0.12, 0.2, 0.7, 8, STONE, 0, y0 + 2.85, 0);
  colliders.push({ kind: 'cyl', x: 0, z: 0, r: 4.1, maxY: y0 + 0.6, tag: 'fountain' });
  colliders.push({ kind: 'cyl', x: 0, z: 0, r: 0.6, maxY: y0 + 2.5, tag: 'fountain' });
  // Upper bowl flares to r 1.3; give the camera something to hit there.
  colliders.push({ kind: 'cyl', x: 0, z: 0, r: 1.3, maxY: y0 + 3.6, tag: 'fountain', camOnly: true });

  const pavilion = buildPavilion(b, colliders, placer, B.pavRng);

  // Paths: axis walks always; diagonal and ring walks by variant.
  for (const e of EDGES) {
    const r = sideBox(e, -2, 2, TH, PLAZA_HALF, 0);
    addSlab(b, r.minX, r.maxX, r.minZ, r.maxZ, 0.1, DECK_Y + 0.01, PATH_AXIS);
  }
  if (variant.includes('diag')) {
    const d0 = 13, d1 = PLAZA_HALF - 1.5;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const c = (d0 + d1) / 2;
      addBox(b, 3, 0.08, (d1 - d0) * Math.SQRT2, PATH_DIAG, sx * c, DECK_Y - 0.02, sz * c, Math.atan2(sx, sz));
    }
  }
  if (variant.includes('ring')) addRing(b, RING_R - 1.5, RING_R + 1.5, 64, PATH_RING, 0, DECK_Y + 0.03, 0);

  // Planters: a grid in the quadrants, or scattered.
  if (variant.includes('grid')) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const a of [19, 27, 35]) for (const c of [19, 27, 35]) {
      const w = rng.next() < 0.5 ? 3.2 : 2.4, d = 5.6 - w;
      const x = sx * a, z = sz * c;
      if (placer.free(x, z, w, d, 1.3)) { placer.take(x, z, w, d); planterAt(b, colliders, x, z, w, d, rng.range(0.5, 0.75)); }
    }
  } else {
    let n = rng.int(6, 9);
    for (let t = 0; t < 300 && n > 0; t++) {
      const x = rng.range(-40, 40), z = rng.range(-40, 40);
      const w = rng.range(2, 4), d = rng.range(1.6, 3);
      if (!placer.free(x, z, w, d, 1.4, 1.2)) continue;
      placer.take(x, z, w, d); planterAt(b, colliders, x, z, w, d, rng.range(0.5, 0.75)); n--;
    }
  }

  // Low seat walls around the plaza rim.
  for (const e of EDGES) {
    for (const uc of [-33, -22, -11, 11, 22, 33]) {
      if (rng.next() < 0.35) continue;
      const len = rng.range(5, 8.5);
      const r = sideBox(e, uc - len / 2, uc + len / 2, 41.3, 41.9, 0);
      const cx = (r.minX + r.maxX) / 2, cz = (r.minZ + r.maxZ) / 2, w = r.maxX - r.minX, d = r.maxZ - r.minZ;
      if (!placer.free(cx, cz, w, d, 1.2, 0.8)) continue;
      placer.take(cx, cz, w, d);
      const h = rng.range(0.5, 0.8);
      addSlab(b, r.minX, r.maxX, r.minZ, r.maxZ, DECK_Y, DECK_Y + h, CONCRETE);
      addSlab(b, r.minX - 0.05, r.maxX + 0.05, r.minZ - 0.05, r.maxZ + 0.05, DECK_Y + h - 0.06, DECK_Y + h, 0xb5ada1);
      colliders.push({ ...r, maxY: DECK_Y + h, tag: 'wall' });
    }
  }
  return { stepEdges, pavilion };
}

// The pavilion: an open-sided roofed shelter on the deck beside the terrace (east or west, seeded),
// abreast of the chair spot. 5 x 5 m, four posts, a roof slab at 3 m. Two adjacent sides (north
// and the outer one) are a 1 m wall topped by a close slatted screen up to the roof, so a body in
// that corner is out of sight from the north and from outside; the terrace side and the south
// side are open. A 1 m wall alone cannot hide a standing head (sight is head to head at 1.6 m),
// hence the screen. Taken from the placer before the planters, benches, carts and trees, and
// its nav spur is added first so they keep off it. Clear of every nav line by 2.4 m or more on
// all three path variants (terrace foot at 14, the axis walk at z 0, the ring at r 26).
const PAV = { cx: 19, cz: 6, half: 2.5, roof: 3, wall: 1, t: 0.3 };
const PAV_WOOD = 0x7a5a3e, PAV_ROOF = 0x3f4a44, PAV_WALL = 0xb9b1a3;
function buildPavilion(b, colliders, placer, rng) {
  const sx = rng && rng.next() < 0.5 ? -1 : 1;
  const { half: h, roof, wall, t } = PAV;
  const cx = sx * PAV.cx, cz = PAV.cz, y0 = DECK_Y;
  const x0 = cx - h, x1 = cx + h, z0 = cz - h, z1 = cz + h;
  const xo = sx > 0 ? x1 : x0;                                  // the outer side
  placer.take(cx, cz, h * 2 + 0.6, h * 2 + 0.6);
  // Deck boards, posts, roof with a fascia.
  addSlab(b, x0, x1, z0, z1, y0, y0 + 0.02, 0x9c8466);
  for (const px of [x0 + 0.125, x1 - 0.125]) for (const pz of [z0 + 0.125, z1 - 0.125]) {
    addBox(b, 0.25, roof, 0.25, PAV_WOOD, px, y0 + roof / 2, pz);
  }
  addSlab(b, x0 - 0.3, x1 + 0.3, z0 - 0.3, z1 + 0.3, y0 + roof, y0 + roof + 0.2, PAV_ROOF);
  addSlab(b, x0 - 0.35, x1 + 0.35, z0 - 0.35, z1 + 0.35, y0 + roof + 0.2, y0 + roof + 0.26, 0x55615a);
  colliders.push(aabb(x0 - 0.3, x1 + 0.3, z0 - 0.3, z1 + 0.3, y0 + roof + 0.26, { minY: y0 + roof, camOnly: true, tag: 'pavilionRoof' }));
  // The two walled sides: north (z0) and outer (xo). Low wall, rails, close vertical slats.
  const walls = [
    aabb(x0, x1, z0, z0 + t, y0 + roof, { tag: 'pavilionWall' }),
    aabb(Math.min(xo, xo - sx * t), Math.max(xo, xo - sx * t), z0, z1, y0 + roof, { tag: 'pavilionWall' }),
  ];
  for (const w of walls) {
    addSlab(b, w.minX, w.maxX, w.minZ, w.maxZ, y0, y0 + wall, PAV_WALL);
    addSlab(b, w.minX - 0.04, w.maxX + 0.04, w.minZ - 0.04, w.maxZ + 0.04, y0 + wall, y0 + wall + 0.06, 0xcfc8ba);
    addSlab(b, w.minX, w.maxX, w.minZ, w.maxZ, y0 + roof - 0.12, y0 + roof, PAV_WOOD);
    const alongX = w.maxX - w.minX > w.maxZ - w.minZ;
    const len = alongX ? w.maxX - w.minX : w.maxZ - w.minZ;
    const n = Math.floor(len / 0.16);
    for (let i = 0; i < n; i++) {
      const s = (alongX ? w.minX : w.minZ) + (i + 0.5) * (len / n);
      const mx = alongX ? s : (w.minX + w.maxX) / 2, mz = alongX ? (w.minZ + w.maxZ) / 2 : s;
      addBox(b, alongX ? 0.12 : 0.08, roof - wall - 0.12, alongX ? 0.08 : 0.12, PAV_WOOD, mx, y0 + wall + (roof - wall - 0.12) / 2 + 0.06, mz);
    }
    colliders.push(w);
  }
  // The open corner's post is the only free-standing one.
  const px = sx > 0 ? x0 : x1 - 0.25;
  colliders.push(aabb(px, px + 0.25, z1 - 0.25, z1, y0 + roof, { tag: 'pavilionPost' }));
  // Nav: in from the terrace-foot path, to the middle, to the hiding corner.
  const nav = addSpur(placer.nav, { x: sx * 14, z: cz }, [{ x: cx - sx * 0.6, z: cz }, { x: cx + sx * 1.3, z: z0 + 1.1 }]);
  return { side: sx > 0 ? 'E' : 'W', centre: { x: cx, z: cz }, hide: { x: cx + sx * 1.6, z: z0 + 0.9 },
    blockDirs: [[0, -1], [sx, 0]], openDirs: [[-sx, 0], [0, 1]], nav };
}

function planterAt(b, colliders, x, z, w, d, h) {
  planterBox(b, colliders, aabb(x - w / 2, x + w / 2, z - d / 2, z + d / 2, 0), DECK_Y, h);
}

// Concrete box with soil and a couple of shrub lumps; standable AABB collider at the rim height.
function planterBox(b, colliders, r, base, h) {
  const top = base + h;
  addSlab(b, r.minX, r.maxX, r.minZ, r.maxZ, base, top, CONCRETE);
  addSlab(b, r.minX + 0.15, r.maxX - 0.15, r.minZ + 0.15, r.maxZ - 0.15, top - 0.04, top + 0.01, SOIL);
  const cx = (r.minX + r.maxX) / 2, cz = (r.minZ + r.maxZ) / 2;
  const w = r.maxX - r.minX, d = r.maxZ - r.minZ;
  const n = Math.max(1, Math.round(Math.max(w, d) / 2));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n - 0.5;
    const sx = w >= d ? cx + t * (w - 0.6) : cx, sz = w >= d ? cz : cz + t * (d - 0.6);
    const s = Math.min(w, d) - 0.5;
    addBox(b, s, 0.45, s, GREEN[i % GREEN.length], sx, top + 0.2, sz, i * 0.4);
  }
  colliders.push({ ...r, maxY: top, tag: 'planter' });
}
