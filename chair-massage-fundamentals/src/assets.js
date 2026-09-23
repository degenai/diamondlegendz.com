// Loader for the baked Blender JSON meshes (format "cmf-mesh-1", see tools/blender/export_json.py).
// loadMesh(url) -> Promise<Group> of named children; each call returns a fresh clone
// (geometry and material shared). Same-origin fetch only, so it works under the CSP.
import * as THREE from '../vendor/three.module.js';

const cache = new Map(); // url -> Promise<Group> (the pristine template)
let sharedMat = null;

function material() {
  if (!sharedMat) sharedMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  return sharedMat;
}

function buildNode(o) {
  let node;
  if (o.positions && o.positions.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(o.positions, 3));
    if (o.normals && o.normals.length) g.setAttribute('normal', new THREE.Float32BufferAttribute(o.normals, 3));
    if (o.colors && o.colors.length) g.setAttribute('color', new THREE.Float32BufferAttribute(o.colors, 3));
    if (o.indices && o.indices.length) g.setIndex(o.indices);
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    g.computeBoundingSphere();
    node = new THREE.Mesh(g, material());
  } else {
    node = new THREE.Group(); // empties keep the hierarchy (rig joints)
  }
  node.name = o.name;
  const t = o.parentTransform || {};
  if (t.position) node.position.fromArray(t.position);
  if (t.quaternion) node.quaternion.fromArray(t.quaternion);
  if (t.scale) node.scale.fromArray(t.scale);
  return node;
}

function build(json, url) {
  if (!json || json.format !== 'cmf-mesh-1' || !Array.isArray(json.objects)) {
    throw new Error(`[assets] ${url}: not a cmf-mesh-1 file`);
  }
  const root = new THREE.Group();
  root.name = url.split('/').pop().replace(/\.json$/, '');
  // Exporter's material table (name -> {color, hex}, linear RGB) so code can
  // recolour a region (skin, shirt, pants...) by matching vertex colours.
  root.userData.materials = json.materials || {};
  const byName = new Map();
  for (const o of json.objects) {
    if (byName.has(o.name)) console.warn(`[assets] ${url}: duplicate object name "${o.name}"`);
    byName.set(o.name, buildNode(o));
  }
  // Exporter writes parents first, but attach in a second pass so order never matters.
  for (const o of json.objects) {
    if (o.parent && !byName.has(o.parent)) console.warn(`[assets] ${url}: "${o.name}" parent "${o.parent}" missing`);
    const parent = (o.parent && byName.get(o.parent)) || root;
    parent.add(byName.get(o.name));
  }
  return root;
}

function template(url) {
  let p = cache.get(url);
  if (!p) {
    p = fetch(url, { credentials: 'same-origin' })
      .then((r) => { if (!r.ok) throw new Error(`[assets] ${url}: HTTP ${r.status}`); return r.json(); })
      .then((json) => build(json, url));
    p.catch(() => cache.delete(url)); // let a later call retry
    cache.set(url, p);
  }
  return p;
}

export function loadMesh(url) {
  return template(url).then((g) => g.clone(true));
}

export function preload(urls) {
  return Promise.all(urls.map((u) => template(u)));
}
