// Seeded low-rise lots on the four edges, 60..80 m out. One lot is the SERENITY GROUP location.
// Two alleys (a 2.4 m gap between two lots, dead-ending at a wall with a dumpster) on two seeded
// sides that are not the escape edge. Window grids are one InstancedMesh; the Serenity sign is one
// emissive box.
import * as THREE from '../../vendor/three.module.js';
import { addBox, addCyl } from './batch.js';
import { addSpur } from './nav.js';
import {
  HALF, LOT_FRONT, GAP_HALF, EDGES, SIDE, OUTER_WALK, DECK_Y, ALLEY_HALF, ALLEY_END, toXZ, sideBox,
} from './layout.js';

const FLOOR_H = 3.2;
const PALETTE = [0x9c4a3a, 0x7e3f32, 0xa8674c, 0x8a6a55, 0xd8c9a8, 0xc9a978, 0xb8b2a2, 0xd6a79a];
const AWNINGS = [0x2f6f4e, 0xb33a3a, 0x2d4f8a, 0xd08a2c, 0x6b3f7a, 0x1f7a7a];
const TEAL = 0x2ec4b6;
const SERENITY_WHITE = 0xf1f0ea;
const GLASS = [0x2d3a48, 0x3a4958, 0x26303a];
const LIT = 0xf2c77a;
const MAX_WINDOWS = 2400;

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const _up = new THREE.Vector3(0, 1, 0);
const _c = new THREE.Color();

function splitSpan(rng, u0, u1, n) {
  const weights = Array.from({ length: n }, () => rng.range(0.7, 1.3));
  const total = weights.reduce((a, w) => a + w, 0);
  const out = [];
  let u = u0;
  weights.forEach((w, i) => {
    const next = i === n - 1 ? u1 : u + ((u1 - u0) * w) / total;
    out.push([u, next]);
    u = next;
  });
  return out;
}

function planLots(rng, esc) {
  const lots = [];
  for (const edge of EDGES) {
    const span = edge === 'N' || edge === 'S' ? HALF : LOT_FRONT;
    const n = rng.int(3, 5);
    let spans;
    if (edge === esc.edge) {
      const a = [-span, esc.g - GAP_HALF], c = [esc.g + GAP_HALF, span];
      const la = a[1] - a[0], lc = c[1] - c[0];
      const na = Math.max(1, Math.min(n - 1, Math.round((n * la) / (la + lc))));
      spans = [...splitSpan(rng, a[0], a[1], na), ...splitSpan(rng, c[0], c[1], n - na)];
    } else {
      spans = splitSpan(rng, -span, span, n);
    }
    for (const [u0, u1] of spans) {
      const floors = rng.int(2, 6);
      lots.push({
        edge, u0, u1,
        front: LOT_FRONT + (rng.next() < 0.35 ? rng.range(0.8, 2.5) : 0),
        floors, h: floors * FLOOR_H,
        color: PALETTE[Math.floor(rng.next() * PALETTE.length)],
        store: rng.next() < 0.5,
        awning: AWNINGS[Math.floor(rng.next() * AWNINGS.length)],
        gapSide: edge === esc.edge ? (u1 === esc.g - GAP_HALF ? 1 : u0 === esc.g + GAP_HALF ? -1 : 0) : 0,
        serenity: false,
      });
    }
  }
  // Exactly one Serenity lot: a reasonably wide lot not on the escape edge.
  const cands = lots.filter((l) => l.edge !== esc.edge && l.u1 - l.u0 >= 16 && Math.abs((l.u0 + l.u1) / 2) < 50);
  const pool = cands.length ? cands : lots.filter((l) => l.edge !== esc.edge);
  const s = pool[Math.floor(rng.next() * pool.length)];
  s.serenity = true; s.floors = Math.max(3, s.floors); s.h = s.floors * FLOOR_H;
  s.front = LOT_FRONT; s.store = true; s.color = SERENITY_WHITE;
  return lots;
}

// Two alleys on two seeded non-escape sides: a boundary between two lots that are both at least
// 12 m wide, within 50 m of the side's centre (so the mouth sits on the outer sidewalk's nav
// line). Both lots give up ALLEY_HALF each. Own rng, so the lots roll the same with or without.
function planAlleys(rng, lots, esc) {
  const sides = EDGES.filter((e) => e !== esc.edge);
  for (let i = sides.length - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); [sides[i], sides[j]] = [sides[j], sides[i]]; }
  const alleys = [];
  for (const edge of sides) {
    if (alleys.length === 2) break;
    const row = lots.filter((l) => l.edge === edge).sort((a, c) => a.u0 - c.u0);
    const cands = [];
    for (let i = 0; i + 1 < row.length; i++) {
      const a = row[i], c = row[i + 1];
      if (Math.abs(a.u1 - c.u0) > 1e-6 || Math.abs(a.u1) > 50) continue;
      if (a.u1 - a.u0 < 12 || c.u1 - c.u0 < 12) continue;
      cands.push([a, c]);
    }
    if (!cands.length) continue;
    const [a, c] = cands[Math.floor(rng.next() * cands.length)];
    const u = a.u1;
    a.u1 = u - ALLEY_HALF; c.u0 = u + ALLEY_HALF;
    alleys.push({ edge, u, dumpSide: rng.next() < 0.5 ? -1 : 1 });
  }
  return alleys;
}

const ALLEY_WALL = 0x5b3b31;
const DUMPSTER = 0x2f5a3c;
// The dead-end wall (full alley width, ALLEY_END..HALF), a dumpster against one side near the
// end (walkable round: 1.4 m beside it, 1.4 m behind it), and the nav spur down the middle.
function buildAlley(b, colliders, nav, A) {
  const { edge, u, dumpSide: s } = A;
  const yaw = SIDE[edge].yaw;
  const wallH = 3.6;
  const [wx, wz] = toXZ(edge, u, (ALLEY_END + HALF) / 2);
  addBox(b, ALLEY_HALF * 2, wallH, HALF - ALLEY_END, ALLEY_WALL, wx, DECK_Y + wallH / 2, wz, yaw);
  const [cx, cz] = toXZ(edge, u, ALLEY_END + 0.1);
  addBox(b, ALLEY_HALF * 2 + 0.1, 0.18, 0.45, 0x8a7a6a, cx, DECK_Y + wallH + 0.09, cz, yaw);
  colliders.push(sideBox(edge, u - ALLEY_HALF, u + ALLEY_HALF, ALLEY_END, HALF, DECK_Y + wallH, { tag: 'alleyWall' }));
  // Dumpster: u + s * (0.2..1.2), d 74.6..76.6, a big commercial bin 1.9 m tall (taller than a
  // head, so the 1.4 m pocket behind it is out of sight from the mouth), a lid, two bags.
  const du = u + s * 0.7, d0 = 74.6, d1 = 76.6, DH = 1.9;
  const [dx, dz] = toXZ(edge, du, (d0 + d1) / 2);
  addBox(b, 1.0, DH - 0.08, d1 - d0, DUMPSTER, dx, DECK_Y + (DH - 0.08) / 2, dz, yaw);
  addBox(b, 1.08, 0.08, d1 - d0 + 0.08, 0x223f2b, dx, DECK_Y + DH - 0.04, dz, yaw);
  for (const k of [0, 1]) {
    const [bx, bz] = toXZ(edge, u + s * (0.95 - k * 0.3), d0 - 0.4 - k * 0.2);
    addBox(b, 0.45, 0.4, 0.4, 0x222428, bx, DECK_Y + 0.2, bz, yaw + k * 0.6);
  }
  colliders.push(sideBox(edge, Math.min(u + s * 0.2, u + s * 1.2), Math.max(u + s * 0.2, u + s * 1.2), d0, d1, DECK_Y + DH, { tag: 'dumpster' }));
  const P = (uu, d) => { const [x, z] = toXZ(edge, uu, d); return { x, z }; };
  A.nav = addSpur(nav, P(u, OUTER_WALK), [P(u, 64), P(u, 71), P(u - s * 0.5, 77.3), P(u + s * 0.7, 77.3)]);
}

export function buildBuildings(B) {
  const { batch: b, colliders, rng, esc } = B;
  const lots = planLots(rng, esc);
  const alleys = B.alleyRng ? planAlleys(B.alleyRng, lots, esc) : [];
  for (const A of alleys) buildAlley(b, colliders, B.nav, A);

  const winGeo = new THREE.BoxGeometry(1.1, 1.5, 0.12);
  const winMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  const windows = new THREE.InstancedMesh(winGeo, winMat, MAX_WINDOWS);
  windows.name = 'windows';
  let wi = 0;
  const addWindow = (x, y, z, yaw, color) => {
    if (wi >= MAX_WINDOWS) return;
    _q.setFromAxisAngle(_up, yaw);
    windows.setMatrixAt(wi, _m.compose(_p.set(x, y, z), _q, _s));
    windows.setColorAt(wi, _c.set(color));
    wi++;
  };
  const glass = (lot) => (lot.serenity ? 0x3f8f8f : rng.next() < 0.08 ? LIT : GLASS[Math.floor(rng.next() * GLASS.length)]);

  let serenity = null;
  let sign = null;
  for (const lot of lots) {
    const { edge, u0, u1, front, h } = lot;
    const yaw = SIDE[edge].yaw;
    const w = u1 - u0, uc = (u0 + u1) / 2;
    const depth = HALF - front, dc = (front + HALF) / 2;
    const [cx, cz] = toXZ(edge, uc, dc);
    addBox(b, w, h, depth, lot.color, cx, h / 2, cz, yaw);
    // Cornice: a slightly proud band flush with the roof.
    const [fx, fz] = toXZ(edge, uc, dc - 0.15);
    addBox(b, w + 0.02, 0.4, depth + 0.3, lot.serenity ? TEAL : shade(lot.color, 0.8), fx, h - 0.2, fz, yaw);
    // Roof clutter.
    if (rng.next() < 0.6) {
      const [rx, rz] = toXZ(edge, uc + rng.range(-w / 4, w / 4), dc + rng.range(-3, 3));
      if (rng.next() < 0.5) addBox(b, 2.2, 1.2, 1.6, 0x9aa0a4, rx, h + 0.6, rz, yaw);
      else addCyl(b, 1.1, 1.1, 2.2, 8, 0x7a6a58, rx, h, rz);
    }
    colliders.push(sideBox(edge, u0, u1, front, HALF, h, { tag: lot.serenity ? 'serenity' : 'building' }));

    // Window grid on the street face.
    const cols = Math.max(1, Math.floor((w - 2) / 3));
    const step = (w - 2) / cols;
    const firstFloor = lot.store ? 1 : 0;
    for (let f = firstFloor; f < lot.floors; f++) {
      for (let k = 0; k < cols; k++) {
        const [x, z] = toXZ(edge, u0 + 1 + step * (k + 0.5), front - 0.04);
        addWindow(x, f * FLOOR_H + 1.8, z, yaw, glass(lot));
      }
    }
    // Side face along the escape street.
    if (lot.gapSide) {
      const uf = lot.gapSide > 0 ? u1 + 0.04 : u0 - 0.04;
      const [ax, az] = toXZ(edge, 1, 0); const [ox, oz] = toXZ(edge, 0, 0);
      const syaw = Math.atan2((ax - ox) * lot.gapSide, (az - oz) * lot.gapSide);
      for (let f = 0; f < lot.floors; f++) {
        for (let d = front + 2; d < HALF - 1; d += 3) {
          const [x, z] = toXZ(edge, uf, d);
          addWindow(x, f * FLOOR_H + 1.8, z, syaw, glass(lot));
        }
      }
    }
    if (lot.store) storefront(b, lot, yaw);
    if (lot.serenity) {
      const r = serenityFacade(b, lot, yaw);
      sign = r.sign;
      serenity = {
        aabb: sideBox(edge, u0, u1, front, HALF, h), edge,
        sign: r.sign.position.clone(), door: r.door, lot,
      };
    }
  }
  windows.count = wi;
  windows.instanceMatrix.needsUpdate = true;
  if (windows.instanceColor) windows.instanceColor.needsUpdate = true;
  windows.computeBoundingSphere();
  return { lots, windows, sign, serenity, alleys };
}

function shade(hex, k) {
  return _c.set(hex).multiplyScalar(k).getHex();
}

// Glass shopfront band + angled awning on the ground floor.
function storefront(b, lot, yaw) {
  const { edge, u0, u1, front } = lot;
  const uc = (u0 + u1) / 2, w = u1 - u0;
  const [gx, gz] = toXZ(edge, uc, front - 0.05);
  addBox(b, w - 1.6, 2.6, 0.1, lot.serenity ? 0x1f5f5c : 0x27313b, gx, 1.5, gz, yaw);
  if (lot.serenity) return;
  const [ax, az] = toXZ(edge, uc, front - 0.75);
  addBox(b, Math.min(w - 2, w * 0.8), 0.06, 1.5, lot.awning, ax, 3.05, az, yaw, -0.35);
}

// White-and-teal facade, dark teal door, emissive teal sign box over it (no text; pillar 3).
function serenityFacade(b, lot, yaw) {
  const { edge, u0, u1, front } = lot;
  const uc = (u0 + u1) / 2;
  const [bx, bz] = toXZ(edge, uc, front - 0.06);
  addBox(b, u1 - u0, 0.5, 0.14, TEAL, bx, 3.35, bz, yaw);
  const [dx, dz] = toXZ(edge, uc, front - 0.1);
  addBox(b, 2.6, 2.9, 0.14, 0x14504c, dx, 1.45, dz, yaw);
  for (const off of [-1.45, 1.45]) {
    const [px, pz] = toXZ(edge, uc + off, front - 0.12);
    addBox(b, 0.3, 3.1, 0.2, TEAL, px, 1.55, pz, yaw);
  }
  const [sx, sz] = toXZ(edge, uc, front - 0.45);
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(7, 1.1, 0.45),
    new THREE.MeshLambertMaterial({ color: TEAL, emissive: 0x17b0a2, emissiveIntensity: 1.1 }),
  );
  sign.name = 'serenitySign';
  sign.position.set(sx, 3.85, sz);
  sign.rotation.y = yaw;
  return { sign, door: new THREE.Vector3(dx, 0, dz) };
}
