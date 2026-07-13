"""THE COMPILER — pairwise compilation of committee demon yield (Fernholz).

gamma*(committee) = 1/2 * sum_{i<j} w_i w_j var(spread_ij) * 252

Yield compiles from pairs; survival does not. This tool: (1) builds the 42x42
annualized spread-variance matrix from panel v3 (pairwise-aligned windows),
(2) CALIBRATES compiled predictions against measured Atlas yields (U1 median
log(final/hold)/yrs) for known configs, (3) screens ALL C(42,5) five-node
equal-weight committees analytically and ranks them — raw, and hodl-aware.

Run:  python sidecars/demon-atlas-20260709/compiler.py
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
sys.path.insert(0, str(HERE))

from demon_ranch.backtest_duos import load_prices

PANEL = ROOT / "data/derived/total_return_panel_v3_2020_2026.csv"
START, END = "2020-06-01", "2026-06-29"
VAULT = HERE / "atlas_pairs_fc.jsonl"
MACHINE_PARTS = set(json.loads((Path(__file__).parent / "degen_blacklist.json").read_text(encoding="utf-8"))["blacklist"])

prices = load_prices(PANEL)
symbols = sorted(prices.keys())
S = len(symbols)
idx = {s: i for i, s in enumerate(symbols)}

# pairwise spread variance (annualized), pairwise-aligned windows
V = np.zeros((S, S))
for a, b in itertools.combinations(symbols, 2):
    common = sorted(set(prices[a]) & set(prices[b]))
    common = [d for d in common if START <= d <= END]
    pa = np.array([prices[a][d] for d in common])
    pb = np.array([prices[b][d] for d in common])
    ra = pa[1:] / pa[:-1] - 1.0
    rb = pb[1:] / pb[:-1] - 1.0
    V[idx[a], idx[b]] = V[idx[b], idx[a]] = np.var(ra - rb, ddof=1) * 252.0

def gamma(combo):
    k = len(combo); w2 = 1.0 / (k * k)
    return 0.5 * w2 * sum(V[idx[a], idx[b]] for a, b in itertools.combinations(combo, 2))

# ---- calibration vs measured Atlas yields ----
measured = {}
for line in VAULT.open(encoding="utf-8"):
    r = json.loads(line)
    if r.get("error") or r["universe"] != "U1" or r["policy"] != "threshold_5pct":
        continue
    yrs = 6.08
    ylds = [np.log(f / h) / yrs for f, h in zip(r["finals"], r["holds"]) if f > 0 and h > 0]
    measured[r["config"]] = statistics.median(ylds)

print("=== CALIBRATION: compiled gamma* vs measured median yield (U1, t5) ===")
cases = ["TQQQ/TLT/GLDM/GME/SGOV/VEU/F", "GDX/EWZ/SLV/XLU/XLP/PDBC/GLDM",
         "GLDM/GME", "EWZ/GDX", "GLDM/PDBC", "XLP/XLU", "ECH/EWZ", "GDX/XLU"]
for cfg in cases:
    combo = tuple(cfg.split("/"))
    if not all(c in idx for c in combo) or cfg not in measured:
        alt = "/".join(sorted(combo))
        if alt in measured: cfg2 = alt
        else:
            found = [k for k in measured if set(k.split("/")) == set(combo)]
            if not found: print(f"  {cfg:34s} (not measured)"); continue
            cfg2 = found[0]
    else:
        cfg2 = cfg
    g = gamma(combo)
    m = measured[cfg2]
    print(f"  {cfg2:34s} compiled {g:+.4f}  measured {m:+.4f}  residual {m-g:+.4f}")

# ---- the first screen: all C(42,5) order-5 committees ----
print()
print(f"=== SCREEN: all C({S},5) = {len(list(itertools.combinations(range(3),2))) and 0 or ''}", flush=True)
combos = list(itertools.combinations(range(S), 2))
best_raw, best_clean = [], []
count = 0
for combo in itertools.combinations(range(S), 5):
    g = 0.0
    for i in range(5):
        for j in range(i + 1, 5):
            g += V[combo[i], combo[j]]
    g *= 0.5 / 25.0
    count += 1
    syms5 = tuple(symbols[c] for c in combo)
    best_raw.append((g, syms5))
    if not (set(syms5) & MACHINE_PARTS):
        best_clean.append((g, syms5))
best_raw.sort(reverse=True); best_clean.sort(reverse=True)
print(f"screened {count:,} five-node committees analytically")
print()
print("TOP 5 RAW compiled yield (expect corpse-pumps — the compiler is survival-blind):")
for g, c in best_raw[:5]:
    print(f"  {g:+.4f}  {' '.join(c)}")
print()
print("TOP 10 CLEAN (machine-parts excluded):")
for g, c in best_clean[:10]:
    print(f"  {g:+.4f}  {' '.join(c)}")
print()
pent1 = ("ECH", "EWZ", "GDX", "XLP", "XLU")
pent2 = ("ECH", "EWJ", "EWZ", "GDX", "XLU")
r1 = sum(1 for g, c in best_clean if g > gamma(pent1)) + 1
r2 = sum(1 for g, c in best_clean if g > gamma(pent2)) + 1
print(f"Pentagram #1 {pent1}: compiled {gamma(pent1):+.4f}, clean-rank #{r1:,}")
print(f"Pentagram #2 {pent2}: compiled {gamma(pent2):+.4f}, clean-rank #{r2:,}")
