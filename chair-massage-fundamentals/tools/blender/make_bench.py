"""Plaza bench: 5 seat slats + 4 back slats (dark green paint) on two cast-iron style end frames
(grey iron, welded tube polylines with scroll-ish armrests). 1.8 m long (X), seat 0.45 m high.
Seat front faces Blender -Y (= three.js +Z), matching benchParts() in src/world/props.js.
Origin on the ground at the bench centre.

  blender -b --factory-startup --python-exit-code 1 --python tools/blender/make_bench.py -- \
      --json assets/bench.json --render assets-test/sheets/bench.png

Objects: Bench (empty) > slats, frames.  Materials: Paint (slats), Iron (frames).
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lowpoly as lp
from mathutils import Vector

args = lp.script_args({"out": "", "json": "assets/bench.json"})
lp.clear_scene()

PAINT = lp.material("Paint", "#1f4a33")
IRON = lp.material("Iron", "#7a8187")

root = lp.empty("Bench")
L = 1.80
R = 0.024                     # iron tube radius
FX = 0.78                     # end frames at x = +-FX

# side profile joints (y, z); front = -Y
FOOT_F = (-0.27, R)
SEAT_F = (-0.25, 0.42)
SEAT_B = (0.15, 0.42)
FOOT_B = (0.24, R)
BACK_T = (0.26, 0.83)
ARM_B = (0.20, 0.64)
ARM_F = (-0.30, 0.64)

fr = lp.Part("frames")
for s in (-1, 1):
    P = lambda yz: (s * FX, yz[0], yz[1])
    f = lp.Frame(fr, R, mat=IRON)
    f.line([P(FOOT_F), P(SEAT_F), P(SEAT_B), P(FOOT_B)], free_start=True, free_end=True)  # ends stand in the cast feet          # front leg, seat rail, rear leg
    f.line([P(SEAT_B), P(BACK_T)], free_end=True)                   # back support
    f.line([P(SEAT_F), P((-0.31, 0.53)), P(ARM_F), P(ARM_B)])      # armrest with a forward scroll
    f.weld()
    for foot in (FOOT_F, FOOT_B):                                    # flared cast feet
        fr.box((0.07, 0.10, 0.03), loc=(s * FX, foot[0], 0.015), mat=IRON)
fr.build(parent=root)

sl = lp.Part("slats")
T, W = 0.032, 0.075          # slat thickness, width
zs = SEAT_F[1] + R + T / 2   # seat slats rest ON the rail
for i in range(5):
    y = -0.24 + i * (0.36 / 4)
    sl.box((L, W, T), loc=(0, y, zs), mat=PAINT)
# back slats sit on the front face of the back support tube
d = Vector((0, BACK_T[0] - SEAT_B[0], BACK_T[1] - SEAT_B[1])).normalized()
n = Vector((0, -d.z, d.y))                       # front-facing normal of the back plane
tilt = -math.degrees(math.atan2(d.y, d.z))       # negative: top leans toward +Y
for i in range(4):
    t = 0.14 + i * 0.095                         # distance along the support from the seat rail
    c = Vector((0, SEAT_B[0], SEAT_B[1])) + d * t + n * (R + T / 2)
    sl.box((L, T, W + 0.01), loc=(0, c.y, c.z), rot=(tilt, 0, 0), mat=PAINT)
sl.build(parent=root)
lp.finish(args)
