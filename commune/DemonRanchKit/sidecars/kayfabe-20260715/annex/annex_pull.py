"""CORPSE ANNEX data prep (declared in RUMBLE.md). Three cached pulls, exploration-era only."""
from pathlib import Path

import yfinance as yf

HERE = Path(__file__).parent

COHORT61 = ("BND DBA DBB ECH EMB EWA EWC EWD EWG EWH EWI EWJ EWK EWL EWM EWN EWP EWQ EWS "
            "EWT EWU EWW EWY EWZ EZA F FXI GDX GME HYG IEF IWM IYT LQD MSTR NVDA QQQ SHY "
            "SLV SMH THD TIP TLT TUR UNG USO VEU VNQ VTI VYM XBI XLB XLE XLF XLI XLK XLP "
            "XLU XLV XLY XME").split()
DOTCOM = ("EWA EWC EWG EWH EWJ EWK EWL EWM EWN EWP EWQ EWS EWU EWW QQQ IWM F XLB XLE XLF "
          "XLI XLK XLP XLU XLV XLY").split()
DEATH_PANEL = "RSX BBBY NKLA KOSS EXPR TMF UNG DBB GDX SOXL".split()

for name, tickers, start, end in [
    ("gfc_panel_2005_2012", COHORT61, "2005-01-01", "2012-12-31"),
    ("dotcom_panel_1996_2005", DOTCOM, "1996-01-01", "2005-12-31"),
    ("death_panel_full", DEATH_PANEL, "2005-01-01", "2026-06-30"),
]:
    out = HERE / f"{name}.csv"
    if out.exists():
        print(name, "cached")
        continue
    px = yf.download(tickers, start=start, end=end, auto_adjust=True, progress=False)["Close"]
    px = px.sort_index()
    px.to_csv(out)
    got = [t for t in tickers if t in px.columns and px[t].notna().sum() > 100]
    missing = sorted(set(tickers) - set(got))
    print(f"{name}: {len(got)}/{len(tickers)} tickers with >100 rows; missing/thin: {missing}")
