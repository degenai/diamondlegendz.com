"""THE COTERIE TRIALS on Engine v2.1 (bit-identical exact port, gate PASS 2026-07-11).

Same experiment as coterie.py (see its docstring for the three geometries and
Alex's matched-geometry protocol) — but batched: one make_worlds() tensor per
cell, every sub-book and the committee simulated across all 250 worlds at once.
Arm A and Arm B share the same P tensor, so the comparison stays world-paired.

Output: appends to the same coterie_results.jsonl (records tagged engine:"v2").
Cells already banked by the stdlib run are skipped (resume-compatible).

Run:  python sidecars/coterie-trials-20260711/coterie_v2.py [--worlds 250]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from multiprocessing import Pool
from pathlib import Path

# tiny-array lockstep workload: BLAS threading is pure overhead — pin to 1
for _v in ("OMP_NUM_THREADS", "MKL_NUM_THREADS", "OPENBLAS_NUM_THREADS", "NUMEXPR_NUM_THREADS"):
    os.environ.setdefault(_v, "1")

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "sidecars" / "demon-atlas-20260709"))

from atlas import DATE_END, DATE_START, INITIAL_CAPITAL, PANEL, POLICIES, UNIVERSES, aligned_n
from engine_v2 import build_ctx_np, make_worlds, simulate_batch
from coterie import GEOMETRIES, OUT_FILE, SEED
from demon_ranch.backtest_duos import load_json, load_prices


_G = {}


def _init():
    _G["prices"] = load_prices(PANEL)
    _G["costs"] = load_json(ROOT / "configs/costs.default.json")
    _G["ctxs"] = {}


def _rate(t):
    costs = _G["costs"]
    return (float(costs.get("spread_bps", {}).get(t, 0.0))
            + float(costs.get("slippage_bps", 0.0))) / 1e4


def run_cell(cell):
    gname, plabel, universe, worlds = cell
    try:
        costs = _G["costs"]
        floor = float(costs.get("order_floor_usd", 1.0))
        g = GEOMETRIES[gname]
        syms = g["committee"]
        if syms not in _G["ctxs"]:
            align = tuple(dict.fromkeys(syms + ("VTI",)))
            dates, sa = aligned_n(_G["prices"], align, DATE_START, DATE_END)
            ctxn = build_ctx_np(syms, {t: sa[t] for t in syms}, sa["VTI"])
            ctxn["dates"] = dates
            _G["ctxs"][syms] = ctxn
        ctx = _G["ctxs"][syms]
        policy = POLICIES[plabel]
        seed = int.from_bytes(hashlib.sha256(
            f"{SEED}|{gname}|{plabel}|{universe}|v2".encode()).digest()[:8], "big")
        rng = np.random.default_rng(seed)
        P = make_worlds(universe, ctx, worlds, rng)
        col = {t: i for i, t in enumerate(syms)}
        r_all = np.array([_rate(t) for t in syms])

        cot_finals = np.zeros(worlds)
        cot_rebs = np.zeros(worlds, dtype=np.int64)
        for book, cap in zip(g["books"], g["book_capital"]):
            cols = [col[t] for t in book]
            fb, _, rb = simulate_batch(P[:, :, cols], [0.5, 0.5], policy, ctx["dates"],
                                       r_all[cols], order_floor=floor,
                                       capital=INITIAL_CAPITAL * cap,
                                       exec_mode=os.environ.get("ATLAS_EXEC", "unit"),
                                       quantum_bps=float(os.environ.get("ATLAS_BPS", "0")))
            cot_finals += fb
            cot_rebs += rb
        com_finals, _, com_rebs = simulate_batch(P, g["committee_weights"], policy,
                                                 ctx["dates"], r_all, order_floor=floor,
                                                 capital=INITIAL_CAPITAL,
                                                 exec_mode=os.environ.get("ATLAS_EXEC", "unit"),
                                                 quantum_bps=float(os.environ.get("ATLAS_BPS", "0")))
        w = np.asarray(g["committee_weights"])
        holds = (INITIAL_CAPITAL * w[None, :] * P[:, -1, :] / P[:, 0, :]).sum(axis=1)
        return {
            "geometry": gname, "books": ["/".join(b) for b in g["books"]],
            "committee": "/".join(syms), "policy": plabel, "universe": universe,
            "window": f"{DATE_START}..{DATE_END}", "worlds": worlds,
            "seed": str(seed),
            "engine": ("v3.1-bps%g" % float(os.environ.get("ATLAS_BPS", "0")))
                      if float(os.environ.get("ATLAS_BPS", "0")) > 0
                      else ("v2.2-chunked" if os.environ.get("ATLAS_EXEC") == "chunked" else "v2"),
            "coterie_finals": [round(float(x), 2) for x in cot_finals],
            "committee_finals": [round(float(x), 2) for x in com_finals],
            "holds": [round(float(x), 2) for x in holds],
            "coterie_rebalances": [int(x) for x in cot_rebs],
            "committee_rebalances": [int(x) for x in com_rebs],
        }
    except Exception as e:
        return {"geometry": gname, "policy": plabel, "universe": universe, "worlds": 0,
                "error": f"{type(e).__name__}: {e}"[:200],
                "coterie_finals": [], "committee_finals": [], "holds": []}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--worlds", type=int, default=250)
    ap.add_argument("--procs", type=int, default=6)
    ap.add_argument("--exec", dest="exec_mode", choices=["unit", "chunked"], default="unit")
    ap.add_argument("--outfile", default=None)
    ap.add_argument("--bps", type=float, default=0.0)
    args = ap.parse_args()
    os.environ["ATLAS_EXEC"] = args.exec_mode
    os.environ["ATLAS_BPS"] = str(args.bps)
    global OUT_FILE
    if args.outfile:
        OUT_FILE = Path(args.outfile) if Path(args.outfile).is_absolute() else HERE / args.outfile
    t0 = time.time()

    done = set()
    if OUT_FILE.exists():
        with OUT_FILE.open(encoding="utf-8") as f:
            for line in f:
                try:
                    r = json.loads(line)
                    if r.get("error"):
                        continue
                    done.add((r["geometry"], r["policy"], r["universe"]))
                except Exception:
                    pass
    cells = [(gn, pl, u, args.worlds) for gn in GEOMETRIES for pl in POLICIES for u in UNIVERSES
             if (gn, pl, u) not in done]
    print(f"coterie v2: {len(GEOMETRIES)*len(POLICIES)*len(UNIVERSES)} cells total, "
          f"{len(done)} done, {len(cells)} to run, {args.procs} procs, {args.worlds} worlds/cell", flush=True)

    written = 0
    with OUT_FILE.open("a", encoding="utf-8") as out, \
         Pool(processes=args.procs, initializer=_init, maxtasksperchild=8) as pool:
        for rec in pool.imap_unordered(run_cell, cells, chunksize=1):
            out.write(json.dumps(rec, separators=(",", ":")) + "\n")
            out.flush()
            written += 1
            print(f"[{written}/{len(cells)}] {rec['geometry']} {rec['policy']} {rec['universe']}"
                  f"{' ERROR' if rec.get('error') else ''} ({time.time()-t0:.0f}s)", flush=True)
    print(f"coterie v2 complete: +{written} cells, {time.time()-t0:.0f}s", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
