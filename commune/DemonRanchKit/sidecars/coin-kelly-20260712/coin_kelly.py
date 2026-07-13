"""THE COIN GAME'S JUICIEST NUMBER — optimal weight & band for the codex coin.

Alex (2026-07-12): "we're assuming [50%]'s perfect. We should explore — high
resolution, our epoch length, statistics of the medians like usual."

The coin: heads x1.05, tails x(1/1.05) — symmetric multiplicative, zero
geometric drift. Epoch = 1,530 flips (the Atlas window). Partner = cash.

PHASE 1 (exact, no simulation): rebalancing every flip at weight w makes the
book's log depend only on the head count h ~ Binomial(1530, 1/2):
    log G = h*ln(1+w*u) + (1530-h)*ln(1-w*d),   u = 0.05, d = 1 - 1/1.05
Kelly: g'(w) = 0  =>  w* = (u-d)/(2ud); with d = u/(1+u) this is EXACTLY 1/2,
independent of u. The exploration maps the whole hill at 0.5% resolution.

PHASE 2 (simulated): add the operator's-chair frictions — 0.15% cost per
rebalance, threshold band b (trade only when the coin's weight drifts past
w +/- b). Map the (w, band) surface at epoch length: median final, P(beat
the parked coin), trades/epoch. The friction optimum is the real finding.

Run:  python sidecars/coin-kelly-20260712/coin_kelly.py
"""

import json
import math
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
T = 1530
U = 0.05
D = 1.0 - 1.0 / 1.05
COST = 0.0015

# ---------- PHASE 1: exact binomial statistics ----------
lg = [math.lgamma(k + 1) for k in range(T + 1)]
LOG_HALF_T = T * math.log(0.5)
logpmf = np.array([lg[T] - lg[h] - lg[T - h] + LOG_HALF_T for h in range(T + 1)])
pmf = np.exp(logpmf)
cdf = np.cumsum(pmf)
H = np.arange(T + 1)

def quantile_h(q):
    return int(np.searchsorted(cdf, q))

def stats_for_w(w):
    a, b = math.log(1 + w * U), math.log(1 - w * D)
    logG = H * a + (T - H) * b
    med = 1000.0 * math.exp(logG[765])
    q25 = 1000.0 * math.exp(logG[quantile_h(0.25)] if a >= 0 else logG[quantile_h(0.75)])
    q75 = 1000.0 * math.exp(logG[quantile_h(0.75)] if a >= 0 else logG[quantile_h(0.25)])
    parked = (2 * H - T) * math.log(1 + U)
    p_beat = float(pmf[logG > parked].sum())
    g = 0.5 * a + 0.5 * b
    return med, q25, q75, p_beat, g

print("=== PHASE 1: exact — the Kelly hill at 0.5% resolution, epoch = 1,530 flips ===")
print("w* analytic = (u-d)/(2ud) =", (U - D) / (2 * U * D), " (theorem: exactly 1/2 for this coin)")
grid = np.arange(0.0, 1.0001, 0.005)
rows = [(w, *stats_for_w(w)) for w in grid]
best = max(rows, key=lambda r: r[1])
print(f"best median on grid: w = {best[0]:.3f} -> ${best[1]:,.0f}")
print(f"{'w':>6s} {'median':>9s} {'q25':>8s} {'q75':>9s} {'P(beat parked)':>14s}")
for w in [0.10, 0.25, 0.40, 0.45, 0.50, 0.55, 0.60, 0.75, 0.90, 1.00]:
    m, q25, q75, pb, g = stats_for_w(w)
    print(f"{w:6.2f} {m:9,.0f} {q25:8,.0f} {q75:9,.0f} {pb:14.3f}")
flat = [w for w, m, *_ in rows if m >= best[1] * 0.95]
print(f"the plateau (>=95% of peak median): w in [{min(flat):.3f}, {max(flat):.3f}]  <- Law III, again")

# ---------- PHASE 2: friction surface ----------
print()
print("=== PHASE 2: simulated — 0.15%/trade + threshold bands, 3,000 worlds ===")
rng = np.random.default_rng(20260712)
W = 3000
heads = rng.random((W, T)) < 0.5
mults = np.where(heads, 1 + U, 1 / (1 + U))
parked_final = 1000.0 * np.exp(np.log(1 + U) * (2 * heads.sum(axis=1) - T))

w_grid = np.round(np.arange(0.25, 0.7501, 0.025), 3)
b_grid = [0.0, 0.01, 0.02, 0.03, 0.04, 0.05, 0.075, 0.10, 0.15, 0.20]
results = []
for w in w_grid:
    for b in b_grid:
        x = np.full(W, 1000.0 * w)
        c = np.full(W, 1000.0 * (1 - w))
        trades = np.zeros(W)
        for t in range(T):
            x = x * mults[:, t]
            tot = x + c
            drift = np.abs(x / tot - w)
            m = drift > b
            if m.any():
                delta = np.abs(x[m] - w * tot[m])
                cost = 2 * delta * COST
                tot2 = tot[m] - cost
                x[m] = w * tot2
                c[m] = (1 - w) * tot2
                trades[m] += 1
        finals = x + c
        results.append(dict(w=float(w), band=float(b),
                            med=float(np.median(finals)),
                            p_beat=float((finals > parked_final).mean()),
                            trades=float(np.median(trades))))
        print(f"  w={w:.3f} band={b:.3f} median ${np.median(finals):8,.0f}  "
              f"P(beat parked) {(finals > parked_final).mean():.3f}  trades/epoch {np.median(trades):6.0f}", flush=True)

top = sorted(results, key=lambda r: -r["med"])[:10]
print()
print("=== TOP 10 UNDER FRICTION (by median final) ===")
for r in top:
    print(f"  w={r['w']:.3f} band={r['band']:.3f} -> median ${r['med']:,.0f}, "
          f"P(beat) {r['p_beat']:.3f}, {r['trades']:.0f} trades")
w50 = [r for r in results if abs(r["w"] - 0.5) < 1e-9]
print()
print("=== THE BAND CURVE AT w = 0.50 (Law V in the toy) ===")
for r in sorted(w50, key=lambda r: r["band"]):
    print(f"  band {r['band']:.3f}: median ${r['med']:,.0f}, {r['trades']:.0f} trades/epoch")

(HERE / "coin_kelly_results.json").write_text(json.dumps(
    {"phase1_grid": [dict(w=float(w), med=m, q25=q, q75=q2, p_beat=pb, g_per_flip=g)
                     for (w, m, q, q2, pb, g) in rows],
     "phase2": results, "epoch": T, "u": U, "cost": COST}, indent=0), encoding="utf-8")
print("\nsaved: coin_kelly_results.json")
