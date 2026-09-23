"""Boxy low-poly sedan. Front faces Blender -Y (= three.js +Z). Origin on the ground at the car centre.

  blender -b --factory-startup --python-exit-code 1 --python tools/blender/make_sedan.py -- --json assets/sedan.json [--color "#e8e4da"] [--render sheet.png]

Objects: Sedan (empty) > Body, Cabin, Wheel_FL, Wheel_FR, Wheel_RL, Wheel_RR.
L/R are the driver's left/right (left = +X). Wheel origins sit on the axle so code can spin
(local X) and steer (local Z / three Y) them. Body has notched wheel arches + a dark chassis.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lowpoly as lp

args = lp.script_args({"out": "", "json": "assets/sedan.json", "color": "#e8e4da"})
lp.clear_scene()

PAINT = lp.material("Paint", args.color)
GLASS = lp.material("Glass", lp.PALETTE["glass"])
TRIM = lp.material("Trim", lp.PALETTE["black"])
TIRE = lp.material("Tire", lp.PALETTE["rubber"])
HUB = lp.material("Hub", lp.PALETTE["chrome"])
LAMP = lp.material("Lamp", lp.PALETTE["lamp"])
TAIL = lp.material("Tail", lp.PALETTE["red"])

root = lp.empty("Sedan")
W = 0.86            # body half width
AXLE, WR = 1.35, 0.32

body = lp.Part("Body")
profile = [(-2.20, 0.30), (-2.20, 0.64), (-2.05, 0.80), (-0.95, 0.88),
           (1.60, 0.88), (2.15, 0.84), (2.20, 0.64), (2.20, 0.30)]
profile += lp.arch_notches((-AXLE, AXLE), 0.40, WR, 0.30)
body.extrude_profile(profile, -W, W, mat=PAINT)
body.box((1.30, 3.9, 0.36), loc=(0, 0, 0.48), mat=TRIM)                                   # chassis fills the arch tunnel
body.extrude_profile([(-0.30, 1.38), (1.10, 1.38), (1.10, 1.43), (-0.30, 1.43)], -0.76, 0.76, mat=PAINT)  # roof
body.box((1.50, 0.10, 0.50), loc=(0, 0.40, 1.13), mat=PAINT)                             # B pillar
for s in (-1, 1):
    body.box((0.30, 0.04, 0.12), loc=(0.58 * s, -2.21, 0.68), mat=LAMP)
    body.box((0.30, 0.04, 0.10), loc=(0.58 * s, 2.21, 0.70), mat=TAIL)
for y in (-2.24, 2.24):
    body.box((1.80, 0.10, 0.14), loc=(0, y, 0.38), mat=TRIM)                              # bumpers
body.build(parent=root)

lp.Part("Cabin").extrude_profile([(-0.95, 0.87), (-0.30, 1.38), (1.10, 1.38), (1.62, 0.87)],
                                 -0.74, 0.74, mat=GLASS).build(parent=root)

lp.four_wheels(root, 0.76, AXLE, WR, 0.24, TIRE, HUB)
print(f"[sedan] tris {lp.tri_count()}")
lp.finish(args)
