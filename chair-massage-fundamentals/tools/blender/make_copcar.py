"""City police cruiser: the sedan's construction (copied from make_sedan.py, not imported, so the
sedan output never changes) with black-and-white livery, a roof light bar and a push bumper.
Front faces Blender -Y (= three.js +Z). Origin on the ground at the car centre.

  blender -b --factory-startup --python-exit-code 1 --python tools/blender/make_copcar.py -- \
      --json assets/copcar.json --render assets-test/sheets/copcar.png

Objects: CopCar (empty) > Body, Cabin, lightbar, Wheel_FL, Wheel_FR, Wheel_RL, Wheel_RR.
Left = +X. lightbar: red half on the left (+X), blue half on the right (-X); materials LightRed /
LightBlue so code can flash them by swapping those colours.
Livery: black Paint hood/trunk/lower body, White doors (proud side panels) and roof.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lowpoly as lp

args = lp.script_args({"out": "", "json": "assets/copcar.json"})
lp.clear_scene()

PAINT = lp.material("Paint", "#16171a")
WHITE = lp.material("White", "#f2f2ee")
GLASS = lp.material("Glass", lp.PALETTE["glass"])
TRIM = lp.material("Trim", lp.PALETTE["black"])
TIRE = lp.material("Tire", lp.PALETTE["rubber"])
HUB = lp.material("Hub", lp.PALETTE["chrome"])
LAMP = lp.material("Lamp", lp.PALETTE["lamp"])
TAIL = lp.material("Tail", lp.PALETTE["red"])
LRED = lp.material("LightRed", "#e0201a")
LBLUE = lp.material("LightBlue", "#1f5fe0")
BAR = lp.material("BarBase", "#3a3d42")

root = lp.empty("CopCar")
W = 0.86            # body half width
AXLE, WR = 1.35, 0.32

body = lp.Part("Body")
profile = [(-2.20, 0.30), (-2.20, 0.64), (-2.05, 0.80), (-0.95, 0.88),
           (1.60, 0.88), (2.15, 0.84), (2.20, 0.64), (2.20, 0.30)]
profile += lp.arch_notches((-AXLE, AXLE), 0.40, WR, 0.30)
body.extrude_profile(profile, -W, W, mat=PAINT)
body.box((1.30, 3.9, 0.36), loc=(0, 0, 0.48), mat=TRIM)                                   # chassis fills the arch tunnel
body.extrude_profile([(-0.30, 1.38), (1.10, 1.38), (1.10, 1.43), (-0.30, 1.43)], -0.76, 0.76, mat=WHITE)  # roof
body.box((1.50, 0.10, 0.50), loc=(0, 0.40, 1.13), mat=WHITE)                             # B pillar
# white doors: one proud panel per side between the arches (per-face livery, no textures)
for s in (-1, 1):
    body.box((0.02, 1.62, 0.44), loc=(s * (W + 0.005), 0.0, 0.64), mat=WHITE)
for s in (-1, 1):
    body.box((0.30, 0.04, 0.12), loc=(0.58 * s, -2.21, 0.68), mat=LAMP)
    body.box((0.30, 0.04, 0.10), loc=(0.58 * s, 2.21, 0.70), mat=TAIL)
for y in (-2.24, 2.24):
    body.box((1.80, 0.10, 0.14), loc=(0, y, 0.38), mat=TRIM)                              # bumpers
# push bumper: two uprights + two cross bars bolted ahead of the front bumper
for s in (-1, 1):
    body.box((0.08, 0.08, 0.50), loc=(0.36 * s, -2.36, 0.58), mat=TRIM)
    body.box((0.06, 0.16, 0.06), loc=(0.36 * s, -2.26, 0.40), mat=TRIM)                   # brace into the bumper
body.box((1.00, 0.07, 0.07), loc=(0, -2.37, 0.46), mat=TRIM)
body.box((0.90, 0.07, 0.07), loc=(0, -2.37, 0.76), mat=TRIM)
body.build(parent=root)

lp.Part("Cabin").extrude_profile([(-0.95, 0.87), (-0.30, 1.38), (1.10, 1.38), (1.62, 0.87)],
                                 -0.74, 0.74, mat=GLASS).build(parent=root)

# light bar: origin on the roof surface, base + red (left, +X) and blue (right, -X) domes
lb = lp.Part("lightbar")
lb.box((1.10, 0.26, 0.06), loc=(0, 0, 0.03), mat=BAR)
lb.taper((0.52, 0.22), (0.46, 0.16), 0.055, 0.14, loc=(0.27, 0, 0), mat=LRED)
lb.taper((0.52, 0.22), (0.46, 0.16), 0.055, 0.14, loc=(-0.27, 0, 0), mat=LBLUE)
lb.build(parent=root, location=(0, 0.25, 1.43))

lp.four_wheels(root, 0.76, AXLE, WR, 0.24, TIRE, HUB)
lp.finish(args)
