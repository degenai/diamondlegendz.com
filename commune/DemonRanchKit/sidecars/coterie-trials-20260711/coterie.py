"""THE COTERIE TRIALS — fleets of raiders vs matched singular higher-order demons.

Alex's protocol (2026-07-11): "the coteries of raiders strat should be tested
against similar geometries of matched singular higher order demons."

Each trial holds the SAME assets at the SAME aggregate weights in the SAME
simulated worlds; the only variable is the wall between the books.

  Arm A (coterie):   N sub-books, capital partitioned, each pair rebalances
                     internally only. Fleet final = sum of sub-book finals.
  Arm B (committee): one merged book, matched aggregate weights, full graph.

Geometries (engine-diverse, census-informed):
  G1 complete-graph: {GME/MSTR, GME/TSLA, MSTR/TSLA} thirds  vs  triad equal.
       Both trade every edge -> isolates the capital-partitioning effect.
  G2 hub-and-spoke:  {GME/SLV, GME/MSTR} halves  vs  triad GME .5/SLV .25/MSTR .25.
       Partitioning + one forgone chord (SLV-MSTR); subtract G1 -> chord price.
  G3 disjoint:       {GME/SLV, MSTR/TUR} halves  vs  quad equal.
       Engine-diverse fleet vs full committee; six forgone chords.

Output: coterie_results.jsonl (append-only, resumable) — one line per
(geometry, policy, universe): paired per-world finals for both arms + holds.

Run:  python sidecars/coterie-trials-20260711/coterie.py [--procs 6] [--worlds 250]
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
import time
from multiprocessing import Pool
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "sidecars" / "demon-atlas-20260709"))

from atlas import (DATE_END, DATE_START, INITIAL_CAPITAL, PANEL, POLICIES,
                   UNIVERSES, aligned_n, build_ctx, make_world)

OUT_FILE = HERE / "coterie_results.jsonl"
SEED = "coterie-20260711"

GEOMETRIES = {
    "G1_complete": {
        "books": [("GME", "MSTR"), ("GME", "TSLA"), ("MSTR", "TSLA")],
        "book_capital": [1/3, 1/3, 1/3],
        "committee": ("GME", "MSTR", "TSLA"),
        "committee_weights": [1/3, 1/3, 1/3],
    },
    "G2_hub": {
        "books": [("GME", "SLV"), ("GME", "MSTR")],
        "book_capital": [0.5, 0.5],
        "committee": ("GME", "SLV", "MSTR"),
        "committee_weights": [0.5, 0.25, 0.25],
    },
    "G3_disjoint": {
        "books": [("GME", "SLV"), ("MSTR", "TUR")],
        "book_capital": [0.5, 0.5],
        "committee": ("GME", "SLV", "MSTR", "TUR"),
        "committee_weights": [0.25, 0.25, 0.25, 0.25],
    },
}

_G = {}


def init_worker():
    from demon_ranch.backtest_duos import load_json, load_prices
    _G["prices"] = load_prices(PANEL)
    _G["costs"] = load_json(ROOT / "configs/costs.default.json")
    _G["ctx"] = {}


def run_cell(cell):
    try:
        return _run_cell(cell)
    except Exception as e:  # quarantine, don't kill the pool
        _G["ctx"].clear()
        gname, plabel, universe, worlds = cell
        return {"geometry": gname, "policy": plabel, "universe": universe,
                "worlds": 0, "error": f"{type(e).__name__}: {e}"[:200],
                "coterie_finals": [], "committee_finals": [], "holds": []}


def _run_cell(cell):
    gname, plabel, universe, worlds = cell
    from demon_ranch.backtest_duos import simulate
    g = GEOMETRIES[gname]
    syms = g["committee"]
    if syms not in _G["ctx"]:
        align = tuple(dict.fromkeys(syms + ("VTI",)))
        dates, series_all = aligned_n(_G["prices"], align, DATE_START, DATE_END)
        _G["ctx"][syms] = build_ctx(syms, {t: series_all[t] for t in syms},
                                    series_all["VTI"], dates)
    ctx = _G["ctx"][syms]
    policy = POLICIES[plabel]
    rng = random.Random(f"{SEED}|{gname}|{plabel}|{universe}")
    cot_finals, com_finals, holds = [], [], []
    cot_rebs, com_rebs = [], []
    for _ in range(worlds):
        path = make_world(universe, ctx, rng)
        # Arm A — the coterie: partitioned sub-books, same world
        tot, rebs = 0.0, 0
        for book, cap in zip(g["books"], g["book_capital"]):
            m = simulate(book, [0.5, 0.5], policy, ctx["dates"], path,
                         _G["costs"], INITIAL_CAPITAL * cap, collect_trades=False)["metrics"]
            tot += m["final_equity"]
            rebs += m["rebalance_count"]
        cot_finals.append(round(tot, 2)); cot_rebs.append(rebs)
        # Arm B — the matched committee: one book, aggregate weights, full graph
        m = simulate(syms, g["committee_weights"], policy, ctx["dates"], path,
                     _G["costs"], INITIAL_CAPITAL, collect_trades=False)["metrics"]
        com_finals.append(round(m["final_equity"], 2)); com_rebs.append(m["rebalance_count"])
        holds.append(round(sum(INITIAL_CAPITAL * w * path[t][-1] / path[t][0]
                               for w, t in zip(g["committee_weights"], syms)), 2))
    return {
        "geometry": gname, "books": ["/".join(b) for b in g["books"]],
        "committee": "/".join(syms), "policy": plabel, "universe": universe,
        "window": f"{DATE_START}..{DATE_END}", "worlds": worlds, "seed": SEED,
        "coterie_finals": cot_finals, "committee_finals": com_finals,
        "holds": holds, "coterie_rebalances": cot_rebs, "committee_rebalances": com_rebs,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--procs", type=int, default=6)
    ap.add_argument("--worlds", type=int, default=250)
    args = ap.parse_args()
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
    cells = [(gn, pl, u, args.worlds)
             for gn in GEOMETRIES for pl in POLICIES for u in UNIVERSES
             if (gn, pl, u) not in done]
    print(f"coterie trials: {len(GEOMETRIES) * len(POLICIES) * len(UNIVERSES)} cells total, "
          f"{len(done)} done, {len(cells)} to run", flush=True)

    written = 0
    with OUT_FILE.open("a", encoding="utf-8") as out, \
         Pool(processes=args.procs, initializer=init_worker, maxtasksperchild=12) as pool:
        for rec in pool.imap_unordered(run_cell, cells, chunksize=1):
            out.write(json.dumps(rec, separators=(",", ":")) + "\n")
            out.flush()
            written += 1
            print(f"[{written}/{len(cells)}] {rec['geometry']} {rec['policy']} {rec['universe']} "
                  f"({time.time()-t0:.0f}s)", flush=True)
    print(f"coterie trials complete: +{written} cells, {time.time()-t0:.0f}s", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
