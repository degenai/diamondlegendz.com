"""PROTOCOL v1.3 — regime rescale: walk-forward EG persistence at the ~2yr timescale.

Registered in REPORT.md before running. Inherits v1 estimators (imported, not copied).
Primary: P(pass window k+1 | pass window k) vs window k+1's unconditional pass rate,
pooled over consecutive non-overlapping 504-trading-day windows from 2008-04-01.
Secondary: frozen-beta spread from window k, ADF on window k+1. alpha=0.05 frozen.
"""
import json
from itertools import combinations

import numpy as np
import pandas as pd

from coint_test import (ALPHA, OUT, adf_p, cohort_tickers, eg_best, frozen_spread,
                        load_yf_panel)

WINDOW_DAYS = 504
MIN_OBS = 400


def main():
    px = load_yf_panel()
    px = px.loc[px.index >= "2008-04-01"]
    cohort = cohort_tickers(load_yf_panel())
    idx = px.index
    n_win = len(idx) // WINDOW_DAYS
    blocks = [(idx[k * WINDOW_DAYS], idx[(k + 1) * WINDOW_DAYS - 1]) for k in range(n_win)]
    print(f"cohort {len(cohort)} tickers; {n_win} non-overlapping {WINDOW_DAYS}d windows:")
    for i, (a, b) in enumerate(blocks):
        print(f"  W{i}: {a.date()} .. {b.date()}")

    pairs = list(combinations(cohort, 2))
    # pass matrix + fits per (pair, window)
    fits = {}
    passes = np.zeros((len(pairs), n_win), dtype=bool)
    tested = np.zeros((len(pairs), n_win), dtype=bool)
    for wi, (d0, d1) in enumerate(blocks):
        wpx = px.loc[d0:d1]
        for pi, (a, b) in enumerate(pairs):
            sub = np.log(wpx[[a, b]].dropna())
            if len(sub) < MIN_OBS:
                continue
            fit = eg_best(sub[a].values, sub[b].values, a, b)
            fits[(pi, wi)] = fit
            tested[pi, wi] = True
            passes[pi, wi] = fit["p"] < ALPHA
        print(f"window {wi} done: pass rate "
              f"{passes[tested[:, wi], wi].mean():.4f} (n={int(tested[:, wi].sum())})")

    # primary: adjacent-window persistence, pooled
    per_transition = []
    pooled = {"pass_k": 0, "pass_both": 0, "n_k1_tested": 0, "n_k1_pass": 0}
    froz = {"passers": [0, 0], "failers": [0, 0]}  # [n, k] frozen-beta ADF on k+1
    for wi in range(n_win - 1):
        ok = tested[:, wi] & tested[:, wi + 1]
        pk = passes[:, wi] & ok
        p_both = pk & passes[:, wi + 1]
        uncond = passes[ok, wi + 1].mean() if ok.sum() else float("nan")
        per_transition.append({
            "transition": f"W{wi}->W{wi+1}",
            "n_pass_k": int(pk.sum()),
            "persist_rate": round(float(p_both.sum() / pk.sum()), 4) if pk.sum() else None,
            "uncond_rate_k1": round(float(uncond), 4),
        })
        pooled["pass_k"] += int(pk.sum())
        pooled["pass_both"] += int(p_both.sum())
        pooled["n_k1_tested"] += int(ok.sum())
        pooled["n_k1_pass"] += int(passes[ok, wi + 1].sum())
        # secondary: frozen-beta ADF on k+1
        d0, d1 = blocks[wi + 1]
        wpx = px.loc[d0:d1]
        for pi in np.flatnonzero(ok):
            a, b = pairs[pi]
            sub = np.log(wpx[[a, b]].dropna())
            s = frozen_spread(fits[(pi, wi)], sub[a].values, sub[b].values, a, b)
            hit = adf_p(s) < ALPHA
            grp = "passers" if passes[pi, wi] else "failers"
            froz[grp][0] += 1
            froz[grp][1] += int(hit)

    results = {
        "windows": [f"{a.date()}..{b.date()}" for a, b in blocks],
        "per_transition": per_transition,
        "PRIMARY_pooled_persistence": {
            "P(pass k+1 | pass k)": round(pooled["pass_both"] / pooled["pass_k"], 4),
            "unconditional pass rate": round(pooled["n_k1_pass"] / pooled["n_k1_tested"], 4),
            "n_pass_k": pooled["pass_k"],
        },
        "SECONDARY_frozen_beta_adf_k1": {
            g: {"n": n, "k": k, "rate": round(k / n, 4) if n else None}
            for g, (n, k) in froz.items()
        },
    }
    (OUT / "v13_results.json").write_text(json.dumps(results, indent=2))
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
