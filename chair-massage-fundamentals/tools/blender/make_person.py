"""Neutral jointed person, ~1.80 m, idle pose, arms slightly out. One mesh for every human
(peds, clients, goons, cops, player): code recolours by region and animates by rotating joints.
Faces Blender -Y (= three.js +Z). Origin (scene root) on the ground between the feet.

  blender -b --factory-startup --python-exit-code 1 --python tools/blender/make_person.py -- --json assets/person.json [--render sheet.png]

Hierarchy (every object's origin IS its joint; all rotations are zero in the idle pose, the arm
splay is baked into the geometry, so rotation.x on a limb swings it forward/back):
  hips (pelvis, z 0.95)
    torso (waist, z 1.02)
      head (neck, z 1.50)
      upperArmL / upperArmR (shoulder)  > lowerArmL / lowerArmR (elbow; forearm + hand)
    upperLegL / upperLegR (hip joint)   > lowerLegL / lowerLegR (knee; shin + shoe)
L = the person's left = +X (three.js +X as well).
Materials (= recolour regions, listed in the JSON "materials" field):
  skin (head, neck, forearms, hands) | shirt (torso, upper arms) | pants (hips, legs) | hair | shoes
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lowpoly as lp
from mathutils import Vector

args = lp.script_args({"out": "", "json": "assets/person.json"})
lp.clear_scene()

SKIN = lp.material("skin", "#c69c7b")
SHIRT = lp.material("shirt", "#9a9a94")
PANTS = lp.material("pants", "#4a4e57")
HAIR = lp.material("hair", "#3a2a1e")
SHOES = lp.material("shoes", "#1e1e1e")

HIP_Z, WAIST_Z, NECK_Z, SHOULDER_Z = 0.95, 1.02, 1.50, 1.44
KNEE_Z = 0.50
SPLAY = math.radians(9)         # arms slightly out from the body
UA, LA = 0.30, 0.25             # upper / lower arm lengths (hand extra)

hips = (lp.Part("hips")
        .taper((0.34, 0.20), (0.33, 0.20), -0.11, 0.08, mat=PANTS)
        .build(location=(0, 0, HIP_Z)))

torso = (lp.Part("torso")
         .taper((0.32, 0.19), (0.42, 0.22), 0.0, 0.40, mat=SHIRT)          # waist -> chest
         .taper((0.42, 0.22), (0.30, 0.18), 0.40, 0.48, mat=SHIRT)         # shoulder slope
         .build(parent=hips, location=(0, 0, WAIST_Z - HIP_Z)))

(lp.Part("head")
 .cyl(0.055, 0.08, loc=(0, 0, 0.03), segments=6, mat=SKIN)                    # neck
 .taper((0.18, 0.21), (0.19, 0.22), 0.06, 0.24, loc=(0, 0.005, 0), mat=SKIN)  # face / skull
 .taper((0.20, 0.23), (0.17, 0.19), 0.22, 0.30, loc=(0, 0.01, 0), mat=HAIR)   # hair cap
 .box((0.20, 0.06, 0.12), loc=(0, 0.10, 0.18), mat=HAIR)                       # back of hair
 .box((0.04, 0.05, 0.04), loc=(0, -0.12, 0.13), mat=SKIN)                      # nose (shows facing)
 .build(parent=torso, location=(0, 0, NECK_Z - WAIST_Z)))

for side, s in (("L", 1), ("R", -1)):
    d = Vector((math.sin(SPLAY) * s, 0, -math.cos(SPLAY)))       # arm direction, slightly out
    ua = (lp.Part("upperArm" + side)
          .pipe([(0, 0, 0.02), d * UA], 0.058, caps=True, radii=[0.062, 0.05], mat=SHIRT)
          .build(parent=torso, location=(0.215 * s, 0, SHOULDER_Z - WAIST_Z)))
    hand = d * (LA + 0.06)
    (lp.Part("lowerArm" + side)
     .pipe([(0, 0, 0), d * LA], 0.045, caps=True, radii=[0.046, 0.036], mat=SKIN)
     .box((0.05, 0.09, 0.11), loc=hand, rot=(0, math.degrees(SPLAY) * s, 0), mat=SKIN)   # hand
     .build(parent=ua, location=d * UA))
    ul = (lp.Part("upperLeg" + side)
          .pipe([(0, 0, 0.04), (0, 0, -(HIP_Z - KNEE_Z) + 0.02)], 0.08, caps=True, radii=[0.085, 0.065],
                mat=PANTS)
          .build(parent=hips, location=(0.095 * s, 0, 0)))
    (lp.Part("lowerLeg" + side)
     .pipe([(0, 0, 0.02), (0, 0, -KNEE_Z + 0.10)], 0.06, caps=True, radii=[0.064, 0.048], mat=PANTS)
     .box((0.11, 0.26, 0.09), loc=(0, -0.05, -KNEE_Z + 0.045), mat=SHOES)
     .build(parent=ul, location=(0, 0, KNEE_Z - HIP_Z)))

print(f"[person] tris {lp.tri_count()}")
lp.finish(args)
