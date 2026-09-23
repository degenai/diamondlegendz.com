"""Baseball bat (33 in / 0.84 m), wood, black tape on the handle. Origin at the knob end; the bat
runs along Blender -Y (= three.js +Z), so a hand bone can hold it at the origin and swing it.

  blender -b --factory-startup --python-exit-code 1 --python tools/blender/make_bat.py -- \
      --json assets/bat.json --render assets-test/sheets/bat.png

Objects: bat (single mesh, root). Materials: Wood, Tape.
Note: the origin is on the bat's axis, so [check] reports min z -0.033 (half the barrel);
that is intentional for a hand-held prop.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lowpoly as lp

args = lp.script_args({"out": "", "json": "assets/bat.json"})
lp.clear_scene()

WOOD = lp.material("Wood", "#c8955a")
TAPE = lp.material("Tape", lp.PALETTE["black"])

b = lp.Part("bat")
b.cyl(0.022, 0.014, loc=(0, -0.007, 0), rot=(90, 0, 0), segments=8, radius2=0.017, mat=WOOD)   # knob
b.pipe([(0, -0.012, 0), (0, -0.30, 0), (0, -0.55, 0), (0, -0.80, 0), (0, -0.84, 0)], 0.03,
       segments=8, caps=True, radii=[0.0125, 0.014, 0.027, 0.033, 0.030], mat=WOOD)            # handle -> barrel -> end cap
b.cyl(0.0148, 0.20, loc=(0, -0.12, 0), rot=(90, 0, 0), segments=8, radius2=0.0156, caps=False, mat=TAPE)  # grip tape
b.build()
lp.finish(args)
