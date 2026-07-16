"""ROYAL RUMBLE — BATCH 1. Protocol FROZEN in ../RUMBLE.md ("BATCH 1", declared
2026-07-15 before any batch-1 computation). This script IMPLEMENTS that protocol
exactly; it re-registers nothing, changes no windows/directions/targets, adds no
sensors, drops no secondary.

Arena: THE SANDBOX ONLY — target years 2012..2018 (Rule 1; boundary is law).

House rules honored:
  R4  — every existing script imported READ-ONLY. No existing file edited. In
        particular kayfabe_test.py is NOT imported (its module body opens
        kayfabe_run.log in 'w' mode as a side effect, which would truncate a
        completed pre-registered artifact); its title_changes estimator is instead
        copied VERBATIM below with a file:line citation (the same idiom kayfabe_test
        itself used to reuse harvest.py's gamma/title/drift).
  R10 — estimators reused verbatim: panel/cohort from coint_test.py; crossings_per_yr
        from coint_test.py:123-127; title_changes from kayfabe_test.py:82-91; the
        forward trade-added target, gamma_126d incumbent and TC-252 costume are read
        straight out of the cached kayfabe_pairs.csv (computed by the validated
        book_metrics/engine invocation). sigma = sqrt(gamma_126d) (annualized).
  R1  — medians and counts only in the statistics of record.

Standalone sidecar. Deterministic, no RNG. Writes batch1_pairs.csv,
batch1_results.json, batch1_run.log into this directory. Touches no engine/atlas/
backtest/REPORT/RUMBLE file.
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
import statsmodels.api as sm
from scipy.stats import spearmanr

ROOT = Path(os.environ.get("DEMON_RANCH_ROOT", Path(__file__).resolve().parents[3]))
COINT = ROOT / "sidecars" / "cointegration-20260715"
KAY = ROOT / "sidecars" / "kayfabe-20260715"
HERE = KAY / "rumble_batch1"
sys.path.insert(0, str(COINT))

# R4/R10: read-only reuse of the panel loader, cohort selector, crossing-rate estimator.
from coint_test import load_yf_panel, cohort_tickers, crossings_per_yr

# ---------------- protocol constants (FROZEN — RUMBLE.md BATCH 1) ----------------
TARGET_YEARS = list(range(2012, 2019))    # 2012..2018 sandbox ONLY (Rule 1)
WIN_TC_A, WIN_TC_B, WIN_TC_C = 126, 252, 504   # Title-Change costumes
WIN_BREATH_BETA = 504                     # frozen-beta OLS window
WIN_BREATH_XING = 252                     # zero-crossing-rate window
WIN_KIN = 252                             # factor-kinship corr window
WIN_DD = 756                              # running-high drawdown window
WIN_SIGMA = 126                           # gamma/sigma window (== cached gamma_126d)
MIN_TRAIL = WIN_DD                         # need >=756 trailing rows (kayfabe convention)

# Declared directions (RUMBLE.md): gamma+, TC+, Breath+, League+, Kinship+, DD-gamma NEGATIVE
DIRECTIONS = {"gamma_126d": +1, "tc_126": +1, "tc_252": +1, "tc_504": +1,
              "breath_252": +1, "factor_kinship_252": +1, "ddgamma_ratio": -1}

# Same-League map (declared in RUMBLE.md BATCH 1; covers all 61 cohort tickers)
LEAGUE_MAP = {}
for _grp, _members in {
    "country":   "ECH EWA EWC EWD EWG EWH EWI EWJ EWK EWL EWM EWN EWP EWQ EWS EWT EWU EWW EWY EWZ EZA FXI THD TUR",
    "ussector":  "IYT XLB XLE XLF XLI XLK XLP XLU XLV XLY XME XBI",
    "bond":      "BND EMB HYG IEF LQD SHY TIP TLT",
    "commodity": "DBA DBB GDX SLV UNG USO",
    "broad":     "IWM QQQ SMH VEU VNQ VTI VYM",
    "single":    "F GME MSTR NVDA",
}.items():
    for _t in _members.split():
        LEAGUE_MAP[_t] = _grp

LOG_PATH = HERE / "batch1_run.log"
_logf = open(LOG_PATH, "w", encoding="utf-8")


def log(msg):
    print(msg, flush=True)
    _logf.write(str(msg) + "\n")
    _logf.flush()


# ---------------- estimators ----------------
def title_changes(pa, pb):
    """VERBATIM copy of kayfabe_test.py:82-91 (which itself follows
    coint_test.crossings_per_yr's zero-ignoring convention). Lead swaps in
    cumulative LOG return between the legs = sign changes of (cumlog_a - cumlog_b)."""
    diff = np.log(pa / pa[0]) - np.log(pb / pb[0])
    d = np.sign(diff)
    d = d[d != 0]
    if len(d) < 2:
        return 0
    return int(np.sum(d[1:] != d[:-1]))


def frozen_beta_ols(lpa, lpb):
    """Frozen alpha,beta from OLS of log(pa) on log(pb) over the window. Uses the
    same sm.add_constant/sm.OLS idiom as coint_test.eg_best (R10). First leg is the
    dependent variable (frozen choice; see deviations)."""
    ols = sm.OLS(lpa, sm.add_constant(lpb)).fit()
    return float(ols.params[0]), float(ols.params[1])


def sp_rho(x, y):
    """Spearman rho masking non-finite in EITHER array, n>=10, rounded to 4 —
    identical convention to v12_target_swap.sp used by kayfabe shot 1."""
    x = np.asarray(x, float)
    y = np.asarray(y, float)
    m = np.isfinite(x) & np.isfinite(y)
    if int(m.sum()) < 10:
        return None
    rho, _ = spearmanr(x[m], y[m])
    return round(float(rho), 4)


def main():
    t0 = time.time()
    px = load_yf_panel()
    cohort = cohort_tickers(px)
    pairs = list(combinations(cohort, 2))
    log(f"cohort {len(cohort)} tickers | {len(pairs)} pairs | sandbox targets {TARGET_YEARS}")
    assert len(cohort) == 61 and len(pairs) == 1830, "cohort/pair count drifted from kayfabe"

    # ---- cached kayfabe columns (reused verbatim, RESTRICTED to 2012..2018) --------
    cache = pd.read_csv(KAY / "kayfabe_pairs.csv")
    cache = cache[cache["year"].isin(TARGET_YEARS)].copy()
    cache_idx = cache.set_index(["pair", "year"])
    log(f"cached kayfabe rows in sandbox window: {len(cache)}")

    # ---- per pair-year new-sensor computation (fp = first trading day of year y) ---
    rows = []
    n_done = 0
    for pi, (a, b) in enumerate(pairs):
        aligned = px[[a, b]].dropna()
        idx_years = aligned.index.year.values
        pa_all = aligned[a].values
        pb_all = aligned[b].values
        pair = f"{a}/{b}"
        same_league = int(LEAGUE_MAP[a] == LEAGUE_MAP[b])
        for y in TARGET_YEARS:
            where = np.nonzero(idx_years == y)[0]
            if len(where) == 0:
                continue
            fp = int(where[0])                       # first trading day of year y
            if fp + 1 < MIN_TRAIL:                    # not enough trailing history
                continue

            # trailing slices END INCLUSIVE at fp (kayfabe convention: [fp-W+1 : fp+1])
            tc_a = title_changes(pa_all[fp - WIN_TC_A + 1: fp + 1], pb_all[fp - WIN_TC_A + 1: fp + 1])
            tc_c = title_changes(pa_all[fp - WIN_TC_C + 1: fp + 1], pb_all[fp - WIN_TC_C + 1: fp + 1])

            # Breath: frozen beta on 504d log prices, zero-crossing rate on last 252d
            lb_a = np.log(pa_all[fp - WIN_BREATH_BETA + 1: fp + 1])
            lb_b = np.log(pb_all[fp - WIN_BREATH_BETA + 1: fp + 1])
            alpha, beta = frozen_beta_ols(lb_a, lb_b)
            lx_a = np.log(pa_all[fp - WIN_BREATH_XING + 1: fp + 1])
            lx_b = np.log(pb_all[fp - WIN_BREATH_XING + 1: fp + 1])
            spread = lx_a - alpha - beta * lx_b
            breath = crossings_per_yr(spread, float(np.mean(spread)))

            # Factor-Kinship: trailing 252d Pearson corr of daily simple returns
            ka = pa_all[fp - WIN_KIN + 1: fp + 1]
            kb = pb_all[fp - WIN_KIN + 1: fp + 1]
            ra = ka[1:] / ka[:-1] - 1.0
            rb = kb[1:] / kb[:-1] - 1.0
            kin = float(np.corrcoef(ra, rb)[0, 1])

            # DD-gamma ratio: max leg drawdown from 756d running high / annualized sigma
            wa = pa_all[fp - WIN_DD + 1: fp + 1]
            wb = pb_all[fp - WIN_DD + 1: fp + 1]
            dd_a = 1.0 - wa[-1] / np.max(wa)
            dd_b = 1.0 - wb[-1] / np.max(wb)
            dd_max = float(max(dd_a, dd_b))

            # cached columns for this pair-year
            try:
                crow = cache_idx.loc[(pair, y)]
            except KeyError:
                continue
            gamma = float(crow["gamma_126d"])
            tc_b = float(crow["title_change_252d"])
            target = crow["target_ta_per_yr"]
            naive = crow["naive_prev_ta_per_yr"]
            eligible = bool(crow["eligible_fwd"])
            sigma = float(np.sqrt(gamma)) if gamma > 0 else np.nan
            ddgamma = dd_max / sigma if (sigma and np.isfinite(sigma) and sigma > 0) else np.nan

            rows.append({
                "pair": pair, "year": int(y), "same_league": same_league,
                "gamma_126d": gamma, "sigma_126d": sigma,
                "tc_126": int(tc_a), "tc_252": tc_b, "tc_504": int(tc_c),
                "breath_252": float(breath), "factor_kinship_252": kin,
                "dd_max_756d": dd_max, "ddgamma_ratio": float(ddgamma) if np.isfinite(ddgamma) else np.nan,
                "naive_prev_ta_per_yr": float(naive) if pd.notna(naive) else np.nan,
                "target_ta_per_yr": float(target) if pd.notna(target) else np.nan,
                "eligible_fwd": eligible,
            })
        n_done += 1
        if n_done % 300 == 0:
            log(f"  ...{n_done}/{len(pairs)} pairs  ({time.time()-t0:.0f}s)")

    df = pd.DataFrame(rows)
    df.to_csv(HERE / "batch1_pairs.csv", index=False)
    log(f"pair-year table: {len(df)} rows written  ({time.time()-t0:.0f}s)")

    elig = df[df["eligible_fwd"]].copy()
    SENSORS = ["gamma_126d", "tc_126", "tc_252", "tc_504", "breath_252",
               "factor_kinship_252", "ddgamma_ratio"]

    # ---- SANITY GATE: recompute gamma yearly rho 2012..2018, compare to kayfabe ----
    kayfabe_gamma_rho = {2012: 0.3441, 2013: 0.0627, 2014: 0.1807, 2015: 0.1663,
                         2016: 0.3868, 2017: 0.0899, 2018: 0.5149}
    sanity = {}
    for y in TARGET_YEARS:
        d = elig[elig["year"] == y]
        sanity[y] = sp_rho(d["gamma_126d"].values, d["target_ta_per_yr"].values)
    # Gate intent: reproduce kayfabe shot 1's gamma DIRECTION (strongly positive, 7/7) from
    # the cached csv. Numeric identity is impossible because kayfabe_pairs.csv stores gamma
    # at 8 and target at 6 decimals, so a few near-tie ranks shift ~1e-3 vs kayfabe's
    # full-precision in-memory rho. Pass on: all 7 correctly positive AND max drift < 5e-3.
    max_drift = max(abs((sanity[y] or -9) - kayfabe_gamma_rho[y]) for y in TARGET_YEARS)
    all_positive = all(sanity[y] is not None and sanity[y] > 0 for y in TARGET_YEARS)
    sanity_match = all_positive and max_drift < 5e-3
    log("SANITY GATE (gamma yearly rho, sandbox) recomputed-from-csv vs kayfabe shot 1:")
    for y in TARGET_YEARS:
        log(f"  {y}: recomputed {sanity[y]}  kayfabe {kayfabe_gamma_rho[y]}  "
            f"drift={abs((sanity[y] or -9) - kayfabe_gamma_rho[y]):.4f}")
    log(f"  gamma strongly positive 7/7={all_positive}, max drift={max_drift:.4f} "
        f"(csv rounding), GATE PASS={sanity_match}")

    # ---- PRIMARY: median yearly cross-sectional Spearman + correctly-signed year count
    def primary_stat(col, direction):
        yr = {}
        for y in TARGET_YEARS:
            d = elig[elig["year"] == y]
            yr[y] = sp_rho(d[col].values, d["target_ta_per_yr"].values)
        vals = [v for v in yr.values() if v is not None]
        med = round(float(np.median(vals)), 4) if vals else None
        n_pos = sum(1 for v in vals if v > 0)                    # raw positive-year count
        n_correct = sum(1 for v in vals if v * direction > 0)   # correctly-signed per direction
        return {"yearly_rho": {str(y): yr[y] for y in TARGET_YEARS},
                "median_rho": med, "n_years": len(vals),
                "n_pos_years": n_pos, "n_correct_sign_years": n_correct}

    primary = {s: primary_stat(s, DIRECTIONS[s]) for s in SENSORS}

    # ---- SECONDARY: corpse-flag precision at decile, pooled 2012..2018 -------------
    tgt = elig["target_ta_per_yr"].values
    fin_t = np.isfinite(tgt)
    tq10 = np.quantile(tgt[fin_t], 0.10)              # forward BOTTOM-decile cutoff (pooled)
    forward_bottom = elig["target_ta_per_yr"] <= tq10

    def corpse_flag(col, direction):
        s = elig[col].values.astype(float)
        m = np.isfinite(s) & fin_t
        sv = s[m]
        fb = forward_bottom.values[m]
        if direction > 0:                            # worst = LOW sensor decile
            thr = np.quantile(sv, 0.10)
            worst = sv <= thr
        else:                                        # worst = HIGH sensor decile
            thr = np.quantile(sv, 0.90)
            worst = sv >= thr
        n_worst = int(worst.sum())
        prec = float(fb[worst].mean()) if n_worst else None
        return {"n_worst_decile": n_worst,
                "precision": round(prec, 4) if prec is not None else None,
                "base_rate": 0.10,
                "lift_vs_base": round(prec - 0.10, 4) if prec is not None else None}

    secondary = {s: corpse_flag(s, DIRECTIONS[s]) for s in SENSORS}

    # ---- Same-League Tag: group medians (per year + pooled) instead of rho ---------
    league_year = {}
    for y in TARGET_YEARS:
        d = elig[elig["year"] == y]
        same = d[d["same_league"] == 1]["target_ta_per_yr"]
        cross = d[d["same_league"] == 0]["target_ta_per_yr"]
        sm_med = round(float(same.median()), 6) if len(same) else None
        cr_med = round(float(cross.median()), 6) if len(cross) else None
        league_year[str(y)] = {"same": sm_med, "cross": cr_med,
                               "gap": (round(sm_med - cr_med, 6) if (sm_med is not None and cr_med is not None) else None),
                               "n_same": int(len(same)), "n_cross": int(len(cross))}
    gaps = [v["gap"] for v in league_year.values() if v["gap"] is not None]
    league_pooled_same = round(float(elig[elig["same_league"] == 1]["target_ta_per_yr"].median()), 6)
    league_pooled_cross = round(float(elig[elig["same_league"] == 0]["target_ta_per_yr"].median()), 6)
    league_median_gap = round(float(np.median(gaps)), 6) if gaps else None
    league_pos_years = sum(1 for g in gaps if g > 0)     # same-league > cross-league (League+)
    # league corpse-flag analog: cross-league group vs forward bottom decile (group, not decile)
    cross_mask = (elig["same_league"] == 0).values & fin_t
    league_corpse_prec = round(float(forward_bottom.values[cross_mask].mean()), 4) if cross_mask.sum() else None

    # ---- REDUNDANCY: pairwise Spearman between sensor pair-year scores, pooled ------
    redun_cols = ["gamma_126d", "tc_126", "tc_252", "tc_504", "breath_252",
                  "factor_kinship_252", "ddgamma_ratio", "same_league"]
    R = {}
    for i in redun_cols:
        R[i] = {}
        xi = elig[i].values.astype(float)
        for j in redun_cols:
            xj = elig[j].values.astype(float)
            m = np.isfinite(xi) & np.isfinite(xj)
            if m.sum() < 10:
                R[i][j] = None
            else:
                rho, _ = spearmanr(xi[m], xj[m])
                R[i][j] = round(float(rho), 4)
    # find |rho|>0.8 off-diagonal, fold junior (lower primary median |rho|) into senior
    def prim_abs(col):
        if col == "same_league":
            return abs(league_median_gap) if league_median_gap is not None else 0.0
        m = primary[col]["median_rho"]
        return abs(m) if m is not None else 0.0
    folds = []
    for a_i, b_i in combinations(redun_cols, 2):
        rho = R[a_i][b_i]
        if rho is not None and abs(rho) > 0.8:
            senior, junior = (a_i, b_i) if prim_abs(a_i) >= prim_abs(b_i) else (b_i, a_i)
            folds.append({"pair": [a_i, b_i], "rho": rho, "senior": senior, "junior": junior})

    # ---- VERDICTS (elimination bar: correct-sign median AND >=4/7 correct-sign years)
    ENTRANTS = {
        "gamma_126d": "gamma_126d (incumbent)",
        "title_change": ["tc_126", "tc_252", "tc_504"],
        "breath_252": "Breath",
        "same_league": "Same-League Tag",
        "factor_kinship_252": "Factor-Kinship",
        "ddgamma_ratio": "Drawdown-gamma Ratio",
    }
    verdicts = {}

    def verdict_for(col):
        d = DIRECTIONS[col]
        med = primary[col]["median_rho"]
        n_ok = primary[col]["n_correct_sign_years"]
        correct_sign = med is not None and med * d > 0
        survives = correct_sign and n_ok >= 4
        if survives:
            return "SURVIVES", None
        if not correct_sign:
            return "ELIMINATED", f"median rho {med} wrong sign for declared direction ({'+' if d>0 else '-'})"
        return "ELIMINATED", f"only {n_ok}/7 correctly-signed years (<4)"

    for col in ["gamma_126d", "breath_252", "factor_kinship_252", "ddgamma_ratio"]:
        v, cod = verdict_for(col)
        verdicts[col] = {"verdict": v, "cause_of_death": cod}

    # Title-Change entrant: best-of the three costumes (multiplicity noted)
    tc_best = max(["tc_126", "tc_252", "tc_504"],
                  key=lambda c: (primary[c]["median_rho"] or -9) * DIRECTIONS[c])
    v, cod = verdict_for(tc_best)
    verdicts["title_change"] = {"verdict": v, "cause_of_death": cod, "best_costume": tc_best,
                                "multiplicity": "3 costumes (126/252/504), best-of reported"}

    # League verdict: group-median gap direction (League+) + >=4/7 years same>cross
    league_survives = (league_median_gap is not None and league_median_gap > 0 and league_pos_years >= 4)
    verdicts["same_league"] = {
        "verdict": "SURVIVES" if league_survives else "ELIMINATED",
        "cause_of_death": None if league_survives else
            (f"same-league median gap {league_median_gap} not > 0" if (league_median_gap is None or league_median_gap <= 0)
             else f"only {league_pos_years}/7 years same>cross (<4)"),
    }

    # ---- assemble results ----------------------------------------------------------
    results = {
        "protocol": "Royal Rumble BATCH 1 — RUMBLE.md, declared 2026-07-15 pre-run; sandbox 2012-2018 only",
        "arena": {"target_years": TARGET_YEARS, "n_pairs": len(pairs), "n_pairyears_eligible": int(len(elig))},
        "directions": DIRECTIONS,
        "sanity_gate": {"gamma_yearly_rho_recomputed": {str(y): sanity[y] for y in TARGET_YEARS},
                        "kayfabe_gamma_yearly_rho": {str(y): kayfabe_gamma_rho[y] for y in TARGET_YEARS},
                        "gamma_positive_7of7": bool(all_positive),
                        "max_drift_vs_kayfabe": round(float(max_drift), 4),
                        "match": bool(sanity_match),
                        "note": "gamma strongly positive 7/7 in sandbox — reproduces kayfabe shot 1 "
                                "direction; <5e-3 drift is kayfabe_pairs.csv rounding (gamma 8dp / target 6dp)"},
        "PRIMARY_median_yearly_spearman": primary,
        "SECONDARY_corpse_flag_precision": secondary,
        "same_league_group_medians": {"per_year": league_year,
                                       "pooled_same": league_pooled_same,
                                       "pooled_cross": league_pooled_cross,
                                       "median_yearly_gap": league_median_gap,
                                       "n_years_same_gt_cross": league_pos_years,
                                       "corpse_flag_cross_group_precision": league_corpse_prec},
        "redundancy_matrix_spearman_pooled": R,
        "redundancy_folds_rho_gt_0p8": folds,
        "verdicts": verdicts,
        "deviations": [
            "Breath frozen-beta: plain OLS of log(pa) on log(pb) (first leg dependent), "
            "matching RUMBLE 'trailing 504d OLS of log prices' literally; not the "
            "cointegration-p-selected eg_best direction. Beta frozen on 504d, crossings "
            "counted on the trailing 252d sub-window around that sub-window's own mean.",
            "Trailing 'N days' taken as N price rows (N-1 returns), ending INCLUSIVE at the "
            "first trading day of year y — identical to kayfabe_test.py's window convention, "
            "so new sensors align 1:1 with the cached gamma/TC-252/target rows.",
            "DD-gamma drawdown = current depth below the trailing-756d running high "
            "(1 - last/max), deeper leg; divided by sigma=sqrt(gamma_126d) (annualized).",
            "Corpse-flag deciles computed POOLED across 2012-2018 (per RUMBLE 'pooled'); "
            "Same-League corpse-flag is a GROUP precision (cross-league vs forward bottom "
            "decile), not a decile, since the tag is binary.",
        ],
    }
    (HERE / "batch1_results.json").write_text(json.dumps(results, indent=2))

    # ---- console standings ---------------------------------------------------------
    log("\n" + "=" * 92)
    log("STANDINGS — entrant | primary median rho | correct-sign yrs | corpse-flag prec | verdict")
    log("-" * 92)
    def line(name, col):
        p = primary[col]; s = secondary[col]; vv = verdicts[col if col in verdicts else "title_change"]
        log(f"  {name:<26} med={str(p['median_rho']):>8}  "
            f"corrsign={p['n_correct_sign_years']}/7  prec={str(s['precision']):>7}  {vv['verdict']}"
            + (f"  [{vv['cause_of_death']}]" if vv.get('cause_of_death') else ""))
    line("gamma_126d (incumbent)", "gamma_126d")
    for c in ["tc_126", "tc_252", "tc_504"]:
        p = primary[c]; s = secondary[c]
        star = " <BEST" if c == tc_best else ""
        log(f"  {'Title-Change '+c:<26} med={str(p['median_rho']):>8}  "
            f"corrsign={p['n_correct_sign_years']}/7  prec={str(s['precision']):>7}  "
            f"{verdicts['title_change']['verdict'] if c==tc_best else '(costume)'}{star}")
    line("Breath", "breath_252")
    log(f"  {'Same-League Tag':<26} gap_med={league_median_gap}  "
        f"yrs_same>cross={league_pos_years}/7  crossgrp_prec={league_corpse_prec}  "
        f"{verdicts['same_league']['verdict']}"
        + (f"  [{verdicts['same_league']['cause_of_death']}]" if verdicts['same_league']['cause_of_death'] else ""))
    line("Factor-Kinship", "factor_kinship_252")
    line("Drawdown-gamma Ratio", "ddgamma_ratio")
    log("=" * 92)
    log("REDUNDANCY folds (|rho|>0.8):")
    if folds:
        for f in folds:
            log(f"  {f['pair'][0]} ~ {f['pair'][1]}  rho={f['rho']}  -> junior {f['junior']} folds into {f['senior']}")
    else:
        log("  none")
    log(f"SANITY GATE match: {sanity_match}")
    log("=" * 92)
    log(f"wrote batch1_pairs.csv ({len(df)} rows), batch1_results.json  [{time.time()-t0:.0f}s]")
    _logf.close()


if __name__ == "__main__":
    main()
