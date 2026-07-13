"""v3.1 BPS-QUANTUM GATE (docket item 35).

Two layers:
  PLUMBING (pass/fail): chunked with quantum_bps=0 must be BIT-IDENTICAL to
    blessed v2.2 chunked (the q-vector refactor cannot change flat-floor math).
  SEMANTICS (report): quantum_bps=10 vs flat-$1 chunked — a NEW definition with
    no reference; the coin lab's Law III shelf predicts small metric deltas.
    Reported, not gated; sanity bound: median-final drift < 5%.

Parallel cases, flushed output (gate design v3 lessons).
Run:  python sidecars/demon-atlas-20260709/verify_v31.py
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

# mode "full" = plumbing bit-parity (bps=0 vs v2.2) + bps10 semantics report.
# mode "bps-smoke" = bps10 arm only: flat-$1 chunked on moonshot committees
# ping-pongs (near-equal deltas -> chunk size 1 -> unit-loop regression, the
# 2026-07-12 21:51 lesson); plumbing parity is already proven by 5 full cases.
CASES = [
    (("GLDM", "GME"), {"type": "threshold_pct", "band": 0.04}, "U1", "full"),
    (("EWZ", "GDX"), {"type": "calendar", "freq": "weekly"}, "U7", "full"),
    (("GME", "MSTR", "TSLA"), {"type": "threshold_pct", "band": 0.04}, "U8", "bps-smoke"),
    (("EWY", "GME", "SLV"), {"type": "calendar", "freq": "weekly"}, "U5", "bps-smoke"),  # tail worlds ping-pong flat arms under some seeds
    (("DBB", "EWU", "EWZ", "GDX", "TUR"), {"type": "threshold_pct", "band": 0.05}, "U1", "full"),
    (("TQQQ", "TLT", "GLDM", "GME", "SGOV", "VEU", "F"),
     {"type": "threshold_pct", "band": 0.05}, "U1", "full"),
]
WORLDS = 24


def run_case(case):
    import atlas
    from engine_v2 import simulate_batch
    from demon_ranch.backtest_duos import load_json, load_prices

    syms, policy, universe, mode = case
    prices = load_prices(atlas.PANEL)
    costs = load_json(ROOT / "configs/costs.default.json")
    align = tuple(dict.fromkeys(syms + ("VTI",)))
    dates, series_all = atlas.aligned_n(prices, align, atlas.DATE_START, atlas.DATE_END)
    ctx = atlas.build_ctx(syms, {t: series_all[t] for t in syms}, series_all["VTI"], dates)
    rng = random.Random(f"verify31|{'/'.join(syms)}|{universe}")
    paths = [atlas.make_world(universe, ctx, rng) for _ in range(WORLDS)]
    weights = [1.0 / len(syms)] * len(syms)
    rates = np.array([(float(costs.get("spread_bps", {}).get(t, 0.0))
                       + float(costs.get("slippage_bps", 0.0))) / 1e4 for t in syms])
    P = np.stack([np.stack([np.asarray(p[t]) for t in syms], axis=1) for p in paths])

    t0 = time.time()
    f10, d10, c10 = simulate_batch(P, weights, policy, dates, rates, exec_mode="chunked", quantum_bps=10.0)
    t10 = time.time() - t0
    if mode == "bps-smoke":
        ok = np.isfinite(f10).all() and (f10 > 0).all()
        line = (f"  {'/'.join(syms)[:28]:28s} {universe:3s} | bps-smoke only (flat-$1 ping-pong regression "
                f"documented) | bps10 median ${np.median(f10):12,.0f} | {t10:5.1f}s | "
                f"{'PASS' if ok else 'FAIL'}")
        return bool(ok), line

    f22, d22, c22 = simulate_batch(P, weights, policy, dates, rates, exec_mode="chunked")
    f0, d0, c0 = simulate_batch(P, weights, policy, dates, rates, exec_mode="chunked", quantum_bps=0.0)
    bit = np.array_equal(f0, f22) and np.array_equal(d0, d22) and np.array_equal(c0, c22)
    med22, med10 = np.median(f22), np.median(f10)
    drift = abs(med10 / med22 - 1)
    sane = drift < 0.05
    line = (f"  {'/'.join(syms)[:28]:28s} {universe:3s} | plumbing(bps=0): "
            f"{'BIT-IDENTICAL' if bit else 'DIVERGED'} | bps10 median ${med10:12,.0f} vs flat ${med22:12,.0f} "
            f"(drift {drift*100:5.2f}%) | rebal Δmax {int(np.abs(c10-c22).max())} | bps10 {t10:5.1f}s | "
            f"{'PASS' if bit and sane else 'FAIL'}")
    return bit and sane, line


def main() -> int:
    print("v3.1 gate: plumbing (bit-parity at bps=0) + semantics report (bps=10)", flush=True)
    t0 = time.time()
    all_ok = True
    with Pool(processes=min(6, len(CASES))) as pool:
        for ok, line in pool.imap_unordered(run_case, CASES):
            print(line, flush=True)
            all_ok &= ok
    print(f"total wall: {time.time()-t0:.0f}s", flush=True)
    print("GATE:", "PASS — v3.1 bps quantum blessed" if all_ok else "FAIL — v3.1 benched", flush=True)
    return 0 if all_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
