"""Docket #83 Roster Overlap -- Phase 0 (classify) + Phase 1 (current holdings census).

DESCRIPTIVE CENSUS -- NOT A SELECTION.

Fetches CURRENT holdings for every equity/bond-basket fund in PANEL97, normalizes to
{fund, asof_date, cusip, isin, sedol, ticker, figi, name, weight}, drops cash/FX/derivative
lines, renormalizes weights to sum to 1 per fund.  Raw payloads cached to raw/.

NOTE ON BUILD SPEC: the intended build spec (SCOUT_holdings_data_20260715.md) was delivered
EMPTY (0 bytes).  Fetch routing below was reverse-engineered live from issuer endpoints.

Working fetch methods (verified 2026-07-15):
  - iShares (41): BlackRock varnish product-data API (etf-scraper's .ajax path is dead -- the
    old endpoint now returns the Astro SPA page).  Column-oriented JSON, cusip+isin+sedol.
  - SSGA/SPDR (12): etf-scraper (still works).  name+ticker+cusip+sedol.
  - Vanguard (6): investor.vanguard.com portfolio-holding API.  ticker+isin+cusip+sedol.
  - Global X (4): assets.globalxetfs.com full-holdings CSV.  ticker+sedol (no cusip/isin).
  - KraneShares (1): kraneshares.com dated holdings CSV.  ticker+identifier.
  - VanEck (2): vaneck.com xlsx download.  ticker+FIGI (no cusip/isin/sedol).
  - IVV aux (S&P 500 basket, for UPRO look-through): iShares API.

Blocked from this host (recorded as fetch_failures):
  - Invesco QQQ/SPLV: whole domain returns HTTP 406 (WAF IP block).  QQQ recovered as a
    PARTIAL top-25 roster via stockanalysis.com (flagged).  SPLV -> fetch_failure.
  - Schwab SCHD: HTTP 403 (Akamai).  -> fetch_failure.
"""
import io
import json
import time
import csv
from pathlib import Path

import pandas as pd
import requests

HERE = Path(__file__).resolve().parent
RAW = HERE / "raw"
RAW.mkdir(exist_ok=True)

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
HDRS = {"User-Agent": UA, "Accept": "*/*", "Accept-Language": "en-US,en;q=0.9"}
THROTTLE = 1.0  # ~1 req/sec

# --------------------------------------------------------------------------------------
# PANEL97 classification + fetch routing (Phase 0)
# --------------------------------------------------------------------------------------
# klass: equity_basket | bond_basket | leveraged_or_inverse | commodity_pool | single_stock
# For leveraged: reference_index, proxy_ticker (a PANEL fund tracking the same index),
#   proxy_flag ('exact_index' where the proxy tracks the same index, 'PROXY' where approximate),
#   direction (long/inverse).
# For commodity_pool: commodity_tag, commodity_bucket.
ISHARES_PID = {
 "ECH":"239618","EWG":"239650","EWQ":"239648","INDA":"239659","EWH":"239657","EIDO":"239661",
 "EWJ":"239665","EWI":"239664","EWN":"239671","EWW":"239670","EWM":"239669","EWS":"239678",
 "EPOL":"239676","EWP":"239683","EWY":"239681","EZA":"239680","EWT":"239686","EWL":"239685",
 "EWD":"239684","EWU":"239690","TUR":"239689","THD":"239688","USMV":"239695","IWM":"239710",
 "QUAL":"256101","MTUM":"251614","VLUE":"251616","SGOV":"314116","TLT":"239454","SHY":"239452",
 "IEF":"239456","TIP":"239467","IYT":"239501","FXI":"239536","LQD":"239566","HYG":"239565",
 "EMB":"239572","EWA":"239607","EWK":"239610","EWC":"239615","EWZ":"239612"}

ISHARES_SLUG = {  # for provenance / raw filenames; the API only needs the pid
 "EWK":"ishares-msci-belgium-capped-etf"}

VANGUARD = ["VTI","VEU","VYM","VNQ","VNQI","BND"]
SSGA = ["XBI","XLB","XLE","XLF","XLI","XLK","XLP","XLRE","XLU","XLV","XLY","XME"]
GLOBALX = ["COPX","SIL","URA","ARGT"]
GLOBALX_NAME = {"COPX":"copper-miners","SIL":"silver-miners","URA":"uranium","ARGT":"argentina"}
VANECK = {"SMH":"semiconductor-etf-smh","GDX":"gold-miners-etf-gdx"}
VANECK_SLUG = {"SMH":"smh","GDX":"gdx"}

SINGLE_STOCKS = ["AMC","BABA","F","GME","MSTR","NVDA","PLTR","TSLA"]

# Full config table (Phase 0 persisted to classification.csv)
CONFIG = {}
def _c(t, klass, issuer, fetch, **kw):
    row = dict(ticker=t, klass=klass, issuer=issuer, fetch_method=fetch,
               subtype="", reference_index="", proxy_ticker="", proxy_flag="",
               direction="", commodity_tag="", commodity_bucket="", notes="")
    row.update(kw); CONFIG[t] = row

# iShares equity single-country + regional + factor (equity baskets)
for t in ["ECH","EWG","EWQ","INDA","EWH","EIDO","EWJ","EWI","EWN","EWW","EWM","EWS","EPOL",
          "EWP","EWY","EZA","EWT","EWL","EWD","EWU","TUR","THD","USMV","IWM","QUAL","MTUM",
          "VLUE","IYT","FXI","EWA","EWK","EWC","EWZ"]:
    _c(t,"equity_basket","iShares","ishares_api")
# iShares bond baskets
for t in ["SGOV","TLT","SHY","IEF","TIP","LQD","HYG","EMB"]:
    _c(t,"bond_basket","iShares","ishares_api")
# SSGA equity baskets (sector SPDRs + XME + XBI)
for t in SSGA:
    _c(t,"equity_basket","SSGA","etf_scraper")
# Vanguard
for t in ["VTI","VEU","VYM","VNQ","VNQI"]:
    _c(t,"equity_basket","Vanguard","vanguard_api")
_c("BND","bond_basket","Vanguard","vanguard_api")
# Global X equity baskets (miners / country)
for t in GLOBALX:
    _c(t,"equity_basket","GlobalX","globalx_csv")
# KraneShares
_c("KWEB","equity_basket","KraneShares","kraneshares_csv")
# VanEck equity baskets
for t in VANECK:
    _c(t,"equity_basket","VanEck","vaneck_xlsx")
# Invesco (blocked)
_c("QQQ","equity_basket","Invesco","stockanalysis_partial",
   notes="Invesco IP-blocked (406); PARTIAL top-25 roster from stockanalysis.com")
_c("SPLV","equity_basket","Invesco","BLOCKED",notes="Invesco IP-blocked (406) -> fetch_failure")
# Schwab (blocked)
_c("SCHD","equity_basket","Schwab","BLOCKED",notes="Schwab 403 Akamai -> fetch_failure")

# Leveraged / inverse
_c("TQQQ","leveraged_or_inverse","ProShares","lookthrough",subtype="3x",
   reference_index="Nasdaq-100",proxy_ticker="QQQ",proxy_flag="exact_index",direction="long")
_c("SQQQ","leveraged_or_inverse","ProShares","lookthrough",subtype="-3x",
   reference_index="Nasdaq-100",proxy_ticker="QQQ",proxy_flag="exact_index",direction="inverse")
_c("UPRO","leveraged_or_inverse","ProShares","lookthrough",subtype="3x",
   reference_index="S&P 500",proxy_ticker="IVV_AUX",proxy_flag="exact_index",direction="long",
   notes="no PANEL S&P500 fund; look-through uses auxiliary IVV basket")
_c("SOXL","leveraged_or_inverse","Direxion","lookthrough",subtype="3x",
   reference_index="NYSE Semiconductor",proxy_ticker="SMH",proxy_flag="PROXY",direction="long",
   notes="SMH tracks MVIS US Listed Semiconductor 25, not SOXL's index exactly -- PROXY")
_c("SOXS","leveraged_or_inverse","Direxion","lookthrough",subtype="-3x",
   reference_index="NYSE Semiconductor",proxy_ticker="SMH",proxy_flag="PROXY",direction="inverse",
   notes="SMH proxy -- FLAGGED")
_c("TNA","leveraged_or_inverse","Direxion","lookthrough",subtype="3x",
   reference_index="Russell 2000",proxy_ticker="IWM",proxy_flag="exact_index",direction="long")
_c("TZA","leveraged_or_inverse","Direxion","lookthrough",subtype="-3x",
   reference_index="Russell 2000",proxy_ticker="IWM",proxy_flag="exact_index",direction="inverse")
_c("TMF","leveraged_or_inverse","Direxion","lookthrough",subtype="3x",
   reference_index="ICE 20+ Year US Treasury",proxy_ticker="TLT",proxy_flag="exact_index",direction="long")
_c("YINN","leveraged_or_inverse","Direxion","lookthrough",subtype="3x",
   reference_index="FTSE China 50",proxy_ticker="FXI",proxy_flag="PROXY",direction="long",
   notes="FXI tracks FTSE China 50 (same index); flagged per spec")
_c("YANG","leveraged_or_inverse","Direxion","lookthrough",subtype="-3x",
   reference_index="FTSE China 50",proxy_ticker="FXI",proxy_flag="PROXY",direction="inverse",
   notes="FXI proxy; flagged")
_c("UVXY","leveraged_or_inverse","ProShares","none",subtype="1.5x",
   reference_index="S&P 500 VIX Short-Term Futures",proxy_ticker="",proxy_flag="no_basket",
   direction="long_vol",notes="holds VIX futures; no equity/bond roster -> overlap 0")

# Commodity pools (futures/physical) -- tag + bucket
_c("BITO","commodity_pool","ProShares","none",commodity_tag="bitcoin",commodity_bucket="crypto",
   subtype="futures",notes="Bitcoin futures")
_c("CPER","commodity_pool","USCF","none",commodity_tag="copper",commodity_bucket="industrial_metal",subtype="futures")
_c("DBA","commodity_pool","Invesco","none",commodity_tag="agriculture",commodity_bucket="agriculture",subtype="futures")
_c("DBB","commodity_pool","Invesco","none",commodity_tag="base_metals",commodity_bucket="industrial_metal",subtype="futures")
_c("GLDM","commodity_pool","SSGA","none",commodity_tag="gold",commodity_bucket="precious_metal",subtype="physical")
_c("PDBC","commodity_pool","Invesco","none",commodity_tag="broad_commodity",commodity_bucket="broad",subtype="futures")
_c("SLV","commodity_pool","iShares","none",commodity_tag="silver",commodity_bucket="precious_metal",subtype="physical")
_c("UNG","commodity_pool","USCF","none",commodity_tag="natgas",commodity_bucket="energy",subtype="futures")
_c("USO","commodity_pool","USCF","none",commodity_tag="oil",commodity_bucket="energy",subtype="futures")

# Single stocks (other) -- treated as 1-line baskets (100% self)
for t in SINGLE_STOCKS:
    _c(t,"single_stock","-","self",notes="single name; 100% self, identifiers bridged via ETF rosters")

PANEL97 = (
    "AMC ARGT BABA BITO BND COPX CPER DBA DBB ECH EIDO EMB EPOL EWA EWC EWD EWG "
    "EWH EWI EWJ EWK EWL EWM EWN EWP EWQ EWS EWT EWU EWW EWY EWZ EZA F FXI GDX "
    "GLDM GME HYG IEF INDA IWM IYT KWEB LQD MSTR MTUM NVDA PDBC PLTR QQQ QUAL "
    "SCHD SGOV SHY SIL SLV SMH SOXL SOXS SPLV SQQQ THD TIP TLT TMF TNA TQQQ TSLA "
    "TUR TZA UNG UPRO URA USMV USO UVXY VEU VLUE VNQ VNQI VTI VYM XBI XLE XLB "
    "XLF XLI XLK XLP XLRE XLU XLV XLY XME YANG YINN"
).split()
assert len(PANEL97) == 97, len(PANEL97)
assert set(PANEL97) == set(CONFIG), set(PANEL97) ^ set(CONFIG)

# NB: assetClass 'Cash' is NOT dropped -- iShares mislabels TREASURY BILLS (real T-bill CUSIPs,
# the actual SGOV portfolio) as assetClass 'Cash'.  'Money Market' IS dropped: that is the
# BlackRock cash-sweep fund (BLK CSH FND, cusip 066922477) held across many iShares funds --
# keeping it would fabricate iShares<->iShares overlap.
DROP_ASSETCLASS = {"money market","cash and/or derivatives","fx","foreign exchange","warrant",
                   "futures","cash collateral","currency","forward","swap","swaps","options"}
# Cash/sweep/derivative NAME markers -> dropped even when a cusip is present (sweep funds carry
# cusips).  None of these substrings occur in T-bill / treasury / corporate-bond issue names.
DROP_NAME_TOK = ("USD CASH","CASH COLLATERAL","CSH FND","CASH FUND","MONEY MARKET","BLK CSH",
                 "CASH MGMT","NET OTHER ASSET","MARGIN BALANCE","CASH AND CARRY","MMF ",
                 "SWEEP","LIQUIDITY FUND","CASH OFFSET","FUTURE","FORWARD ","SWAP")
DROP_NAME_EXACT = {"CASH","USD","-","","CASH_USD","US DOLLAR"}

# --------------------------------------------------------------------------------------
# fetchers -> list of dict rows {cusip,isin,sedol,ticker,figi,name,weight_raw,asof}
# --------------------------------------------------------------------------------------
def _get(url, **kw):
    r = requests.get(url, headers=HDRS, timeout=40, **kw)
    r.raise_for_status()
    return r

def fetch_ishares(t):
    pid = ISHARES_PID[t]
    url = ("https://www.blackrock.com/varnish-api/blk-one01-product-data/product-data/"
           "api/v2/get-product-data")
    r = _get(url, params={"portfolioId": pid, "component": "holdings", "siteEntryPassthrough": "true"})
    (RAW / f"{t}_ishares_{pid}.json").write_bytes(r.content)
    j = r.json()
    dp = j["componentsByNameMap"]["holdings"]["containersByNameMap"]["all"]["dataPointsByNameMap"]
    def col(name):
        return dp[name]["value"] if name in dp else None
    n = len(dp["holdingPercent"]["value"])
    cusip, isin, sedol = col("cusip"), col("isin"), col("sedol")
    ac, name, w = col("assetClass"), col("issueName"), col("holdingPercent")
    asof = dp["asOfDate"].get("value") or dp["holdingPercent"].get("formattedAsOfDate")
    if isinstance(asof, list): asof = asof[0]
    rows = []
    for i in range(n):
        rows.append(dict(cusip=cusip[i] if cusip else None, isin=isin[i] if isin else None,
                         sedol=sedol[i] if sedol else None, ticker=None, figi=None,
                         name=name[i], assetclass=(ac[i] if ac else ""), weight_raw=w[i], asof=asof))
    return rows

def fetch_vanguard(t):
    def find_list(o):
        if isinstance(o, list) and o and isinstance(o[0], dict) and (
           "percentWeight" in o[0] or "isin" in o[0] or "cusip" in o[0]):
            return o
        if isinstance(o, dict):
            for v in o.values():
                r = find_list(v)
                if r: return r
        return None
    rows, saved = [], b""
    for kind in ("stock", "bond"):  # equity funds -> stock; BND -> bond; merge both
        url = f"https://investor.vanguard.com/investment-products/etfs/profile/api/{t.lower()}/portfolio-holding/{kind}"
        try:
            r = _get(url, params={"start": 1, "count": 20000})  # pull FULL roster (API pages at 500)
        except Exception:
            continue
        saved += r.content + b"\n"
        j = r.json()
        asof = j.get("asOfDate")
        for h in (find_list(j) or []):
            rows.append(dict(cusip=h.get("cusip"), isin=h.get("isin"), sedol=h.get("sedol"),
                             ticker=h.get("ticker"), figi=None,
                             name=h.get("shortName") or h.get("longName"),
                             assetclass=h.get("secMainType",""), weight_raw=h.get("percentWeight"),
                             asof=(h.get("asOfDate") or asof)))
        time.sleep(0.3)
    (RAW / f"{t}_vanguard.json").write_bytes(saved)
    return rows

def fetch_ssga(t):
    from etf_scraper import ETFScraper
    h = ETFScraper().query_holdings(t, None)
    h.to_csv(RAW / f"{t}_ssga.csv", index=False)
    asof = str(h["as_of_date"].iloc[0]) if "as_of_date" in h.columns and len(h) else None
    rows = []
    for _, x in h.iterrows():
        rows.append(dict(cusip=x.get("cusip"), isin=x.get("isin"), sedol=x.get("sedol"),
                         ticker=x.get("ticker"), figi=None, name=x.get("name"),
                         assetclass=str(x.get("sector","")), weight_raw=x.get("weight"), asof=asof))
    return rows

def fetch_globalx(t):
    # find the exact dated CSV url on the fund page
    page = _get(f"https://www.globalxetfs.com/funds/{t.lower()}/").text
    import re
    m = re.search(r'(https://assets\.globalxetfs\.com/funds/holdings/'+t.lower()+r'_full-holdings_\d{8}\.csv)', page)
    if not m:
        raise RuntimeError("globalx csv url not found on page")
    url = m.group(1)
    time.sleep(THROTTLE)
    r = _get(url); (RAW / f"{t}_globalx.csv").write_bytes(r.content)
    txt = r.content.decode("utf-8-sig", "replace")
    lines = txt.splitlines()
    # a header line has "as of MM/DD/YYYY"; find the column header row
    asof = None
    mo = re.search(r'as of (\d{2}/\d{2}/\d{4})', txt)
    if mo: asof = mo.group(1)
    hdr_i = next((i for i,l in enumerate(lines) if l.startswith("% of Net Assets") or "Ticker" in l and "Name" in l), 1)
    rdr = csv.DictReader(lines[hdr_i:])
    rows = []
    for x in rdr:
        w = x.get("% of Net Assets") or x.get("% of Net Assets ")
        rows.append(dict(cusip=None, isin=None, sedol=(x.get("SEDOL") or None),
                         ticker=(x.get("Ticker") or None), figi=None, name=x.get("Name"),
                         assetclass="", weight_raw=w, asof=asof))
    return rows

def fetch_kraneshares(t):
    from datetime import date, timedelta
    import re
    page = _get(f"https://kraneshares.com/{t.lower()}/").text
    m = re.search(r'(https://kraneshares\.com/csv/\d{2}_\d{2}_\d{4}_'+t.lower()+r'_holdings\.csv)', page)
    url = m.group(1) if m else None
    if not url:  # fallback: try recent dates
        for d in range(0, 7):
            dd = date.today() - timedelta(days=d)
            cand = f"https://kraneshares.com/csv/{dd.strftime('%m_%d_%Y')}_{t.lower()}_holdings.csv"
            try:
                _get(cand); url = cand; break
            except Exception:
                continue
    time.sleep(THROTTLE)
    r = _get(url); (RAW / f"{t}_kraneshares.csv").write_bytes(r.content)
    lines = r.content.decode("utf-8-sig","replace").splitlines()
    asof = None
    mo = re.search(r'As of (\d{4}-\d{2}-\d{2})', lines[0]) if lines else None
    if mo: asof = mo.group(1)
    hdr_i = next((i for i,l in enumerate(lines) if l.startswith("Rank") or ("Ticker" in l and "% of Net Assets" in l)), 1)
    rdr = csv.DictReader(lines[hdr_i:])
    rows = []
    for x in rdr:
        rows.append(dict(cusip=None, isin=None, sedol=None,
                         ticker=(x.get("Ticker") or None), figi=(x.get("Identifier") or None),
                         name=x.get("Company Name"), assetclass="",
                         weight_raw=x.get("% of Net Assets"), asof=asof))
    return rows

def fetch_vaneck(t):
    slug = VANECK[t]
    url = f"https://www.vaneck.com/us/en/etf/equity/{VANECK_SLUG[t]}/holdings/download/xlsx/"
    r = _get(url); (RAW / f"{t}_vaneck.xlsx").write_bytes(r.content)
    x = pd.read_excel(io.BytesIO(r.content), header=None)
    # header row is the one containing 'Ticker'
    hdr_i = next(i for i in range(len(x)) if x.iloc[i].astype(str).str.contains("Ticker").any())
    asof = None
    top = " ".join(str(v) for v in x.iloc[0].tolist())
    import re
    mo = re.search(r'(\d{2}/\d{2}/\d{4})', top)
    if mo: asof = mo.group(1)
    hdr = x.iloc[hdr_i].tolist()
    df = x.iloc[hdr_i+1:].copy(); df.columns = hdr
    rows = []
    for _, r2 in df.iterrows():
        tick = r2.get("Ticker")
        if pd.isna(tick): continue
        rows.append(dict(cusip=None, isin=None, sedol=None, ticker=str(tick),
                         figi=(str(r2.get("Identifier (FIGI)")) if not pd.isna(r2.get("Identifier (FIGI)")) else None),
                         name=r2.get("Holding Name"), assetclass=str(r2.get("Asset Class","")),
                         weight_raw=r2.get("% of Net Assets"), asof=asof))
    return rows

def fetch_ivv_aux():
    """S&P 500 basket for UPRO look-through (auxiliary, not a PANEL ticker)."""
    url = ("https://www.blackrock.com/varnish-api/blk-one01-product-data/product-data/"
           "api/v2/get-product-data")
    r = _get(url, params={"portfolioId": "239726", "component": "holdings", "siteEntryPassthrough": "true"})
    (RAW / "IVV_AUX_ishares_239726.json").write_bytes(r.content)
    j = r.json()
    dp = j["componentsByNameMap"]["holdings"]["containersByNameMap"]["all"]["dataPointsByNameMap"]
    n = len(dp["holdingPercent"]["value"])
    def col(nm): return dp[nm]["value"] if nm in dp else [None]*n
    cusip, isin, sedol, ac, name, w = col("cusip"), col("isin"), col("sedol"), col("assetClass"), col("issueName"), col("holdingPercent")
    asof = dp["asOfDate"].get("value"); asof = asof[0] if isinstance(asof, list) else asof
    return [dict(cusip=cusip[i], isin=isin[i], sedol=sedol[i], ticker=None, figi=None,
                 name=name[i], assetclass=ac[i], weight_raw=w[i], asof=asof) for i in range(n)]

QQQ_PARTIAL = [  # top-25 real weights, stockanalysis.com as of ~2026-07-14 (Invesco IP-blocked)
 ("NVDA",8.01),("AAPL",7.26),("MU",4.78),("MSFT",4.49),("AMZN",4.14),("AMD",3.94),
 ("GOOGL",3.26),("TSLA",3.19),("META",3.11),("GOOG",3.04),("AVGO",2.97),("WMT",2.41),
 ("INTC",2.39),("AMAT",2.07),("CSCO",2.07),("LRCX",1.90),("COST",1.76),("NFLX",1.34),
 ("KLAC",1.31),("PLTR",1.26),("SNDK",1.23),("TXN",1.23),("SPCX",1.21),("PANW",1.15),("LIN",1.06)]

def fetch_qqq_partial(t=None):
    return [dict(cusip=None, isin=None, sedol=None, ticker=tk, figi=None, name=tk,
                 assetclass="Equity", weight_raw=w, asof="2026-07-14") for tk, w in QQQ_PARTIAL]

# --------------------------------------------------------------------------------------
def clean_rows(rows):
    out = []
    for r in rows:
        try:
            w = float(r.get("weight_raw"))
        except (TypeError, ValueError):
            if isinstance(r.get("weight_raw"), str):
                s = r["weight_raw"].replace("%","").replace(",","").strip()
                try: w = float(s)
                except ValueError: continue
            else:
                continue
        if w <= 0:
            continue
        ac = str(r.get("assetclass") or "").strip().lower()
        if ac in DROP_ASSETCLASS:
            continue
        cu = (str(r["cusip"]).strip() if r.get("cusip") not in (None,"-","","None") else None)
        isin = (str(r["isin"]).strip() if r.get("isin") not in (None,"-","","None") else None)
        sd = (str(r["sedol"]).strip() if r.get("sedol") not in (None,"-","","None") else None)
        tk = (str(r["ticker"]).strip().upper() if r.get("ticker") not in (None,"-","","None") else None)
        fg = (str(r["figi"]).strip() if r.get("figi") not in (None,"-","","None","nan") else None)
        if not any([cu, isin, sd, tk, fg]):
            continue
        # cash / sweep / derivative name drop (applies even with a cusip -- sweep funds have them)
        nm = str(r.get("name") or "").upper().strip()
        if nm in DROP_NAME_EXACT or any(tok in nm for tok in DROP_NAME_TOK):
            continue
        out.append(dict(cusip=cu, isin=isin, sedol=sd, ticker=tk, figi=fg,
                        name=r.get("name"), weight=w, asof=r.get("asof")))
    # collapse duplicate securities within a fund (sum weights) using best available key
    agg = {}
    for r in out:
        key = r["cusip"] or r["isin"] or r["sedol"] or r["ticker"] or r["figi"]
        if key in agg:
            agg[key]["weight"] += r["weight"]
        else:
            agg[key] = r
    out = list(agg.values())
    tot = sum(r["weight"] for r in out)
    if tot > 0:
        for r in out:
            r["weight"] = r["weight"] / tot
    return out

FETCHERS = {
 "ishares_api": fetch_ishares, "vanguard_api": fetch_vanguard, "etf_scraper": fetch_ssga,
 "globalx_csv": fetch_globalx, "kraneshares_csv": fetch_kraneshares, "vaneck_xlsx": fetch_vaneck,
 "stockanalysis_partial": fetch_qqq_partial,
}

def main():
    # Phase 0: persist classification.csv
    cols = ["ticker","klass","subtype","issuer","fetch_method","reference_index","proxy_ticker",
            "proxy_flag","direction","commodity_tag","commodity_bucket","notes"]
    cdf = pd.DataFrame([{k: CONFIG[t].get(k,"") for k in cols} for t in PANEL97])
    cdf.insert(0, "census_banner", "DESCRIPTIVE CENSUS -- NOT A SELECTION")
    cdf.to_csv(HERE / "classification.csv", index=False)
    print("Phase0: classification.csv ->", cdf["klass"].value_counts().to_dict())

    # Phase 1: fetch every roster fund (equity_basket, bond_basket, single_stock handled inline)
    all_rows, failures, meta = [], [], []
    roster_funds = [t for t in PANEL97 if CONFIG[t]["klass"] in ("equity_basket","bond_basket")]
    for t in roster_funds:
        fm = CONFIG[t]["fetch_method"]
        if fm == "BLOCKED":
            failures.append({"ticker": t, "reason": CONFIG[t]["notes"]}); print(f"  SKIP {t}: BLOCKED"); continue
        try:
            raw = FETCHERS[fm](t)
            rows = clean_rows(raw)
            if not rows:
                raise RuntimeError("0 rows after cleaning")
            asof = rows[0]["asof"]
            for r in rows:
                all_rows.append(dict(fund=t, asof_date=asof, cusip=r["cusip"], isin=r["isin"],
                                     sedol=r["sedol"], ticker=r["ticker"], figi=r["figi"],
                                     name=r["name"], weight=r["weight"]))
            meta.append({"fund": t, "method": fm, "n_holdings": len(rows), "asof": asof})
            print(f"  OK   {t:5s} {fm:22s} n={len(rows):4d} asof={asof}")
        except Exception as e:
            failures.append({"ticker": t, "reason": f"{fm}: {repr(e)[:160]}"})
            print(f"  FAIL {t:5s} {fm}: {repr(e)[:120]}")
        time.sleep(THROTTLE)

    # single stocks: 1-line self baskets
    for t in SINGLE_STOCKS:
        all_rows.append(dict(fund=t, asof_date="2026-07-15", cusip=None, isin=None, sedol=None,
                             ticker=t, figi=None, name=t, weight=1.0))
        meta.append({"fund": t, "method": "self", "n_holdings": 1, "asof": "2026-07-15"})

    # auxiliary IVV basket for UPRO look-through
    try:
        ivv = clean_rows(fetch_ivv_aux())
        for r in ivv:
            all_rows.append(dict(fund="IVV_AUX", asof_date=r["asof"], cusip=r["cusip"], isin=r["isin"],
                                 sedol=r["sedol"], ticker=r["ticker"], figi=r["figi"], name=r["name"], weight=r["weight"]))
        meta.append({"fund": "IVV_AUX", "method": "ishares_api", "n_holdings": len(ivv), "asof": ivv[0]["asof"]})
        print(f"  OK   IVV_AUX (S&P500 aux for UPRO) n={len(ivv)}")
    except Exception as e:
        failures.append({"ticker": "IVV_AUX", "reason": repr(e)[:160]})

    df = pd.DataFrame(all_rows, columns=["fund","asof_date","cusip","isin","sedol","ticker","figi","name","weight"])
    df.to_csv(HERE / "holdings_normalized.csv", index=False)
    pd.DataFrame(meta).to_csv(HERE / "fetch_meta.csv", index=False)
    with open(HERE / "fetch_failures.json", "w") as f:
        json.dump({"banner":"DESCRIPTIVE CENSUS -- NOT A SELECTION","failures": failures}, f, indent=2)
    print(f"\nPhase1: {len(meta)} funds fetched, {len(failures)} failures -> {[x['ticker'] for x in failures]}")
    print(f"holdings_normalized.csv rows={len(df)}")

if __name__ == "__main__":
    main()
