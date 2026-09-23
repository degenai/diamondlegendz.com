"""Folding portable massage chair (kneeling type), low poly, flat shaded, PE palette.

  blender -b --factory-startup --python tools/blender/make_chair.py -- --json assets/chair.json [--out x.glb] [--render sheet.png]

Blender axes: X lateral, +Y toward the face cradle (client sits at -Y and leans forward), Z up.
Origin on the floor under the chair. Objects under empty "Chair": Frame, Seat, Kneelers,
ChestPad, Armrest, FaceCradle (code can recolour pads or animate a fold per object).

The frame is welded: every tube is a mitred polyline (lp.Frame) and every place two lines meet
gets a joint ball, so no pole floats. Side view (y, z), mirrored to x = +/-XS:
  loop A: rear foot -> diagonal leg -> chest rail (15 deg forward of vertical) -> top bar -> other side
  loop B: front foot -> diagonal leg (crosses A at the pivot) -> seat rear bar -> other side
  seat rails B-corner -> leg A; kneeler arms off leg B; armrest brackets off the chest rails;
  face-cradle stem off the top bar.
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lowpoly as lp
from mathutils import Vector

args = lp.script_args({"out": "", "json": "assets/chair.json"})
lp.clear_scene()

PAD = lp.material("Pad", lp.PALETTE["pe_green"])
FRAME = lp.material("Frame", lp.PALETTE["gold"])
FOOT = lp.material("Foot", lp.PALETTE["rubber"])

root = lp.empty("Chair")
R = 0.016          # tube radius
XS = 0.20          # half spacing of the side frames
FZ = R             # floor tubes rest on z=0


def lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def on_z(a, b, z):
    """Point on the side-view line a->b at height z."""
    return lerp(a, b, (z - a[1]) / (b[1] - a[1]))


def X(yz, s):
    return (XS * s, yz[0], yz[1])


# ---- side-view key points (y, z) ---------------------------------------------------
TILT = math.radians(15)                       # chest pad leans forward 15 deg from vertical
RF, FF = (-0.30, FZ), (0.56, FZ)              # rear / front feet
CB = (0.30, 0.74)                             # chest rail bottom (leg A bends here)
CT = (CB[0] + 0.32 * math.tan(TILT), CB[1] + 0.32)   # chest rail top
SR = (-0.22, 0.56)                            # seat rear corner (top of leg B)
SF = on_z(RF, CB, SR[1])                      # seat rail meets leg A here
KB = on_z(FF, SR, 0.30)                       # kneeler arm root on leg B
KF = (KB[0] + 0.24, KB[1] + 0.13)             # kneeler arm tip (cantilever)
AR = lerp(CB, CT, 0.15)                        # armrest bracket root on chest rail
A1 = (AR[0] + 0.12, 0.70)                      # bracket elbow
AF = (A1[0] + 0.20, 0.70)                      # bracket tip
TOPC = (CT[0], CT[1])                         # top bar centre (x = 0)
STEM = (TOPC[0] + 0.07, TOPC[1] + 0.12)        # face cradle stem tip

part = lp.Part("Frame")
fr = lp.Frame(part, R, mat=FRAME)
fr.line([X(RF, -1), X(CB, -1), X(CT, -1), X(CT, 1), X(CB, 1), X(RF, 1)], closed=True)   # loop A
fr.line([X(FF, -1), X(SR, -1), X(SR, 1), X(FF, 1)], closed=True)                        # loop B
for s in (-1, 1):
    fr.line([X(SR, s), X(SF, s)])                                      # seat rail
    fr.line([X(KB, s), X(KF, s)], free_end=True)                       # kneeler arm
    fr.line([X(AR, s), X(A1, s), X(AF, s)], free_end=True)             # armrest bracket
fr.line([(0, TOPC[0], TOPC[1]), (0, STEM[0], STEM[1])], free_end=True)  # face cradle stem
fr.weld()
for yz in (RF, FF):
    for s in (-1, 1):
        part.box((0.06, 0.07, 0.012), loc=(XS * s, yz[0], 0.006), mat=FOOT)   # rubber feet
part.build(parent=root)


def pad_on(p0, p1, thick, up_sign=1):
    """Centre + X-rotation (deg) for a pad lying on the side-view segment p0->p1, offset to sit
    on top of the tube (up_sign=+1 -> the side whose normal has +Z, -1 -> the other side)."""
    d = Vector((0, p1[0] - p0[0], p1[1] - p0[1])).normalized()
    nrm = Vector((0, -d.z, d.y)) * up_sign
    mid = Vector((0, (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2))
    c = mid + nrm * (R + thick / 2)
    ang = math.degrees(math.atan2(d.z, d.y))  # angle of the segment from +Y toward +Z
    return (c.x, c.y, c.z), ang


# seat: lies on the seat rails
c, a = pad_on(SR, SF, 0.08)
lp.Part("Seat").box((0.44, 0.40, 0.08), loc=(0, c[1] - 0.02, c[2]), rot=(a, 0, 0), mat=PAD).build(parent=root)

# kneelers: one pad per side on the kneeler arms
k = lp.Part("Kneelers")
c, a = pad_on(KB, KF, 0.07)
for s in (-1, 1):
    k.box((0.17, 0.26, 0.07), loc=(0.16 * s, c[1] + 0.02, c[2]), rot=(a, 0, 0), mat=PAD)
k.build(parent=root)

# chest pad: on the client side (-Y) of the chest rails; pad plane leans 15 deg forward
c, a = pad_on(CB, CT, 0.08)
lp.Part("ChestPad").box((0.40, 0.44, 0.08), loc=c, rot=(a, 0, 0), mat=PAD).build(parent=root)

# armrest: on the horizontal part of the brackets
c, a = pad_on(A1, AF, 0.05)
lp.Part("Armrest").box((0.48, 0.22, 0.05), loc=(0, c[1] + 0.01, c[2]), rot=(a, 0, 0), mat=PAD).build(parent=root)

# face cradle: 8-sided puck on the stem tip, face opening tilted toward the client (-Y, up)
tilt = 35  # rotate about +X: puck axis (local Z) tips toward -Y, i.e. faces up and back at the client
n = Vector((0, -math.sin(math.radians(tilt)), math.cos(math.radians(tilt))))  # puck axis
tip = Vector((0, STEM[0], STEM[1]))
fc = lp.Part("FaceCradle")
fc.cyl(0.13, 0.06, loc=tip + n * (R + 0.03), rot=(tilt, 0, 0), segments=8, mat=PAD)
fc.cyl(0.10, 0.02, loc=tip + n * (R * 0.5), rot=(tilt, 0, 0), segments=8, mat=FRAME)  # gold mount plate
fc.build(parent=root)

print(f"[chair] tris {lp.tri_count()}")
lp.finish(args)
