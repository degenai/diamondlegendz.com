# Docket #83 -- Roster Overlap Census (Phase 0 + 1)

**Date:** 2026-07-15  
**Author:** roster-overlap sidecar agent  
**Status: DESCRIPTIVE CENSUS -- NOT A SELECTION.** Not doctrine, not a screen, not a selection.

**Question:** *What does structural kinship, measured from current rosters, look like across the 97-ticker panel?*

> Build-spec note: the intended spec file `SCOUT_holdings_data_20260715.md` was delivered EMPTY (0 bytes). All fetch routing below was reverse-engineered live from issuer endpoints on 2026-07-15 and is documented in `fetch_holdings.py`.

## Method
- **Holdings:** current published rosters, mostly as-of 2026-07-14 (Vanguard 2026-06-30). Cash / money-market sweep / FX / derivative lines dropped; weights renormalized to sum to 1 per fund. See `holdings_normalized.csv`, `fetch_meta.csv`.
- **Overlap(A,B) = Σ_g min(w_A[g], w_B[g])** over a reconciled identifier space (union-find over ISIN/CUSIP/SEDOL/ticker/FIGI; US-ISIN cross-derived to CUSIP). Symmetric, ∈ [0,1].
- **Look-through:** leveraged/inverse funds inherit their reference index's basket via a panel proxy (TQQQ/SQQQ→QQQ, TNA/TZA→IWM, TMF→TLT, UPRO→IVV[aux], SOXL/SOXS→SMH *[PROXY]*, YINN/YANG→FXI *[PROXY]*). Direction (long/short) is ignored for *roster* kinship. UVXY (VIX futures) has no basket → 0.
- **Commodity pools:** crude Phase-1 placeholder rubric on commodity tag/bucket (same tag = 1.0, same bucket = 0.5, broad PDBC vs any = 0.5, else 0). Commodity vs equity/bond roster = 0.

## Phase 0 -- classification (`classification.csv`)

| class | n |
|---|---|
| equity_basket | 60 |
| bond_basket | 9 |
| leveraged_or_inverse | 11 |
| commodity_pool | 9 |
| single_stock | 8 |
| **total** | **97** |

## Phase 1 -- fetch outcome
- **76 funds** with rosters fetched (incl. 8 single-name 'self' baskets + IVV auxiliary S&P 500 basket).
- **2 fetch failures:** SCHD, SPLV -- Invesco (SPLV) and Schwab (SCHD) both hard-block this host (HTTP 406 / 403).
- **QQQ:** Invesco IP-blocked; recovered as a **partial top-25 roster** (~68% of NAV) from stockanalysis.com and **flagged**. All QQQ / TQQQ / SQQQ overlaps are therefore lower bounds.

## Validation anchors (checked before trusting the matrix)

- **(a) QQQ vs XLK = 0.6163** (target 0.40–0.70). QQQ is a partial top-25 roster → this is a **lower bound**. Clean supplements on full rosters: **VTI vs XLK = 0.3378**, **XLK vs SMH = 0.4781** (both mega-cap-tech-heavy, as expected).
- **(b) EWK ⊂ VEU containment:** 0.7499 of EWK (Belgium) by weight is present in VEU; only 0.00678 of VEU is Belgian. Symmetric Σmin = 0.00678 (tiny, because VEU's per-name weights are minute). Containment is the right lens here, and it confirms EWK ⊂ VEU.
- **(c) EWJ vs EWU = 0.000000** (Japan vs UK). Expected ≈ 0. ✓

## Overlap distribution (all defined pairs)

- Defined pairs: **4465** of 4656 (191 undefined — the SCHD/SPLV rows).
- Median = **0.0000**, Q25 = 0.0000, Q75 = 0.0000, Q90 = 0.0040, max = 1.0000.
- **85.6%** of defined pairs are exactly 0; 0.6% are ≥ 0.5.
- The panel is overlap-sparse: most pairs share *no* securities (different countries / asset classes). Kinship concentrates in a few dense cliques (US mega-cap tech; US treasuries by maturity; sector-vs-broad).

## Top-20 overlap pairs

| # | pair | overlap |
|---|---|---|
| 1 | SMH/SOXL | 1.0000 |
| 2 | SMH/SOXS | 1.0000 |
| 3 | SOXL/SOXS | 1.0000 |
| 4 | QQQ/SQQQ | 1.0000 |
| 5 | QQQ/TQQQ | 1.0000 |
| 6 | SQQQ/TQQQ | 1.0000 |
| 7 | FXI/YANG | 1.0000 |
| 8 | FXI/YINN | 1.0000 |
| 9 | TLT/TMF | 1.0000 |
| 10 | YANG/YINN | 1.0000 |
| 11 | IWM/TNA | 1.0000 |
| 12 | IWM/TZA | 1.0000 |
| 13 | TNA/TZA | 1.0000 |
| 14 | UPRO/VTI | 0.8883 |
| 15 | VNQ/XLRE | 0.6279 |
| 16 | QQQ/XLK | 0.6163 |
| 17 | SQQQ/XLK | 0.6163 |
| 18 | TQQQ/XLK | 0.6163 |
| 19 | CPER/DBB | 0.5000 |
| 20 | CPER/PDBC | 0.5000 |

## Findings

**F1 — The panel is overlap-sparse and clustered.** 85.6% of defined pairs share nothing; the median pair overlap is 0.0000. Structural kinship is not smeared across the panel — it lives in a handful of dense families.

**F2 — The dense families are narrow and structural.** Only 28 of 4,465 pairs reach ≥0.5, and they are exactly what structure predicts: (i) **leverage/look-through identities** — TQQQ≡SQQQ≡QQQ, TNA≡TZA≡IWM, TMF≡TLT, SOXL≡SOXS≡SMH, YINN≡YANG≡FXI (=1.0 by construction); (ii) **US mega-cap tech** — QQQ/XLK=0.62, XLK/SMH=0.48, VTI/XLK=0.34; (iii) **same-theme cross-issuer** — VNQ/XLRE=0.63 (US REITs), CPER/DBB=0.50 (base-metals rubric); (iv) **sector-in-broad containment** — each XL* sector inside VTI, but modest (XLK/VTI=0.34 → XLE/VTI=0.03), since VTI spreads weight across ~1,200 names.

**F2b — Fixed income partitions cleanly by maturity and credit.** Despite nine bond funds, most bond-fund pairs are **zero**: Treasury funds are disjoint across maturity buckets (IEF/TLT=0, SHY/TLT=0, SGOV/SHY=0; only *adjacent* SHY/IEF share bonds, at 0.17), and the credit universes don't touch (LQD[IG]/HYG[HY]=0, EMB/LQD=0). The one connector is the aggregate **BND**, which by design contains the ladder (BND/SHY=0.36, BND/IEF=0.23, BND/TLT=0.13). Maturity/credit bucketing is a *roster* fact, not just a duration story.

**F3 — Cross-country equity pairs are ≈0.** Single-country iShares funds (EWJ, EWU, EWG, …) share essentially no constituents with each other — confirming that overlap measures *roster* kinship, not correlation. Same-country/region is the only equity bridge (EWK⊂VEU containment 0.75; KWEB/FXI=0.36, shared China mega-caps).

**F4 — EXPLORATION (ANACHRONISM FLAGGED: current rosters vs 2008–2026 cointegration passers).** The kayfabe-v2 theory predicts the 19 v1.4 cointegration passers (z_is < −1.645) are 'kin-pairs' that should rank HIGH in roster overlap. On this panel they do **not** — the passers look like random pairs.

- **15 of 19 passers have EXACTLY ZERO roster overlap.** The 4 with any kinship are all **trivial**: IWM/IYT = 0.012, EWC/EZA = 0.011, EWA/EZA = 0.007, EWK/VEU = 0.007. The single largest passer overlap (IWM/IYT = 0.012) ranks only **347th of 4,465** pairs — below the median even of the 642 pairs that overlap at all.
- **Magnitude test (the honest one):** passer MEAN overlap = **0.00194** vs all-pairs mean = **0.01292** — passers run ~**7× BELOW** the panel average. The panel has 28 pairs at ≥0.5; **no passer exceeds 0.02.** (A naive percentile reads 85.6th, but that is a zero-mass artifact — 85.6% of ALL pairs are zero, so any zero pair lands there. And while a hair more passers than baseline have *trace* overlap (21.1% vs 14.4%, n=19, not significant), none is material.)
- The passers are dominated by **cross-country equity pairs** (EZA/THD, EWD/EWH, EWY/EZA, EWS/EWW, EWJ/EWN …) plus one **commodity-vs-equity** pair (DBB/EWZ, base-metals futures vs Brazil) and two US sector pairs (EWL/XLB, IYT/XLB) — all with **zero shared roster**. Whatever drives their price cointegration, it is **not** shared holdings.
- Read plainly: **structural kinship (rosters) and statistical cointegration (prices) are essentially orthogonal in this panel.** Evidence *against* the naive kin-pair story; carry this into any v2 write-up.

## Files
- `classification.csv` — Phase 0 (97 funds).
- `holdings_normalized.csv` — {fund, asof_date, cusip, isin, sedol, ticker, figi, name, weight}.
- `overlap_matrix.csv` — 97×97 symmetric overlap (NaN = undefined: SCHD/SPLV).
- `v14_passers_overlap.csv` — the 19 passers with their roster overlap + percentile.
- `overlap_summary.json`, `fetch_meta.csv`, `fetch_failures.json`, `raw/` — provenance.
