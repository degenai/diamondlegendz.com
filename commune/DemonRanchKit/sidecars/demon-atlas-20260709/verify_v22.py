"""v2.2 CHUNKED-EXECUTION GATE — chunked buys vs the canonical reference.

Docket item 31. Gate design v3 (2026-07-12, after the 7-CPU-hour lesson):
  - cases run in PARALLEL (Pool) — total time = slowest case, not the sum
  - every print flushes — no more buffered silence
  - reference per case: "stdlib" (direct canonical) or "unit" (transitive via
    v2.1-unit, bit-identical to stdlib — 0.00e+00 gate, 2026-07-11) where the
    stdlib/unit $1 loop is intractable
  - the U8 moonshot torture case runs BOTH arms at order_floor=$100: the
    chunked crossover math is floor-agnostic (identical code paths), the $1
    floor stays covered by every other case, and the unit reference becomes
    tractable (100x fewer iterations) instead of unbounded.

Run:  python sidecars/demon-atlas-20260709/verify_v22.py
"""

import os
for _v in ("OMP_NUM_THREADS", "MKL_NUM_THREADS", "OPENBLAS_NUM_THREADS", "NUMEXPR_NUM_THREADS"):
    os.environ.setdefault(_v, "1")

import random
import sys
import time
from multiprocessing import Pool
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(HERE))

# (syms, policy, universe, reference, order_floor)
CASES = [
    (("GLDM", "GME"), {"type": "threshold_pct", "band": 0.04}, "U1", "stdlib", 1.0),
    (("EWZ", "GDX"), {"type": "calendar", "freq": "weekly"}, "U7", "stdlib", 1.0),
    (("GME", "MSTR", "TSLA"), {"type": "threshold_pct", "band": 0.04}, "U1", "stdlib", 1.0),
    (("GME", "MSTR", "TSLA"), {"type": "threshold_pct", "band": 0.04}, "U8", "unit", 100.0),  # torture, coarse floor
    (("EWY", "GME", "SLV"), {"type": "calendar", "freq": "weekly"}, "U5", "stdlib", 1.0),
    (("DBB", "EWU", "EWZ", "GDX", "TUR"), {"type": "threshold_pct", "band": 0.05}, "U1", "stdlib", 1.0),
    (("ARGT", "COPX", "F", "GME", "URA"), {"type": "threshold_pct", "band": 0.04}, "U7", "unit", 1.0),
    (("TQQQ", "TLT", "GLDM", "GME", "SGOV", "VEU", "F"),
     {"type": "threshold_pct", "band": 0.05}, "U1", "stdlib", 1.0),
]
WORLDS = 24


def run_case(case):
    import atlas
    from engine_v2 import simulate_batch
    from demon_ranch.backtest_duos import load_json, load_prices, simulate

    syms, policy, universe, ref, floor = case
    prices = load_prices(atlas.PANEL)
    costs = dict(load_json(ROOT / "configs/costs.default.json"))
    costs["order_floor_usd"] = floor

    align = tuple(dict.fromkeys(syms + ("VTI",)))
    dates, series_all = atlas.aligned_n(prices, align, atlas.DATE_START, atlas.DATE_END)
    ctx = atlas.build_ctx(syms, {t: series_all[t] for t in syms}, series_all["VTI"], dates)
    rng = random.Random(f"verify22|{'/'.join(syms)}|{universe}")
    paths = [atlas.make_world(universe, ctx, rng) for _ in range(WORLDS)]
    weights = [1.0 / len(syms)] * len(syms)
    rates = np.array([(float(costs.get("spread_bps", {}).get(t, 0.0))
                       + float(costs.get("slippage_bps", 0.0))) / 1e4 for t in syms])
    P = np.stack([np.stack([np.asarray(p[t]) for t in syms], axis=1) for p in paths])

    t0 = time.time()
    fu, du, cu = simulate_batch(P, weights, policy, dates, rates, order_floor=floor)
    tu = time.time() - t0
    if ref == "stdlib":
        f1, d1, c1 = [], [], []
        for p in paths:
            m = simulate(syms, weights, policy, dates, p, costs, 1000.0, collect_trades=False)["metrics"]
            f1.append(m["final_equity"]); d1.append(m["max_drawdown"]); c1.append(m["rebalance_count"])
        f1 = np.array(f1); d1 = np.array(d1); c1 = np.array(c1)
    else:
        f1, d1, c1 = fu, du, cu
    t0 = time.time()
    f2, d2, c2 = simulate_batch(P, weights, policy, dates, rates, order_floor=floor, exec_mode="chunked")
    tc = time.time() - t0

    rel = np.abs(f2 - f1) / np.maximum(np.abs(f1), 1.0)
    dd = np.abs(d2 - d1)
    dc = np.abs(c2 - c1)
    ok = rel.max() < 1e-9 and dd.max() < 1e-9 and dc.max() == 0
    line = (f"  {'/'.join(syms)[:28]:28s} {universe:3s} ref={ref:6s} floor=${floor:<5.0f} | "
            f"rel max {rel.max():.2e} | dd max {dd.max():.2e} | rebal diff {int(dc.max())} | "
            f"unit {tu:6.1f}s -> chunked {tc:5.1f}s ({tu/max(tc,1e-9):6.1f}x) | {'PASS' if ok else 'FAIL'}")
    return ok, line


def main() -> int:
    print("v2.2 gate v3: parallel cases, flushed output", flush=True)
    t0 = time.time()
    all_ok = True
    with Pool(processes=min(8, len(CASES))) as pool:
        for ok, line in pool.imap_unordered(run_case, CASES):
            print(line, flush=True)
            all_ok &= ok
    print(f"total wall: {time.time()-t0:.0f}s", flush=True)
    print("GATE:", "PASS — v2.2 chunked blessed as versioned semantics" if all_ok
          else "FAIL — chunked stays benched", flush=True)
    return 0 if all_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
