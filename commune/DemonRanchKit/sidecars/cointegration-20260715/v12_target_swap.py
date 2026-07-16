"""v1.2 — TARGET SWAP. Pre-registered in REPORT.md ("PROTOCOLS v1.2 / v1.3 / v1.4",
locked 2026-07-15 before any run). This script IMPLEMENTS it exactly; it does not
re-register anything.

THE ECONOMICALLY HONEST QUESTION (v1 asked: does IS cointegration predict OOS
mean-reversion? Answer NO). v1.2 asks: does any IS feature predict the OOS quantity
the demon actually MONETIZES -- actual-path trade-added %/yr and harvest efficiency
eta -- rather than an ADF pass/fail?

House rules honored here:
  R4  — engine_v2.simulate_batch imported READ-ONLY; the policy/costs invocation is
        copied VERBATIM from committed adversarial scripts, cited file:line below.
  R10 — EG p / frozen_spread / half_life reused verbatim from coint_test.py (v1's
        estimators); gamma / eta / trade-added reused verbatim from harvest.py /
        the_2x2.py (the estimators that already exist for those quantities).
  R1  — medians and counts only; no means anywhere in the summary.

Standalone sidecar. Deterministic, no RNG. Writes v12_pairs.csv + v12_results.json.
Does NOT touch coint_test*.py or REPORT.md.
"""
import os
for _v in ("OMP_NUM_THREADS", "MKL_NUM_THREADS", "OPENBLAS_NUM_THREADS", "NUMEXPR_NUM_THREADS"):
    os.environ.setdefault(_v, "1")

import json
import sys
import time
from itertools import combinations
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import spearmanr

ROOT = Path(os.environ.get("DEMON_RANCH_ROOT", Path(__file__).resolve().parents[2]))
SIDE = ROOT / "sidecars" / "cointegration-20260715"
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "sidecars/demon-atlas-20260709"))
sys.path.insert(0, str(SIDE))

# R4: engine imported read-only. R10: v1 estimators imported verbatim from coint_test.
from engine_v2 import simulate_batch
from demon_ranch.backtest_duos import load_json
from coint_test import (load_yf_panel, cohort_tickers, eg_best, frozen_spread,
                        half_life, window, WIN_A, WIN_B)

# ---- VERBATIM policy/costs invocation, copied from committed adversarial scripts ----
# the_2x2.py:17  costs = load_json(ROOT/"configs/costs.default.json")
# the_2x2.py:19  POL = {"type":"threshold_pct","band":0.05}
# the_2x2.py:18 / harvest.py:30-31  RR = per-ticker (spread_bps + slippage_bps)/1e4
COSTS = load_json(ROOT / "configs/costs.default.json")
POL = {"type": "threshold_pct", "band": 0.05}

NULL_BAND = 2.0 / np.sqrt(1830.0)   # pre-registered |rho| < ~0.047

IS_FEATURES = ["is_eg_p", "is_halflife", "is_eta", "is_ta_per_yr", "is_gamma", "is_drift_gap"]
OOS_TARGETS = ["oos_ta_per_yr", "oos_eta"]


def rr_for(syms):
    # the_2x2.py:18 / harvest.py:30-31 — VERBATIM construction.
    return np.array([(float(COSTS.get("spread_bps", {}).get(t, 0.0))
                      + float(COSTS.get("slippage_bps", 0.0))) / 1e4 for t in syms])


def book_metrics(px, dates, syms):
    """Actual-path two-leg demon on ONE real path, plus harvest eta / gamma / drift.

    px: [T, 2] RAW price levels (engine consumes levels, not logs). syms=[a,b].
    Actual-path trade-added: the_2x2.py:31-34,46 (equal-weight, annualized log basis).
    eta / gamma / drift: harvest.py:25-52 (same simulate_batch terminal f[0]).
    """
    S = len(syms)                              # 2
    rr = rr_for(syms)
    # ---- ACTUAL PATH — the_2x2.py:31-33 VERBATIM invocation (single world = real path)
    f, _, _ = simulate_batch(px[None, :, :], [1.0 / S] * S, POL, dates, rr,
                             order_floor=1.0, capital=1000.0,
                             exec_mode="chunked", quantum_bps=10.0)
    hold = 1000.0 * (px[-1] / px[0]).mean()                     # the_2x2.py:33
    ta_act = (f[0] / hold - 1.0) * 100.0                        # the_2x2.py:34  (total %)
    yrs = (len(px) - 1) / 252.0                                 # the_2x2.py:29 == harvest.py:23
    ta_per_yr = float(np.log1p(ta_act / 100.0) / yrs * 100.0)   # the_2x2.py:46  (%/yr)
    # ---- HARVEST — harvest.py:25-52 VERBATIM formulas
    Ra = px[1:, 0] / px[:-1, 0] - 1.0                           # harvest.py:25 (daily simple)
    Rb = px[1:, 1] / px[:-1, 1] - 1.0
    T = yrs
    ga = float(np.log(px[-1, 0] / px[0, 0]) / T)                # harvest.py:26 (annualized log g)
    gb = float(np.log(px[-1, 1] / px[0, 1]) / T)
    gam = float(np.var(Ra - Rb, ddof=1) * 252.0)               # harvest.py:47  (gamma)
    dem = float(f[0])                                           # harvest.py:33 (demon terminal)
    g_dem = float(np.log(dem / 1000.0) / T)                     # harvest.py:48
    mean_g = (ga + gb) / 2.0                                    # harvest.py:49
    realized_prem = g_dem - mean_g                             # harvest.py:50
    theory_prem = gam / 8.0                                     # harvest.py:51
    eta = float(realized_prem / theory_prem) if theory_prem != 0.0 else float("nan")  # harvest.py:52
    drift_gap = abs(ga - gb)                                    # |g_a - g_b| annualized log
    return {"ta_per_yr": ta_per_yr, "eta": eta, "gamma": gam,
            "drift_gap": drift_gap, "ta_total": ta_act}


def run_direction(px, cohort, fit_win, test_win, tag):
    rows = []
    fit_px, test_px = window(px, fit_win), window(px, test_win)
    t0 = time.time()
    seen = 0
    for a, b in combinations(cohort, 2):
        fp_raw = fit_px[[a, b]].dropna()
        tp_raw = test_px[[a, b]].dropna()
        if len(fp_raw) < 500 or len(tp_raw) < 500:
            continue
        # IS EG p (continuous) + frozen-spread half-life — coint_test verbatim (log prices)
        fp_log = np.log(fp_raw)
        fit = eg_best(fp_log[a].values, fp_log[b].values, a, b)
        s_is = frozen_spread(fit, fp_log[a].values, fp_log[b].values, a, b)
        hl_is = half_life(s_is)
        # IS features (fit window) + OOS targets (test window) via the actual-path engine
        is_m = book_metrics(fp_raw.values, [d.strftime("%Y-%m-%d") for d in fp_raw.index], [a, b])
        oos_m = book_metrics(tp_raw.values, [d.strftime("%Y-%m-%d") for d in tp_raw.index], [a, b])
        rows.append({
            "pair": f"{a}/{b}", "direction": tag,
            # ---- 6 IS features
            "is_eg_p": fit["p"],
            "is_halflife": hl_is,
            "is_eta": is_m["eta"],
            "is_ta_per_yr": is_m["ta_per_yr"],
            "is_gamma": is_m["gamma"],
            "is_drift_gap": is_m["drift_gap"],
            # ---- 2 OOS targets
            "oos_ta_per_yr": oos_m["ta_per_yr"],
            "oos_eta": oos_m["eta"],
        })
        seen += 1
        if seen % 200 == 0:
            print(f"  [{tag}] {seen} pairs  ({time.time()-t0:.0f}s)", flush=True)
    print(f"  [{tag}] DONE {seen} pairs in {time.time()-t0:.0f}s", flush=True)
    return pd.DataFrame(rows)


def sp(x, y):
    """Spearman rho masking non-finite (half-life inf, eta blow-ups) in EITHER array."""
    x = np.asarray(x, float)
    y = np.asarray(y, float)
    m = np.isfinite(x) & np.isfinite(y)
    if int(m.sum()) < 10:
        return {"rho": None, "p": None, "n": int(m.sum())}
    rho, p = spearmanr(x[m], y[m])
    return {"rho": round(float(rho), 4), "p": round(float(p), 6), "n": int(m.sum())}


def validate_fortress(px):
    """VALIDATION (protocol step 4): reproduce the_2x2.py's fortress actual-path
    2020-2026 number (~+2.27%/yr, REPORT F2) with the SAME invocation, before
    trusting any pair number. the_2x2.py:16,25-34,46 — OURS window 2020-01-01..2026-06-29,
    dropna over F+VTI, equal weight, 5% band."""
    F = ["DBB", "EWU", "EWZ", "GDX", "TUR"]
    BENCH = "VTI"
    sub = px.loc[(px.index >= "2020-01-01") & (px.index <= "2026-06-29"), F + [BENCH]].dropna()
    pxv = sub[F].values
    dates = [d.strftime("%Y-%m-%d") for d in sub.index]
    S = len(F)
    yrs = (len(pxv) - 1) / 252.0
    rr = rr_for(F)
    f, _, _ = simulate_batch(pxv[None, :, :], [1.0 / S] * S, POL, dates, rr,
                             order_floor=1.0, capital=1000.0,
                             exec_mode="chunked", quantum_bps=10.0)
    hold = 1000.0 * (pxv[-1] / pxv[0]).mean()
    ta_act = (f[0] / hold - 1.0) * 100.0
    ta_per_yr = float(np.log1p(ta_act / 100.0) / yrs * 100.0)
    return {"n_days": int(len(pxv)), "yrs": round(yrs, 2),
            "demon_terminal": round(float(f[0]), 2), "hold_terminal": round(float(hold), 2),
            "ta_total_pct": round(float(ta_act), 3), "ta_per_yr_pct": round(ta_per_yr, 3),
            "expected_per_yr": "+2.27 to +2.34 (REPORT F2 / adversarial README)"}


def main():
    px = load_yf_panel()
    cohort = cohort_tickers(px)
    print(f"cohort: {len(cohort)} tickers", flush=True)

    val = validate_fortress(px)
    print("FORTRESS VALIDATION (2020-2026 actual path):", json.dumps(val), flush=True)

    ab = run_direction(px, cohort, WIN_A, WIN_B, "fitA_testB")
    ba = run_direction(px, cohort, WIN_B, WIN_A, "fitB_testA")
    pairs = pd.concat([ab, ba], ignore_index=True)
    pairs.to_csv(SIDE / "v12_pairs.csv", index=False)

    # ---- PRIMARY: Spearman(IS EG p, OOS trade-added/yr), all pairs, fitA->testB
    primary = sp(ab["is_eg_p"], ab["oos_ta_per_yr"])
    rho = primary["rho"]
    if rho is None:
        verdict = "UNDEFINED"
    elif abs(rho) < NULL_BAND:
        verdict = f"INSIDE NULL BAND (|rho|<{NULL_BAND:.4f}) -> NO predictive value"
    elif rho < -NULL_BAND:
        verdict = "rho < -null: ADVOCATE PREDICTION CONFIRMED (lower EG p -> more OOS harvest)"
    else:
        verdict = "rho > +null: OPPOSITE of advocate (higher EG p -> more OOS harvest)"

    # ---- SECONDARY: full matrix, 6 IS x 2 OOS x 2 directions. No selection.
    matrix = {}
    for tag, df in (("fitA_testB", ab), ("fitB_testA", ba)):
        matrix[tag] = {}
        for feat in IS_FEATURES:
            matrix[tag][feat] = {tgt: sp(df[feat], df[tgt]) for tgt in OOS_TARGETS}

    # medians only (R1) for orientation
    def meds(df):
        out = {}
        for c in IS_FEATURES + OOS_TARGETS:
            s = pd.to_numeric(df[c], errors="coerce").replace([np.inf, -np.inf], np.nan)
            out[c] = round(float(s.median()), 4) if s.notna().any() else None
        return out

    results = {
        "protocol": "v1.2 TARGET SWAP — see REPORT.md, locked 2026-07-15 pre-run",
        "cohort_n": len(cohort), "cohort": cohort,
        "n_pairs_fitA_testB": int(len(ab)), "n_pairs_fitB_testA": int(len(ba)),
        "null_band": round(float(NULL_BAND), 4),
        "fortress_validation": val,
        "PRIMARY": {
            "definition": "Spearman rho(IS EG p, OOS trade-added %/yr), all pairs, fitA->testB",
            "advocate_prediction_of_record": "rho < -0.047",
            **primary, "verdict": verdict,
        },
        "SECONDARY_matrix": matrix,
        "medians_fitA_testB": meds(ab),
        "medians_fitB_testA": meds(ba),
    }
    (SIDE / "v12_results.json").write_text(json.dumps(results, indent=2))

    # ---- console summary
    print("\n" + "=" * 78)
    print("PRIMARY  rho(IS EG p , OOS trade-added/yr)  fitA->testB, all pairs")
    print(f"  rho = {primary['rho']}   p = {primary['p']}   n = {primary['n']}   "
          f"null |rho|<{NULL_BAND:.4f}")
    print(f"  VERDICT: {verdict}")
    print("=" * 78)
    print("SECONDARY MATRIX  rho (n)   rows=IS feature, cols=OOS target")
    for tag in ("fitA_testB", "fitB_testA"):
        print(f"\n[{tag}]")
        print(f"  {'IS feature':<14} {'oos_ta_per_yr':>22} {'oos_eta':>22}")
        for feat in IS_FEATURES:
            cells = []
            for tgt in OOS_TARGETS:
                c = matrix[tag][feat][tgt]
                cells.append(f"{c['rho']} (n={c['n']})")
            print(f"  {feat:<14} {cells[0]:>22} {cells[1]:>22}")
    print("\nwrote v12_pairs.csv + v12_results.json")


if __name__ == "__main__":
    main()
