"""VALIDATION GATE — reproduce a known committed number before trusting the engine.

Target: the fortress (DBB/EWU/EWZ/GDX/TUR), 5% band, ACTUAL PATH, 2020-2026
trade-added ~ +2.27%/yr (FABLE_BRIEF_20260715 §1.1; the_2x2.py header +2.34/2.27).

Uses the SAME engine invocation as the_2x2.py:31-33,46 and the SAME cached price
convention as the census, so passing this validates the census harness end to end.
Data source: cached yf_panel_2008_2026.csv (yahoo auto-adjusted close) — the fortress
tickers all live in that panel; no network required.
"""
import os, sys
from pathlib import Path
for _v in ("OMP_NUM_THREADS", "MKL_NUM_THREADS", "OPENBLAS_NUM_THREADS", "NUMEXPR_NUM_THREADS"):
    os.environ.setdefault(_v, "1")
import numpy as np
import pandas as pd

ROOT = Path(os.environ.get("DEMON_RANCH_ROOT", Path(__file__).resolve().parents[2]))
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "sidecars/demon-atlas-20260709"))
from engine_v2 import simulate_batch
from demon_ranch.backtest_duos import load_json

PANEL = ROOT / "sidecars/cointegration-20260715/yf_panel_2008_2026.csv"
costs = load_json(ROOT / "configs/costs.default.json")
POL = {"type": "threshold_pct", "band": 0.05}
FORT = ["DBB", "EWU", "EWZ", "GDX", "TUR"]

df = pd.read_csv(PANEL, parse_dates=["Date"]).set_index("Date")
# the_2x2 uses start="2020-01-01", end="2026-06-29" via yf.download (end exclusive).
sub = df.loc["2020-01-01":"2026-06-28", FORT].dropna()
px = sub.values
dates = [d.strftime("%Y-%m-%d") for d in sub.index]
S = len(FORT)
yrs = (len(px) - 1) / 252.0
RR = np.array([(float(costs.get("spread_bps", {}).get(t, 0.0))
                + float(costs.get("slippage_bps", 0.0))) / 1e4 for t in FORT])

f, dd, rb = simulate_batch(px[None, :, :], [1.0 / S] * S, POL, dates, RR,
                           order_floor=1.0, capital=1000.0,
                           exec_mode="chunked", quantum_bps=10.0)
hold = 1000.0 * (px[-1] / px[0]).mean()
ta_tot = (f[0] / hold - 1.0) * 100.0
ta_yr = np.log1p(ta_tot / 100.0) / yrs * 100.0

print(f"fortress 2020-2026  days={len(px)}  yrs={yrs:.2f}")
print(f"  demon ${f[0]:,.2f}  hold ${hold:,.2f}  rebals={int(rb[0])}")
print(f"  trade-added total {ta_tot:+.2f}%   per yr {ta_yr:+.2f}%/yr")
print(f"  TARGET +2.27%/yr  -> {'PASS' if abs(ta_yr - 2.27) < 0.15 else 'CHECK'}")
