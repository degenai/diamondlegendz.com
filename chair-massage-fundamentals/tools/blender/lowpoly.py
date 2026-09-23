"""Shared helpers for headless low-poly asset scripts (Blender 5.2, bpy + bmesh).

Units: metres. Blender is Z-up; glTF and export_json.py convert to Three.js Y-up.
Every part is built straight into a bmesh (no bpy.ops primitives), so scripts are
deterministic, fast, and do not depend on UI context.
"""
import sys
import argparse
import math
import bpy
import bmesh
from mathutils import Matrix, Vector, Euler

PALETTE = {
    "pe_green": "#006937",
    "gold": "#ffd700",
    "black": "#141414",
    "suit": "#1a1a1d",
    "shirt": "#f2f2ee",
    "skin": "#c69c7b",
    "rubber": "#222222",
    "glass": "#2a3a46",
    "chrome": "#b8bcc4",
    "red": "#c0221a",
    "lamp": "#fff4c2",
}


def script_args(defaults):
    """Parse args after Blender's '--' separator."""
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    for k, v in defaults.items():
        p.add_argument("--" + k, default=v)
    a, _ = p.parse_known_args(argv)
    return a


def clear_scene():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for item in list(coll):
            coll.remove(item)


def hex_to_linear(h):
    h = h.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return out


_mats = {}


def material(name, hex_color):
    """Flat, rough material. glTF exports it as baseColorFactor (no textures)."""
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    rgba = hex_to_linear(hex_color) + [1.0]
    m.diffuse_color = rgba
    try:
        m.use_nodes = True  # deprecated/no-op in 5.x, required in older builds
    except Exception:
        pass
    nt = m.node_tree
    bsdf = None
    if nt is not None:
        bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is not None:
        bsdf.inputs["Base Color"].default_value = rgba
        bsdf.inputs["Roughness"].default_value = 1.0
        bsdf.inputs["Metallic"].default_value = 0.0
    m["hex"] = hex_color
    _mats[name] = m
    return m


class Part:
    """Accumulates primitives into one bmesh with per-face material slots."""

    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.slots = []

    def _slot(self, mat):
        if mat not in self.slots:
            self.slots.append(mat)
        return self.slots.index(mat)

    def _tag(self, geom_verts, mat):
        idx = self._slot(mat)
        vs = set(geom_verts)
        for f in self.bm.faces:
            if all(v in vs for v in f.verts):
                f.material_index = idx
                f.smooth = False

    def box(self, size, loc=(0, 0, 0), rot=(0, 0, 0), mat=None):
        m = Matrix.LocRotScale(Vector(loc), Euler([math.radians(r) for r in rot]), Vector(size))
        r = bmesh.ops.create_cube(self.bm, size=1.0, matrix=m)
        self._tag(r["verts"], mat)
        return self

    def cyl(self, radius, depth, loc=(0, 0, 0), rot=(0, 0, 0), segments=8, mat=None, caps=True, radius2=None):
        m = Matrix.LocRotScale(Vector(loc), Euler([math.radians(r) for r in rot]), None)
        r = bmesh.ops.create_cone(self.bm, cap_ends=caps, cap_tris=False, segments=segments,
                                  radius1=radius, radius2=radius if radius2 is None else radius2,
                                  depth=depth, matrix=m)
        self._tag(r["verts"], mat)
        return self

    def tube(self, a, b, radius, segments=6, mat=None, caps=False):
        """Cylinder from point a to point b (frame tubing)."""
        a, b = Vector(a), Vector(b)
        d = b - a
        q = Vector((0, 0, 1)).rotation_difference(d.normalized())
        m = Matrix.Translation((a + b) / 2) @ q.to_matrix().to_4x4()
        r = bmesh.ops.create_cone(self.bm, cap_ends=caps, cap_tris=False, segments=segments,
                                  radius1=radius, radius2=radius, depth=d.length, matrix=m)
        self._tag(r["verts"], mat)
        return self

    def extrude_profile(self, profile_yz, x0, x1, mat=None):
        """Side profile polygon (list of (y, z)) extruded along X from x0 to x1."""
        left = [self.bm.verts.new((x0, y, z)) for y, z in profile_yz]
        right = [self.bm.verts.new((x1, y, z)) for y, z in profile_yz]
        n = len(profile_yz)
        faces = [self.bm.faces.new(list(reversed(left))), self.bm.faces.new(right)]
        for i in range(n):
            j = (i + 1) % n
            faces.append(self.bm.faces.new((left[i], left[j], right[j], right[i])))
        bmesh.ops.recalc_face_normals(self.bm, faces=faces)
        self._tag(left + right, mat)
        return self

    def build(self, parent=None, location=(0, 0, 0)):
        bmesh.ops.triangulate(self.bm, faces=self.bm.faces[:], quad_method="BEAUTY", ngon_method="BEAUTY")
        me = bpy.data.meshes.new(self.name)
        self.bm.to_mesh(me)
        self.bm.free()
        for p in me.polygons:
            p.use_smooth = False
        for m in self.slots:
            me.materials.append(m)
        ob = bpy.data.objects.new(self.name, me)
        bpy.context.scene.collection.objects.link(ob)
        ob.location = location
        if parent is not None:
            ob.parent = parent
        return ob


def empty(name, location=(0, 0, 0), parent=None):
    ob = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = location
    if parent is not None:
        ob.parent = parent
    return ob


def tri_count():
    dg = bpy.context.evaluated_depsgraph_get()
    n = 0
    for ob in bpy.context.scene.objects:
        if ob.type == "MESH":
            me = ob.evaluated_get(dg).to_mesh()
            me.calc_loop_triangles()
            n += len(me.loop_triangles)
            ob.evaluated_get(dg).to_mesh_clear()
    return n


def export_glb(path):
    import os
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(path), export_format="GLB",
                              export_yup=True, export_apply=True)
    print(f"[lowpoly] wrote {path} ({os.path.getsize(path)} bytes, {tri_count()} tris)")


def finish(args):
    """Common tail: export GLB and/or JSON based on --out / --json."""
    import time
    if getattr(args, "out", None):
        export_glb(args.out)
    if getattr(args, "json", None):
        import os
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import export_json
        export_json.export(args.json)
