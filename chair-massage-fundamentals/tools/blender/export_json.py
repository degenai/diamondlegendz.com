"""Loader-free exporter: dump every object in the scene to one JSON file that
Three.js can feed straight into BufferGeometry (no GLTFLoader needed).

Format (Y-up, metres, three.js conventions):
{
  "format": "cmf-mesh-1",
  "objects": [
    { "name", "parent": name|null,
      "parentTransform": {"position":[x,y,z], "quaternion":[x,y,z,w], "scale":[x,y,z]},
      "positions":[...], "normals":[...], "colors":[...linear RGB...], "indices":[...] }
  ]
}
Geometry is in object-local space; parentTransform is the local transform relative
to "parent" (or the scene root). Flat shading: every triangle gets its face normal,
vertices are deduplicated on (position, normal, colour) so indices stay useful.
Empties are emitted with empty arrays so the node hierarchy survives (for rigs).

Standalone use (after a make_*.py in the same Blender run):
  blender -b --python make_chair.py --python export_json.py -- --json out.json
"""
import os
import sys
import json
import bpy
from mathutils import Matrix

# Blender Z-up -> three.js Y-up: (x, y, z) -> (x, z, -y), same as the glTF exporter.
C = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1)))
CI = C.inverted()
P = 4  # decimal places; ~0.1 mm, plenty for low poly


def _r(v):
    return [round(float(c), P) for c in v]


def _mat_color(ob, idx):
    if idx < len(ob.material_slots) and ob.material_slots[idx].material:
        c = ob.material_slots[idx].material.diffuse_color
        return (round(c[0], 4), round(c[1], 4), round(c[2], 4))
    return (0.8, 0.8, 0.8)


def _mesh_arrays(ob, dg):
    ev = ob.evaluated_get(dg)
    me = ev.to_mesh()
    me.calc_loop_triangles()
    verts = me.vertices
    col_attr = me.color_attributes.active_color if me.color_attributes else None
    lut = {}
    pos, nor, col, idx = [], [], [], []
    for tri in me.loop_triangles:
        n = tri.normal
        ny = (round(n.x, P), round(n.z, P), round(-n.y, P))
        base = _mat_color(ob, tri.material_index)
        for li, vi in zip(tri.loops, tri.vertices):
            co = verts[vi].co
            p = (round(co.x, P), round(co.z, P), round(-co.y, P))
            if col_attr is not None:
                src = col_attr.data[li if col_attr.domain == "CORNER" else vi].color
                c = (round(src[0], 4), round(src[1], 4), round(src[2], 4))
            else:
                c = base
            key = (p, ny, c)
            k = lut.get(key)
            if k is None:
                k = len(lut)
                lut[key] = k
                pos.extend(p)
                nor.extend(ny)
                col.extend(c)
            idx.append(k)
    ev.to_mesh_clear()
    return pos, nor, col, idx


def export(path):
    dg = bpy.context.evaluated_depsgraph_get()
    objs = []
    tris = 0
    # parents before children so the loader can build the tree in one pass
    def depth(o):
        d = 0
        while o.parent:
            o, d = o.parent, d + 1
        return d
    for ob in sorted(bpy.context.scene.objects, key=lambda o: (depth(o), o.name)):
        if ob.type not in ("MESH", "EMPTY"):
            continue
        local = ob.parent.matrix_world.inverted() @ ob.matrix_world if ob.parent else ob.matrix_world
        loc, q, s = (C @ local @ CI).decompose()
        entry = {
            "name": ob.name,
            "parent": ob.parent.name if ob.parent else None,
            "parentTransform": {"position": _r(loc), "quaternion": _r((q.x, q.y, q.z, q.w)), "scale": _r(s)},
            "positions": [], "normals": [], "colors": [], "indices": [],
        }
        if ob.type == "MESH":
            p, n, c, i = _mesh_arrays(ob, dg)
            entry.update(positions=p, normals=n, colors=c, indices=i)
            tris += len(i) // 3
        objs.append(entry)
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, "w") as f:
        json.dump({"format": "cmf-mesh-1", "upAxis": "Y", "triangles": tris, "objects": objs}, f, separators=(",", ":"))
    print(f"[export_json] wrote {path} ({os.path.getsize(path)} bytes, {tris} tris, {len(objs)} objects)")


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if "--json" in argv:
        export(argv[argv.index("--json") + 1])
    else:
        print("[export_json] no --json <path> given; nothing written")
