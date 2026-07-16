"""RUMBLE BATCH 2 — declared in RUMBLE.md before computation. Pure statistics on
batch1_pairs.csv (no new sensor columns; v1 entrants are re-declared directions/belts
of existing columns). R1: medians/counts only.

Reliability-belt direction convention for incumbents (γ, TC-126, Breath, DD-γ v1):
same sign as their feast declaration, noted as convention in results.
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import spearmanr

HERE = Path(__file__).parent
df = pd.read_csv(HERE.parent / "rumble_batch1" / "batch1_pairs.csv")
df = df[df.eligible_fwd].copy()
df["win"] = (df.target_ta_per_yr > 0).astype(int)
YEARS = sorted(df.year.unique())
assert YEARS == list(range(2012, 2019)), YEARS

# entrant: (column, transform, feast_dir, reliability_dir, lineage)
CONT = {
    "gamma_126d (incumbent)":      ("gamma_126d", 1, +1, +1, "v0 survivor"),
    "TC-126 (survivor)":           ("tc_126", 1, +1, +1, "v0 survivor"),
    "Breath (survivor)":           ("breath_252", 1, +1, +1, "v0 survivor"),
    "Anti-Kinship (v1 of Factor-Kinship)": ("factor_kinship_252", -1, +1, -1, "sign-flip of v0"),
    "Kinship-Reliability (v1 of Factor-Kinship)": ("factor_kinship_252", 1, None, +1, "weight-class move of v0"),
    "DD-gamma v1 (sign-accepted)": ("ddgamma_ratio", 1, +1, +1, "sign-flip of v0, era caveat"),
}


def yearly_rhos(col, transform, target):
    out = []
    for y in YEARS:
        sub = df[df.year == y]
        r, _ = spearmanr(transform * sub[col], sub[target])
        out.append(float(r))
    return out


def belt(rhos, direction):
    med = float(np.median(rhos))
    pos = int(sum(1 for r in rhos if np.sign(r) == direction))
    verdict = "PASS" if (np.sign(med) == direction and pos >= 4) else "FAIL"
    return {"median_rho": round(med, 4), "correct_sign_years": f"{pos}/7", "verdict": verdict}


def corpse_precision(col, transform, feast_dir):
    """Worst decile per predicted direction vs pooled bottom-decile forward TA."""
    s = transform * df[col]
    worst = s <= s.quantile(0.1) if feast_dir == +1 else s >= s.quantile(0.9)
    bottom = df.target_ta_per_yr <= df.target_ta_per_yr.quantile(0.1)
    n = int(worst.sum())
    return {"precision": round(float((worst & bottom).sum() / n), 4) if n else None, "n_flagged": n, "base": 0.1}


results = {"arena": "sandbox 2012-2018, 7 cross-sections, from batch1_pairs.csv", "entrants": {}}
for name, (col, tr, f_dir, r_dir, lineage) in CONT.items():
    e = {"lineage": lineage}
    if f_dir is not None:
        e["feast"] = belt(yearly_rhos(col, tr, "target_ta_per_yr"), f_dir)
        e["corpse"] = corpse_precision(col, tr, f_dir)
    if r_dir is not None:
        e["reliability"] = belt(yearly_rhos(col, tr, "win"), r_dir)
    results["entrants"][name] = e

# binary league entrants: group gaps per year
cross_feast, same_rel = [], []
for y in YEARS:
    sub = df[df.year == y]
    same, cross = sub[sub.same_league == 1], sub[sub.same_league == 0]
    cross_feast.append(float(cross.target_ta_per_yr.median() - same.target_ta_per_yr.median()))
    same_rel.append(float(same.win.mean() - cross.win.mean()))

results["entrants"]["Cross-League (v1 of Same-League)"] = {
    "lineage": "sign-flip of v0",
    "feast_gap_median (cross minus same, TA/yr)": round(float(np.median(cross_feast)), 4),
    "correct_sign_years": f"{sum(1 for g in cross_feast if g > 0)}/7",
    "verdict": "PASS" if (np.median(cross_feast) > 0 and sum(g > 0 for g in cross_feast) >= 4) else "FAIL",
}
results["entrants"]["League-Reliability (v1 of Same-League)"] = {
    "lineage": "weight-class move of v0",
    "reliability_gap_median (same minus cross, win-rate)": round(float(np.median(same_rel)), 4),
    "correct_sign_years": f"{sum(1 for g in same_rel if g > 0)}/7",
    "verdict": "PASS" if (np.median(same_rel) > 0 and sum(g > 0 for g in same_rel) >= 4) else "FAIL",
}

(HERE / "batch2_results.json").write_text(json.dumps(results, indent=2))
print(json.dumps(results, indent=2))
