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
    defaults = dict(defaults)
    defaults.setdefault("render", "")  # --render sheet.png -> 3-view Workbench contact sheet
    defaults.setdefault("render_size", "900x300")  # bigger (e.g. 2700x900) to inspect joints
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
    if bpy.app.version < (5, 0, 0):
        m.use_nodes = True  # 5.x: deprecated no-op (warns); materials.new() already has a node tree
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

    def taper(self, bottom, top, z0, z1, loc=(0, 0, 0), rot=(0, 0, 0), mat=None, shift=(0, 0)):
        """Tapered box (8 verts, 12 tris). bottom/top = (sx, sy) full sizes at local z0/z1.
        shift = (dx, dy) offset of the top face (lean). Good for torsos, heads, cabins."""
        m = Matrix.LocRotScale(Vector(loc), Euler([math.radians(r) for r in rot]), None)
        (bx, by), (tx, ty) = bottom, top
        pts = [(-bx / 2, -by / 2, z0), (bx / 2, -by / 2, z0), (bx / 2, by / 2, z0), (-bx / 2, by / 2, z0),
               (-tx / 2 + shift[0], -ty / 2 + shift[1], z1), (tx / 2 + shift[0], -ty / 2 + shift[1], z1),
               (tx / 2 + shift[0], ty / 2 + shift[1], z1), (-tx / 2 + shift[0], ty / 2 + shift[1], z1)]
        v = [self.bm.verts.new(m @ Vector(p)) for p in pts]
        quads = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
        faces = [self.bm.faces.new([v[i] for i in q]) for q in quads]
        bmesh.ops.recalc_face_normals(self.bm, faces=faces)
        self._tag(v, mat)
        return self

    def ball(self, p, r, segments=6, rings=3, mat=None):
        """Low-poly sphere (6x3 = 24 tris). Use for welded joints and knuckles."""
        m = Matrix.Translation(Vector(p))
        res = bmesh.ops.create_uvsphere(self.bm, u_segments=segments, v_segments=rings, radius=r, matrix=m)
        self._tag(res["verts"], mat)
        return self

    def pipe(self, points, radius, segments=6, closed=False, caps=False, mat=None, radii=None):
        """Continuous tube swept along a polyline with mitred corners: one shell, no gaps at bends.
        closed=True joins the last point back to the first. radii (optional) = per-point radius
        (tapered limbs). Parallel-transport frames so the tube never twists."""
        P = [Vector(p) for p in points]
        n = len(P)
        R = radii or [radius] * n
        segs = n if closed else n - 1
        dirs = [(P[(i + 1) % n] - P[i]).normalized() for i in range(segs)]
        d0 = dirs[0]
        helper = Vector((0, 0, 1)) if abs(d0.z) < 0.9 else Vector((1, 0, 0))
        u = d0.cross(helper).normalized()
        frames, prev = [], d0
        for d in dirs:  # transport u along the path
            u = (prev.rotation_difference(d) @ u).normalized()
            frames.append((u, d.cross(u).normalized()))
            prev = d
        rings = []
        for i in range(n):
            if i == 0:  # first ring lives in segment 0's frame (slid along it onto the mitre)
                din = dirs[-1] if closed else dirs[0]
                (u, w), along = frames[0], dirs[0]
            elif i == n - 1 and not closed:
                din = dirs[-1]
                (u, w), along = frames[-1], din
            else:
                din = dirs[i - 1]
                (u, w), along = frames[i - 1], din
            dout = dirs[i % segs] if (closed or i < n - 1) else din
            mit = din + dout
            mit = mit.normalized() if mit.length > 1e-6 else din
            ring = []
            for k in range(segments):
                a = 2 * math.pi * k / segments
                o = (u * math.cos(a) + w * math.sin(a)) * R[i]
                t = o.dot(mit) / along.dot(mit)        # slide along the segment onto the mitre plane
                ring.append(self.bm.verts.new(P[i] + o - along * t))
            rings.append(ring)
        faces = []
        for s in range(segs):
            a, b = rings[s], rings[(s + 1) % n]
            if closed and s == segs - 1:
                # frames drift around a non-planar loop (holonomy): rotate ring 0's indexing
                # to the best match so the closing segment twists as little as possible.
                ref = (a[0].co - P[s]).normalized()
                off = max(range(segments), key=lambda k: (b[k].co - P[0]).normalized().dot(
                    ref - dirs[s] * ref.dot(dirs[s])))
                b = b[off:] + b[:off]
            for k in range(segments):
                k2 = (k + 1) % segments
                faces.append(self.bm.faces.new((a[k], a[k2], b[k2], b[k])))
        if caps and not closed:
            faces.append(self.bm.faces.new(list(reversed(rings[0]))))
            faces.append(self.bm.faces.new(rings[-1]))
        bmesh.ops.recalc_face_normals(self.bm, faces=faces)
        self._tag([v for r in rings for v in r], mat)
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


def _seg_closest(p1, q1, p2, q2):
    """Closest points between segments p1q1 and p2q2 -> (dist, s, t, c1, c2)."""
    d1, d2, r = q1 - p1, q2 - p2, p1 - p2
    a, e, f = d1.dot(d1), d2.dot(d2), d2.dot(r)
    c, b = d1.dot(r), d1.dot(d2)
    if a < 1e-12:  # first "segment" is a point
        t = min(max(f / e, 0.0), 1.0) if e > 1e-12 else 0.0
        c2 = p2 + d2 * t
        return (p1 - c2).length, 0.0, t, p1, c2
    den = a * e - b * b
    s = min(max((b * f - c * e) / den, 0.0), 1.0) if den > 1e-12 else 0.0
    t = (b * s + f) / e
    if t < 0.0:
        t, s = 0.0, min(max(-c / a, 0.0), 1.0)
    elif t > 1.0:
        t, s = 1.0, min(max((b - c) / a, 0.0), 1.0)
    c1, c2 = p1 + d1 * s, p2 + d2 * t
    return (c1 - c2).length, s, t, c1, c2


class Frame:
    """Welded tube frame. Add polylines with line(); weld() drops a joint ball wherever two
    different lines touch or cross (T-joints, pivots, end-to-corner), then reports any open
    end that touches nothing ("floating"). A frame that prints 'floating ends: 0' reads as
    one welded piece. Usage:
        fr = lp.Frame(part, radius=0.016, mat=GOLD)
        fr.line([a, b, c]); fr.line([...], closed=True); fr.line([p, q], free_end=True)
        fr.weld()          # before part.build()
    """

    def __init__(self, part, radius, mat=None, segments=6, joint_scale=1.45, joint_rings=2):
        self.part, self.r, self.mat, self.seg, self.js = part, radius, mat, segments, joint_scale
        self.rings = joint_rings  # 2 = 12-tri bipyramid knuckle, 3 = 24-tri ball
        self.lines = []  # (points, closed, free_ends)
        self.joints = []

    def line(self, points, closed=False, free_end=False, free_start=False):
        pts = [Vector(p) for p in points]
        self.lines.append((pts, closed, (free_start, free_end)))
        self.part.pipe(pts, self.r, segments=self.seg, closed=closed, caps=(free_end or free_start), mat=self.mat)
        return self

    def joint(self, p):
        """Force a joint ball at p (e.g. a decorative knuckle)."""
        p = Vector(p)
        if all((p - j).length > self.r * 2 for j in self.joints):
            self.joints.append(p)
        return self

    def _segs(self, li):
        pts, closed, _ = self.lines[li]
        n = len(pts)
        return [(pts[i], pts[(i + 1) % n]) for i in range(n if closed else n - 1)]

    def weld(self, verbose=True):
        tol = self.r * 2.05
        comp = list(range(len(self.lines)))

        def find(x):
            while comp[x] != x:
                x = comp[x]
            return x
        for i in range(len(self.lines)):
            for j in range(i + 1, len(self.lines)):
                for a in self._segs(i):
                    for b in self._segs(j):
                        d, s, t, c1, c2 = _seg_closest(a[0], a[1], b[0], b[1])
                        if d < tol:
                            self.joint((c1 + c2) / 2)
                            comp[find(i)] = find(j)
        floating = []
        for li, (pts, closed, free) in enumerate(self.lines):
            if closed:
                continue
            for end, is_free in ((pts[0], free[0]), (pts[-1], free[1])):
                if is_free:
                    continue
                touching = any(_seg_closest(end, end, a, b)[0] < tol
                               for lj in range(len(self.lines)) if lj != li for a, b in self._segs(lj))
                if not touching:
                    floating.append(tuple(round(c, 3) for c in end))
        for p in self.joints:
            self.part.ball(p, self.r * self.js, segments=self.seg, rings=self.rings, mat=self.mat)
        self.pieces = len({find(i) for i in range(len(self.lines))})
        if verbose:
            print(f"[frame] {self.part.name}: {len(self.lines)} lines, {len(self.joints)} joints, "
                  f"pieces: {self.pieces} (want 1), floating ends: {len(floating)} {floating if floating else ''}")
        return floating


def arch_notches(wheel_ys, radius, z_axle, z_bottom, steps=5):
    """Wheel-arch notches for the BOTTOM edge of a side profile used with extrude_profile().
    Returns (y, z) points running from +Y to -Y; append them after the profile's rear-bottom
    point (profile order: front-bottom, up over the roof, rear-bottom, then these).
    Concave profiles are fine: build() triangulates n-gons with polyfill."""
    pts = []
    for y0 in sorted(wheel_ys, reverse=True):
        pts.append((y0 + radius, z_bottom))
        for k in range(steps + 1):
            a = math.pi * k / steps
            pts.append((y0 + radius * math.cos(a), max(z_axle, z_bottom) + radius * math.sin(a)))
        pts.append((y0 - radius, z_bottom))
    return pts


def wheel(name, loc, radius, width, tire_mat, hub_mat, parent=None, segments=10):
    """Wheel object with its origin on the axle: spin = local X rotation, steer = local Z
    (three.js: rotation.x spin, rotation.y steer). Named Wheel_FL/FR/RL/RR by convention."""
    w = Part(name)
    w.cyl(radius, width, rot=(0, 90, 0), segments=segments, mat=tire_mat)
    w.cyl(radius * 0.5, width + 0.02, rot=(0, 90, 0), segments=6, mat=hub_mat)
    ob = w.build(parent=parent, location=loc)
    ob.location.z = -min(v.co.z for v in ob.data.vertices)  # tyre's flat rests on z=0 (odd n-gons!)
    return ob


def four_wheels(parent, half_track, axle_y, radius, width, tire_mat, hub_mat, segments=10):
    """Front axle at -axle_y (front faces -Y), rear at +axle_y. Returns the 4 wheel objects."""
    out = []
    for name, sx, sy in (("Wheel_FL", 1, -1), ("Wheel_FR", -1, -1), ("Wheel_RL", 1, 1), ("Wheel_RR", -1, 1)):
        out.append(wheel(name, (half_track * sx, axle_y * sy, radius), radius, width,
                         tire_mat, hub_mat, parent=parent, segments=segments))
    return out


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


def check(max_tris=600):
    """Numeric guards before export: triangle cap, sits on the ground, overall size in metres."""
    lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
    for ob in bpy.context.scene.objects:
        if ob.type == "MESH":
            for v in ob.data.vertices:
                w = ob.matrix_world @ v.co
                lo, hi = Vector(map(min, lo, w)), Vector(map(max, hi, w))
    n = tri_count()
    size = hi - lo
    print(f"[check] tris {n}/{max_tris} | min z {lo.z:+.3f} | size x{size.x:.2f} y{size.y:.2f} z{size.z:.2f} m")
    if abs(lo.z) > 0.01:
        print(f"[check] WARNING: lowest point is at z={lo.z:+.3f}, prop does not sit on the ground")
    if n > max_tris:
        raise RuntimeError(f"triangle budget exceeded: {n} > {max_tris}")


def finish(args, max_tris=600):
    """Common tail: guards, then export GLB and/or JSON (--out / --json), then --render sheet."""
    check(max_tris)
    if getattr(args, "out", None):
        export_glb(args.out)
    if getattr(args, "json", None):
        import os
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import export_json
        export_json.export(args.json)
    if getattr(args, "render", None):
        import os
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import render_check
        w, h = (int(v) for v in args.render_size.lower().split("x"))
        render_check.contact_sheet(args.render, w, h)
