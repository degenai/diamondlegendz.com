"""Plaza food cart: cream box body on two spoked wheels + a stand leg, red/cream striped awning on
two posts, a steel counter shelf on the serving side. ~2.2 m long (X), ~1.9 m tall.
Serving side faces Blender -Y (= three.js +Z), matching cartParts() in src/world/props.js.
Origin on the ground at the cart centre.

  blender -b --factory-startup --python-exit-code 1 --python tools/blender/make_foodcart.py -- \
      --json assets/foodcart.json --render assets-test/sheets/foodcart.png [--awning "#c8322a"]

Objects: FoodCart (empty) > body, awning, wheelL (+X end), wheelR (-X end).
Wheel origins sit on the axle; the axle runs along X, so spin = local X (three.js rotation.x).
Materials (recolour regions): Body, Awning, AwningAlt, Steel, Tire, Spoke.
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lowpoly as lp

args = lp.script_args({"out": "", "json": "assets/foodcart.json", "awning": "#c8322a"})
lp.clear_scene()

BODY = lp.material("Body", "#efe6cf")
AWN = lp.material("Awning", args.awning)
AWN2 = lp.material("AwningAlt", "#f6f1e4")
STEEL = lp.material("Steel", "#8d9296")
TIRE = lp.material("Tire", lp.PALETTE["rubber"])
SPOKE = lp.material("Spoke", "#5a5f64")

root = lp.empty("FoodCart")
BX, BY = 2.08, 0.92          # body footprint
Z0, Z1 = 0.36, 1.05          # body bottom / top
WR = 0.33                    # wheel radius (to the tyre's outer surface)

# --- body --------------------------------------------------------------------------------
b = lp.Part("body")
b.box((BX, BY, Z1 - Z0), loc=(0, 0, (Z0 + Z1) / 2), mat=BODY)
b.box((BX + 0.04, BY + 0.04, 0.05), loc=(0, 0, Z1 + 0.025), mat=STEEL)            # counter top
b.box((BX + 0.02, 0.02, 0.10), loc=(0, -BY / 2 - 0.005, 0.60), mat=AWN)           # red band, serving side
b.box((1.60, 0.02, 0.36), loc=(0, -BY / 2 - 0.006, 0.86), mat=STEEL)              # serving hatch panel
b.box((1.90, 0.26, 0.035), loc=(0, -BY / 2 - 0.12, 0.93), mat=STEEL)              # counter shelf
for x in (-0.80, 0.80):                                                            # shelf brackets
    b.box((0.03, 0.20, 0.03), loc=(x, -BY / 2 - 0.09, 0.87), rot=(-35, 0, 0), mat=STEEL)
b.box((0.06, 0.06, Z0 + 0.02), loc=(-0.70, 0.28, (Z0 + 0.02) / 2), mat=STEEL)     # stand leg
b.box((0.16, 0.12, 0.025), loc=(-0.70, 0.28, 0.0125), mat=TIRE)                    # rubber foot
b.box((0.04, 0.60, 0.04), loc=(-BX / 2 - 0.10, 0, 0.98), mat=STEEL)                # push handle
for y in (-0.26, 0.26):
    b.box((0.14, 0.04, 0.04), loc=(-BX / 2 - 0.05, y, 0.98), mat=STEEL)
b.build(parent=root)

# --- awning: striped sloped canopy + front valance, posts included -------------------------
# Profile in (y, z): high at the back, overhanging the serving side (-Y), valance drops at front.
YB, YF = 0.52, -0.86
ZB, ZF = 1.92, 1.72
T = 0.035
prof = [(YB, ZB), (YF, ZF), (YF, ZF - 0.16), (YF + T, ZF - 0.16), (YF + T, ZF - T), (YB, ZB - T)]
a = lp.Part("awning")
N = 7
AX = BX + 0.14
for i in range(N):
    x0 = -AX / 2 + AX * i / N
    a.extrude_profile(prof, x0, x0 + AX / N, mat=AWN if i % 2 == 0 else AWN2)
def under(y):  # underside z of the canopy at y
    return (ZB - T) + (y - YB) * ((ZF - T) - (ZB - T)) / (YF - YB)
PY = 0.10
for x in (-0.96, 0.96):
    ztop = under(PY) + 0.02
    a.box((0.045, 0.045, ztop - Z1), loc=(x, PY, (Z1 + ztop) / 2), mat=STEEL)
a.build(parent=root)

# --- spoked wheels, axle along X ----------------------------------------------------------
def spoked(name, x):
    w = lp.Part(name)
    ring = [(0, (WR - 0.03) * math.cos(2 * math.pi * k / 10), (WR - 0.03) * math.sin(2 * math.pi * k / 10))
            for k in range(10)]
    w.pipe(ring, 0.03, segments=4, closed=True, mat=TIRE)
    for ang in (0, 60, 120):
        w.box((0.025, 0.025, 2 * (WR - 0.04)), rot=(ang, 0, 0), mat=SPOKE)
    w.cyl(0.055, 0.10, rot=(0, 90, 0), segments=6, mat=STEEL)
    ob = w.build(parent=root, location=(x, 0, WR))
    ob.location.z = -min(v.co.z for v in ob.data.vertices)
    return ob
spoked("wheelL", BX / 2 + 0.035)
spoked("wheelR", -BX / 2 - 0.035)
lp.finish(args)
