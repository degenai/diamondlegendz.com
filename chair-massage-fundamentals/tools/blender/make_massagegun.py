"""Handheld percussive massage gun, gold + PE green palette. Level 0 = normal consumer size
(~25 cm bottom-of-grip to head tip), T shape. ~ 12 cm grip capped with a motor housing that a
short shaft (barrel) and round percussion head project forward from.

  blender -b --factory-startup --python-exit-code 1 --python tools/blender/make_massagegun.py -- \
      --json assets/massagegun.json --render assets-test/sheets/massagegun.png
  blender -b --factory-startup --python-exit-code 1 --python tools/blender/make_massagegun.py -- \
      --level 3 --json "" --render assets-test/sheets/massagegun_level3.png

Blender axes: X lateral, -Y = forward (three.js +Z, same forward as people/vehicles), Z up
(three.js +Y). Origin at the bottom of the grip, where the hand holds it.

Hierarchy (every object's origin is the joint to its parent, rig-free):
  grip (root, origin = bottom of the grip)
    body (origin = top of the grip; motor housing, fixed size at every level)
      barrel (origin = its own base, the socket on the body; long axis is local -Y so
              scaling barrel.scale.y in Blender / .scale.z in three.js lengthens it away
              from the body with no gap)
        head (origin = barrel's tip; a uv-sphere big enough to overlap back over the
              shaft, so it never gaps even as barrel/head are scaled independently)

Level table (barrel length scale, head size scale) applied AFTER build via --level, purely to
preview what code will do at runtime by setting these same two scales on the loaded nodes:
  0: 1.0x / 1.0x   1: 2.0x / 1.3x   2: 3.0x / 1.7x   3: 4.0x / 2.2x
Only level 0 is exported (the deliverable geometry is level-0/unscaled; higher levels are a
render-only preview of the runtime scaling, not separate assets).
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lowpoly as lp

args = lp.script_args({"out": "", "json": "assets/massagegun.json", "level": "0"})
level = int(args.level)
lp.clear_scene()

GOLD = lp.material("Gold", lp.PALETTE["gold"])
GREEN = lp.material("Green", lp.PALETTE["pe_green"])
BLACK = lp.material("Black", lp.PALETTE["black"])

GRIP_H = 0.115          # bottom-of-grip to top-of-grip (= body attach height)
BODY_SIZE = (0.076, 0.060, 0.072)   # x, y, z of the main housing box
BARREL_R = 0.017
BARREL_LEN = 0.115       # level-0 shaft length (base, unscaled)
HEAD_R = 0.032

# --- grip: root, origin at (0,0,0) = bottom of the grip ---------------------------------
grip = (lp.Part("grip")
        .taper((0.030, 0.026), (0.038, 0.030), 0, GRIP_H, mat=GOLD)
        .box((0.012, 0.012, 0.032), loc=(0, -0.019, 0.075), mat=GREEN)   # trigger nub
        .build(parent=None, location=(0, 0, 0)))

# --- body: motor housing, child of grip, origin at the grip's top ----------------------
bx, by, bz = BODY_SIZE
body = (lp.Part("body")
        .box(BODY_SIZE, loc=(0, 0, bz / 2 - 0.008), mat=GREEN)              # embeds 8mm into grip
        .box((bx + 0.004, by + 0.004, 0.014), loc=(0, 0, 0.05), mat=GOLD)   # trim band
        .box((0.020, 0.020, 0.010), loc=(0, 0, 0.067), mat=GOLD)            # top button
        .build(parent=grip, location=(0, 0, GRIP_H)))

# --- barrel: shaft, child of body, origin at its OWN base (the body socket); geometry runs
# along local -Y only, so scaling barrel.scale.y stretches it away from the body with no gap ---
barrel = (lp.Part("barrel")
          .cyl(BARREL_R, BARREL_LEN, loc=(0, -BARREL_LEN / 2, 0), rot=(90, 0, 0),
               segments=8, caps=False, mat=BLACK)
          .build(parent=body, location=(0, -0.045, 0.045)))   # embeds 7mm past the body's front face

# --- head: percussion head, child of barrel, origin at the barrel's tip; sphere radius is
# bigger than the shaft so it overlaps back over it at every head/barrel scale combo ----------
head = (lp.Part("head")
        .ball((0, 0, 0), HEAD_R, segments=6, rings=3, mat=GOLD)
        .build(parent=barrel, location=(0, -BARREL_LEN, 0)))

# --- level preview: same two scales a runtime would set on the loaded nodes ------------------
LEVELS = {0: (1.0, 1.0), 1: (2.0, 1.3), 2: (3.0, 1.7), 3: (4.0, 2.2)}
barrel_scale, head_scale = LEVELS[level]
barrel.scale.y = barrel_scale
head.scale = (head_scale, head_scale, head_scale)

# force matrix_world to recompute before lp.check() reads it (bpy defers evaluation and
# check()'s ground-check bbox loop reads ob.matrix_world directly, unlike tri_count()'s
# depsgraph-evaluated read; without this, freshly-set location/parent/scale can read stale)
import bpy as _bpy
_bpy.context.view_layer.update()

lp.finish(args, max_tris=300)
