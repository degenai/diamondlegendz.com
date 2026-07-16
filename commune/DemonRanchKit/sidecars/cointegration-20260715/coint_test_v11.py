"""PROTOCOL v1.1 — commodity extension (pre-registered in REPORT.md before v1 results were read).

Inherits v1's frozen estimators/thresholds exactly (imported, not copied). 2012 cohort,
A' = 2012-02-01..2019-12-31, B unchanged. Strata: all pairs / commodity-commodity /
energy-x-agriculture (the named-linkage hypothesis).
"""
import json
from pathlib import Path

import pandas as pd

from coint_test import (ALPHA, COVERAGE_MIN, OUT, WIN_B, load_yf_panel, pair_run,
                        rates, window)

EXTRA = ["WEAT", "CORN", "SOYB", "CANE", "BNO", "UGA", "DBE", "PALL", "PPLT"]
WIN_A2 = ("2012-02-01", "2019-12-31")
COHORT2_START_BY = "2012-01-15"
COHORT2_END_AFTER = "2026-06-01"
EXTRA_CACHE = OUT / "yf_commodities_2011_2026.csv"

ENERGY = {"USO", "BNO", "UGA", "DBE", "UNG", "XLE"}
AG = {"WEAT", "CORN", "SOYB", "CANE", "DBA"}
COMMODITY = ENERGY | AG | {"DBB", "CPER", "COPX", "SLV", "SIL", "PDBC", "URA", "XME",
                           "PALL", "PPLT", "GLDM"}


def load_extra() -> pd.DataFrame:
    if EXTRA_CACHE.exists():
        return pd.read_csv(EXTRA_CACHE, index_col=0, parse_dates=True)
    import yfinance as yf
    px = yf.download(EXTRA, start="2011-01-01", end="2026-06-30",
                     auto_adjust=True, progress=False)["Close"].sort_index()
    px.to_csv(EXTRA_CACHE)
    return px


def cohort_2012(px: pd.DataFrame) -> list:
    keep = []
    for t in px.columns:
        s = px[t].dropna()
        if s.empty or str(s.index[0].date()) > COHORT2_START_BY:
            continue
        if str(s.index[-1].date()) < COHORT2_END_AFTER:
            continue
        ok = True
        for win in (WIN_A2, WIN_B):
            w = window(px, win)
            if w[t].notna().sum() < COVERAGE_MIN * len(w):
                ok = False
                break
        if ok:
            keep.append(t)
    return sorted(keep)


def stratum(df: pd.DataFrame, mask) -> dict:
    sub = df[mask]
    return rates(sub) if len(sub) else {"n_pairs": 0}


def main():
    px = load_yf_panel().join(load_extra(), how="outer").sort_index()
    cohort = cohort_2012(px)
    comm = sorted(set(cohort) & COMMODITY)
    print(f"2012 cohort: {len(cohort)} tickers; commodity members: {comm}")
    print(f"teucrium singles in cohort: {[t for t in EXTRA if t in cohort]}")

    results = {"cohort_2012": cohort, "commodity_members": comm,
               "protocol": "v1.1 — see REPORT.md; inherits v1 thresholds frozen"}

    frames = []
    for fit_win, test_win, tag in ((WIN_A2, WIN_B, "fitA2_testB"), (WIN_B, WIN_A2, "fitB_testA2")):
        df = pair_run(px, cohort, fit_win, test_win, tag)
        a, b = zip(*(p.split("/") for p in df["pair"]))
        df["leg_a"], df["leg_b"] = a, b
        df["comm_pair"] = df.leg_a.isin(COMMODITY) & df.leg_b.isin(COMMODITY)
        df["energy_ag"] = (df.leg_a.isin(ENERGY) & df.leg_b.isin(AG)) | \
                          (df.leg_a.isin(AG) & df.leg_b.isin(ENERGY))
        frames.append(df)
        results[f"all_pairs_{tag}"] = rates(df)
        results[f"commodity_pairs_{tag}"] = stratum(df, df.comm_pair)
        results[f"energy_x_ag_{tag}"] = stratum(df, df.energy_ag)

    pairs = pd.concat(frames, ignore_index=True)
    pairs.to_csv(OUT / "v11_pairs_results.csv", index=False)
    (OUT / "v11_results.json").write_text(json.dumps(results, indent=2))
    print(json.dumps({k: v for k, v in results.items() if k != "cohort_2012"}, indent=2))

    ea = pairs[pairs.energy_ag].drop(columns=["fortress_pair", "leg_a", "leg_b", "comm_pair", "energy_ag"])
    print("\nenergy x agriculture pairs (the OIL/WHEAT stratum):")
    print(ea.to_string(index=False))


if __name__ == "__main__":
    main()
