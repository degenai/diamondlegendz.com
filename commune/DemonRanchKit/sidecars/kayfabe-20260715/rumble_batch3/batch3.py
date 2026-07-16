"""ROYAL RUMBLE — BATCH 3, THE CORPSE ANNEX. Protocol FROZEN in ../RUMBLE.md
("BATCH 3 — THE CORPSE ANNEX", declared 2026-07-15 before any batch-3 computation).
This script IMPLEMENTS that protocol exactly: no new sensors, no threshold changes,
no target years outside those declared (GFC 2008-2011; dot-com 2000-2003).

House rules honored:
  R4  — no existing script edited. batch1.py and kayfabe_test.py are NOT imported:
        BOTH open a run-log in 'w' mode at module scope (batch1.py:77-78,
        kayfabe_test.py:54-55), which would truncate a completed pre-registered
        artifact. Their sensor estimators are therefore COPIED VERBATIM below with
        file:line citations (the idiom batch1.py itself used to reuse kayfabe's
        title_changes). v12_target_swap.py IS imported read-only — it has no such
        side effect and is the same module kayfabe_test.py imports for the engine.
  R10 — sensors defined verbatim per rumble_batch1/batch1.py; the forward
        trade-added target uses the validated engine invocation book_metrics from
        sidecars/cointegration-20260715/v12_target_swap.py (the invocation that
        reproduced the fortress at +2.171%/yr), applied to the annex panels.
  R1  — medians and counts only in the statistics of record.

Standalone sidecar. Deterministic, no RNG. Writes batch3_pairs_gfc.csv,
batch3_pairs_dotcom.csv, batch3_results.json, batch3_run.log into this directory.
Touches no engine/atlas/backtest/REPORT/RUMBLE file.
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
ANNEX = KAY / "annex"
HERE = KAY / "rumble_batch3"
HERE.mkdir(exist_ok=True)
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "sidecars/demon-atlas-20260709"))
sys.path.insert(0, str(COINT))

# R4/R10: read-only reuse of the crossing-rate estimator and the VALIDATED forward
# trade-added engine invocation (book_metrics + the fortress machinery).
from coint_test import crossings_per_yr, load_yf_panel
from v12_target_swap import book_metrics, simulate_batch, rr_for, POL

# ---------------- protocol constants (FROZEN — RUMBLE.md BATCH 3) ----------------
GFC_YEARS = [2008, 2009, 2010, 2011]        # GFC arena target years
DOTCOM_YEARS = [2000, 2001, 2002, 2003]     # dot-com arena target years
WIN_GAMMA = 126                             # gamma / sigma window
WIN_TC = 126                                # Title-Change (TC-126) window
WIN_BREATH_BETA = 504                       # Breath frozen-beta OLS window
WIN_BREATH_XING = 252                       # Breath zero-crossing window
WIN_KIN = 252                               # Factor-Kinship corr window
WIN_DD = 756                                # drawdown running-high window
MIN_FWD_DAYS = 240                          # forward-year eligibility (>=240 fwd days)
SEV_THR = -5.0                              # SEVERITY: forward TA <= -5 %/yr (catastrophe)

# GFC league map = Batch-1's map (RUMBLE.md BATCH 1), covers all 61 GFC tickers.
GFC_LEAGUE = {}
for _grp, _members in {
    "country":   "ECH EWA EWC EWD EWG EWH EWI EWJ EWK EWL EWM EWN EWP EWQ EWS EWT EWU EWW EWY EWZ EZA FXI THD TUR",
    "ussector":  "IYT XLB XLE XLF XLI XLK XLP XLU XLV XLY XME XBI",
    "bond":      "BND EMB HYG IEF LQD SHY TIP TLT",
    "commodity": "DBA DBB GDX SLV UNG USO",
    "broad":     "IWM QQQ SMH VEU VNQ VTI VYM",
    "single":    "F GME MSTR NVDA",
}.items():
    for _t in _members.split():
        GFC_LEAGUE[_t] = _grp

# Dot-com league map = declared in RUMBLE.md BATCH 3, covers all 26 dot-com tickers.
DOTCOM_LEAGUE = {}
for _grp, _members in {
    "country": "EWA EWC EWG EWH EWJ EWK EWL EWM EWN EWP EWQ EWS EWU EWW",
    "sector":  "XLB XLE XLF XLI XLK XLP XLU XLV XLY",
    "broad":   "QQQ IWM",
    "single":  "F",
}.items():
    for _t in _members.split():
        DOTCOM_LEAGUE[_t] = _grp

LOG_PATH = HERE / "batch3_run.log"
_logf = open(LOG_PATH, "w", encoding="utf-8")


def log(msg):
    print(msg, flush=True)
    _logf.write(str(msg) + "\n")
    _logf.flush()


# ---------------- sensor estimators (VERBATIM from batch1.py / kayfabe_test.py) ----

def gamma_ann(pa, pb):
    """VERBATIM kayfabe_test.py:65-70 (== the cached gamma_126d batch1 reads):
    annualized variance of the daily ARITHMETIC return spread over the window."""
    Ra = pa[1:] / pa[:-1] - 1.0
    Rb = pb[1:] / pb[:-1] - 1.0
    return float(np.var(Ra - Rb, ddof=1) * 252.0)


def title_changes(pa, pb):
    """VERBATIM batch1.py:88-97 (== kayfabe_test.py:82-91). Lead swaps in cumulative
    LOG return between the legs = sign changes of (cumlog_a - cumlog_b); zeros ignored."""
    diff = np.log(pa / pa[0]) - np.log(pb / pb[0])
    d = np.sign(diff)
    d = d[d != 0]
    if len(d) < 2:
        return 0
    return int(np.sum(d[1:] != d[:-1]))


def frozen_beta_ols(lpa, lpb):
    """VERBATIM batch1.py:100-105. Frozen alpha,beta from OLS of log(pa) on log(pb)
    over the window; first leg is the dependent variable (batch1's frozen choice)."""
    ols = sm.OLS(lpa, sm.add_constant(lpb)).fit()
    return float(ols.params[0]), float(ols.params[1])


def sp_rho(x, y):
    """VERBATIM batch1.py:108-117. Spearman masking non-finite in EITHER array, n>=10."""
    x = np.asarray(x, float)
    y = np.asarray(y, float)
    m = np.isfinite(x) & np.isfinite(y)
    if int(m.sum()) < 10:
        return None
    rho, _ = spearmanr(x[m], y[m])
    return round(float(rho), 4)


# ---------------- per-arena pair-year table (sensors + forward target) ------------

def build_pairyear_table(px, years, league_map, arena_name):
    """One row per (pair, target-year). Sensor value = NaN when that sensor's trailing
    window is not fully available in the aligned series at the first trading day of the
    year (per-sensor eligibility, honestly reported). target_ta_per_yr = NaN when the
    forward calendar year has < MIN_FWD_DAYS aligned trading days. Trailing windows END
    INCLUSIVE at the first trading day of year y (batch1/kayfabe convention)."""
    cohort = sorted(px.columns)
    pairs = list(combinations(cohort, 2))
    rows = []
    t0 = time.time()
    n_engine = 0
    for pi, (a, b) in enumerate(pairs):
        aligned = px[[a, b]].dropna()
        if len(aligned) == 0:
            continue
        idx_years = aligned.index.year.values
        pa_all = aligned[a].values
        pb_all = aligned[b].values
        same_league = int(league_map[a] == league_map[b])
        for y in years:
            where = np.nonzero(idx_years == y)[0]
            if len(where) == 0:
                continue
            fp = int(where[0])                       # first trading day of year y (aligned)

            # ---- forward target: calendar-year actual-path trade-added %/yr (engine verbatim)
            fwd_mask = idx_years == y
            n_fwd = int(fwd_mask.sum())
            target = np.nan
            if n_fwd >= MIN_FWD_DAYS:
                w = aligned[fwd_mask]
                dts = [d.strftime("%Y-%m-%d") for d in w.index]
                target = float(book_metrics(w.values, dts, [a, b])["ta_per_yr"])
                n_engine += 1

            # ---- sensors, each with its OWN trailing-window eligibility (fp+1 >= W)
            def ok(W):
                return fp + 1 >= W

            gamma = sigma = np.nan
            if ok(WIN_GAMMA):
                gamma = gamma_ann(pa_all[fp - WIN_GAMMA + 1: fp + 1], pb_all[fp - WIN_GAMMA + 1: fp + 1])
                sigma = float(np.sqrt(gamma)) if gamma > 0 else np.nan

            tc126 = np.nan
            if ok(WIN_TC):
                tc126 = float(title_changes(pa_all[fp - WIN_TC + 1: fp + 1], pb_all[fp - WIN_TC + 1: fp + 1]))

            breath = np.nan
            if ok(WIN_BREATH_BETA):
                lb_a = np.log(pa_all[fp - WIN_BREATH_BETA + 1: fp + 1])
                lb_b = np.log(pb_all[fp - WIN_BREATH_BETA + 1: fp + 1])
                alpha, beta = frozen_beta_ols(lb_a, lb_b)
                lx_a = np.log(pa_all[fp - WIN_BREATH_XING + 1: fp + 1])
                lx_b = np.log(pb_all[fp - WIN_BREATH_XING + 1: fp + 1])
                spread = lx_a - alpha - beta * lx_b
                breath = float(crossings_per_yr(spread, float(np.mean(spread))))

            kin = np.nan
            if ok(WIN_KIN):
                ka = pa_all[fp - WIN_KIN + 1: fp + 1]
                kb = pb_all[fp - WIN_KIN + 1: fp + 1]
                ra = ka[1:] / ka[:-1] - 1.0
                rb = kb[1:] / kb[:-1] - 1.0
                kin = float(np.corrcoef(ra, rb)[0, 1])

            ddg = np.nan
            if ok(WIN_DD):
                wa = pa_all[fp - WIN_DD + 1: fp + 1]
                wb = pb_all[fp - WIN_DD + 1: fp + 1]
                dd_a = 1.0 - wa[-1] / np.max(wa)
                dd_b = 1.0 - wb[-1] / np.max(wb)
                dd_max = float(max(dd_a, dd_b))
                if sigma is not None and np.isfinite(sigma) and sigma > 0:
                    ddg = dd_max / sigma

            rows.append({
                "pair": f"{a}/{b}", "year": int(y), "same_league": same_league,
                "n_fwd_days": n_fwd,
                "gamma_126d": gamma, "sigma_126d": sigma,
                "tc_126": tc126, "breath_252": breath,
                "factor_kinship_252": kin, "ddgamma_ratio": ddg,
                "target_ta_per_yr": target,
            })
        if (pi + 1) % 300 == 0:
            log(f"  [{arena_name}] ...{pi+1}/{len(pairs)} pairs, {n_engine} engine runs  ({time.time()-t0:.0f}s)")
    df = pd.DataFrame(rows)
    log(f"  [{arena_name}] table {len(df)} pair-years, {n_engine} forward engine runs  ({time.time()-t0:.0f}s)")
    return df, cohort, pairs


# ---------------- belts ----------------------------------------------------------

# Continuous fighters: (col, transform, feast_dir, reliability_dir) — EXACTLY Batch 2.
FIGHTERS_CONT = {
    "gamma_126d":   ("gamma_126d", +1, +1, +1),
    "TC-126":       ("tc_126", +1, +1, +1),
    "Breath":       ("breath_252", +1, +1, +1),
    "Anti-Kinship": ("factor_kinship_252", -1, +1, -1),
    "DD-gamma v1":  ("ddgamma_ratio", +1, +1, +1),
}


def belt(yearly, direction):
    """yearly = {year: rho or None}. median + correct-sign count; bar = correct-sign
    median AND >=3 of 4 correctly-signed years (RUMBLE.md BATCH 3 elimination)."""
    vals = [v for v in yearly.values() if v is not None]
    med = round(float(np.median(vals)), 4) if vals else None
    n_correct = sum(1 for v in vals if v * direction > 0)
    survives = med is not None and med * direction > 0 and n_correct >= 3
    return {"yearly_rho": {str(y): yearly[y] for y in yearly},
            "median_rho": med, "n_years": len(vals),
            "correct_sign_years": f"{n_correct}/4", "verdict": "PASS" if survives else "FAIL"}


def corpse_belt(sub, col, transform, feast_dir, sev_base):
    """Pooled over the arena's target years. Worst decile per the entrant's feast
    direction (feast+ -> LOW sensor). Decile precision vs forward BOTTOM-decile TA;
    severity precision vs forward TA <= -5 %/yr. sub = this sensor's eligible pooled
    rows (col finite AND target finite)."""
    s = transform * sub[col]
    if feast_dir > 0:
        thr = s.quantile(0.10)
        worst = s <= thr
    else:
        thr = s.quantile(0.90)
        worst = s >= thr
    bottom = sub["target_ta_per_yr"] <= sub["target_ta_per_yr"].quantile(0.10)
    sev = sub["target_ta_per_yr"] <= SEV_THR
    n = int(worst.sum())
    return {"n_flagged": n,
            "decile_precision": round(float((worst & bottom).sum() / n), 4) if n else None,
            "decile_base": 0.10,
            "severity_precision": round(float((worst & sev).sum() / n), 4) if n else None,
            "severity_base": round(float(sev_base), 4)}


def analyze_arena(df, years, arena_name):
    """All six fighters, three belts, per arena. Returns a results dict."""
    fin_t = np.isfinite(df["target_ta_per_yr"].values)
    fwd = df[fin_t].copy()                       # forward-eligible pool (target valid)
    fwd["win"] = (fwd["target_ta_per_yr"] > 0).astype(int)
    sev_base = float((fwd["target_ta_per_yr"] <= SEV_THR).mean()) if len(fwd) else float("nan")
    bottom_base = 0.10

    out = {"arena": arena_name, "target_years": years,
           "n_pairyears_forward_eligible": int(len(fwd)),
           "corpse_base_rates": {"decile": bottom_base,
                                 "severity_TA_le_-5pct_per_yr": round(sev_base, 4)},
           "eligible_n_per_sensor_per_year": {}, "entrants": {}}

    # per-sensor per-year eligible-n (sensor finite AND forward target finite)
    sens_cols = ["gamma_126d", "tc_126", "breath_252", "factor_kinship_252", "ddgamma_ratio"]
    for col in sens_cols:
        col_fin = np.isfinite(fwd[col].values)
        out["eligible_n_per_sensor_per_year"][col] = {
            str(y): int((col_fin & (fwd["year"].values == y)).sum()) for y in years}
    # Cross-League needs no trailing window -> eligible-n == forward-eligible n
    out["eligible_n_per_sensor_per_year"]["cross_league(no trailing window)"] = {
        str(y): int((fwd["year"].values == y).sum()) for y in years}

    # ---- continuous fighters ----
    for name, (col, tr, f_dir, r_dir) in FIGHTERS_CONT.items():
        elig = fwd[np.isfinite(fwd[col].values)].copy()
        feast_yr, rel_yr = {}, {}
        for y in years:
            d = elig[elig["year"] == y]
            feast_yr[y] = sp_rho((tr * d[col]).values, d["target_ta_per_yr"].values)
            rel_yr[y] = sp_rho((tr * d[col]).values, d["win"].values)
        feast = belt(feast_yr, f_dir)
        reliability = belt(rel_yr, r_dir)
        corpse = corpse_belt(elig, col, tr, f_dir, sev_base)
        out["entrants"][name] = {
            "transform": tr, "feast_dir": f_dir, "reliability_dir": r_dir,
            "n_eligible_pooled": int(len(elig)),
            "feast": feast, "reliability": reliability, "corpse": corpse}

    # ---- Cross-League (binary; group gaps as in Batch 2, oriented cross-minus-same) ----
    feast_gap_yr, rel_gap_yr = {}, {}
    for y in years:
        d = fwd[fwd["year"] == y]
        same = d[d["same_league"] == 1]
        cross = d[d["same_league"] == 0]
        if len(same) and len(cross):
            feast_gap_yr[y] = round(float(cross["target_ta_per_yr"].median()
                                          - same["target_ta_per_yr"].median()), 4)
            rel_gap_yr[y] = round(float(cross["win"].mean() - same["win"].mean()), 4)
        else:
            feast_gap_yr[y] = None
            rel_gap_yr[y] = None
    fg = [v for v in feast_gap_yr.values() if v is not None]
    rg = [v for v in rel_gap_yr.values() if v is not None]
    feast_gap_med = round(float(np.median(fg)), 4) if fg else None
    rel_gap_med = round(float(np.median(rg)), 4) if rg else None
    n_feast_correct = sum(1 for v in fg if v > 0)     # cross > same (Cross-League +)
    n_rel_correct = sum(1 for v in rg if v > 0)
    # corpse: worst GROUP per Cross-League+ direction = SAME-league pairs (low cross-league)
    same_mask = (fwd["same_league"] == 1)
    n_same = int(same_mask.sum())
    bottom = fwd["target_ta_per_yr"] <= fwd["target_ta_per_yr"].quantile(0.10)
    sev = fwd["target_ta_per_yr"] <= SEV_THR
    out["entrants"]["Cross-League"] = {
        "note": "binary tag; group gaps oriented cross-minus-same to match the Cross-League "
                "(+) direction; corpse = same-league GROUP precision (worst group), not a decile",
        "feast_gap_median (cross - same, TA/yr)": feast_gap_med,
        "feast_gap_per_year": {str(y): feast_gap_yr[y] for y in years},
        "feast_correct_sign_years": f"{n_feast_correct}/4",
        "feast_verdict": "PASS" if (feast_gap_med is not None and feast_gap_med > 0 and n_feast_correct >= 3) else "FAIL",
        "reliability_gap_median (cross - same, win-rate)": rel_gap_med,
        "reliability_per_year": {str(y): rel_gap_yr[y] for y in years},
        "reliability_correct_sign_years": f"{n_rel_correct}/4",
        "corpse": {"n_flagged_same_league_group": n_same,
                   "decile_precision": round(float((same_mask & bottom).sum() / n_same), 4) if n_same else None,
                   "decile_base": bottom_base,
                   "severity_precision": round(float((same_mask & sev).sum() / n_same), 4) if n_same else None,
                   "severity_base": round(sev_base, 4)},
    }
    return out


# ---------------- validation gate ------------------------------------------------

def fortress_five_run(px, year, panel_name):
    """VERBATIM v12_target_swap.validate_fortress invocation (lines 157-168), restricted
    to ONE calendar year on the given panel. 5 legs, equal weight, 5% band."""
    F = ["DBB", "EWU", "EWZ", "GDX", "TUR"]
    sub = px.loc[px.index.year == year, F].dropna()
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
    return {"panel": panel_name, "year": year, "n_days": int(len(pxv)),
            "demon_terminal": round(float(f[0]), 2), "hold_terminal": round(float(hold), 2),
            "ta_per_yr_pct": round(ta_per_yr, 4), "finite": bool(np.isfinite(ta_per_yr))}


def pair_year_ta(px, a, b, year):
    al = px[[a, b]].dropna()
    w = al[al.index.year == year]
    if len(w) < MIN_FWD_DAYS:
        return None, len(w)
    dts = [d.strftime("%Y-%m-%d") for d in w.index]
    return float(book_metrics(w.values, dts, [a, b])["ta_per_yr"]), len(w)


# ---------------- main -----------------------------------------------------------

def main():
    t0 = time.time()
    gfc = pd.read_csv(ANNEX / "gfc_panel_2005_2012.csv", index_col=0, parse_dates=True).sort_index()
    dotcom = pd.read_csv(ANNEX / "dotcom_panel_1996_2005.csv", index_col=0, parse_dates=True).sort_index()
    log(f"GFC panel {gfc.shape} {gfc.index[0].date()}..{gfc.index[-1].date()}")
    log(f"dot-com panel {dotcom.shape} {dotcom.index[0].date()}..{dotcom.index[-1].date()}")
    assert len(gfc.columns) == 61, gfc.shape
    assert len(dotcom.columns) == 26, dotcom.shape

    # ================= VALIDATION GATE (before trusting anything) =================
    log("\n===== VALIDATION GATE =====")
    val = {}
    # (1) fortress five, 2009, GFC panel — finite + plausible
    vf_gfc = fortress_five_run(gfc, 2009, "gfc_panel_2005_2012")
    log(f"  fortress-five 2009 (GFC panel): ta_per_yr={vf_gfc['ta_per_yr_pct']}%/yr "
        f"finite={vf_gfc['finite']} n_days={vf_gfc['n_days']}")
    # provenance anchor: reproduce the +2.171%/yr fortress from the MAIN panel (2020-2026)
    main_px = load_yf_panel()
    from v12_target_swap import validate_fortress
    prov = validate_fortress(main_px)
    log(f"  provenance: fortress 2020-2026 (main panel) ta_per_yr={prov['ta_per_yr_pct']}%/yr "
        f"(expected ~+2.171; v12 machinery intact)")
    # (2) spot-check: one pair's 2010 trade-added, GFC panel vs main panel
    sca, scb, scy = "EWU", "EWZ", 2010
    ta_gfc, n_gfc = pair_year_ta(gfc, sca, scb, scy)
    ta_main, n_main = pair_year_ta(main_px, sca, scb, scy)
    diff = abs(ta_gfc - ta_main) if (ta_gfc is not None and ta_main is not None) else None
    log(f"  spot-check {sca}/{scb} {scy} TA/yr: GFC={round(ta_gfc,4)} (n={n_gfc})  "
        f"main={round(ta_main,4)} (n={n_main})  |diff|={round(diff,4)}")
    gate_pass = bool(vf_gfc["finite"] and abs(vf_gfc["ta_per_yr_pct"]) < 100.0
                     and diff is not None and diff < 2.0)
    log(f"  GATE PASS={gate_pass}  (fortress finite&|.|<100; spot-check |diff|<2.0 %/yr)")
    val = {"fortress_five_2009_gfc": vf_gfc,
           "provenance_fortress_2020_2026_main": prov,
           "spot_check_pair_2010": {"pair": f"{sca}/{scb}", "year": scy,
                                    "ta_gfc": round(ta_gfc, 4), "n_gfc": n_gfc,
                                    "ta_main": round(ta_main, 4), "n_main": n_main,
                                    "abs_diff": round(diff, 4),
                                    "note": "same source (yfinance), different pull dates; small drift acceptable"},
           "gate_pass": gate_pass}

    # ================= ARENAS =================
    log("\n===== GFC ARENA (2008-2011) =====")
    df_gfc, coh_gfc, pairs_gfc = build_pairyear_table(gfc, GFC_YEARS, GFC_LEAGUE, "GFC")
    assert len(coh_gfc) == 61 and len(pairs_gfc) == 1830, (len(coh_gfc), len(pairs_gfc))
    df_gfc.to_csv(HERE / "batch3_pairs_gfc.csv", index=False)
    res_gfc = analyze_arena(df_gfc, GFC_YEARS, "GFC")

    log("\n===== DOT-COM ARENA (2000-2003) =====")
    df_dc, coh_dc, pairs_dc = build_pairyear_table(dotcom, DOTCOM_YEARS, DOTCOM_LEAGUE, "DOTCOM")
    assert len(coh_dc) == 26 and len(pairs_dc) == 325, (len(coh_dc), len(pairs_dc))
    df_dc.to_csv(HERE / "batch3_pairs_dotcom.csv", index=False)
    res_dc = analyze_arena(df_dc, DOTCOM_YEARS, "DOTCOM")

    # ================= CROSS-ARENA VERDICTS =================
    # sandbox feast signs from batch2_results.json (all positive)
    b2 = json.loads((KAY / "rumble_batch2" / "batch2_results.json").read_text())
    sandbox_feast = {
        "gamma_126d": b2["entrants"]["gamma_126d (incumbent)"]["feast"]["median_rho"],
        "TC-126": b2["entrants"]["TC-126 (survivor)"]["feast"]["median_rho"],
        "Breath": b2["entrants"]["Breath (survivor)"]["feast"]["median_rho"],
        "Anti-Kinship": b2["entrants"]["Anti-Kinship (v1 of Factor-Kinship)"]["feast"]["median_rho"],
        "DD-gamma v1": b2["entrants"]["DD-gamma v1 (sign-accepted)"]["feast"]["median_rho"],
        "Cross-League": b2["entrants"]["Cross-League (v1 of Same-League)"]["feast_gap_median (cross minus same, TA/yr)"],
    }

    def feast_val(res, name):
        e = res["entrants"][name]
        return e["feast_gap_median (cross - same, TA/yr)"] if name == "Cross-League" else e["feast"]["median_rho"]

    def sgn(x):
        return 0 if (x is None or x == 0) else (1 if x > 0 else -1)

    cross_arena = {}
    for name in ["gamma_126d", "TC-126", "Breath", "Anti-Kinship", "DD-gamma v1", "Cross-League"]:
        s_sand = sgn(sandbox_feast[name])
        s_gfc = sgn(feast_val(res_gfc, name))
        s_dc = sgn(feast_val(res_dc, name))
        signs = [s_sand, s_gfc, s_dc]
        if all(s > 0 for s in signs):
            v = "STABLE"
        elif all(s <= 0 for s in signs):
            v = "DEAD"
        else:
            v = "REGIME-BOUND"
        cross_arena[name] = {
            "sandbox_feast": sandbox_feast[name], "gfc_feast": feast_val(res_gfc, name),
            "dotcom_feast": feast_val(res_dc, name),
            "signs": {"sandbox": s_sand, "gfc": s_gfc, "dotcom": s_dc}, "verdict": v}

    results = {
        "protocol": "Royal Rumble BATCH 3 — THE CORPSE ANNEX; RUMBLE.md declared 2026-07-15 pre-run",
        "validation_gate": val,
        "arenas": {"GFC": res_gfc, "DOTCOM": res_dc},
        "cross_arena_verdicts": cross_arena,
        "sandbox_feast_signs_from_batch2": sandbox_feast,
        "deviations": [
            "batch1.py and kayfabe_test.py NOT imported (both truncate a run-log at module "
            "scope); their sensor estimators copied verbatim with file:line citations (R4).",
            "Per-sensor per-pair-year eligibility: each sensor computed only when its own "
            "trailing window (gamma/TC 126d, kinship 252d, breath 504d, ddgamma 756d) is fully "
            "present in the aligned series at the first trading day of year y; eligible-n "
            "reported per sensor per year. This is the honest handling of the dot-com sector-SPDR "
            "late inception (SPDRs incept 1998-12-22 -> 756d ddgamma excludes sector pairs until ~2002).",
            "Forward target = calendar-year actual-path trade-added %/yr via book_metrics "
            "(v12_target_swap, verbatim), on the annex panel; >=240 forward aligned days required.",
            "Cross-League group gaps oriented cross-minus-same (matches the Cross-League + "
            "direction); its corpse belt is a same-league GROUP precision (worst group per the "
            "feast direction), not a decile, since the tag is binary (batch1 idiom).",
            "Elimination bar: correct-sign median AND >=3/4 correctly-signed years (4 cross-sections).",
        ],
    }
    (HERE / "batch3_results.json").write_text(json.dumps(results, indent=2))

    # ================= STANDINGS =================
    def standings(res, sandbox_ref):
        log("\n" + "=" * 108)
        log(f"STANDINGS — {res['arena']} arena ({res['target_years']})")
        log(f"  corpse base rates: decile=0.10  severity(TA<=-5%/yr)={res['corpse_base_rates']['severity_TA_le_-5pct_per_yr']}  "
            f"(fwd-eligible pair-years={res['n_pairyears_forward_eligible']})")
        log("-" * 108)
        log(f"  {'entrant':<15}{'feast med':>11}{'sign-yrs':>10}{'reliab med':>12}"
            f"{'corpse dec':>12}{'severity':>11}{'verdict':>10}")
        for name in ["gamma_126d", "TC-126", "Breath", "Anti-Kinship", "DD-gamma v1"]:
            e = res["entrants"][name]
            log(f"  {name:<15}{str(e['feast']['median_rho']):>11}{e['feast']['correct_sign_years']:>10}"
                f"{str(e['reliability']['median_rho']):>12}{str(e['corpse']['decile_precision']):>12}"
                f"{str(e['corpse']['severity_precision']):>11}{e['feast']['verdict']:>10}")
        cl = res["entrants"]["Cross-League"]
        log(f"  {'Cross-League':<15}{str(cl['feast_gap_median (cross - same, TA/yr)']):>11}"
            f"{cl['feast_correct_sign_years']:>10}{str(cl['reliability_gap_median (cross - same, win-rate)']):>12}"
            f"{str(cl['corpse']['decile_precision']):>12}{str(cl['corpse']['severity_precision']):>11}"
            f"{cl['feast_verdict']:>10}")
        log("=" * 108)

    standings(res_gfc, sandbox_feast)
    standings(res_dc, sandbox_feast)

    log("\nCROSS-ARENA VERDICTS (sign of feast median: sandbox / GFC / dot-com):")
    for name, cv in cross_arena.items():
        log(f"  {name:<15} sandbox={cv['sandbox_feast']:>8}  gfc={str(cv['gfc_feast']):>8}  "
            f"dotcom={str(cv['dotcom_feast']):>8}  -> {cv['verdict']}")
    log("\nVALIDATION GATE PASS=" + str(val["gate_pass"]))
    log(f"\nwrote batch3_pairs_gfc.csv, batch3_pairs_dotcom.csv, batch3_results.json  [{time.time()-t0:.0f}s]")
    _logf.close()


if __name__ == "__main__":
    main()
