"""Pre-registered cointegration persistence test (SS0 of FABLE_BRIEF_20260715).

PROTOCOL IS IN REPORT.md AND WAS LOCKED BEFORE THIS RAN. Read it first.
Standalone sidecar: imports repo modules read-only (R4). Deterministic, no RNG.
"""
import os
for _v in ("OMP_NUM_THREADS", "MKL_NUM_THREADS", "OPENBLAS_NUM_THREADS", "NUMEXPR_NUM_THREADS"):
    os.environ.setdefault(_v, "1")

import json
import math
import sys
from itertools import combinations
from pathlib import Path

import numpy as np
import pandas as pd
import statsmodels.api as sm
from statsmodels.tsa.stattools import adfuller, coint
from statsmodels.tsa.vector_ar.vecm import coint_johansen

ROOT = Path(os.environ.get("DEMON_RANCH_ROOT", Path(__file__).resolve().parents[2]))
OUT = ROOT / "sidecars" / "cointegration-20260715"

FORTRESS = ["DBB", "EWU", "EWZ", "GDX", "TUR"]
PANEL97 = (
    "AMC ARGT BABA BITO BND COPX CPER DBA DBB ECH EIDO EMB EPOL EWA EWC EWD EWG "
    "EWH EWI EWJ EWK EWL EWM EWN EWP EWQ EWS EWT EWU EWW EWY EWZ EZA F FXI GDX "
    "GLDM GME HYG IEF INDA IWM IYT KWEB LQD MSTR MTUM NVDA PDBC PLTR QQQ QUAL "
    "SCHD SGOV SHY SIL SLV SMH SOXL SOXS SPLV SQQQ THD TIP TLT TMF TNA TQQQ TSLA "
    "TUR TZA UNG UPRO URA USMV USO UVXY VEU VLUE VNQ VNQI VTI VYM XBI XLE XLB "
    "XLF XLI XLK XLP XLRE XLU XLV XLY XME YANG YINN"
).split()

WIN_A = ("2008-04-01", "2019-12-31")
WIN_B = ("2020-01-02", "2026-06-29")
ALPHA = 0.05
COHORT_START_BY = "2008-04-15"
COHORT_END_AFTER = "2026-06-01"
COVERAGE_MIN = 0.95

YF_CACHE = OUT / "yf_panel_2008_2026.csv"
V4_PANEL = ROOT / "data" / "derived" / "total_return_panel_v4_2020_2026.csv"


# ---------- data ----------

def load_yf_panel() -> pd.DataFrame:
    if YF_CACHE.exists():
        return pd.read_csv(YF_CACHE, index_col=0, parse_dates=True)
    import yfinance as yf
    px = yf.download(PANEL97, start="2008-01-01", end="2026-06-30",
                     auto_adjust=True, progress=False)["Close"]
    px = px.sort_index()
    px.to_csv(YF_CACHE)
    return px


def load_v4_panel() -> pd.DataFrame:
    df = pd.read_csv(V4_PANEL)
    df["close"] = pd.to_numeric(df["close"], errors="coerce")
    wide = df.pivot_table(index="date", columns="ticker", values="close")
    wide.index = pd.to_datetime(wide.index)
    wide.columns = [c.upper() for c in wide.columns]
    return wide.sort_index()


def window(df: pd.DataFrame, win) -> pd.DataFrame:
    return df.loc[(df.index >= win[0]) & (df.index <= win[1])]


def cohort_tickers(px: pd.DataFrame) -> list:
    keep = []
    for t in px.columns:
        s = px[t].dropna()
        if s.empty:
            continue
        if str(s.index[0].date()) > COHORT_START_BY:
            continue
        if str(s.index[-1].date()) < COHORT_END_AFTER:
            continue
        ok = True
        for win in (WIN_A, WIN_B):
            w = window(px, win)
            if w[t].notna().sum() < COVERAGE_MIN * len(w):
                ok = False
                break
        if ok:
            keep.append(t)
    return sorted(keep)


# ---------- estimators (locked in protocol) ----------

def eg_best(ly: np.ndarray, lx: np.ndarray, ny: str, nx: str) -> dict:
    """Engle-Granger both normalizations; keep smaller p. Returns fit of chosen leg."""
    best = None
    for a, b, na, nb in ((ly, lx, ny, nx), (lx, ly, nx, ny)):
        t_stat, p, _ = coint(a, b, trend="c")
        if best is None or p < best["p"]:
            ols = sm.OLS(a, sm.add_constant(b)).fit()
            best = {"p": float(p), "t": float(t_stat), "dep": na, "indep": nb,
                    "alpha": float(ols.params[0]), "beta": float(ols.params[1])}
    return best


def frozen_spread(fit: dict, ly: np.ndarray, lx: np.ndarray, ny: str, nx: str) -> np.ndarray:
    if fit["dep"] == ny:
        return ly - fit["alpha"] - fit["beta"] * lx
    return lx - fit["alpha"] - fit["beta"] * ly


def adf_p(s: np.ndarray) -> float:
    return float(adfuller(s, regression="c", autolag="AIC")[1])


def half_life(s: np.ndarray) -> float:
    ds, s1 = np.diff(s), s[:-1]
    b = sm.OLS(ds, sm.add_constant(s1)).fit().params[1]
    return float(-math.log(2) / b) if b < 0 else float("inf")


def crossings_per_yr(s: np.ndarray, ref: float) -> float:
    d = np.sign(s - ref)
    d = d[d != 0]
    flips = int(np.sum(d[1:] != d[:-1]))
    return flips / (len(s) / 252.0)


# ---------- experiment ----------

def pair_run(px: pd.DataFrame, tickers: list, fit_win, test_win, tag: str) -> pd.DataFrame:
    rows = []
    fit_px, test_px = window(px, fit_win), window(px, test_win)
    for a, b in combinations(tickers, 2):
        fp = np.log(fit_px[[a, b]].dropna())
        tp = np.log(test_px[[a, b]].dropna())
        if len(fp) < 500 or len(tp) < 500:
            continue
        fit = eg_best(fp[a].values, fp[b].values, a, b)
        s_is = frozen_spread(fit, fp[a].values, fp[b].values, a, b)
        s_oos = frozen_spread(fit, tp[a].values, tp[b].values, a, b)
        fresh = eg_best(tp[a].values, tp[b].values, a, b)
        rows.append({
            "pair": f"{a}/{b}", "direction": tag,
            "is_p": fit["p"], "is_pass": fit["p"] < ALPHA,
            "dep": fit["dep"], "beta": fit["beta"],
            "oos_frozen_adf_p": adf_p(s_oos),
            "oos_fresh_eg_p": fresh["p"],
            "hl_is": half_life(s_is), "hl_oos": half_life(s_oos),
            "xing_oos_vs_ismean": crossings_per_yr(s_oos, float(np.mean(s_is))),
            "xing_oos_vs_oosmean": crossings_per_yr(s_oos, float(np.mean(s_oos))),
            "fortress_pair": a in FORTRESS and b in FORTRESS,
        })
    return pd.DataFrame(rows)


def johansen_run(px: pd.DataFrame, fit_win, test_win, tag: str) -> dict:
    fp = np.log(window(px, fit_win)[FORTRESS].dropna())
    tp = np.log(window(px, test_win)[FORTRESS].dropna())
    res = coint_johansen(fp.values, det_order=0, k_ar_diff=1)
    rank = 0
    for r in range(len(res.lr1)):
        if res.lr1[r] > res.cvt[r, 1]:
            rank = r + 1
        else:
            break
    out = {
        "direction": tag, "n_fit": len(fp), "n_test": len(tp),
        "trace_stats": [float(x) for x in res.lr1],
        "crit_95": [float(x) for x in res.cvt[:, 1]],
        "rank_at_95": rank,
    }
    if rank >= 1:
        vec = res.evec[:, 0]
        vec = vec / vec[0]
        s_is, s_oos = fp.values @ vec, tp.values @ vec
        out.update({
            "coint_vector": {t: float(v) for t, v in zip(FORTRESS, vec)},
            "oos_frozen_adf_p": adf_p(s_oos),
            "hl_is": half_life(s_is), "hl_oos": half_life(s_oos),
            "xing_oos_vs_ismean": crossings_per_yr(s_oos, float(np.mean(s_is))),
        })
    return out


def rates(df: pd.DataFrame) -> dict:
    def rate(sub, col):
        n = len(sub)
        k = int((sub[col] < ALPHA).sum())
        return {"n": n, "k": k, "rate": round(k / n, 4) if n else None}
    passers, failers = df[df.is_pass], df[~df.is_pass]
    return {
        "n_pairs": len(df),
        "is_pass": {"n": len(passers), "expected_by_chance": round(len(df) * ALPHA, 1)},
        "oos_frozen_adf": {"among_is_passers": rate(passers, "oos_frozen_adf_p"),
                           "among_is_failers": rate(failers, "oos_frozen_adf_p")},
        "oos_fresh_eg_CLEGG_COMPARABLE": {"among_is_passers": rate(passers, "oos_fresh_eg_p"),
                                          "among_is_failers": rate(failers, "oos_fresh_eg_p")},
        "hl_oos_median_passers": round(float(passers.hl_oos.replace(np.inf, np.nan).median()), 1) if len(passers) else None,
        "hl_oos_median_failers": round(float(failers.hl_oos.replace(np.inf, np.nan).median()), 1) if len(failers) else None,
    }


def main():
    px = load_yf_panel()
    cohort = cohort_tickers(px)
    missing_fortress = [t for t in FORTRESS if t not in cohort]
    print(f"cohort: {len(cohort)} tickers; fortress missing from cohort: {missing_fortress}")

    results = {"cohort": cohort, "protocol": "see REPORT.md — locked before run"}

    # fortress basket (Johansen), both directions
    results["johansen_fortress"] = [
        johansen_run(px, WIN_A, WIN_B, "fitA_testB"),
        johansen_run(px, WIN_B, WIN_A, "fitB_testA"),
    ]

    # pairs, both directions
    ab = pair_run(px, cohort, WIN_A, WIN_B, "fitA_testB")
    ba = pair_run(px, cohort, WIN_B, WIN_A, "fitB_testA")
    pairs = pd.concat([ab, ba], ignore_index=True)
    pairs.to_csv(OUT / "pairs_results.csv", index=False)

    results["pairs_fitA_testB"] = rates(ab)
    results["pairs_fitB_testA"] = rates(ba)
    results["fortress_pairs"] = pairs[pairs.fortress_pair].drop(columns="fortress_pair").to_dict("records")

    # source check: window B, yfinance vs v4 panel, same pairs, same estimator (paired)
    v4 = load_v4_panel()
    shared = [t for t in cohort if t in v4.columns]
    check_rows = []
    fit_b_yf = window(px, WIN_B)
    fit_b_v4 = window(v4, WIN_B)
    for a, b in combinations(shared, 2):
        yf_w = np.log(fit_b_yf[[a, b]].dropna())
        v4_w = np.log(fit_b_v4[[a, b]].dropna())
        if len(yf_w) < 500 or len(v4_w) < 500:
            continue
        p_yf = eg_best(yf_w[a].values, yf_w[b].values, a, b)["p"]
        p_v4 = eg_best(v4_w[a].values, v4_w[b].values, a, b)["p"]
        check_rows.append({"pair": f"{a}/{b}", "p_yf": p_yf, "p_v4": p_v4})
    chk = pd.DataFrame(check_rows)
    if len(chk):
        agree = float(((chk.p_yf < ALPHA) == (chk.p_v4 < ALPHA)).mean())
        rho = float(chk[["p_yf", "p_v4"]].corr(method="spearman").iloc[0, 1])
        results["source_check_winB"] = {"n_pairs": len(chk), "pass_agreement": round(agree, 4),
                                        "spearman_p_corr": round(rho, 4)}
        chk.to_csv(OUT / "source_check_winB.csv", index=False)

    (OUT / "results.json").write_text(json.dumps(results, indent=2))
    print(json.dumps({k: v for k, v in results.items() if k != "fortress_pairs"}, indent=2))
    print("\nfortress pairs:")
    print(pairs[pairs.fortress_pair].to_string(index=False))


if __name__ == "__main__":
    main()
