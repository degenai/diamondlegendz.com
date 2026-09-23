# Blender prop pipeline: research notes (2026-09-23)

Scope: headless `blender --background --factory-startup --python make_x.py`, bmesh-built, flat-shaded, colours from `diffuse_color` → custom JSON.
"(verified)" = probed locally against Blender 5.2.2 LTS (`C:\Program Files\Blender Foundation\Blender 5.2`).

## 1. blender-mcp (what to take, what to skip)
- [ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp) is a socket addon (localhost:9876) plus an MCP server. Its main tool is `execute_blender_code` (runs arbitrary Python in a live GUI Blender). It also includes asset fetchers (Poly Haven, Sketchfab, Hyper3D/Hunyuan3D, Poly Pizza) and `get_viewport_screenshot`.
- Where it helps: you get live scene introspection and a viewport screenshot the model can look at. The README says to "break complex requests into smaller steps" and to save before running code.
- Where it falls short: it needs a running GUI Blender. On Windows the screenshot tool fails or hangs ([#148](https://github.com/ahujasid/blender-mcp/issues/148), [#140](https://github.com/ahujasid/blender-mcp/issues/140), [#187](https://github.com/ahujasid/blender-mcp/issues/187) WSL path mismatch). The server is unauthenticated with unrestricted code execution ([#207](https://github.com/ahujasid/blender-mcp/issues/207)). The scene state is mutable and can't be reproduced.
- **Rule:** stay on stateless, reproducible scripts. Copy only the feedback idea: render a picture every time we build (section 4), not a live socket.

## 2. bpy in background mode (4.x / 5.x)
- **Context:** in `-b` mode `context.window` exists but `context.area` is `None` (verified). Any `view3d.*` / `view3d`-polled op fails `poll()` (verified). `object.transform_apply`, `object.mode_set`, and `mesh.*` in edit mode do work (verified). Since [4.0](https://developer.blender.org/docs/release_notes/4.0/python_api/) the dict override argument to `bpy.ops` has been removed; use `with context.temp_override(...)`. [5.0](https://developer.blender.org/docs/release_notes/5.0/python_api/) adds `override.logging_set(True)` to show which context members an op reads.
- **Rule:** use bmesh / data API for all geometry. `bpy.ops` is allowed only for export and render. There is no reason to fake a 3D view.
- **Exit codes:** by default a Python exception still exits **0** (verified). Always pass `--python-exit-code 1` before `--python` so batch builds fail loudly.
- **bmesh gotchas:** use `ensure_lookup_table()` before indexing `bm.verts[i]` / `bm.faces[i]`, or you get an IndexError (verified). `bm.faces` are created with `smooth=False`, so `bm.to_mesh()` gives flat shading with no extra step (verified; `mesh.shade_flat()` also exists). `bm.free()` after `to_mesh`.
- **Normals:** [4.1](https://developer.blender.org/docs/release_notes/4.1/python_api/) removed `use_auto_smooth`, `auto_smooth_angle`, `calc_normals_split`. Read per-corner normals from `mesh.corner_normals`. `MeshLoop.normal` is read-only. For flat props, export the face normal per triangle (or `corner_normals`, which equal face normals when faces are sharp).
- **Evaluated mesh:** read modifier results with `ob.evaluated_get(depsgraph).to_mesh()` followed by `to_mesh_clear()`. Since 4.0, `bmesh.from_object` needs an evaluated depsgraph.

## 3. Colour, materials, and the 5.x API breaks
- **`material.use_nodes` is deprecated in 5.0**: it is always True, setting it does nothing, and it raises a DeprecationWarning (verified). `materials.new()` already creates the Principled node tree ([5.0 notes](https://developer.blender.org/docs/release_notes/5.0/python_api/)). Also deprecated: `world.use_nodes` and `scene.use_nodes`. **Rule:** delete every `use_nodes = True` line.
- **Also removed in 5.x:** `BLENDER_EEVEE_NEXT` is now `BLENDER_EEVEE`. Dict access to addon properties (`scene['cycles']`) is gone. BGL is gone. The boolean solver `FAST` is now `FLOAT`. Collada is gone. 5.1 moved to Python 3.13. 5.2 changed geometry-nodes modifier inputs to `mod.properties.inputs.<id>`.
- **Workbench reads `diffuse_color`, not the Principled Base Color** (verified: red diffuse with blue BSDF renders red). The glTF exporter reads the BSDF. If a GLB is ever needed, set both.
- **`diffuse_color` is scene-linear.** [5.0 added a per-file Working Space](https://developer.blender.org/docs/release_notes/5.0/color_management/). The default is `lin_rec709_scene` (verified via `bpy.data.colorspace.working_space_interop_id`), so our hex→linear conversion stays correct under `--factory-startup`. Assert that value in `export_json.py` so the pipeline breaks loudly if the working space ever changes. Three.js expects linear vertex colours, so pass them through unchanged.
- **Colour attributes** (4.x+): `mesh.color_attributes.new(name, 'FLOAT_COLOR'|'BYTE_COLOR', 'POINT'|'CORNER')`. For both types, `.color` reads and writes **linear** and `.color_srgb` is the sRGB view. BYTE_COLOR is stored as 8-bit sRGB, so linear 0.5 comes back as 0.5029 (verified). **Rule:** use `FLOAT_COLOR` + `CORNER` for flat per-face colour (hard edges between faces). POINT domain bleeds colour across faces.

## 4. Render-to-check (the missing feedback loop)
- `scene.render.engine = 'BLENDER_WORKBENCH'` renders fine in `-b` on this machine (verified, ~2 s for 64 px). The enum list only shows `BLENDER_EEVEE` at runtime, but assignment works. Use `display.shading.light = 'FLAT'|'STUDIO'|'MATCAP'` and `color_type = 'MATERIAL'|'OBJECT'|'RANDOM'|'VERTEX'|'TEXTURE'|'SINGLE'` (verified).
- **The default view transform is AgX, which shifts colours:** pure red rendered as (0.86, 0.22, 0.13) (verified). **Rule:** set `scene.view_settings.view_transform = 'Standard'` for review thumbnails.
- 5.2 adds `gpu.init()` for GPU work in `--background` ([5.2 notes](https://developer.blender.org/docs/release_notes/5.2/python_api/)). On a headless box with no GPU, fall back to Cycles CPU.
- **Rule:** each `make_x.py` writes an orthographic front, side, and top render plus a 3/4 view (`color_type='RANDOM'` makes loose parts obvious). The builder looks at those images before it calls the prop done.

## 5. glTF exporter names (5.2 source: `scripts/addons_core/io_scene_gltf2/__init__.py`)
- `export_format` ∈ `GLB`, `GLTF_SEPARATE`. `GLTF_EMBEDDED` is only available behind an addon preference.
- Other flags: `export_yup` (default True), `export_apply` (default False, modifiers).
- Vertex colours: the old `export_colors` is now rejected ("keyword unrecognized", verified). Use `export_vertex_color` ∈ `MATERIAL`(default) | `ACTIVE` | `NAME` | `NONE`, plus `export_vertex_color_name`, `export_all_vertex_colors`, `export_active_vertex_color_when_no_material`.
- Materials and selection: `export_materials` ∈ `EXPORT` | `PLACEHOLDER` | `VIEWPORT` | `NONE`. `use_selection`.
- 5.2 added meshopt compression export and fixed vertex-colour export on subsets of materials ([5.2 I/O](https://developer.blender.org/docs/release_notes/5.2/pipeline_io/)).

## 6. Low-poly construction patterns (bmesh)
- **Side profile then extrude:** define the silhouette in the YZ plane, extrude it along X, run `recalc_face_normals`. This gives the best silhouette per triangle for vehicles and furniture.
- **Mirror a half:** `bmesh.ops.mirror(bm, geom=..., axis='X', merge_dist=1e-3)`. Delete the faces lying on the mirror plane first: mirroring a closed half leaves internal seam faces and non-manifold edges (verified: mirrored cube came out non-manifold with volume 0).
- **Bevel:** `bmesh.ops.bevel(geom=edges, offset=..., segments=1, affect='EDGES', profile=0.5)`. One segment on silhouette edges only; every segment multiplies the triangle count.
- **Decimation:** use a `DECIMATE` modifier (`COLLAPSE`, `ratio`) and read the evaluated mesh. It is a last resort because it wrecks hard silhouettes. Better to lower `segments` on cones and spheres (6–8 sides are enough).
- **Budgets:** count `mesh.loop_triangles` after `calc_loop_triangles()`. Set a triangle cap per prop in the script, and make the build print the count and fail if it goes over the cap.

## 7. LLM-generated asset failure modes → guards
- Disconnected or floating parts are the main failure once code runs ([3DCodeBench](https://arxiv.org/html/2606.01057v1)). Error-feedback loops raise executability from 0.70 to 0.97, but conditional shape quality barely moves (−0.01).
- **Guard:** count connected components per part and check that each part's bbox touches or overlaps its parent's. Assert `min z ≈ 0` so props sit on the ground.
- Multi-part assemblies are the hardest case: the best models reach only about 0.5 part-match F1, and semantics (~0.8) run well ahead of geometry (~0.35) ([P3D-Bench](https://arxiv.org/html/2606.11152v1)). Models also stop revising after the first pass.
- **Guard:** write dimensions as named constants in metres, from a reference sheet. Assert the overall bbox against real-world size (chair seat ~0.45 m).
- API drift (4.x → 5.0 names) is the main source of runtime errors ([3DCodeBench](https://arxiv.org/html/2606.01057v1)). **Guard:** check the 5.x breaks in section 3 before trusting any snippet written from memory.
- Visual verification by VLMs is weak (Claude 3.5 Sonnet agreed with humans 0.66 of the time vs 0.79 human–human, per [BlenderGym](https://arxiv.org/html/2504.01786v1)). Propose → render → verify loops beat single-shot generation.
- **Guard:** combine the numeric asserts above with the section-4 renders. Neither is enough alone.
- **Axes:** Blender is Z-up, right-handed, −Y forward. Three.js is Y-up. The JSON exporter must apply `(x, y, z) → (x, z, −y)` exactly once. Keep an asymmetric test prop (arrow pointing +X, label on the +Y side) to catch double or missing swaps.
