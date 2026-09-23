"""Park-ranger campaign hat ("Smokey" hat): wide flat brim, crown with the four-dent Montana pinch
peak, brown band. A prop, not a person: code parents it to a person's `head` pivot.
Origin = centre of the hat's bottom (brim underside). Sized for person.json's head, whose hair cap
tops out ~0.30 m above the neck pivot and is ~0.20 x 0.23 m: place it at about (0, 0.25, 0.01)
in three.js coords under `head` (the crown opening is ~0.23 m across).

  blender -b --factory-startup --python-exit-code 1 --python tools/blender/make_ranger.py -- \
      --json assets/ranger.json --render assets-test/sheets/ranger.png

Objects: hat (single mesh, root). Materials: Felt (tan), Band.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lowpoly as lp

args = lp.script_args({"out": "", "json": "assets/ranger.json"})
lp.clear_scene()

FELT = lp.material("Felt", "#c2a06a")
BAND = lp.material("Band", "#5a3b22")

h = lp.Part("hat")
h.cyl(0.215, 0.014, loc=(0, 0, 0.007), segments=12, mat=FELT)                              # flat brim
h.cyl(0.125, 0.020, loc=(0, 0, 0.022), segments=8, radius2=0.122, mat=BAND)                # hat band
h.cyl(0.118, 0.070, loc=(0, 0, 0.066), segments=8, radius2=0.104, mat=FELT)                # crown wall
h.cyl(0.108, 0.075, loc=(0, 0, 0.1375), rot=(0, 0, 45), segments=4, radius2=0.0, mat=FELT)  # Montana pinch peak
h.build()
lp.finish(args)
