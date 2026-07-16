"""Kayfabe Detection — docket item 82. PRE-REGISTERED, protocol FROZEN in REPORT.md
(locked 2026-07-15 before any run). This script IMPLEMENTS that protocol exactly; it
does not re-register anything and it changes no thresholds/arms/windows.

House rules honored:
  R4  — engine_v2.simulate_batch imported READ-ONLY (via v12_target_swap.book_metrics,
        the VALIDATED actual-path invocation that reproduced the fortress at +2.171%/yr).
        No existing script edited.
  R10 — forward-target estimator (book_metrics) and Spearman helper (sp) reused VERBATIM
        from sidecars/cointegration-20260715/v12_target_swap.py. gamma/drift conventions
        reused verbatim from harvest.py:26/47 (annualized variance of daily arithmetic
        return spread; |annualized log-growth difference|). Annualization per the_2x2.py:46.
  R1  — medians and counts only; no means in the statistic of record.

Standalone sidecar. Deterministic, no RNG. Writes kayfabe_pairs.csv, kayfabe_results.json,
kayfabe_run.log. Does NOT touch REPORT.md or any engine/atlas/backtest script.
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
from scipy.stats import binom

ROOT = Path(os.environ.get("DEMON_RANCH_ROOT", Path(__file__).resolve().parents[2]))
COINT = ROOT / "sidecars" / "cointegration-20260715"
SIDE = ROOT / "sidecars" / "kayfabe-20260715"
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "sidecars/demon-atlas-20260709"))
sys.path.insert(0, str(COINT))

# R10 / R4: reuse the VALIDATED estimators verbatim.
#   book_metrics -> actual-path trade-added %/yr via engine_v2.simulate_batch (read-only)
#   sp           -> Spearman rho masking non-finite in either array (n>=10)
#   validate_fortress -> provenance check that reproduced +2.171%/yr fortress
from coint_test import load_yf_panel, cohort_tickers
from v12_target_swap import book_metrics, sp, validate_fortress

# ---------------- protocol constants (FROZEN — REPORT.md §1,§7) ----------------
TARGET_YEARS = list(range(2012, 2026))   # y in {2012..2025}, 14 samples
TA_YEARS = list(range(2011, 2026))       # trade-added needed for target y and naive y-1
WIN_GAMMA = 126                          # trailing days for gamma  (REPORT §1)
WIN_GAP = 756                            # trailing days for drift gap (REPORT §1)
WIN_TITLE = 252                          # trailing days for title-change count (item 81)
MIN_FWD_DAYS = 240                       # forward-year eligibility (REPORT §7)

LOG_PATH = SIDE / "kayfabe_run.log"
_logf = open(LOG_PATH, "w", encoding="utf-8")


def log(msg):
    print(msg, flush=True)
    _logf.write(msg + "\n")
    _logf.flush()


# ---------------- predictor estimators (harvest.py conventions, verbatim) ------
def gamma_ann(pa, pb):
    """harvest.py:25-47 convention: annualized variance of the daily ARITHMETIC
    return spread. pa,pb = raw price levels of the two legs over the window."""
    Ra = pa[1:] / pa[:-1] - 1.0
    Rb = pb[1:] / pb[:-1] - 1.0
    return float(np.var(Ra - Rb, ddof=1) * 252.0)


def drift_gap(pa, pb):
    """|annualized log-growth difference| (harvest.py:26 g convention;
    v12_target_swap.py:87-96 drift_gap). T = (n-1)/252 for the window."""
    T = (len(pa) - 1) / 252.0
    ga = np.log(pa[-1] / pa[0]) / T
    gb = np.log(pb[-1] / pb[0]) / T
    return float(abs(ga - gb))


def title_changes(pa, pb):
    """Item 81 Title-Change count: number of lead swaps in cumulative LOG return
    between the legs = sign changes of (cumlog_a - cumlog_b) over the window.
    Zeros ignored (same convention as coint_test.crossings_per_yr)."""
    diff = np.log(pa / pa[0]) - np.log(pb / pb[0])
    d = np.sign(diff)
    d = d[d != 0]
    if len(d) < 2:
        return 0
    return int(np.sum(d[1:] != d[:-1]))


def sign_test_p(k, n):
    """One-sided binomial sign test: P(X >= k | n, p=0.5)."""
    return float(binom.sf(k - 1, n, 0.5))


def summarize_arm(yearly_rho):
    """PRIMARY-2 statistic of record: median of the yearly rhos + positive-year count
    + one-sided sign-test p (advocate: median>0, >=10/14 positive, p<0.09)."""
    vals = [r for r in yearly_rho.values() if r is not None]
    n_years = len(vals)
    n_pos = int(sum(1 for r in vals if r > 0))
    med = round(float(np.median(vals)), 4) if vals else None
    return {
        "yearly_rho": {str(y): yearly_rho[y] for y in sorted(yearly_rho)},
        "n_years": n_years,
        "median_rho": med,
        "n_pos_years": n_pos,
        "sign_test_p": round(sign_test_p(n_pos, n_years), 4) if n_years else None,
    }


def main():
    t_start = time.time()
    px = load_yf_panel()
    cohort = cohort_tickers(px)
    pairs = list(combinations(cohort, 2))
    log(f"cohort: {len(cohort)} tickers | pairs: {len(pairs)} | "
        f"panel {px.index[0].date()}..{px.index[-1].date()}")

    fval = validate_fortress(px)
    log("FORTRESS VALIDATION (2020-2026 actual path, v12 verbatim): "
        + json.dumps(fval))

    # ---- accumulators -------------------------------------------------------
    # PRIMARY 2: per target-year cross-sections (aligned by pair within a year)
    per_year = {y: {"K": [], "gamma": [], "gap": [], "title": [],
                    "naive": [], "target": []} for y in TARGET_YEARS}
    # PRIMARY 1: K sign by (pair_idx, year) — needs only trailing eligibility
    K_state = {}                       # (pi, y) -> K value
    csv_rows = []
    pairyear_count = 0

    for pi, (a, b) in enumerate(pairs):
        aligned = px[[a, b]].dropna()
        idx_years = aligned.index.year.values
        pa_all = aligned[a].values
        pb_all = aligned[b].values

        # trade-added per calendar year (ONE engine run each; reused as target y & naive y+1)
        ta = {}
        for Y in TA_YEARS:
            mask = idx_years == Y
            n = int(mask.sum())
            if n < MIN_FWD_DAYS:
                ta[Y] = None
                continue
            w = aligned[mask]
            dts = [d.strftime("%Y-%m-%d") for d in w.index]
            ta[Y] = float(book_metrics(w.values, dts, [a, b])["ta_per_yr"])

        for y in TARGET_YEARS:
            pairyear_count += 1
            where = np.nonzero(idx_years == y)[0]
            if len(where) == 0:
                continue
            fp = int(where[0])                 # first trading day of year y (aligned)
            if fp + 1 < WIN_GAP:               # not enough trailing history -> K undefined
                continue
            # trailing windows END inclusive at first trading day of year y
            ga = pa_all[fp - WIN_GAMMA + 1: fp + 1]
            gb = pb_all[fp - WIN_GAMMA + 1: fp + 1]
            da = pa_all[fp - WIN_GAP + 1: fp + 1]
            db = pb_all[fp - WIN_GAP + 1: fp + 1]
            tia = pa_all[fp - WIN_TITLE + 1: fp + 1]
            tib = pb_all[fp - WIN_TITLE + 1: fp + 1]

            g126 = gamma_ann(ga, gb)
            gap756 = drift_gap(da, db)
            title252 = title_changes(tia, tib)
            K = g126 - 4.0 * gap756
            naive = ta.get(y - 1)
            target = ta.get(y)

            K_state[(pi, y)] = K               # PRIMARY 1 (trailing-eligible only)

            elig_fwd = target is not None
            if elig_fwd:                        # PRIMARY 2 needs forward target
                pd_ = per_year[y]
                pd_["K"].append(K)
                pd_["gamma"].append(g126)
                pd_["gap"].append(gap756)
                pd_["title"].append(float(title252))
                pd_["naive"].append(np.nan if naive is None else naive)
                pd_["target"].append(target)

            csv_rows.append({
                "pair": f"{a}/{b}", "year": y,
                "gamma_126d": round(g126, 8),
                "gap_756d": round(gap756, 8),
                "K": round(K, 8),
                "title_change_252d": title252,
                "naive_prev_ta_per_yr": None if naive is None else round(naive, 6),
                "target_ta_per_yr": None if target is None else round(target, 6),
                "eligible_fwd": elig_fwd,
            })

            if pairyear_count % 200 == 0:
                log(f"  ...{pairyear_count} pair-years  (pair {pi+1}/{len(pairs)}, "
                    f"y={y})  {time.time()-t_start:.0f}s")

    log(f"pair-year loop DONE: {pairyear_count} pair-years in {time.time()-t_start:.0f}s")

    # ---- PRIMARY 1: state persistence --------------------------------------
    all_K = list(K_state.values())
    n_K = len(all_K)
    n_K_pos = int(sum(1 for v in all_K if v > 0))
    p_uncond = n_K_pos / n_K if n_K else None

    n_from_pos = n_next_pos_given_pos = 0
    n_from_nonpos = n_next_pos_given_nonpos = 0
    n_trans = n_next_pos_total = 0
    for (pi, y) in K_state:
        if y + 1 > TARGET_YEARS[-1]:
            continue
        nxt = K_state.get((pi, y + 1))
        if nxt is None:
            continue
        n_trans += 1
        cur_pos = K_state[(pi, y)] > 0
        nxt_pos = nxt > 0
        if nxt_pos:
            n_next_pos_total += 1
        if cur_pos:
            n_from_pos += 1
            if nxt_pos:
                n_next_pos_given_pos += 1
        else:
            n_from_nonpos += 1
            if nxt_pos:
                n_next_pos_given_nonpos += 1

    primary1 = {
        "definition": "Pooled P(K>0 at y+1 | K>0 at y) vs unconditional P(K>0)",
        "n_K_obs": n_K,
        "P_K_gt0_unconditional": round(p_uncond, 4) if p_uncond is not None else None,
        "n_transitions": n_trans,
        "n_transitions_from_Kgt0": n_from_pos,
        "P_next_Kgt0_given_Kgt0": round(n_next_pos_given_pos / n_from_pos, 4) if n_from_pos else None,
        "P_next_Kgt0_given_Kle0": round(n_next_pos_given_nonpos / n_from_nonpos, 4) if n_from_nonpos else None,
        "base_rate_next_Kgt0_over_transitions": round(n_next_pos_total / n_trans, 4) if n_trans else None,
        "lift_vs_unconditional": (round(n_next_pos_given_pos / n_from_pos - p_uncond, 4)
                                  if (n_from_pos and p_uncond is not None) else None),
    }

    # ---- PRIMARY 2: per-year cross-sectional Spearman, then median + sign test
    arms = ["K", "gamma", "gap", "title", "naive"]
    yearly = {arm: {} for arm in arms}
    elig_n = {}
    for y in TARGET_YEARS:
        d = per_year[y]
        elig_n[str(y)] = len(d["target"])
        for arm in arms:
            res = sp(d[arm], d["target"])   # rho masking non-finite (naive nan -> masked)
            yearly[arm][y] = res["rho"]
    primary2 = {arm: summarize_arm(yearly[arm]) for arm in arms}

    # ---- THE BAR: K must BEAT naive (REPORT §5) ----------------------------
    k_med = primary2["K"]["median_rho"]
    naive_med = primary2["naive"]["median_rho"]
    k_pos = primary2["K"]["n_pos_years"]
    naive_pos = primary2["naive"]["n_pos_years"]
    beats = (k_med is not None and naive_med is not None and k_med > naive_med)
    advocate_hit = (k_med is not None and k_med > 0 and k_pos >= 10
                    and primary2["K"]["sign_test_p"] is not None
                    and primary2["K"]["sign_test_p"] < 0.09)
    if beats and advocate_hit:
        verdict = "KAYFABE BEATS NAIVE and clears advocate bar (median>0, >=10/14, p<0.09)"
    elif beats:
        verdict = "KAYFABE beats naive median but MISSES advocate significance bar"
    else:
        verdict = "KAYFABE LOSES: does not beat naive persistence (adds nothing)"

    the_bar = {
        "K_median_rho": k_med, "K_n_pos_years": k_pos, "K_sign_test_p": primary2["K"]["sign_test_p"],
        "naive_median_rho": naive_med, "naive_n_pos_years": naive_pos,
        "K_beats_naive": bool(beats), "advocate_bar_hit": bool(advocate_hit),
        "verdict": verdict,
    }

    results = {
        "protocol": "Kayfabe Detection (docket 82) — REPORT.md, locked 2026-07-15 pre-run",
        "cohort_n": len(cohort), "n_pairs": len(pairs),
        "target_years": TARGET_YEARS,
        "windows": {"gamma_d": WIN_GAMMA, "gap_d": WIN_GAP, "title_d": WIN_TITLE,
                    "min_fwd_days": MIN_FWD_DAYS},
        "K_definition": "K_t = gamma_126d - 4*gap_756d  (8ln2/T dropped, conservative)",
        "fortress_validation": fval,
        "eligible_n_per_year": elig_n,
        "PRIMARY_1_state_persistence": primary1,
        "PRIMARY_2": primary2,
        "THE_BAR": the_bar,
        "deviations": [
            "Trailing windows end INCLUSIVE at the first trading day of year y "
            "(literal reading of REPORT.md 'at the first trading day ... trailing N days'); "
            "the one shared boundary day is negligible for a 126/756-day variance/drift.",
            "Trailing 'N trading days' taken as N price rows -> N-1 daily returns for gamma.",
            "PRIMARY 1 uses trailing-eligible K (>=756d history) regardless of forward "
            "target eligibility, since sign-persistence needs no target.",
        ],
    }

    (SIDE / "kayfabe_results.json").write_text(json.dumps(results, indent=2))
    pd.DataFrame(csv_rows).to_csv(SIDE / "kayfabe_pairs.csv", index=False)

    # ---- console table ------------------------------------------------------
    log("\n" + "=" * 84)
    log("PRIMARY 1 — STATE PERSISTENCE (pooled)")
    log(f"  unconditional P(K>0)            = {primary1['P_K_gt0_unconditional']}  (n={n_K})")
    log(f"  P(K>0 @ y+1 | K>0 @ y)          = {primary1['P_next_Kgt0_given_Kgt0']}  "
        f"(n_from={n_from_pos})")
    log(f"  P(K>0 @ y+1 | K<=0 @ y)         = {primary1['P_next_Kgt0_given_Kle0']}  "
        f"(n_from={n_from_nonpos})")
    log(f"  lift vs unconditional           = {primary1['lift_vs_unconditional']}")
    log("=" * 84)
    log("PRIMARY 2 — median of 14 yearly cross-sectional Spearman rho  (+ positive-year count)")
    log(f"  {'arm':<8} {'median_rho':>11} {'pos_years':>10} {'sign_p':>8}")
    for arm in ["K", "gamma", "gap", "title", "naive"]:
        s = primary2[arm]
        log(f"  {arm:<8} {str(s['median_rho']):>11} {s['n_pos_years']:>7}/{s['n_years']:<2} "
            f"{str(s['sign_test_p']):>8}")
    log("=" * 84)
    log(f"THE BAR (K must beat naive): {verdict}")
    log(f"  K median {k_med} ({k_pos}/14 pos)  vs  naive median {naive_med} ({naive_pos}/14 pos)")
    log(f"eligible-n per year: min={min(elig_n.values())} max={max(elig_n.values())}")
    log("=" * 84)
    log(f"wrote kayfabe_pairs.csv ({len(csv_rows)} rows), kayfabe_results.json  "
        f"[{time.time()-t_start:.0f}s total]")
    _logf.close()


if __name__ == "__main__":
    main()
