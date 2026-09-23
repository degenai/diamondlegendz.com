"""Boxy black cargo van (the franchise goons' van). Front faces Blender -Y (= three.js +Z).
Origin on the ground at the van centre. Same wheel treatment as the sedan (notched arches,
dark chassis, Wheel_* origins on the axles).

  blender -b --factory-startup --python-exit-code 1 --python tools/blender/make_van.py -- --json assets/van.json [--color "#18181b"] [--render sheet.png]

Objects: Van (empty) > Body, Glass, Wheel_FL, Wheel_FR, Wheel_RL, Wheel_RR. Left = +X.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lowpoly as lp

args = lp.script_args({"out": "", "json": "assets/van.json", "color": "#18181b"})
lp.clear_scene()

PAINT = lp.material("Paint", args.color)
GLASS = lp.material("Glass", "#4a6272")
TRIM = lp.material("Trim", "#303033")
TIRE = lp.material("Tire", lp.PALETTE["rubber"])
HUB = lp.material("Hub", lp.PALETTE["chrome"])
LAMP = lp.material("Lamp", lp.PALETTE["lamp"])
TAIL = lp.material("Tail", lp.PALETTE["red"])

root = lp.empty("Van")
W, L = 0.98, 2.65
AXLE_F, AXLE_R, WR = -1.70, 1.80, 0.36

body = lp.Part("Body")
profile = [(-L, 0.34), (-L, 0.98), (-2.35, 1.08), (-1.80, 1.18), (-1.15, 2.08), (-1.0, 2.14),
           (2.60, 2.14), (L, 2.08), (L, 0.34)]
profile += lp.arch_notches((AXLE_F, AXLE_R), 0.45, WR, 0.34)
body.extrude_profile(profile, -W, W, mat=PAINT)
body.box((1.50, 4.9, 0.40), loc=(0, 0, 0.52), mat=TRIM)                  # chassis
for y, h in ((-L - 0.05, 0.16), (L + 0.05, 0.16)):
    body.box((2.0, 0.12, h), loc=(0, y, 0.44), mat=TRIM)                 # bumpers
for s in (-1, 1):
    body.box((0.30, 0.04, 0.14), loc=(0.66 * s, -L - 0.01, 0.84), mat=LAMP)
    body.box((0.12, 0.04, 0.40), loc=(0.86 * s, L + 0.01, 1.30), mat=TAIL)
body.box((0.02, 0.03, 1.55), loc=(0, L + 0.012, 1.18), mat=TRIM)         # rear door seam
for s in (-1, 1):
    body.box((0.02, 0.9, 0.02), loc=((W + 0.005) * s, -0.35, 1.02), mat=TRIM)  # side door rail
body.build(parent=root)

# glass: windshield slab on the slope + front door windows only (cargo van: blind sides)
g = lp.Part("Glass")
g.extrude_profile([(-1.78, 1.21), (-1.17, 2.04), (-1.13, 2.02), (-1.74, 1.19)], -0.90, 0.90, mat=GLASS)
for s in (-1, 1):
    g.extrude_profile([(-1.62, 1.30), (-1.12, 1.98), (-0.55, 1.98), (-0.55, 1.30)],
                      (W - 0.005) * s, (W + 0.012) * s, mat=GLASS)
g.build(parent=root)

lp.four_wheels(root, 0.84, 0.0, WR, 0.26, TIRE, HUB)  # placed below, axles differ front/rear
for ob in root.children:
    if ob.name.startswith("Wheel_"):
        ob.location.y = AXLE_F if ob.name[6] == "F" else AXLE_R
print(f"[van] tris {lp.tri_count()}")
lp.finish(args)
