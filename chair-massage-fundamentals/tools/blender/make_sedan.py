"""Boxy low-poly sedan. Front faces Blender -Y (= three.js +Z). Origin on the ground at the car centre.

  blender --background --python tools/blender/make_sedan.py -- --out assets-test/sedan.glb [--json assets-test/sedan.json] [--color "#e8e4da"]

Objects: Sedan (empty) > Body, Cabin, Wheel_FL, Wheel_FR, Wheel_RL, Wheel_RR.
Wheel origins sit on the axle so code can spin (local X) and steer (local Z / three Y) them.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lowpoly as lp

args = lp.script_args({"out": "assets-test/sedan.glb", "json": "", "color": "#e8e4da"})
lp.clear_scene()

PAINT = lp.material("Paint", args.color)
GLASS = lp.material("Glass", lp.PALETTE["glass"])
TRIM = lp.material("Trim", lp.PALETTE["black"])
TIRE = lp.material("Tire", lp.PALETTE["rubber"])
HUB = lp.material("Hub", lp.PALETTE["chrome"])
LAMP = lp.material("Lamp", lp.PALETTE["lamp"])
TAIL = lp.material("Tail", lp.PALETTE["red"])

root = lp.empty("Sedan")
W = 0.86  # half width

# body: side profile (y, z), front at -Y, extruded across the car
body = lp.Part("Body")
body.extrude_profile([(-2.20, 0.30), (-2.20, 0.64), (-2.05, 0.80), (-0.95, 0.88),
                      (1.60, 0.88), (2.15, 0.84), (2.20, 0.64), (2.20, 0.30)], -W, W, mat=PAINT)
body.extrude_profile([(-0.30, 1.38), (1.10, 1.38), (1.10, 1.43), (-0.30, 1.43)], -0.76, 0.76, mat=PAINT)  # roof
body.box((1.50, 0.10, 0.50), loc=(0, 0.40, 1.13), mat=PAINT)                                           # B pillar
for s in (-1, 1):
    body.box((0.30, 0.04, 0.12), loc=(0.58 * s, -2.21, 0.68), mat=LAMP)
    body.box((0.30, 0.04, 0.10), loc=(0.58 * s, 2.21, 0.70), mat=TAIL)
for y in (-2.24, 2.24):
    body.box((1.80, 0.10, 0.14), loc=(0, y, 0.38), mat=TRIM)                                           # bumpers
body.build(parent=root)

# greenhouse: one glass wedge, slightly narrower than the body
lp.Part("Cabin").extrude_profile([(-0.95, 0.87), (-0.30, 1.38), (1.10, 1.38), (1.62, 0.87)],
                                 -0.74, 0.74, mat=GLASS).build(parent=root)

for name, x, y in (("Wheel_FL", -0.78, -1.35), ("Wheel_FR", 0.78, -1.35),
                   ("Wheel_RL", -0.78, 1.35), ("Wheel_RR", 0.78, 1.35)):
    w = lp.Part(name)
    w.cyl(0.32, 0.24, rot=(0, 90, 0), segments=10, mat=TIRE)
    w.cyl(0.16, 0.26, rot=(0, 90, 0), segments=6, mat=HUB)
    w.build(parent=root, location=(x, y, 0.32))

lp.finish(args)
