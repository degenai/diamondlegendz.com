// Uniform grid over a collider list, so the static-collision helpers in physics.js only look at
// the colliders near a query (the district has ~16x the single block's colliders). The grid
// hangs off the array itself (list._grid) and is rebuilt when the list's length changes;
// addCollider / removeCollider keep it in step without a rebuild. Lists shorter than SMALL (400)
// (nearColliders' own results, test fixtures) are scanned whole, as before.
const CELL = 8;
const SMALL = 400;
let stamp = 1;

function bounds(c) {
  if (c.kind === 'cyl') return [c.x - c.r, c.x + c.r, c.z - c.r, c.z + c.r];
  return [c.minX, c.maxX, c.minZ, c.maxZ];
}

function build(list) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const c of list) {
    const [a, b, d, e] = bounds(c);
    if (a < x0) x0 = a; if (b > x1) x1 = b; if (d < z0) z0 = d; if (e > z1) z1 = e;
  }
  x0 = Math.floor(x0 / CELL) * CELL - CELL; z0 = Math.floor(z0 / CELL) * CELL - CELL;
  const nx = Math.ceil((x1 - x0) / CELL) + 2, nz = Math.ceil((z1 - z0) / CELL) + 2;
  const g = { x0, z0, nx, nz, cells: new Array(nx * nz), n: list.length };
  for (let i = 0; i < g.cells.length; i++) g.cells[i] = [];
  for (const c of list) insert(g, c);
  Object.defineProperty(list, '_grid', { value: g, writable: true, configurable: true, enumerable: false });
  return g;
}

function span(g, a, b, d, e) {
  const i0 = Math.max(0, Math.floor((a - g.x0) / CELL)), i1 = Math.min(g.nx - 1, Math.floor((b - g.x0) / CELL));
  const j0 = Math.max(0, Math.floor((d - g.z0) / CELL)), j1 = Math.min(g.nz - 1, Math.floor((e - g.z0) / CELL));
  return [i0, i1, j0, j1];
}

function insert(g, c) {
  const [a, b, d, e] = bounds(c);
  const [i0, i1, j0, j1] = span(g, a, b, d, e);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) g.cells[j * g.nx + i].push(c);
}

export function gridOf(list) {
  if (list.length < SMALL) return null;
  const g = list._grid;
  return g && g.n === list.length ? g : build(list);
}

// Colliders whose footprint cells touch the box [minX, maxX] x [minZ, maxZ]. Returns `list`
// itself when it has no grid, else `out` filled with each collider once.
export function query(list, minX, maxX, minZ, maxZ, out) {
  const g = gridOf(list);
  if (!g) return list;
  out.length = 0;
  const s = ++stamp;
  const [i0, i1, j0, j1] = span(g, minX, maxX, minZ, maxZ);
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const cell = g.cells[j * g.nx + i];
      for (let k = 0; k < cell.length; k++) {
        const c = cell[k];
        if (c._qs === s) continue;
        c._qs = s;
        out.push(c);
      }
    }
  }
  return out;
}

export function addCollider(list, c) {
  list.push(c);
  const g = list._grid;
  if (g && g.n === list.length - 1) {
    const [a, b, d, e] = bounds(c);
    if (a >= g.x0 && d >= g.z0 && b < g.x0 + g.nx * CELL && e < g.z0 + g.nz * CELL) { insert(g, c); g.n++; }
  }
}

export function removeCollider(list, c) {
  const i = list.indexOf(c);
  if (i < 0) return false;
  list.splice(i, 1);
  const g = list._grid;
  if (g && g.n === list.length + 1) {
    const [a, b, d, e] = bounds(c);
    const [i0, i1, j0, j1] = span(g, a, b, d, e);
    for (let j = j0; j <= j1; j++) for (let k = i0; k <= i1; k++) {
      const cell = g.cells[j * g.nx + k], m = cell.indexOf(c);
      if (m >= 0) cell.splice(m, 1);
    }
    g.n--;
  }
  return true;
}
