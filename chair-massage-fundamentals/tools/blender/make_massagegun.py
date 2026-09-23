"""Handheld percussive massage gun (consumer Theragun/Hypervolt shape), gold + PE green + black rubber.
Level 0 is real-world size: ~0.18 m tall, ~0.24 m bottom-of-grip-rear to head tip.

  blender -b --factory-startup --python-exit-code 1 --python tools/blender/make_massagegun.py -- \
      --json assets/massagegun.json --render assets-test/sheets/massagegun.png
  blender ... make_massagegun.py -- --level 3 --json "" --render assets-test/sheets/massagegun_level3.png

Blender axes: X lateral, -Y = forward (three.js +Z, like people and vehicles), Z up (three.js +Y).

Hierarchy (each origin is the joint to its parent):
  grip   root. Origin = bottom of the handle. Handle rakes: its top sits 25 mm forward of its bottom.
    body     origin = top of the handle. Horizontal motor cylinder ~0.16 m along Y.
      barrel   origin = its own base, 6 mm inside the body's nose. Geometry runs along Blender -Y only
               (three.js +Z), so barrel.scale.z lengthens it away from the body with no gap.
        head     origin = the barrel tip. Rubber ball + neck; the neck reaches back over the shaft.

Runtime levels: barrel.scale.z = 1/2/3/4, head scale = 1/1.3/1.7/2.2.
IMPORTANT: head is a child of barrel, so it inherits barrel.scale.z. Set the head's z scale to
undo it, or the ball stretches into a 4:1 spike at level 3:
    barrel.scale.z = L;  head.scale.set(H, H, H / L);
--level N previews exactly that; add --naive 1 to preview the uncompensated (wrong) version.
Only level 0 is exported; levels are runtime scales, not separate meshes.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lowpoly as lp

args = lp.script_args({"out": "", "json": "assets/massagegun.json", "level": "0", "naive": "0"})
level = int(args.level)
lp.clear_scene()

GOLD = lp.material("Gold", "#e8b923")
GREEN = lp.material("Green", lp.PALETTE["pe_green"])
RUBBER = lp.material("Rubber", lp.PALETTE["rubber"])
CHROME = lp.material("Chrome", lp.PALETTE["chrome"])

GRIP_H = 0.115          # handle bottom -> body underside
RAKE = 0.025            # handle top is this far forward (-Y) of its bottom
BODY_R = 0.033          # motor cylinder radius (~66 mm across)
SHAFT_R = 0.011
SHAFT_L = 0.040         # level-0 shaft length from its base (6 mm of it hidden in the nose)
HEAD_R = 0.020          # 40 mm rubber ball

# --- grip: root, origin at the bottom of the handle ----------------------------------------
grip = lp.Part("grip")
grip.taper((0.034, 0.050), (0.034, 0.046), 0.0, 0.014, mat=GREEN, shift=(0, -0.003))        # base pad / battery foot
grip.taper((0.028, 0.040), (0.030, 0.036), 0.012, GRIP_H + 0.012, mat=GOLD,
           loc=(0, -0.003, 0), shift=(0, -RAKE + 0.003))                                  # raked handle
grip.taper((0.030, 0.016), (0.032, 0.016), 0.022, GRIP_H - 0.004,
           loc=(0, 0.011, 0), shift=(0, -RAKE + 0.004), mat=RUBBER)                        # rubber back strap, 3 mm proud
grip = grip.build(parent=None, location=(0, 0, 0))

# --- body: motor housing, origin at the handle top ------------------------------------------
# Local frame: cylinder axis along Y at z = BODY_R; rear at +Y, nose at -Y. Handle sits 35 mm
# behind the body's midpoint, like a real gun (motor weight over the hand).
BZ = BODY_R
body = lp.Part("body")
body.cyl(BODY_R, 0.120, loc=(0, -0.005, BZ), rot=(90, 0, 0), segments=10, caps=False, mat=GOLD)     # y +0.055..-0.065
body.cyl(BODY_R + 0.0015, 0.012, loc=(0, 0.058, BZ), rot=(90, 0, 0), segments=10, mat=GREEN)       # rear accent ring
body.cyl(BODY_R * 0.95, 0.012, loc=(0, 0.070, BZ), rot=(90, 0, 0), segments=10,
         radius2=BODY_R, mat=RUBBER)                                                               # rounded rear cap (rear = -Z end)
body.cyl(BODY_R * 0.6, 0.004, loc=(0, 0.077, BZ), rot=(90, 0, 0), segments=10, mat=RUBBER)
body.cyl(BODY_R, 0.030, loc=(0, -0.078, BZ), rot=(90, 0, 0), segments=10,
         radius2=0.017, mat=GREEN)                                                                 # tapered green nose, y -0.063..-0.093
for s in (-1, 1):                                                                                  # vent slots, both flanks
    for dz in (-0.007, 0.007):
        body.box((0.006, 0.040, 0.004), loc=(s * (BODY_R - 0.001), 0.020, BZ + dz), mat=RUBBER)
body.cyl(0.008, 0.010, loc=(0, 0.030, BZ + BODY_R - 0.001), segments=8, mat=GREEN)             # power button on top
body.cyl(SHAFT_R + 0.004, 0.010, loc=(0, -0.096, BZ), rot=(90, 0, 0), segments=8, mat=RUBBER)  # dust boot at the nose tip (fixed size, does not stretch)
body = body.build(parent=grip, location=(0, -RAKE, GRIP_H))

# --- barrel: shaft, origin at its base inside the nose; geometry along -Y only ---------------
barrel = lp.Part("barrel")
barrel.cyl(SHAFT_R, SHAFT_L, loc=(0, -SHAFT_L / 2, 0), rot=(90, 0, 0), segments=8, caps=True, mat=CHROME)
barrel = barrel.build(parent=body, location=(0, -0.090, BZ))

# --- head: rubber ball, origin at the barrel tip --------------------------------------------
head = lp.Part("head")
head.cyl(SHAFT_R + 0.002, 0.018, loc=(0, 0.001, 0), rot=(90, 0, 0), segments=8,
         radius2=0.016, mat=GREEN)                                           # neck collar, reaches 10 mm back over the shaft
head.ball((0, -0.004 - HEAD_R, 0), HEAD_R, segments=8, rings=5, mat=RUBBER)
head = head.build(parent=barrel, location=(0, -SHAFT_L, 0))

# --- level preview: the scales runtime code sets on the loaded nodes --------------------------
LEVELS = {0: (1.0, 1.0), 1: (2.0, 1.3), 2: (3.0, 1.7), 3: (4.0, 2.2)}
L, H = LEVELS[level]
barrel.scale.y = L                         # Blender Y == three.js Z
head.scale = (H, H if args.naive == "1" else H / L, H)

import bpy
bpy.context.view_layer.update()
lp.finish(args, max_tris=600)
