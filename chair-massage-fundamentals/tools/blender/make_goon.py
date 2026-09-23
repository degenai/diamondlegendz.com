"""Blocky Serenity Group goon: black suit, white shirt, no tie, sunglasses. ~1.95 m tall.
Faces Blender -Y (= three.js +Z). Origin on the ground between the feet.

  blender --background --python tools/blender/make_goon.py -- --out assets-test/goon.glb [--json assets-test/goon.json]

Rig-free hierarchy; every object's origin is its joint, so code animates by rotating it:
  Goon (empty)
    Torso (origin = hips)           > Head (neck), UpperArm_L/R (shoulder) > LowerArm_L/R (elbow)
    UpperLeg_L/R (hip joint)        > LowerLeg_L/R (knee)
Blender "_L" is the goon's left = +X.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lowpoly as lp

args = lp.script_args({"out": "assets-test/goon.glb", "json": ""})
lp.clear_scene()

SUIT = lp.material("Suit", lp.PALETTE["suit"])
SHIRT = lp.material("Shirt", lp.PALETTE["shirt"])
SKIN = lp.material("Skin", lp.PALETTE["skin"])
BLACK = lp.material("Black", lp.PALETTE["black"])

root = lp.empty("Goon")

torso = (lp.Part("Torso")
         .box((0.50, 0.28, 0.62), loc=(0, 0, 0.31), mat=SUIT)
         .box((0.40, 0.26, 0.16), loc=(0, 0, 0.0), mat=SUIT)
         .box((0.14, 0.02, 0.30), loc=(0, -0.145, 0.44), mat=SHIRT)      # open collar, no tie
         .build(parent=root, location=(0, 0, 0.95)))

(lp.Part("Head")
 .cyl(0.06, 0.08, loc=(0, 0, 0.04), segments=6, mat=SKIN)
 .box((0.24, 0.26, 0.28), loc=(0, 0, 0.22), mat=SKIN)
 .box((0.25, 0.27, 0.06), loc=(0, 0.005, 0.37), mat=BLACK)            # hair
 .box((0.22, 0.02, 0.05), loc=(0, -0.135, 0.25), mat=BLACK)           # sunglasses
 .build(parent=torso, location=(0, 0, 0.62)))

for side, s in (("L", 1), ("R", -1)):
    ua = (lp.Part("UpperArm_" + side)
          .box((0.13, 0.14, 0.34), loc=(0, 0, -0.17), mat=SUIT)
          .build(parent=torso, location=(0.315 * s, 0, 0.56)))
    (lp.Part("LowerArm_" + side)
     .box((0.12, 0.13, 0.28), loc=(0, 0, -0.14), mat=SUIT)
     .box((0.11, 0.12, 0.03), loc=(0, 0, -0.295), mat=SHIRT)            # cuff
     .box((0.09, 0.11, 0.10), loc=(0, 0, -0.36), mat=SKIN)              # hand
     .build(parent=ua, location=(0, 0, -0.34)))
    ul = (lp.Part("UpperLeg_" + side)
          .box((0.17, 0.19, 0.46), loc=(0, 0, -0.23), mat=SUIT)
          .build(parent=root, location=(0.11 * s, 0, 0.95)))
    (lp.Part("LowerLeg_" + side)
     .box((0.15, 0.17, 0.43), loc=(0, 0, -0.215), mat=SUIT)
     .box((0.15, 0.27, 0.07), loc=(0, -0.04, -0.455), mat=BLACK)        # shoe
     .build(parent=ul, location=(0, 0, -0.46)))

lp.finish(args)
