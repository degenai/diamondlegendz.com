// One tall seeded landmark per non-plaza block (ruled 2026-09-24), so a block can be told from its
// neighbours over the roofs: a water tower, a mural wall, a big tree, a Serenity billboard, or a
// church spire, picked by the block's seed. The plaza's landmark is its fountain (no new geometry).
// Everything goes into the block's static batch (the tree into the block's tree InstancedMeshes via
// furniture.js), so a landmark costs no draw call. Block-local coordinates, like the rest of the
// block; each landmark gets colliders and keeps clear of the nav graph.
//  planLandmark(B, rng) runs after the centre and before the furniture: it rolls the kind and
//    places the centre kinds (tower, tree, billboard, spire) on the free spot nearest the centre.
//  muralLandmark(B, L, lots) runs after the buildings: the mural paints the side wall of a lot
//    beside a link street and puts a sign box on its roof.
import * as THREE from '../../vendor/three.module.js';
import { addBox, addCyl, addGeo } from './batch.js';
import { DECK_Y, HALF, SIDE, toXZ, sideBox } from './layout.js';

export const LANDMARKS = ['watertower', 'mural', 'tree', 'billboard', 'spire'];
const PE_GREEN = 0x006937, PE_GOLD = 0xffcc00;       // the player's shirt and the loaner scrubs
const TEAL = 0x2ec4b6, SERENITY_WHITE = 0xf1f0ea;    // buildings.js, the Serenity lot
const TREE_H = 16, TOWER_H = 22, BOARD_H = 12, SPIRE_H = 24;
// Footprint (w along X, d along Z), the nav clearance the placer asks for, and the margin kept
// from other props (the tree keeps its crown clear of the furniture trees).
const FOOT = { watertower: [4.6, 4.6, 1.2, 1.2], tree: [2, 2, 1.2, 3], billboard: [6.4, 0.8, 1.2, 1.2], spire: [3.6, 3.6, 1.2, 1.2] };

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
let pyramid = null;
// A square pyramid, base side 1 and height 1 standing on y = 0, its faces square to the axes.
function addPyramid(b, side, h, color, x, y0, z) {
  if (!pyramid) pyramid = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0).toNonIndexed();
  _e.set(0, 0, 0);
  addGeo(b, pyramid, color, _m.compose(_p.set(x, y0, z), _q.setFromEuler(_e), _s.set(side, h, side)));
}

// The free spot nearest the block centre (ties broken by the seed) for a w x d footprint.
function centreSpot(placer, rng, w, d, clear, margin) {
  let best = null;
  for (let x = -36; x <= 36; x += 1.5) {
    for (let z = -36; z <= 36; z += 1.5) {
      const score = Math.hypot(x, z) + rng.next() * 3;
      if (best && score >= best.score) continue;
      if (!placer.free(x, z, w, d, clear, margin, 42)) continue;
      best = { x, z, score };
    }
  }
  return best;
}

export function planLandmark(B, rng) {
  if (B.plaza) return { kind: 'fountain', colliders: [] };
  const kind = LANDMARKS[rng.int(0, LANDMARKS.length - 1)];
  const L = { kind, colliders: [], tree: null };
  if (kind === 'mural') return L;                       // after the buildings (muralLandmark)
  const yaw = kind === 'billboard' && rng.next() < 0.5 ? Math.PI / 2 : 0;
  let [w, d, clear, margin] = FOOT[kind];
  if (yaw) [w, d] = [d, w];
  const at = centreSpot(B.placer, rng, w, d, clear, margin);
  if (!at) return { kind: 'none', colliders: [] };
  const { x, z } = at;
  L.x = x; L.z = z;
  B.placer.take(x, z, kind === 'tree' ? 6 : w, kind === 'tree' ? 6 : d);
  const b = B.batch, col = (c) => { c.tag = 'landmark'; B.colliders.push(c); L.colliders.push(c); };
  if (kind === 'watertower') {
    // Four legs to the tank floor, cross braces, a banded tank and a shallow cone roof: 22 m.
    const TANK0 = 15.2, TANK_H = 4.6, ROOF_H = TOWER_H - TANK0 - TANK_H, LEG = 1.8;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      addCyl(b, 0.16, 0.22, TANK0, 6, 0x5a4a3c, x + sx * LEG, DECK_Y, z + sz * LEG);
      col({ kind: 'cyl', x: x + sx * LEG, z: z + sz * LEG, r: 0.25, maxY: TOWER_H });
    }
    for (const y of [5, 10]) {
      addBox(b, LEG * 2, 0.14, 0.14, 0x4a3c30, x, DECK_Y + y, z - LEG);
      addBox(b, LEG * 2, 0.14, 0.14, 0x4a3c30, x, DECK_Y + y, z + LEG);
      addBox(b, 0.14, 0.14, LEG * 2, 0x4a3c30, x - LEG, DECK_Y + y, z);
      addBox(b, 0.14, 0.14, LEG * 2, 0x4a3c30, x + LEG, DECK_Y + y, z);
    }
    addCyl(b, 2.4, 2.4, 0.2, 12, 0x3e3a36, x, DECK_Y + TANK0 - 0.2, z);     // walkway
    addCyl(b, 2.1, 2.1, TANK_H, 12, 0x8a6446, x, DECK_Y + TANK0, z);
    for (const y of [1.2, 3.0]) addCyl(b, 2.14, 2.14, 0.16, 12, 0x5b412e, x, DECK_Y + TANK0 + y, z);
    addCyl(b, 0, 2.3, ROOF_H - DECK_Y, 12, 0x6e5040, x, DECK_Y + TANK0 + TANK_H, z);
  } else if (kind === 'tree') {
    // Through the block's tree instancing (furniture.js): 5.3 m at scale 1, so 16 m is x3.02.
    L.tree = { x, z, s: TREE_H / 5.3, w: 3, r: 0.65, h: TREE_H, landmark: true };
  } else if (kind === 'billboard') {
    // A 6 x 3 m panel on two posts, its top at 12 m. SERENITY / GROUP as alternating teal and white
    // blocks (one per letter, no text), on both faces.
    const c = Math.cos(yaw), s = Math.sin(yaw);                  // local +X (along the panel)
    const P = (u, v = 0) => [x + c * u + s * v, z - s * u + c * v];
    for (const u of [-2.2, 2.2]) {
      const [px, pz] = P(u);
      addCyl(b, 0.2, 0.2, BOARD_H - 3 + 0.2, 6, 0x5c6066, px, DECK_Y, pz);
      col({ kind: 'cyl', x: px, z: pz, r: 0.25, maxY: BOARD_H });
    }
    addBox(b, 6, 3, 0.3, 0x1d262c, x, BOARD_H - 1.5, z, yaw);
    addBox(b, 6.2, 0.12, 0.8, 0x5c6066, x, BOARD_H - 3.1, z, yaw);          // catwalk
    for (const face of [-1, 1]) {
      const rows = [[8, BOARD_H - 0.95], [5, BOARD_H - 2.05]];
      let k = 0;
      for (const [n, y] of rows) {
        const cw = 0.56, gap = 0.1, span = n * cw + (n - 1) * gap;
        for (let i = 0; i < n; i++, k++) {
          const [bx, bz] = P(-span / 2 + cw / 2 + i * (cw + gap), face * 0.17);
          addBox(b, cw, 0.8, 0.04, k % 2 ? SERENITY_WHITE : TEAL, bx, y, bz, yaw);
        }
      }
    }
  } else if (kind === 'spire') {
    // A stone bell tower to 10 m, a slate belfry band, and a narrow pyramid on top to 24 m.
    addBox(b, 3.4, 10, 3.4, 0xb9ad98, x, DECK_Y + 5, z);
    addBox(b, 3.6, 0.3, 3.6, 0x8e8474, x, DECK_Y + 10.15, z);
    for (const [ox, oz, rw, rd] of [[0, 1.72, 1, 0.06], [0, -1.72, 1, 0.06], [1.72, 0, 0.06, 1], [-1.72, 0, 0.06, 1]]) {
      addBox(b, rw, 1.8, rd, 0x2a2d33, x + ox, DECK_Y + 7.6, z + oz);         // belfry openings
    }
    addPyramid(b, 3.0, SPIRE_H - 10.3 - DECK_Y, 0x4a5160, x, DECK_Y + 10.3, z);
    col({ minX: x - 1.7, maxX: x + 1.7, minZ: z - 1.7, maxZ: z + 1.7, maxY: SPIRE_H });
  }
  return L;
}

// The mural: a lot beside a link street (its side wall faces the street and nothing else) is
// painted from the pavement to the cornice in PE green with a gold band, and a green sign box with
// a gold face stands on its roof at that end. The paint is a thin collider on the wall's face.
export function muralLandmark(B, L, lots, rng) {
  if (!L || L.kind !== 'mural') return L;
  const cands = lots.filter((l) => l.gapSide && !l.serenity);
  if (!cands.length) { L.kind = 'none'; return L; }
  const lot = cands[rng.int(0, cands.length - 1)];
  const { edge, u0, u1, front, h, gapSide: gs } = lot;
  const yaw = SIDE[edge].yaw, uf = gs > 0 ? u1 : u0, depth = HALF - front, dc = (front + HALF) / 2;
  const b = B.batch;
  const paint = (du, t, y0, y1, d0, d1, color) => {
    const [x, z] = toXZ(edge, uf + gs * du, (d0 + d1) / 2);
    addBox(b, t, y1 - y0, d1 - d0, color, x, (y0 + y1) / 2, z, yaw);
  };
  paint(0.08, 0.16, 0.02, h - 0.42, front + 0.1, HALF - 0.1, PE_GREEN);
  paint(0.1, 0.16, h * 0.42, h * 0.62, front + 0.1, HALF - 0.1, PE_GOLD);
  paint(0.1, 0.16, 0.9, h * 0.42, dc - 2.2, dc + 2.2, PE_GOLD);               // the band's upright
  // Sign box on the roof, 1.5 m in from the painted wall, facing along the street.
  const SIGN_W = Math.min(10, depth - 3), SIGN_H = 2.4, POST = 1.2;
  const us = uf - gs * 1.5;
  for (const dd of [-SIGN_W / 2 + 0.6, SIGN_W / 2 - 0.6]) {
    const [px, pz] = toXZ(edge, us, dc + dd);
    addBox(b, 0.18, POST, 0.18, 0x3a3d42, px, h + POST / 2, pz, yaw);
  }
  const [sx, sz] = toXZ(edge, us, dc);
  addBox(b, 0.5, SIGN_H, SIGN_W, PE_GREEN, sx, h + POST + SIGN_H / 2, sz, yaw);
  for (const f of [-1, 1]) {
    const [fx, fz] = toXZ(edge, us + f * 0.27, dc);
    addBox(b, 0.04, SIGN_H - 0.6, SIGN_W - 0.8, PE_GOLD, fx, h + POST + SIGN_H / 2, fz, yaw);
  }
  const c = sideBox(edge, Math.min(uf, uf + gs * 0.18), Math.max(uf, uf + gs * 0.18), front, HALF, h, { tag: 'landmark' });
  B.colliders.push(c);
  L.colliders.push(c);
  const [lx, lz] = toXZ(edge, uf, dc);
  L.x = lx; L.z = lz; L.lot = { edge, u0, u1 }; L.top = h + POST + SIGN_H;
  return L;
}
