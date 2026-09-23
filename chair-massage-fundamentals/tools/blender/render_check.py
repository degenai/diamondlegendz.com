"""Headless self-check: 3-view Workbench contact sheet (front | three-quarter | side).

  blender -b --factory-startup --python make_x.py -- --render out.png      (via lowpoly.finish)
  or from any script:  import render_check; render_check.contact_sheet("out.png")

Orthographic, flat material colours (diffuse_color), studio light, black object outlines so
separate shells and gaps are visible. Views: FRONT looks from -Y (vehicle/person front),
3/4 from (+X,-Y,+Z), SIDE from +X. A faint floor line is not drawn: floating shows as a gap
between the lowest part and the bottom of the frame, which sits on z=0.
Adds cameras/world only; call it AFTER exporting (export_json ignores cameras anyway).
"""
import os
import math
import time
import tempfile
import bpy
import numpy as np
from mathutils import Vector


def _bounds():
    lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
    for ob in bpy.context.scene.objects:
        if ob.type != "MESH":
            continue
        for c in ob.bound_box:
            w = ob.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, w))
            hi = Vector(map(max, hi, w))
    return lo, hi


def contact_sheet(path, width=900, height=300, bg=(0.82, 0.89, 0.84)):
    t0 = time.time()
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_WORKBENCH"
    sh = sc.display.shading
    sh.light = "STUDIO"
    sh.color_type = "MATERIAL"
    sh.show_object_outline = True
    sh.object_outline_color = (0, 0, 0)
    sh.show_cavity = False
    sc.display_settings.display_device = "sRGB"
    sc.view_settings.view_transform = "Standard"   # hex colours in = hex colours out
    if sc.world is None:
        sc.world = bpy.data.worlds.new("World")
    sc.world.color = bg
    sc.render.film_transparent = False
    sc.render.resolution_x = width // 3
    sc.render.resolution_y = height
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"

    lo, hi = _bounds()
    ctr = (lo + hi) / 2
    size = hi - lo
    radius = size.length / 2
    cam_data = bpy.data.cameras.new("_check_cam")
    cam_data.type = "ORTHO"
    cam = bpy.data.objects.new("_check_cam", cam_data)
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam_data.clip_start, cam_data.clip_end = 0.01, radius * 10

    views = [(0, -1, 0.0), (1, -1, 0.75), (1, 0, 0.0)]  # front, three-quarter, side
    tiles = []
    tmp = tempfile.mkdtemp(prefix="lp_check_")
    for vi, (dx, dy, dz) in enumerate(views):
        d = Vector((dx, dy, dz)).normalized()
        cam.location = ctr + d * radius * 4
        cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
        aspect = (width / 3) / height
        # fit: ortho_scale spans the larger of width/aspect-corrected height
        cam_data.ortho_scale = radius * 2.1 * max(1.0, aspect)
        f = os.path.join(tmp, f"v{vi}.png")
        sc.render.filepath = f
        bpy.ops.render.render(write_still=True)
        img = bpy.data.images.load(f)
        px = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32)
        img.pixels.foreach_get(px)
        tiles.append(px.reshape(img.size[1], img.size[0], 4))
        bpy.data.images.remove(img)
    sheet = np.concatenate(tiles, axis=1)
    sheet[:, width // 3 - 1:width // 3 + 1, :3] = 0.3   # tile separators
    sheet[:, 2 * width // 3 - 1:2 * width // 3 + 1, :3] = 0.3
    out = bpy.data.images.new("_sheet", sheet.shape[1], sheet.shape[0], alpha=True)
    out.pixels.foreach_set(sheet.ravel())
    os.makedirs(os.path.dirname(os.path.abspath(path)) or ".", exist_ok=True)
    out.filepath_raw = os.path.abspath(path)
    out.file_format = "PNG"
    out.save()
    bpy.data.objects.remove(cam, do_unlink=True)
    print(f"[render_check] wrote {path} ({sheet.shape[1]}x{sheet.shape[0]}) in {time.time() - t0:.2f}s")
