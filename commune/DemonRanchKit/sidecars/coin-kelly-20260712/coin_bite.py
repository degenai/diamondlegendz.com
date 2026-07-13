"""COIN LAB II — the BITE axis, at noise-killing resolution.

Alex's clarification (2026-07-12): the earlier study swept the BAND (when to
trade); this sweeps the BITE (how much to trade). Microbite doctrine in the
toy: when the coin's weight drifts past a trigger, move only `bite` fraction
of the book toward target (capped at the actual delta). Full-correction
configs re-run alongside at higher worlds to shrink the median noise.

Coin: x1.05 / x(1/1.05). w = 0.50. Epoch 1,530 flips. Cost 0.15% x notional
(both sides). Worlds: 30,000 (median SE ~ +/-$6 vs +/-$20 at 3k). Paired
paths across all configs. Bootstrap CI on medians reported.

Run:  python sidecars/coin-kelly-20260712/coin_bite.py
"""

import json
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
T, U, COST, W = 1530, 0.05, 0.0015, 30000
TARGET = 0.5

rng = np.random.default_rng(20260712)
heads = rng.random((W, T)) < 0.5
mults = np.where(heads, 1 + U, 1 / (1 + U))
parked = 1000.0 * np.exp(np.log(1 + U) * (2 * heads.sum(axis=1) - T))

def run(policy, band=0.0, bite=1.0, trigger=0.0):
    x = np.full(W, 1000.0 * TARGET)
    c = np.full(W, 1000.0 * (1 - TARGET))
    trades = np.zeros(W)
    turnover = np.zeros(W)
    for t in range(T):
        x = x * mults[:, t]
        tot = x + c
        drift = np.abs(x / tot - TARGET)
        m = drift > (band if policy == "full" else trigger)
        if m.any():
            delta = np.abs(x[m] - TARGET * tot[m])
            notional = delta if policy == "full" else np.minimum(delta, bite * tot[m])
            cost = 2 * notional * COST
            sign = np.sign(x[m] - TARGET * tot[m])
            x2 = x[m] - sign * notional
            c2 = c[m] + sign * notional - cost
            x[m] = x2; c[m] = c2
            trades[m] += 1
            turnover[m] += notional
    finals = x + c
    med = float(np.median(finals))
    # bootstrap CI on the median (200 resamples)
    idx = np.random.default_rng(7).integers(0, W, (200, W))
    boots = np.median(finals[idx], axis=1)
    lo, hi = float(np.percentile(boots, 2.5)), float(np.percentile(boots, 97.5))
    return dict(policy=policy, band=band, bite=bite, trigger=trigger, med=med,
                ci=[round(lo), round(hi)],
                p_beat=float((finals > parked).mean()),
                trades=float(np.median(trades)), turnover=float(np.median(turnover)))

results = []
print("=== FULL CORRECTION (refined band grid, 30k worlds) ===")
for b in [0.0, 0.02, 0.04, 0.06, 0.08, 0.10, 0.12, 0.15]:
    r = run("full", band=b)
    results.append(r)
    print(f"  band {b:5.2f}: median ${r['med']:7,.0f} CI[{r['ci'][0]:,}-{r['ci'][1]:,}] "
          f"P(beat) {r['p_beat']:.3f} trades {r['trades']:5.0f} turnover ${r['turnover']:8,.0f}", flush=True)

print("\n=== MICROBITE (bite = fraction of book per flip, at three triggers) ===")
for trig in [0.0, 0.02, 0.05]:
    for bite in [0.005, 0.01, 0.02, 0.05, 0.10]:
        r = run("bite", bite=bite, trigger=trig)
        results.append(r)
        print(f"  trig {trig:4.2f} bite {bite:5.3f}: median ${r['med']:7,.0f} CI[{r['ci'][0]:,}-{r['ci'][1]:,}] "
              f"P(beat) {r['p_beat']:.3f} trades {r['trades']:5.0f} turnover ${r['turnover']:8,.0f}", flush=True)

top = sorted(results, key=lambda r: -r["med"])[:6]
print("\n=== TOP 6 OVERALL ===")
for r in top:
    tag = f"band {r['band']}" if r["policy"] == "full" else f"trig {r['trigger']} bite {r['bite']}"
    print(f"  {r['policy']:4s} {tag:18s} median ${r['med']:,.0f} CI[{r['ci'][0]:,}-{r['ci'][1]:,}] trades {r['trades']:.0f}")

(HERE / "coin_bite_results.json").write_text(json.dumps(results, indent=0), encoding="utf-8")
print("\nsaved: coin_bite_results.json")
