"""COMPILER CALIBRATION — fitting the yardstick (research docket item 1).

Model:  measured_yield  ~=  kappa * gamma*  -  lam * D  +  c
  gamma* = compiled pairwise yield (Fernholz term)
  D      = drift-dispersion term = sum_{i<j} w_i w_j (g_i - g_j)^2
           (g = annualized log growth per leg; captures buy-and-hold's momentum
           bonus, which gamma* cannot see — the fortress residual)

Fit per policy on ALL measured pairs (861 x 3 from the Atlas, U1 median yields),
then validate OUT-OF-SAMPLE on the measured committees (fortress, metronome-7,
pentagrams, feast books). Saves coefficients to compiler_calibration.json.

Run:  python sidecars/demon-atlas-20260709/calibrate.py
"""

import itertools
import json
import statistics
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "src"))
from demon_ranch.backtest_duos import load_prices

PANEL = ROOT / "data/derived/total_return_panel_v3_2020_2026.csv"
START, END = "2020-06-01", "2026-06-29"
VAULT = HERE / "atlas_pairs_fc.jsonl"

prices = load_prices(PANEL)
symbols = sorted(prices.keys())
idx = {s: i for i, s in enumerate(symbols)}
S = len(symbols)

V = np.zeros((S, S))       # annualized spread variance
G = np.zeros((S, S, 2))    # per-pair annualized log growths (pairwise-aligned)
YRS = np.zeros((S, S))
for a, b in itertools.combinations(symbols, 2):
    common = sorted(set(prices[a]) & set(prices[b]))
    common = [d for d in common if START <= d <= END]
    pa = np.array([prices[a][d] for d in common]); pb = np.array([prices[b][d] for d in common])
    ra = pa[1:] / pa[:-1] - 1.0; rb = pb[1:] / pb[:-1] - 1.0
    yrs = (len(common) - 1) / 252.0
    i, j = idx[a], idx[b]
    V[i, j] = V[j, i] = np.var(ra - rb, ddof=1) * 252.0
    ga = np.log(pa[-1] / pa[0]) / yrs; gb = np.log(pb[-1] / pb[0]) / yrs
    G[i, j] = [ga, gb]; G[j, i] = [gb, ga]
    YRS[i, j] = YRS[j, i] = yrs

g_solo = np.zeros(S)  # per-symbol annualized log growth on its own window
for s in symbols:
    ds = sorted(d for d in prices[s] if START <= d <= END)
    p0, p1 = prices[s][ds[0]], prices[s][ds[-1]]
    g_solo[idx[s]] = np.log(p1 / p0) / ((len(ds) - 1) / 252.0)

def features(combo):
    k = len(combo); w2 = 1.0 / (k * k)
    gam = 0.0; disp = 0.0
    for a, b in itertools.combinations(combo, 2):
        i, j = idx[a], idx[b]
        gam += w2 * V[i, j]
        if k == 2:
            ga, gb = G[i, j]
        else:
            ga, gb = g_solo[i], g_solo[j]
        disp += w2 * (ga - gb) ** 2
    return 0.5 * gam, disp

# measured yields from the vault (U1 medians)
measured = {}
for line in VAULT.open(encoding="utf-8"):
    r = json.loads(line)
    if r.get("error") or r["universe"] != "U1":
        continue
    combo = tuple(r["config"].split("/"))
    if not all(c in idx for c in combo):
        continue
    yrs = YRS[idx[combo[0]], idx[combo[1]]] if len(combo) == 2 else 6.08
    ylds = [np.log(f / h) / yrs for f, h in zip(r["finals"], r["holds"]) if f > 0 and h > 0]
    if ylds:
        measured[(r["config"], r["policy"])] = float(np.median(ylds))

policies = ["threshold_4pct", "threshold_5pct", "calendar_weekly"]
cal = {}
print("=== FIT (per policy, on all measured pairs) ===")
for pol in policies:
    X, y = [], []
    for (cfg, p), m in measured.items():
        if p != pol: continue
        combo = tuple(cfg.split("/"))
        if len(combo) != 2: continue
        if abs(m) > 1.0: continue        # clip corpse-log blowups
        gam, disp = features(combo)
        X.append([gam, disp, 1.0]); y.append(m)
    X = np.array(X); y = np.array(y)
    coef, *_ = np.linalg.lstsq(X, y, rcond=None)
    pred = X @ coef
    ss = 1 - np.sum((y - pred) ** 2) / np.sum((y - y.mean()) ** 2)
    cal[pol] = {"kappa": float(coef[0]), "lambda": float(coef[1]), "c": float(coef[2]),
                "r2": float(ss), "n": int(len(y))}
    print(f"  {pol:16s} n={len(y):3d}  yield = {coef[0]:+.3f}*gamma {coef[1]:+.3f}*disp {coef[2]:+.5f}   R^2={ss:.3f}")

print()
print("=== OUT-OF-SAMPLE: committees (fit on pairs only) ===")
committees = [c for (c, p) in measured if len(c.split("/")) > 2]
seen = set()
for cfg in committees:
    if cfg in seen: continue
    seen.add(cfg)
    combo = tuple(cfg.split("/"))
    gam, disp = features(combo)
    for pol in policies:
        m = measured.get((cfg, pol))
        if m is None: continue
        k = cal[pol]
        pred = k["kappa"] * gam + k["lambda"] * disp + k["c"]
        print(f"  {cfg[:34]:34s} {pol[:10]:10s} pred {pred:+.4f}  measured {m:+.4f}  err {m-pred:+.4f}")

(HERE / "compiler_calibration.json").write_text(json.dumps(
    {"model": "yield = kappa*gamma + lambda*dispersion + c (per policy)",
     "fit_on": "all measured pairs, U1 medians, |y|<=1 clip",
     "coefficients": cal, "date": "2026-07-11"}, indent=2), encoding="utf-8")
print()
print("saved: compiler_calibration.json")
