"""COMMODITY ROUND-ROBIN CENSUS — descriptive, NOT a selection procedure.

For ALL 190 commodity-commodity pairs from the 20-ticker set, on two windows,
record what the demon (equal-weight two-leg, 5% band, repo costs) actually DOES,
plus the structural descriptors (gamma, eta, drift gap, breath, drawdowns, and
whether the §1.4 starvation rule WOULD have bound). One row per pair-window.

This documents behavior. It selects nothing. Rankings are sorted tables only.

R4: engine_v2.simulate_batch imported read-only. No repo file is modified.
R10: one estimator per quantity, copied from the cited committed scripts:
  * actual-path trade-added %/yr  -> the_2x2.py:31-33,46
        f = simulate_batch(px[None], [1/S]*S, {threshold_pct,band=.05}, dates, RR,
                           order_floor=1, capital=1000, exec_mode="chunked",
                           quantum_bps=10)
        hold = 1000*(px[-1]/px[0]).mean();  ta_tot=(f[0]/hold-1)*100
        ta_yr = log1p(ta_tot/100)/yrs*100
  * gamma (annualized spread variance) -> harvest.py:46  var(Ra-Rb,ddof=1)*252
  * eta                                -> harvest.py:45-54 realized_prem/(gamma/8)
        g[t]=log(P[-1]/P[0])/T ; mean_g=(gA+gB)/2 ; g_dem=log(f/1000)/T
        realized_prem=g_dem-mean_g ; theory_prem=gamma/8 ; eta=realized/theory
  * drift gap |gA-gB|                  -> harvest.py:26 g convention
  * spread zero-crossings/yr (BREATH)  -> demon-native unit-hedge spread
        s = log(Pa) - log(Pb), demeaned by its OWN window mean (the census
        window is self-contained, so "window mean" is the coint-protocol
        "OOS mean" analog); count sign changes of (s - mean(s)); /yrs.
  * per-leg max drawdown               -> min(P/cummax - 1) within the window
  * §1.4 starvation bind               -> either leg min(P/cummax-1) <= -0.80
        (FABLE_BRIEF_20260715 §1.4: "stop buying below >80% off running high")
  * days-below-threshold               -> # days any leg is <= -80% off its
        running high (union across the two legs)

Costs: configs/costs.default.json, exactly as every adversarial script builds RR.
Prices: cached yahoo auto-adjusted close (yf_panel_2008_2026.csv joined with
        yf_commodities_2011_2026.csv). Single source, no network.
"""
import os, sys, itertools, json
from pathlib import Path
for _v in ("OMP_NUM_THREADS", "MKL_NUM_THREADS", "OPENBLAS_NUM_THREADS", "NUMEXPR_NUM_THREADS"):
    os.environ.setdefault(_v, "1")
import numpy as np
import pandas as pd

ROOT = Path(os.environ.get("DEMON_RANCH_ROOT", Path(__file__).resolve().parents[2]))
SIDE = ROOT / "sidecars/commodity-roundrobin-20260715"
COINT = ROOT / "sidecars/cointegration-20260715"
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "sidecars/demon-atlas-20260709"))
from engine_v2 import simulate_batch
from demon_ranch.backtest_duos import load_json

TICKERS = ["BNO", "CANE", "COPX", "CORN", "CPER", "DBA", "DBB", "DBE", "PALL",
           "PPLT", "SIL", "SLV", "SOYB", "UGA", "UNG", "URA", "USO", "WEAT",
           "XLE", "XME"]
# energy x agriculture stratum = the v1.1 30-pair stratum (6 energy x 5 ag)
ENERGY = {"BNO", "UGA", "USO", "UNG", "DBE", "XLE"}
AG = {"CANE", "CORN", "SOYB", "WEAT", "DBA"}
OIL = {"BNO", "USO"}  # operator's literal "oil" legs (brent, WTI)

WINDOWS = {"2012-2019": ("2012-02-01", "2019-12-31"),
           "2020-2026": ("2020-01-02", "2026-06-29")}
MIN_DAYS = 500
POL = {"type": "threshold_pct", "band": 0.05}
costs = load_json(ROOT / "configs/costs.default.json")


def rr_for(syms):
    return np.array([(float(costs.get("spread_bps", {}).get(t, 0.0))
                      + float(costs.get("slippage_bps", 0.0))) / 1e4 for t in syms])


def load_panel():
    a = pd.read_csv(COINT / "yf_panel_2008_2026.csv", parse_dates=["Date"]).set_index("Date")
    b = pd.read_csv(COINT / "yf_commodities_2011_2026.csv", parse_dates=["Date"]).set_index("Date")
    have_a = [t for t in TICKERS if t in a.columns]
    have_b = [t for t in TICKERS if t in b.columns]
    df = pd.concat([a[have_a], b[have_b]], axis=1).sort_index()
    missing = [t for t in TICKERS if t not in df.columns]
    if missing:
        raise SystemExit(f"tickers missing from both panels: {missing}")
    return df


def leg_drawdown(p):
    """min(P/cummax - 1) within the series, and the count of days <= -0.80."""
    cummax = np.maximum.accumulate(p)
    dd_path = p / cummax - 1.0
    return float(dd_path.min()), dd_path


def census_row(win, ta, tb, pa, pb, dates):
    S = 2
    px = np.column_stack([pa, pb])          # [T, 2]
    n = len(px)
    yrs = (n - 1) / 252.0
    RR = rr_for([ta, tb])

    # --- actual-path trade-added %/yr (the_2x2.py:31-33,46) ---
    f, dd, rb = simulate_batch(px[None, :, :], [1.0 / S] * S, POL, dates, RR,
                               order_floor=1.0, capital=1000.0,
                               exec_mode="chunked", quantum_bps=10.0)
    hold = 1000.0 * (px[-1] / px[0]).mean()
    ta_tot = (f[0] / hold - 1.0) * 100.0
    ta_yr = float(np.log1p(ta_tot / 100.0) / yrs * 100.0)

    # --- gamma, eta, drift gap (harvest.py) ---
    Ra = pa[1:] / pa[:-1] - 1.0
    Rb = pb[1:] / pb[:-1] - 1.0
    gamma = float(np.var(Ra - Rb, ddof=1) * 252.0)
    gA = float(np.log(pa[-1] / pa[0]) / yrs)
    gB = float(np.log(pb[-1] / pb[0]) / yrs)
    drift_gap = abs(gA - gB)
    g_dem = float(np.log(f[0] / 1000.0) / yrs)
    mean_g = (gA + gB) / 2.0
    theory_prem = gamma / 8.0
    eta = float((g_dem - mean_g) / theory_prem) if theory_prem > 1e-9 else float("nan")

    # --- breath: zero-crossings/yr of the unit-hedge spread about its window mean ---
    s = np.log(pa) - np.log(pb)
    sd = s - s.mean()
    crossings = int(np.sum(np.abs(np.diff(np.sign(sd))) == 2))
    zero_cross_yr = crossings / yrs

    # --- per-leg drawdowns + starvation bind ---
    dd_a, path_a = leg_drawdown(pa)
    dd_b, path_b = leg_drawdown(pb)
    bind = bool(dd_a <= -0.80 or dd_b <= -0.80)
    below = (path_a <= -0.80) | (path_b <= -0.80)
    days_below = int(below.sum())

    return {
        "window": win, "ticker_a": ta, "ticker_b": tb, "n_days": n,
        "yrs": round(yrs, 3), "ta_yr": round(ta_yr, 4), "ta_total": round(ta_tot, 4),
        "eta": round(eta, 4) if eta == eta else "",
        "gamma": round(gamma, 6), "drift_gap": round(drift_gap, 5),
        "zero_cross_yr": round(zero_cross_yr, 4),
        "dd_a": round(dd_a * 100, 2), "dd_b": round(dd_b * 100, 2),
        "starv_bind": int(bind), "days_below": days_below,
        "rebals": int(rb[0]),
        "has_ung": int("UNG" in (ta, tb)),
        "energy_ag": int((ta in ENERGY and tb in AG) or (ta in AG and tb in ENERGY)),
        "oil_ag": int(((ta in OIL and tb in AG) or (ta in AG and tb in OIL))),
    }


def main():
    df = load_panel()
    rows = []
    skipped = []
    pairs = list(itertools.combinations(TICKERS, 2))  # 190
    for win, (s, e) in WINDOWS.items():
        w = df.loc[s:e]
        for ta, tb in pairs:
            sub = w[[ta, tb]].dropna()
            if len(sub) < MIN_DAYS:
                skipped.append((win, ta, tb, len(sub)))
                continue
            pa = sub[ta].values.astype(np.float64)
            pb = sub[tb].values.astype(np.float64)
            dates = [d.strftime("%Y-%m-%d") for d in sub.index]
            rows.append(census_row(win, ta, tb, pa, pb, dates))

    out = pd.DataFrame(rows)
    out.to_csv(SIDE / "commodity_census.csv", index=False)
    print(f"wrote {len(out)} pair-window rows to commodity_census.csv")
    print(f"skipped {len(skipped)} pair-windows (<{MIN_DAYS} aligned days):")
    for row in skipped:
        print("   ", row)

    # -------- console summaries (medians & counts only; R1) --------
    def q(series):
        v = series.dropna().values
        return (np.median(v), np.percentile(v, 25), np.percentile(v, 75), len(v))

    print("\n=== F1  trade-added %/yr distribution by window (median [q25,q75], n) ===")
    for win in WINDOWS:
        g = out[out.window == win]
        med, q25, q75, nn = q(g.ta_yr)
        print(f"  {win}: median {med:+.3f}  [q25 {q25:+.3f}, q75 {q75:+.3f}]  n={nn}")

    print("\n=== F2  UNG-containing vs rest (trade-added/yr median, bind rate) ===")
    for win in WINDOWS:
        g = out[out.window == win]
        for lab, sel in [("UNG pairs", g.has_ung == 1), ("non-UNG", g.has_ung == 0)]:
            sub = g[sel]
            med = np.median(sub.ta_yr)
            binds = int(sub.starv_bind.sum()); nn = len(sub)
            print(f"  {win} {lab:10s}: median ta/yr {med:+.3f}  bind {binds}/{nn} "
                  f"({100*binds/nn:.1f}%)")

    print("\n=== F3  starvation bind rate in this stratum vs 2.4% atlas base ===")
    tot_b = int(out.starv_bind.sum()); tot_n = len(out)
    print(f"  overall: {tot_b}/{tot_n} pair-windows bind = {100*tot_b/tot_n:.1f}% "
          f"(atlas base 2.4%)")
    for win in WINDOWS:
        g = out[out.window == win]
        b = int(g.starv_bind.sum()); nn = len(g)
        print(f"    {win}: {b}/{nn} = {100*b/nn:.1f}%")

    print("\n=== F4  high-gamma vs low-gamma (median split within window) ===")
    for win in WINDOWS:
        g = out[out.window == win].copy()
        med_g = g.gamma.median()
        hi = g[g.gamma >= med_g]; lo = g[g.gamma < med_g]
        print(f"  {win}: gamma median split @ {med_g:.4f}")
        for lab, sub in [("HIGH-gamma", hi), ("LOW-gamma", lo)]:
            med_ta = np.median(sub.ta_yr)
            binds = int(sub.starv_bind.sum()); nn = len(sub)
            med_eta = np.nanmedian(pd.to_numeric(sub.eta, errors="coerce"))
            print(f"    {lab}: median ta/yr {med_ta:+.3f}  median eta {med_eta:+.3f}  "
                  f"bind {binds}/{nn}")

    print("\n=== F5  energy x agriculture stratum (30 pairs/window) — full table ===")
    for win in WINDOWS:
        g = out[(out.window == win) & (out.energy_ag == 1)].sort_values("ta_yr")
        print(f"\n  --- {win}  (n={len(g)}) ---")
        print(f"  {'pair':<12} {'ta/yr':>8} {'eta':>7} {'gamma':>7} {'drift':>7} "
              f"{'cross/yr':>8} {'dd_a':>7} {'dd_b':>7} {'bind':>4}")
        for _, r in g.iterrows():
            eta_s = f"{r.eta:+.2f}" if r.eta != "" else "  nan"
            print(f"  {r.ticker_a+'/'+r.ticker_b:<12} {r.ta_yr:>+8.2f} {eta_s:>7} "
                  f"{r.gamma:>7.3f} {r.drift_gap:>7.3f} {r.zero_cross_yr:>8.2f} "
                  f"{r.dd_a:>7.1f} {r.dd_b:>7.1f} {int(r.starv_bind):>4}")
        med = np.median(g.ta_yr)
        print(f"  energy x ag median ta/yr: {med:+.3f}   "
              f"pairs with ta/yr>0: {int((g.ta_yr>0).sum())}/{len(g)}")

    # machine summary
    summary = {
        "n_rows": len(out),
        "n_skipped": len(skipped),
        "by_window": {win: {
            "n": int((out.window == win).sum()),
            "ta_yr_median": float(np.median(out[out.window == win].ta_yr)),
            "ta_yr_q25": float(np.percentile(out[out.window == win].ta_yr, 25)),
            "ta_yr_q75": float(np.percentile(out[out.window == win].ta_yr, 75)),
            "bind": int(out[out.window == win].starv_bind.sum()),
        } for win in WINDOWS},
        "bind_overall_pct": round(100 * tot_b / tot_n, 2),
    }
    (SIDE / "census_summary.json").write_text(json.dumps(summary, indent=2))
    print("\nwrote census_summary.json")


if __name__ == "__main__":
    main()
