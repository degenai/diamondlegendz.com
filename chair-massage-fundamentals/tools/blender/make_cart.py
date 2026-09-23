"""Park maintenance golf cart: open sides, roof on four posts, bench seat, rear cargo bed.
Front faces Blender -Y (= three.js +Z). Origin on the ground at the cart centre.

  blender -b --factory-startup --python-exit-code 1 --python tools/blender/make_cart.py -- --json assets/cart.json [--color "#e8e4da"] [--render sheet.png]

Objects: Cart (empty) > Body, Seat, Roof (roof + posts + windshield frame), Steering,
Wheel_FL, Wheel_FR, Wheel_RL, Wheel_RR. Left = +X. Steering origin = column top (spin local).
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lowpoly as lp

args = lp.script_args({"out": "", "json": "assets/cart.json", "color": "#e8e4da"})
lp.clear_scene()

PAINT = lp.material("Paint", args.color)
PARK = lp.material("ParkGreen", "#2f5d3a")
SEAT = lp.material("SeatVinyl", "#3a3226")
TRIM = lp.material("Trim", lp.PALETTE["black"])
POST = lp.material("Post", lp.PALETTE["chrome"])
TIRE = lp.material("Tire", lp.PALETTE["rubber"])
HUB = lp.material("Hub", lp.PALETTE["chrome"])
LAMP = lp.material("Lamp", lp.PALETTE["lamp"])

root = lp.empty("Cart")
W = 0.58
AXLE, WR = 0.82, 0.22

body = lp.Part("Body")
# side profile: front cowl, low open floor, seat pedestal, rear deck
profile = [(-1.20, 0.26), (-1.20, 0.58), (-1.02, 0.78), (-0.72, 0.84), (-0.66, 0.40),
           (-0.10, 0.40), (-0.10, 0.62), (1.20, 0.62), (1.20, 0.26)]
profile += lp.arch_notches((-AXLE, AXLE), 0.28, WR, 0.26, steps=4)
body.extrude_profile(profile, -W, W, mat=PAINT)
body.box((0.70, 2.0, 0.20), loc=(0, 0, 0.32), mat=TRIM)                        # chassis
# cargo bed (park green) with low side rails
body.box((1.14, 0.62, 0.04), loc=(0, 0.88, 0.64), mat=PARK)
for s in (-1, 1):
    body.box((0.04, 0.62, 0.20), loc=(0.55 * s, 0.88, 0.76), mat=PARK)
body.box((1.14, 0.04, 0.20), loc=(0, 1.17, 0.76), mat=PARK)
for s in (-1, 1):
    body.box((0.18, 0.04, 0.08), loc=(0.34 * s, -1.21, 0.52), mat=LAMP)
body.build(parent=root)

seat = lp.Part("Seat")
seat.box((1.08, 0.46, 0.10), loc=(0, 0.14, 0.67), mat=SEAT)
seat.box((1.08, 0.08, 0.40), loc=(0, 0.40, 0.92), rot=(-10, 0, 0), mat=SEAT)
seat.build(parent=root)

# roof on four posts; posts are pipes that start inside the body and end inside the roof slab
roof = lp.Part("Roof")
ROOF_Z = 1.86
roof.box((1.22, 1.70, 0.06), loc=(0, -0.05, ROOF_Z), mat=PARK)
for s in (-1, 1):
    x = 0.52 * s
    roof.pipe([(x, -0.80, 0.76), (x, -0.74, 1.30), (x, -0.80, ROOF_Z)], 0.022, mat=POST)  # front posts
    roof.pipe([(x, 0.46, 0.60), (x, 0.52, ROOF_Z)], 0.022, mat=POST)                      # rear posts
roof.pipe([(-0.52, -0.74, 1.30), (0.52, -0.74, 1.30)], 0.016, mat=POST)                   # windshield bar
roof.build(parent=root)

st = lp.Part("Steering")
st.cyl(0.16, 0.03, rot=(0, 0, 0), segments=8, mat=TRIM)
st.pipe([(0, 0, 0), (0, -0.10, -0.40)], 0.02, mat=TRIM)  # column ends inside the dash
st.build(parent=root, location=(0.26, -0.52, 1.08))
bpy_ob = [o for o in root.children if o.name == "Steering"][0]
bpy_ob.rotation_euler = (math.radians(-30), 0, 0)

lp.four_wheels(root, 0.50, AXLE, WR, 0.18, TIRE, HUB, segments=8)
print(f"[cart] tris {lp.tri_count()}")
lp.finish(args)
