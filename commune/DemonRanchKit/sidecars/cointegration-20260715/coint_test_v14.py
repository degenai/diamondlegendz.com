"""PROTOCOL v1.4 — instrument swap: Lo-MacKinlay variance ratio on v1's frozen spreads.

Registered in REPORT.md before running. Primary: does IS VR(252) mean-reversion
(robust z < -1.645) predict OOS VR(252) mean-reversion above the failer base rate,
both directions, windows A/B as v1.
"""
import json
import math
from itertools import combinations

import numpy as np

from coint_test import (FORTRESS, OUT, WIN_A, WIN_B, cohort_tickers, eg_best,
                        frozen_spread, load_yf_panel, window)

Z_CRIT = -1.645
HORIZONS = [5, 21, 63, 126, 252]


def vr_stat(ds: np.ndarray, q: int):
    """Lo-MacKinlay VR with overlapping sums, bias correction, robust z."""
    n = len(ds)
    if n < 3 * q:
        return None, None
    mu = ds.mean()
    var1 = np.sum((ds - mu) ** 2) / (n - 1)
    if var1 <= 0:
        return None, None
    sums = np.convolve(ds, np.ones(q), mode="valid") - q * mu
    # Lo-MacKinlay: m already carries the q factor — VR = varq/var1, NOT varq/(q*var1)
    m = q * (n - q + 1) * (1 - q / n)
    varq = np.sum(sums ** 2) / m
    vr = varq / var1
    dsq = (ds - mu) ** 2
    denom = np.sum(dsq) ** 2
    theta = 0.0
    for j in range(1, q):
        dj = np.sum(dsq[j:] * dsq[:-j]) * n / denom
        theta += (2 * (q - j) / q) ** 2 * dj
    # z* = sqrt(n) * (VR - 1) / sqrt(theta)  (heteroskedasticity-robust)
    z = math.sqrt(n) * (vr - 1) / math.sqrt(theta) if theta > 0 else None
    return float(vr), (float(z) if z is not None else None)


def main():
    px = load_yf_panel()
    cohort = cohort_tickers(px)
    pairs = list(combinations(cohort, 2))
    results = {}
    for fit_win, test_win, tag in ((WIN_A, WIN_B, "fitA_testB"), (WIN_B, WIN_A, "fitB_testA")):
        fp_all, tp_all = window(px, fit_win), window(px, test_win)
        grp = {"passers": [0, 0], "failers": [0, 0]}
        rows = []
        for a, b in pairs:
            fp = np.log(fp_all[[a, b]].dropna())
            tp = np.log(tp_all[[a, b]].dropna())
            if len(fp) < 500 or len(tp) < 500:
                continue
            fit = eg_best(fp[a].values, fp[b].values, a, b)
            s_is = frozen_spread(fit, fp[a].values, fp[b].values, a, b)
            s_oos = frozen_spread(fit, tp[a].values, tp[b].values, a, b)
            vr_is, z_is = vr_stat(np.diff(s_is), 252)
            vr_oos, z_oos = vr_stat(np.diff(s_oos), 252)
            if z_is is None or z_oos is None:
                continue
            is_mr = z_is < Z_CRIT
            oos_mr = z_oos < Z_CRIT
            g = "passers" if is_mr else "failers"
            grp[g][0] += 1
            grp[g][1] += int(oos_mr)
            rows.append({"pair": f"{a}/{b}", "vr_is": round(vr_is, 4), "z_is": round(z_is, 3),
                         "vr_oos": round(vr_oos, 4), "z_oos": round(z_oos, 3)})
        results[tag] = {
            "n_pairs": sum(v[0] for v in grp.values()),
            "IS_mr_rate": round(grp["passers"][0] / max(1, sum(v[0] for v in grp.values())), 4),
            "OOS_mr_among_IS_mr": {"n": grp["passers"][0], "k": grp["passers"][1],
                                   "rate": round(grp["passers"][1] / grp["passers"][0], 4) if grp["passers"][0] else None},
            "OOS_mr_among_IS_not": {"n": grp["failers"][0], "k": grp["failers"][1],
                                    "rate": round(grp["failers"][1] / grp["failers"][0], 4) if grp["failers"][0] else None},
        }
        import pandas as pd
        pd.DataFrame(rows).to_csv(OUT / f"v14_pairs_{tag}.csv", index=False)

    # descriptive: fortress frozen Johansen vector (fit A, rank 2 there; B is rank 0)
    from statsmodels.tsa.vector_ar.vecm import coint_johansen
    fp = np.log(window(px, WIN_A)[FORTRESS].dropna())
    tp = np.log(window(px, WIN_B)[FORTRESS].dropna())
    vec = coint_johansen(fp.values, det_order=0, k_ar_diff=1).evec[:, 0]
    prof = {}
    for q in HORIZONS:
        vr_i, z_i = vr_stat(np.diff(fp.values @ vec), q)
        vr_o, z_o = vr_stat(np.diff(tp.values @ vec), q)
        prof[f"q={q}"] = {"IS": [round(vr_i, 4), round(z_i, 3)],
                          "OOS": [round(vr_o, 4), round(z_o, 3)]}
    results["fortress_vector_vr_profile"] = prof

    (OUT / "v14_results.json").write_text(json.dumps(results, indent=2))
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
