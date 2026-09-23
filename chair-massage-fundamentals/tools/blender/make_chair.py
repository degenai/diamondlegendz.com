"""Folding portable massage chair (low poly, flat shaded, PE palette).

  blender --background --python tools/blender/make_chair.py -- --out assets-test/chair.glb [--json assets-test/chair.json]

Blender axes: X lateral, +Y toward the face cradle (client leans forward), Z up. Origin on the floor
under the seat. Parts are separate objects (Frame, Seat, Kneelers, ChestPad, Armrest, FaceCradle)
under an empty "Chair" so code can recolour or animate a fold.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lowpoly as lp

args = lp.script_args({"out": "assets-test/chair.glb", "json": ""})
lp.clear_scene()

PAD = lp.material("Pad", lp.PALETTE["pe_green"])
FRAME = lp.material("Frame", lp.PALETTE["gold"])
FOOT = lp.material("Foot", lp.PALETTE["rubber"])

root = lp.empty("Chair")

# --- tubular frame: X-frame legs, chest/cradle supports, cross bars -------------
R = 0.016
f = lp.Part("Frame")
for s in (-1, 1):
    x = 0.20 * s
    f.tube((x, -0.30, 0.0), (x, 0.34, 0.60), R, mat=FRAME)       # rear leg -> under chest pad
    f.tube((x, 0.56, 0.0), (x, -0.08, 0.56), R, mat=FRAME)       # front leg -> under seat (X cross)
    f.tube((0.15 * s, 0.26, 0.60), (0.15 * s, 0.52, 1.00), R, mat=FRAME)  # chest pad rail
    f.box((0.05, 0.08, 0.03), loc=(x, -0.30, 0.015), mat=FOOT)   # rubber feet
    f.box((0.05, 0.08, 0.03), loc=(x, 0.56, 0.015), mat=FOOT)
f.tube((-0.20, -0.30, 0.02), (0.20, -0.30, 0.02), R, mat=FRAME)  # floor bars
f.tube((-0.20, 0.56, 0.02), (0.20, 0.56, 0.02), R, mat=FRAME)
f.tube((-0.20, 0.14, 0.33), (0.20, 0.14, 0.33), R, mat=FRAME)    # kneeler cross bar
f.tube((-0.15, 0.40, 0.78), (0.15, 0.40, 0.78), R, mat=FRAME)    # armrest cross bar
f.tube((0.0, 0.50, 0.97), (0.0, 0.60, 1.10), R * 1.2, mat=FRAME)  # face cradle stem
f.build(parent=root)

# --- upholstered pads ---------------------------------------------------------
lp.Part("Seat").box((0.40, 0.34, 0.08), loc=(0, -0.06, 0.60), rot=(-8, 0, 0), mat=PAD).build(parent=root)

k = lp.Part("Kneelers")
for s in (-1, 1):
    k.box((0.15, 0.30, 0.07), loc=(0.13 * s, 0.22, 0.33), rot=(38, 0, 0), mat=PAD)
k.build(parent=root)

lp.Part("ChestPad").box((0.34, 0.08, 0.42), loc=(0, 0.40, 0.86), rot=(-35, 0, 0), mat=PAD).build(parent=root)
lp.Part("Armrest").box((0.42, 0.18, 0.05), loc=(0, 0.56, 0.74), rot=(-10, 0, 0), mat=PAD).build(parent=root)

# face cradle: 8-sided puck, tilted toward the client, with a gold rim ring
fc = lp.Part("FaceCradle")
fc.cyl(0.13, 0.06, loc=(0, 0.64, 1.12), rot=(-30, 0, 0), segments=8, mat=PAD)
fc.cyl(0.135, 0.02, loc=(0, 0.655, 1.095), rot=(-30, 0, 0), segments=8, mat=FRAME)
fc.build(parent=root)

lp.finish(args)
