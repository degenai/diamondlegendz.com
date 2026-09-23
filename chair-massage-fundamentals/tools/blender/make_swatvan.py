"""SWAT van: the franchise van's construction (copied from make_van.py, not imported, so van.json
never changes), matte black, ~0.2 m taller roof, roof light bar and a steel front ram.
Front faces Blender -Y (= three.js +Z). Origin on the ground at the van centre.

  blender -b --factory-startup --python-exit-code 1 --python tools/blender/make_swatvan.py -- \
      --json assets/swatvan.json --render assets-test/sheets/swatvan.png

Objects: SwatVan (empty) > Body, Glass, lightbar, Wheel_FL, Wheel_FR, Wheel_RL, Wheel_RR. Left = +X.
lightbar: red half left (+X), blue half right (-X); materials LightRed / LightBlue.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lowpoly as lp

args = lp.script_args({"out": "", "json": "assets/swatvan.json"})
lp.clear_scene()

PAINT = lp.material("Paint", "#232427")          # matte black (a touch lighter than van black so faces read)
GLASS = lp.material("Glass", "#4f6878")
TRIM = lp.material("Trim", "#111113")
STEEL = lp.material("Steel", "#4a4e54")
TIRE = lp.material("Tire", lp.PALETTE["rubber"])
HUB = lp.material("Hub", "#3a3d42")
LAMP = lp.material("Lamp", lp.PALETTE["lamp"])
TAIL = lp.material("Tail", lp.PALETTE["red"])
LRED = lp.material("LightRed", "#e0201a")
LBLUE = lp.material("LightBlue", "#1f5fe0")

root = lp.empty("SwatVan")
W, L = 1.00, 2.65
AXLE_F, AXLE_R, WR = -1.70, 1.80, 0.38
ROOF = 2.36

body = lp.Part("Body")
profile = [(-L, 0.36), (-L, 1.00), (-2.35, 1.10), (-1.80, 1.20), (-1.10, ROOF - 0.06), (-0.95, ROOF),
           (2.60, ROOF), (L, ROOF - 0.06), (L, 0.36)]
profile += lp.arch_notches((AXLE_F, AXLE_R), 0.47, WR, 0.36)
body.extrude_profile(profile, -W, W, mat=PAINT)
body.box((1.50, 4.9, 0.40), loc=(0, 0, 0.54), mat=TRIM)                  # chassis
body.box((2.02, 0.14, 0.18), loc=(0, L + 0.06, 0.46), mat=TRIM)          # rear bumper
for s in (-1, 1):
    body.box((0.30, 0.04, 0.14), loc=(0.66 * s, -L - 0.01, 0.86), mat=LAMP)
    body.box((0.12, 0.04, 0.40), loc=(0.86 * s, L + 0.01, 1.30), mat=TAIL)
body.box((0.02, 0.03, 1.75), loc=(0, L + 0.012, 1.26), mat=TRIM)         # rear door seam
for s in (-1, 1):
    body.box((0.02, 3.6, 0.10), loc=((W + 0.005) * s, 0.55, 1.10), mat=TRIM)  # armour rub strip
# front ram: wedge plate + two push arms into the chassis
body.extrude_profile([(-L - 0.34, 0.30), (-L - 0.34, 0.66), (-L - 0.24, 0.74), (-L - 0.18, 0.74),
                      (-L - 0.18, 0.30)], -0.92, 0.92, mat=STEEL)
for s in (-1, 1):
    body.box((0.12, 0.30, 0.12), loc=(0.55 * s, -L - 0.05, 0.52), mat=TRIM)
body.build(parent=root)

g = lp.Part("Glass")
g.extrude_profile([(-1.80, 1.23), (-1.145, 2.26), (-1.115, 2.26), (-1.77, 1.23)], -0.92, 0.92, mat=GLASS)
for s in (-1, 1):
    g.extrude_profile([(-1.62, 1.32), (-1.08, 2.14), (-0.55, 2.14), (-0.55, 1.32)],
                      (W - 0.005) * s, (W + 0.012) * s, mat=GLASS)
g.build(parent=root)

lb = lp.Part("lightbar")
lb.box((1.40, 0.30, 0.07), loc=(0, 0, 0.035), mat=STEEL)
lb.taper((0.66, 0.26), (0.58, 0.18), 0.065, 0.16, loc=(0.34, 0, 0), mat=LRED)
lb.taper((0.66, 0.26), (0.58, 0.18), 0.065, 0.16, loc=(-0.34, 0, 0), mat=LBLUE)
lb.build(parent=root, location=(0, -0.55, ROOF))

lp.four_wheels(root, 0.86, 0.0, WR, 0.28, TIRE, HUB)
for ob in root.children:
    if ob.name.startswith("Wheel_"):
        ob.location.y = AXLE_F if ob.name[6] == "F" else AXLE_R
lp.finish(args)
