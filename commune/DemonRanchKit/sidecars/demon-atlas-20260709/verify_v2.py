"""Tolerance-parity gate: Engine v2 vs the canonical stdlib engine.

Identical pre-generated paths (python generators from atlas.py) are run through
BOTH engines; we compare finals, max drawdown, and rebalance counts. v2 deploys
only if the divergence is within research tolerance (buy-waterfall vs $1-loop).

Run:  python sidecars/demon-atlas-20260709/verify_v2.py
"""

import random
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(HERE))

import atlas  # python generators + aligned data loading
from engine_v2 import simulate_batch
from demon_ranch.backtest_duos import load_json, load_prices, simulate

CASES = [
    (("GLDM", "GME"), {"type": "threshold_pct", "band": 0.04}, "U1"),
    (("EWZ", "GDX"), {"type": "calendar", "freq": "weekly"}, "U7"),
    (("PDBC", "TQQQ"), {"type": "threshold_pct", "band": 0.05}, "U3"),
    # committee orders (v2.1 exact-port gate, 2026-07-11)
    (("GME", "MSTR", "TSLA"), {"type": "threshold_pct", "band": 0.04}, "U1"),
    (("EWY", "GME", "SLV"), {"type": "calendar", "freq": "weekly"}, "U5"),
    (("DBB", "EWU", "EWZ", "GDX", "TUR"), {"type": "threshold_pct", "band": 0.05}, "U1"),
    (("ARGT", "COPX", "F", "GME", "URA"), {"type": "threshold_pct", "band": 0.04}, "U7"),
    (("TQQQ", "TLT", "GLDM", "GME", "SGOV", "VEU", "F"),
     {"type": "threshold_pct", "band": 0.05}, "U1"),
    (("GDX", "EWZ", "SLV", "XLU", "XLP", "PDBC", "GLDM"),
     {"type": "calendar", "freq": "weekly"}, "U11"),
]
WORLDS = 24

prices = load_prices(atlas.PANEL)
costs = load_json(ROOT / "configs/costs.default.json")

print("tolerance-parity: stdlib vs engine_v2 on IDENTICAL paths")
all_ok = True
for syms, policy, universe in CASES:
    align = tuple(dict.fromkeys(syms + ("VTI",)))
    dates, series_all = atlas.aligned_n(prices, align, atlas.DATE_START, atlas.DATE_END)
    ctx = atlas.build_ctx(syms, {t: series_all[t] for t in syms}, series_all["VTI"], dates)
    rng = random.Random(f"verify|{'/'.join(syms)}|{universe}")

    paths = [atlas.make_world(universe, ctx, rng) for _ in range(WORLDS)]
    weights = [1.0 / len(syms)] * len(syms)
    rates = np.array([(float(costs.get("spread_bps", {}).get(t, 0.0))
                       + float(costs.get("slippage_bps", 0.0))) / 1e4 for t in syms])

    f1, d1, c1 = [], [], []
    for p in paths:
        m = simulate(syms, weights, policy, dates, p, costs, 1000.0)["metrics"]
        f1.append(m["final_equity"]); d1.append(m["max_drawdown"]); c1.append(m["rebalance_count"])
    f1 = np.array(f1); d1 = np.array(d1); c1 = np.array(c1)

    P = np.stack([np.stack([np.asarray(p[t]) for t in syms], axis=1) for p in paths])
    f2, d2, c2 = simulate_batch(P, weights, policy, dates, rates)

    rel = np.abs(f2 - f1) / np.maximum(np.abs(f1), 1.0)
    dd = np.abs(d2 - d1)
    dc = np.abs(c2 - c1)
    ok = rel.max() < 0.002 and dd.max() < 0.005 and dc.max() <= 1
    all_ok &= ok
    print(f"  {'/'.join(syms)[:28]:28s} {policy['type']:13s} {universe:3s} | "
          f"final rel-diff max {rel.max():.2e} mean {rel.mean():.2e} | "
          f"dd diff max {dd.max():.2e} | rebal diff max {int(dc.max())} | "
          f"{'PASS' if ok else 'FAIL'}")

print("GATE:", "PASS — v2 cleared for Atlas duty" if all_ok else "FAIL — v2 stays benched")
sys.exit(0 if all_ok else 1)
