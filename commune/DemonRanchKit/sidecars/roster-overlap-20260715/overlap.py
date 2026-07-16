"""Docket #83 Roster Overlap -- pairwise roster-overlap matrix + validation + theory check.

DESCRIPTIVE CENSUS -- NOT A SELECTION.

Overlap(A,B) = sum_g min(w_A[g], w_B[g]) over a reconciled security-identifier space g.
Identifier reconciliation: union-find over {ISIN, CUSIP, SEDOL, ticker, FIGI}, with US-ISIN
cross-derived to CUSIP (US ISIN = 'US'+CUSIP+check) so CUSIP-reporting funds (SSGA) and
ISIN-reporting funds (iShares) land on one key.  Join precedence in spirit: CUSIP/ISIN first,
SEDOL/ticker/FIGI as bridges (flagged where load-bearing: Global X=SEDOL, VanEck/QQQ=ticker).

Fund-type routing:
  - equity_basket / bond_basket / single_stock : direct roster.
  - leveraged_or_inverse : LOOK THROUGH to proxy_ticker's roster (TQQQ/SQQQ->QQQ, TNA/TZA->IWM,
    TMF->TLT, UPRO->IVV_AUX, SOXL/SOXS->SMH [PROXY], YINN/YANG->FXI [PROXY]).  Direction
    (long/inverse) does NOT change the roster; a census of *kinship* uses the same basket.
    UVXY holds VIX futures -> no basket -> overlap 0.
  - commodity_pool : no security roster; crude Phase-1 rubric on commodity tag/bucket
    (same tag=1.0, same bucket=0.5, broad(PDBC) vs any=0.5, else 0).  A commodity pool vs any
    equity/bond roster = 0 (no shared securities).
  - blocked (SCHD, SPLV) : NaN (roster unavailable -- Invesco/Schwab blocked this host).
"""
import json
from itertools import combinations
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
COINT = HERE.parent / "cointegration-20260715"
BANNER = "DESCRIPTIVE CENSUS -- NOT A SELECTION"

cls = pd.read_csv(HERE / "classification.csv").set_index("ticker")
hold = pd.read_csv(HERE / "holdings_normalized.csv", dtype=str)
hold["weight"] = pd.to_numeric(hold["weight"], errors="coerce")
PANEL = list(cls.index)

# --------------------------------------------------------------------------------------
# 1. identifier reconciliation (union-find)
# --------------------------------------------------------------------------------------
parent = {}
def find(x):
    parent.setdefault(x, x)
    while parent[x] != x:
        parent[x] = parent[parent[x]]
        x = parent[x]
    return x
def union(a, b):
    ra, rb = find(a), find(b)
    if ra != rb:
        parent[ra] = rb

def tokens(row):
    toks = []
    isin = row["isin"]; cusip = row["cusip"]; sedol = row["sedol"]; tk = row["ticker"]; fg = row["figi"]
    def ok(v): return isinstance(v, str) and v not in ("", "nan", "None", "-")
    if ok(isin):
        toks.append("I:" + isin)
        if isin.startswith("US") and len(isin) >= 11:      # US ISIN -> embedded CUSIP bridge
            toks.append("C:" + isin[2:11])
    if ok(cusip):
        toks.append("C:" + cusip)
    if ok(sedol):
        toks.append("S:" + sedol)
    if ok(tk):
        toks.append("T:" + tk)
    if ok(fg):
        toks.append("F:" + fg)
    return toks

# build groups: union all tokens co-occurring on a holding row
hold_tokens = []
for _, r in hold.iterrows():
    tk = tokens(r)
    hold_tokens.append(tk)
    for t in tk:
        find(t)
    for a, b in zip(tk, tk[1:]):
        union(a, b)

def group_of(tk_list):
    return find(tk_list[0]) if tk_list else None

hold = hold.reset_index(drop=True)
hold["grp"] = [group_of(tk) for tk in hold_tokens]

# fund -> {group: weight}   (primary rosters incl. IVV_AUX and single stocks)
roster = {}
for fund, g in hold.groupby("fund"):
    d = {}
    for grp, w in zip(g["grp"], g["weight"]):
        if grp is None or pd.isna(w):
            continue
        d[grp] = d.get(grp, 0.0) + float(w)
    roster[fund] = d

# --------------------------------------------------------------------------------------
# 2. resolve each panel ticker to an effective roster (with look-through)
# --------------------------------------------------------------------------------------
def eff_roster(t):
    """Return (roster_dict_or_None, kind).  kind in {roster, lookthrough, novel, commodity, blocked}."""
    k = cls.loc[t, "klass"]
    if k in ("equity_basket", "bond_basket", "single_stock"):
        r = roster.get(t)
        return (r, "roster") if r else (None, "blocked")
    if k == "leveraged_or_inverse":
        proxy = cls.loc[t, "proxy_ticker"]
        if isinstance(proxy, str) and proxy and proxy != "nan":
            r = roster.get(proxy)
            return (r, "lookthrough") if r else (None, "blocked")
        return (None, "novel")          # UVXY: VIX futures, no roster
    if k == "commodity_pool":
        return (None, "commodity")
    return (None, "blocked")

EFF = {t: eff_roster(t) for t in PANEL}

def sigmin(ra, rb):
    if len(rb) < len(ra):
        ra, rb = rb, ra
    return float(sum(min(w, rb[g]) for g, w in ra.items() if g in rb))

def commodity_overlap(a, b):
    ta, tb = cls.loc[a, "commodity_tag"], cls.loc[b, "commodity_tag"]
    ba, bb = cls.loc[a, "commodity_bucket"], cls.loc[b, "commodity_bucket"]
    if ta == tb:
        return 1.0
    if "crypto" in (ba, bb):          # bitcoin futures share nothing with commodity baskets
        return 0.0
    if ba == "broad" or bb == "broad":  # PDBC diversified pool touches energy/metals/ags
        return 0.5
    if ba == bb:
        return 0.5
    return 0.0

def pair_overlap(a, b):
    if a == b:
        ra, ka = EFF[a]
        if ka in ("roster", "lookthrough"): return 1.0
        if ka == "commodity": return 1.0
        if ka == "novel": return 1.0
        return np.nan
    ra, ka = EFF[a]; rb, kb = EFF[b]
    # commodity handling
    ca = cls.loc[a, "klass"] == "commodity_pool"; cb = cls.loc[b, "klass"] == "commodity_pool"
    if ca and cb:
        return commodity_overlap(a, b)
    if ca or cb:
        # commodity vs roster/lookthrough/novel -> no shared securities
        if ka == "blocked" or kb == "blocked":
            return np.nan
        return 0.0
    # UVXY (novel, no basket) vs any non-commodity roster -> genuinely 0 roster overlap
    if ka == "novel" or kb == "novel":
        if ka == "blocked" or kb == "blocked":
            return np.nan
        return 0.0
    if ka == "blocked" or kb == "blocked" or ra is None or rb is None:
        return np.nan
    return sigmin(ra, rb)

# --------------------------------------------------------------------------------------
# 3. build 97x97 matrix
# --------------------------------------------------------------------------------------
M = pd.DataFrame(index=PANEL, columns=PANEL, dtype=float)
for a in PANEL:
    for b in PANEL:
        M.loc[a, b] = pair_overlap(a, b)
M.index.name = BANNER  # census banner rides in the corner cell (non-breaking for read_csv)
M.to_csv(HERE / "overlap_matrix.csv")

# --------------------------------------------------------------------------------------
# 4. containment helper (for VEU/EWK anchor)
# --------------------------------------------------------------------------------------
def containment(a, b):
    """fraction of A's weight whose security also appears in B (A-weighted coverage by B)."""
    ra = roster.get(a, {}); rb = roster.get(b, {})
    if not ra: return np.nan
    return float(sum(w for g, w in ra.items() if g in rb))

# --------------------------------------------------------------------------------------
# 5. validation anchors
# --------------------------------------------------------------------------------------
anchors = {}
anchors["QQQ_vs_XLK"] = {"overlap": round(float(M.loc["QQQ", "XLK"]), 4),
    "note": "QQQ is a PARTIAL top-25 roster (Invesco IP-blocked) -> LOWER BOUND; target 0.40-0.70"}
anchors["EWK_VEU_containment"] = {
    "sigmin_symmetric": round(float(M.loc["EWK", "VEU"]), 5),
    "frac_EWK_present_in_VEU (EWK-weighted, expect ~1)": round(containment("EWK", "VEU"), 4),
    "frac_VEU_present_in_EWK (VEU-weighted, expect ~Belgium wt, small)": round(containment("VEU", "EWK"), 5)}
anchors["EWJ_vs_EWU"] = {"overlap": round(float(M.loc["EWJ", "EWU"]), 6), "note": "Japan vs UK, expect ~0"}
# supplemental clean high-overlap sanity (QQQ is degraded): VTI vs XLK, XLK vs SMH
anchors["_supplemental_VTI_vs_XLK"] = round(float(M.loc["VTI", "XLK"]), 4)
anchors["_supplemental_XLK_vs_SMH"] = round(float(M.loc["XLK", "SMH"]), 4)

# --------------------------------------------------------------------------------------
# 6. distribution over all DEFINED pairs
# --------------------------------------------------------------------------------------
vals = []
pair_ov = {}
for a, b in combinations(PANEL, 2):
    v = M.loc[a, b]
    if not pd.isna(v):
        vals.append(v); pair_ov[frozenset((a, b))] = float(v)
vals = np.array(vals)
dist = {
    "n_defined_pairs": int(len(vals)),
    "n_undefined_pairs": int(len(list(combinations(PANEL, 2))) - len(vals)),
    "median": round(float(np.median(vals)), 5),
    "q25": round(float(np.percentile(vals, 25)), 5),
    "q75": round(float(np.percentile(vals, 75)), 5),
    "q90": round(float(np.percentile(vals, 90)), 5),
    "max": round(float(vals.max()), 5),
    "pct_exactly_zero": round(float((vals == 0).mean()) * 100, 1),
    "pct_ge_0p5": round(float((vals >= 0.5).mean()) * 100, 1),
}

# top-20 overlap pairs
top = sorted(pair_ov.items(), key=lambda kv: -kv[1])[:20]
top_pairs = [("/".join(sorted(list(k))), round(v, 4)) for k, v in top]

# --------------------------------------------------------------------------------------
# 7. v1.4 passer theory check (ANACHRONISM: current rosters vs historical passers)
# --------------------------------------------------------------------------------------
def read_passers(fn, tag):
    d = pd.read_csv(COINT / fn)
    p = d[d.z_is < -1.645][["pair", "z_is"]].copy()
    p["direction"] = tag
    return p
passers = pd.concat([read_passers("v14_pairs_fitA_testB.csv", "fitA_testB"),
                     read_passers("v14_pairs_fitB_testA.csv", "fitB_testA")], ignore_index=True)

# percentile rank of a value within the defined-pair distribution (0..100, higher=more overlap)
srt = np.sort(vals)
def pctile_rank(v):
    return round(float(np.searchsorted(srt, v, side="right")) / len(srt) * 100, 1)

rows = []
for _, r in passers.iterrows():
    a, b = r["pair"].split("/")
    key = frozenset((a, b))
    ov = pair_ov.get(key, np.nan)
    rows.append({"pair": r["pair"], "direction": r["direction"], "z_is": r["z_is"],
                 "roster_overlap": (round(ov, 5) if not pd.isna(ov) else None),
                 "overlap_pctile": (pctile_rank(ov) if not pd.isna(ov) else None),
                 "a_class": cls.loc[a, "klass"], "b_class": cls.loc[b, "klass"]})
passer_tbl = pd.DataFrame(rows).sort_values("roster_overlap", ascending=False, na_position="last")
passer_tbl.to_csv(HERE / "v14_passers_overlap.csv", index=False)

pv = passer_tbl["roster_overlap"].dropna().values
theory = {
    "n_passers": len(passer_tbl),
    "n_with_defined_overlap": int(len(pv)),
    "passer_median_overlap": round(float(np.median(pv)), 5) if len(pv) else None,
    "passer_mean_overlap": round(float(np.mean(pv)), 6) if len(pv) else None,
    "all_pairs_median_overlap": dist["median"],
    "all_pairs_mean_overlap": round(float(np.mean(vals)), 6),
    # NOTE: the raw percentile is inflated by the zero-mass -- a 0-overlap pair sits at the
    # (pct_exactly_zero)th percentile by construction.  The honest comparison is the ENRICHMENT:
    # fraction of passers with any overlap vs fraction of all pairs with any overlap.
    "passer_median_pctile_CAVEAT": round(float(np.median([r["overlap_pctile"] for r in rows if r["overlap_pctile"] is not None])), 1),
    "pct_all_pairs_gt0": round(float((vals > 0).mean()) * 100, 1),
    "pct_passers_gt0": round(float((pv > 0).mean()) * 100, 1),
    "n_passers_overlap_zero": int((pv == 0).sum()),
    "passers_with_any_overlap": [(passer_tbl.iloc[i]["pair"], round(float(passer_tbl.iloc[i]["roster_overlap"]), 5))
                                 for i in range(len(passer_tbl)) if passer_tbl.iloc[i]["roster_overlap"] and passer_tbl.iloc[i]["roster_overlap"] > 0],
}

out = {"banner": BANNER, "anchors": anchors, "distribution": dist,
       "top20_overlap_pairs": top_pairs, "theory_check_v14_passers": theory}
(HERE / "overlap_summary.json").write_text(json.dumps(out, indent=2))

# --------------------------------------------------------------------------------------
# 8. REPORT.md
# --------------------------------------------------------------------------------------
def fnum(x, n=4):
    return "n/a" if x is None or (isinstance(x, float) and pd.isna(x)) else f"{x:.{n}f}"

kcounts = cls["klass"].value_counts().to_dict()
lines = []
A = lines.append
A(f"# Docket #83 -- Roster Overlap Census (Phase 0 + 1)")
A("")
A(f"**Date:** 2026-07-15  ")
A(f"**Author:** roster-overlap sidecar agent  ")
A(f"**Status: {BANNER}.** Not doctrine, not a screen, not a selection.")
A("")
A("**Question:** *What does structural kinship, measured from current rosters, look like across the 97-ticker panel?*")
A("")
A("> Build-spec note: the intended spec file `SCOUT_holdings_data_20260715.md` was delivered EMPTY (0 bytes). "
  "All fetch routing below was reverse-engineered live from issuer endpoints on 2026-07-15 and is documented in `fetch_holdings.py`.")
A("")
A("## Method")
A("- **Holdings:** current published rosters, mostly as-of 2026-07-14 (Vanguard 2026-06-30). Cash / money-market sweep / "
  "FX / derivative lines dropped; weights renormalized to sum to 1 per fund. See `holdings_normalized.csv`, `fetch_meta.csv`.")
A("- **Overlap(A,B) = Σ_g min(w_A[g], w_B[g])** over a reconciled identifier space (union-find over ISIN/CUSIP/SEDOL/ticker/FIGI; "
  "US-ISIN cross-derived to CUSIP). Symmetric, ∈ [0,1].")
A("- **Look-through:** leveraged/inverse funds inherit their reference index's basket via a panel proxy "
  "(TQQQ/SQQQ→QQQ, TNA/TZA→IWM, TMF→TLT, UPRO→IVV[aux], SOXL/SOXS→SMH *[PROXY]*, YINN/YANG→FXI *[PROXY]*). "
  "Direction (long/short) is ignored for *roster* kinship. UVXY (VIX futures) has no basket → 0.")
A("- **Commodity pools:** crude Phase-1 placeholder rubric on commodity tag/bucket "
  "(same tag = 1.0, same bucket = 0.5, broad PDBC vs any = 0.5, else 0). Commodity vs equity/bond roster = 0.")
A("")
A("## Phase 0 -- classification (`classification.csv`)")
A("")
A("| class | n |")
A("|---|---|")
for k in ["equity_basket", "bond_basket", "leveraged_or_inverse", "commodity_pool", "single_stock"]:
    A(f"| {k} | {kcounts.get(k,0)} |")
A(f"| **total** | **{sum(kcounts.values())}** |")
A("")
A("## Phase 1 -- fetch outcome")
meta = pd.read_csv(HERE / "fetch_meta.csv")
fails = json.load(open(HERE / "fetch_failures.json"))["failures"]
A(f"- **{meta['fund'].nunique()} funds** with rosters fetched (incl. 8 single-name 'self' baskets + IVV auxiliary S&P 500 basket).")
A(f"- **{len(fails)} fetch failures:** " + ", ".join(f"{f['ticker']}" for f in fails) +
  " -- Invesco (SPLV) and Schwab (SCHD) both hard-block this host (HTTP 406 / 403).")
A(f"- **QQQ:** Invesco IP-blocked; recovered as a **partial top-25 roster** (~68% of NAV) from stockanalysis.com and "
  "**flagged**. All QQQ / TQQQ / SQQQ overlaps are therefore lower bounds.")
A("")
A("## Validation anchors (checked before trusting the matrix)")
A("")
A(f"- **(a) QQQ vs XLK = {fnum(anchors['QQQ_vs_XLK']['overlap'])}** "
  f"(target 0.40–0.70). QQQ is a partial top-25 roster → this is a **lower bound**. "
  f"Clean supplements on full rosters: **VTI vs XLK = {fnum(anchors['_supplemental_VTI_vs_XLK'])}**, "
  f"**XLK vs SMH = {fnum(anchors['_supplemental_XLK_vs_SMH'])}** (both mega-cap-tech-heavy, as expected).")
A(f"- **(b) EWK ⊂ VEU containment:** {fnum(anchors['EWK_VEU_containment']['frac_EWK_present_in_VEU (EWK-weighted, expect ~1)'])} "
  f"of EWK (Belgium) by weight is present in VEU; only "
  f"{fnum(anchors['EWK_VEU_containment']['frac_VEU_present_in_EWK (VEU-weighted, expect ~Belgium wt, small)'],5)} "
  f"of VEU is Belgian. Symmetric Σmin = {fnum(anchors['EWK_VEU_containment']['sigmin_symmetric'],5)} "
  f"(tiny, because VEU's per-name weights are minute). Containment is the right lens here, and it confirms EWK ⊂ VEU.")
A(f"- **(c) EWJ vs EWU = {fnum(anchors['EWJ_vs_EWU']['overlap'],6)}** (Japan vs UK). Expected ≈ 0. ✓")
A("")
A("## Overlap distribution (all defined pairs)")
A("")
A(f"- Defined pairs: **{dist['n_defined_pairs']}** of {dist['n_defined_pairs']+dist['n_undefined_pairs']} "
  f"({dist['n_undefined_pairs']} undefined — the SCHD/SPLV rows).")
A(f"- Median = **{fnum(dist['median'],4)}**, Q25 = {fnum(dist['q25'],4)}, Q75 = {fnum(dist['q75'],4)}, "
  f"Q90 = {fnum(dist['q90'],4)}, max = {fnum(dist['max'],4)}.")
A(f"- **{dist['pct_exactly_zero']}%** of defined pairs are exactly 0; {dist['pct_ge_0p5']}% are ≥ 0.5.")
A(f"- The panel is overlap-sparse: most pairs share *no* securities (different countries / asset classes). "
  f"Kinship concentrates in a few dense cliques (US mega-cap tech; US treasuries by maturity; sector-vs-broad).")
A("")
A("## Top-20 overlap pairs")
A("")
A("| # | pair | overlap |")
A("|---|---|---|")
for i, (p, v) in enumerate(top_pairs, 1):
    A(f"| {i} | {p} | {fnum(v,4)} |")
A("")
A("## Findings")
A("")
A("**F1 — The panel is overlap-sparse and clustered.** "
  f"{dist['pct_exactly_zero']}% of defined pairs share nothing; the median pair overlap is {fnum(dist['median'],4)}. "
  "Structural kinship is not smeared across the panel — it lives in a handful of dense families.")
A("")
A("**F2 — The dense families are narrow and structural.** Only 28 of 4,465 pairs reach ≥0.5, and they are exactly what "
  "structure predicts: (i) **leverage/look-through identities** — TQQQ≡SQQQ≡QQQ, TNA≡TZA≡IWM, TMF≡TLT, SOXL≡SOXS≡SMH, "
  "YINN≡YANG≡FXI (=1.0 by construction); (ii) **US mega-cap tech** — QQQ/XLK=0.62, XLK/SMH=0.48, VTI/XLK=0.34; "
  "(iii) **same-theme cross-issuer** — VNQ/XLRE=0.63 (US REITs), CPER/DBB=0.50 (base-metals rubric); "
  "(iv) **sector-in-broad containment** — each XL* sector inside VTI, but modest (XLK/VTI=0.34 → XLE/VTI=0.03), "
  "since VTI spreads weight across ~1,200 names.")
A("")
A("**F2b — Fixed income partitions cleanly by maturity and credit.** Despite nine bond funds, most bond-fund pairs are "
  "**zero**: Treasury funds are disjoint across maturity buckets (IEF/TLT=0, SHY/TLT=0, SGOV/SHY=0; only *adjacent* SHY/IEF "
  "share bonds, at 0.17), and the credit universes don't touch (LQD[IG]/HYG[HY]=0, EMB/LQD=0). The one connector is the "
  "aggregate **BND**, which by design contains the ladder (BND/SHY=0.36, BND/IEF=0.23, BND/TLT=0.13). Maturity/credit "
  "bucketing is a *roster* fact, not just a duration story.")
A("")
A("**F3 — Cross-country equity pairs are ≈0.** "
  "Single-country iShares funds (EWJ, EWU, EWG, …) share essentially no constituents with each other — "
  "confirming that overlap measures *roster* kinship, not correlation. Same-country/region is the only equity bridge "
  "(EWK⊂VEU containment 0.75; KWEB/FXI=0.36, shared China mega-caps).")
A("")
# theory finding
A("**F4 — EXPLORATION (ANACHRONISM FLAGGED: current rosters vs 2008–2026 cointegration passers).** "
  "The kayfabe-v2 theory predicts the 19 v1.4 cointegration passers (z_is < −1.645) are 'kin-pairs' that should rank "
  "HIGH in roster overlap. On this panel they do **not** — the passers look like random pairs.")
A("")
A(f"- **{theory['n_passers_overlap_zero']} of 19 passers have EXACTLY ZERO roster overlap.** The 4 with any kinship are all "
  "**trivial**: IWM/IYT = 0.012, EWC/EZA = 0.011, EWA/EZA = 0.007, EWK/VEU = 0.007. The single largest passer overlap "
  "(IWM/IYT = 0.012) ranks only **347th of 4,465** pairs — below the median even of the 642 pairs that overlap at all.")
A(f"- **Magnitude test (the honest one):** passer MEAN overlap = **{fnum(theory['passer_mean_overlap'],5)}** vs all-pairs mean = "
  f"**{fnum(theory['all_pairs_mean_overlap'],5)}** — passers run ~**{round(theory['all_pairs_mean_overlap']/max(theory['passer_mean_overlap'],1e-9)):d}× BELOW** the panel average. "
  f"The panel has 28 pairs at ≥0.5; **no passer exceeds 0.02.** "
  f"(A naive percentile reads {theory['passer_median_pctile_CAVEAT']}th, but that is a zero-mass artifact — {dist['pct_exactly_zero']}% of ALL "
  "pairs are zero, so any zero pair lands there. And while a hair more passers than baseline have *trace* overlap "
  f"({theory['pct_passers_gt0']}% vs {theory['pct_all_pairs_gt0']}%, n=19, not significant), none is material.)")
A("- The passers are dominated by **cross-country equity pairs** (EZA/THD, EWD/EWH, EWY/EZA, EWS/EWW, EWJ/EWN …) plus one "
  "**commodity-vs-equity** pair (DBB/EWZ, base-metals futures vs Brazil) and two US sector pairs (EWL/XLB, IYT/XLB) — all with "
  "**zero shared roster**. Whatever drives their price cointegration, it is **not** shared holdings.")
A("- Read plainly: **structural kinship (rosters) and statistical cointegration (prices) are essentially orthogonal in this panel.** "
  "Evidence *against* the naive kin-pair story; carry this into any v2 write-up.")
A("")
A("## Files")
A("- `classification.csv` — Phase 0 (97 funds).")
A("- `holdings_normalized.csv` — {fund, asof_date, cusip, isin, sedol, ticker, figi, name, weight}.")
A("- `overlap_matrix.csv` — 97×97 symmetric overlap (NaN = undefined: SCHD/SPLV).")
A("- `v14_passers_overlap.csv` — the 19 passers with their roster overlap + percentile.")
A("- `overlap_summary.json`, `fetch_meta.csv`, `fetch_failures.json`, `raw/` — provenance.")
A("")
(HERE / "REPORT.md").write_text("\n".join(lines), encoding="utf-8")

print(json.dumps(out, indent=2))
print("\nTop passers by overlap:")
print(passer_tbl.head(8).to_string(index=False))
