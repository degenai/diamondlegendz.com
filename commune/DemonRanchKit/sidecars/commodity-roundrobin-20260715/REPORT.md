# Commodity Round-Robin — a Descriptive Census of the Commodity Stratum Under the Demon

**Date: 2026-07-15 · Author: census agent (Claude) · Status: DESCRIPTIVE CENSUS — NOT DOCTRINE, NOT a screen, NOT a selection procedure, NOT a recommendation**
**Script:** `sidecars/commodity-roundrobin-20260715/census.py` (engine imported read-only, R4); validation `validate.py`
**Data:** yahoo auto-adjusted close, cached, single source: `sidecars/cointegration-20260715/yf_panel_2008_2026.csv` joined column-wise with `yf_commodities_2011_2026.csv`. **Survivor panel** — every delisted commodity ETF (the graveyard is 43% of the 2006–2012 commodity cohort, §1.7) is invisible here, so every drawdown and bind-rate below is a *lower* bound on the stratum's real tail. UNG is the one corpse that survived long enough to stay in-frame.
**Method:** All 190 commodity–commodity pairs of the 20-ticker set {BNO CANE COPX CORN CPER DBA DBB DBE PALL PPLT SIL SLV SOYB UGA UNG URA USO WEAT XLE XME}, on two windows (A′ = 2012-02-01…2019-12-31, B = 2020-01-02…2026-06-29), skipping any pair-window with <500 aligned days (**0 were skipped; all 380 pair-windows ran**). One estimator per quantity (R10), copied from the committed scripts and cited in `census.py`:
- **trade-added %/yr** — actual path, equal-weight two-leg, 5% band, repo costs, `exec_mode="chunked", quantum_bps=10` (`the_2x2.py:31-33,46`); annualized as `log1p(ta_total/100)/yrs`.
- **eta** — `harvest.py:45-54`: `(g_dem − mean_g)/(gamma/8)`.
- **gamma** — annualized spread variance `var(Ra−Rb, ddof=1)·252` (`harvest.py:46`).
- **drift gap** `|ga−gb|`, g = `log(P[-1]/P[0])/T` (`harvest.py:26`).
- **breath** — zero-crossings/yr of the unit-hedge spread `log Pa − log Pb` about its own window mean.
- **per-leg max drawdown** — `min(P/cummax − 1)` within the window.
- **§1.4 starvation bind** — either leg's deepest drawdown ≤ −80% off its running high (`FABLE_BRIEF_20260715 §1.4`); **days-below** = days either leg sits ≤ −80%.
- Medians and counts only, no means (R1).

**VALIDATION GATE (passed before any census number was trusted).** Reproduced the committed fortress figure with the census harness on cached data: DBB/EWU/EWZ/GDX/TUR, 5% band, actual path, 2020-2026 → **total +14.87%, +2.15%/yr**, which bit-matches `RESEARCH_DOCKET.md:1605` ("2020-01..2026-06 … +14.87% … +2.15%/yr"; the +2.27%/yr figure elsewhere is the shorter 6.1-yr slice). Engine invocation confirmed correct; no pure-numpy fallback needed.

## Question

**What does the commodity stratum actually DO under the demon, described without selection?** The cointegration screen (v1.1) already returned NO — there is no ETF-level oil/ag equilibrium to trade, and the stratum's only in-sample coint passers were UNG-contaminated marginals. That result forbids *selecting* these pairs on a mean-reversion claim. It says nothing about how the equal-weight rebalancer *behaves* when simply pointed at every pair. This census documents that behavior — the harvest, the corpse-feeding, the tail — as description, and crowns nothing.

## Findings

### F1. Trade-added is mostly small and positive; the median commodity pair "works" a little, both windows

DESCRIPTIVE CENSUS — NOT A SELECTION.

| window | n pairs | median ta/yr | q25 | q75 | min (pair) | max (pair) |
|---|---|---|---|---|---|---|
| 2012-2019 | 190 | **+0.73%/yr** | +0.01 | +1.23 | −6.69 (PALL/URA) | +3.03 (UNG/URA) |
| 2020-2026 | 190 | **+0.78%/yr** | −0.22 | +1.49 | −8.88 (UNG/URA) | +4.56 (PALL/UNG) |

The central tendency is a modest positive harvest (~0.7–0.8%/yr median) — the demon extracts a little from most commodity dispersion. But the lower quartile crosses zero in window B, and the tails are wide and asymmetric to the downside. **Note UNG/URA is the single BEST pair in 2012-2019 (+3.03) and the single WORST in 2020-2026 (−8.88)** — same two tickers, opposite sign across windows. That inversion is the whole story of the stratum (F2, F4) in one row: when the corpse-to-be still oscillates, the demon harvests it; when it decays one-way against a trending partner (uranium's 2020-26 bull), the demon feeds it.

### F2. UNG contamination is visible in the numbers — the corpse splits the stratum

DESCRIPTIVE CENSUS — NOT A SELECTION.

| window | group | n | median ta/yr | starvation bind |
|---|---|---|---|---|
| 2012-2019 | UNG pairs | 19 | +1.24%/yr | **19/19 (100%)** |
| 2012-2019 | non-UNG | 171 | +0.69%/yr | 66/171 (38.6%) |
| 2020-2026 | UNG pairs | 19 | **−3.67%/yr** | **19/19 (100%)** |
| 2020-2026 | non-UNG | 171 | +0.88%/yr | 18/171 (10.5%) |

UNG (natural gas, −92.5% off its running high in window B, the atlas corpse) **binds the starvation rule in 100% of its pairs, both windows** — it is always ≥80% below its own high. In 2012-2019 UNG was still volatile enough to oscillate, so UNG-pairs actually show the *highest* group median (+1.24) — the demon harvested its swings. In 2020-2026 UNG just decayed, and every UNG pair's median collapses to **−3.67%/yr** while the rest of the stratum sits at +0.88. The six worst 2020-26 pairs are all UNG-legged (UNG/URA −8.9, COPX/UNG −8.0, UNG/XME −7.9, UGA/UNG −6.4, SLV/UNG −5.4, UNG/XLE −5.3), each with UNG parked ≥80% down for **703 of ~1,600 days**. This is §1.5's corpse-feeding mechanism (GME/AMC), in commodities, with no meme stocks.

### F3. The starvation rule binds ~13× more often here than in the wider atlas

DESCRIPTIVE CENSUS — NOT A SELECTION.

| scope | binds / pair-windows | rate | vs atlas base |
|---|---|---|---|
| whole census | 122 / 380 | **32.1%** | 2.4% → **13.4×** |
| 2012-2019 | 85 / 190 | 44.7% | 18.6× |
| 2020-2026 | 37 / 190 | 19.5% | 8.1× |

The atlas base rate for the rule binding is **2.4% of normal worlds** (`FABLE_BRIEF §1.4`, the "40:1 tail ratio"). In this stratum it binds **32.1% of pair-windows** — an order of magnitude more, because single-commodity ETFs routinely draw down >80% (roll drag + spot cyclicality): the deepest legs in-panel are UNG −92.5%, USO −83.8%, URA −81.4%, WEAT −80.8%, BNO −80.3%, plus SIL/COPX/XME in the −77 to −80% band. **But the two windows are qualitatively different binds.** Median days-below among binding pairs: **2012-2019 = 23 days** (transient touches — survivors like URA, SIL, COPX, BNO, WEAT dipping just past −80% in the 2015-16 commodity collapse, then recovering) vs **2020-2026 = 703 days** (the permanent UNG/USO corpse floor). This is exactly §1.4's stated failure mode made concrete: *the rule cannot tell a volatile survivor from a corpse.* In this stratum most 2012-19 binds are false alarms on legs that recovered — the rule would have starved them at the bottom.

### F4. High-gamma pairs harvest more; low-gamma pairs are the fragile ones — descriptively consistent with §1.8

DESCRIPTIVE CENSUS — NOT A SELECTION. gamma split at the within-window median.

| window | group | median ta/yr | median eta | bind |
|---|---|---|---|---|
| 2012-2019 | HIGH-gamma (≥0.101) | **+1.19** | 0.98 | 56/95 |
| 2012-2019 | LOW-gamma (<0.101) | +0.24 | 1.01 | 29/95 |
| 2020-2026 | HIGH-gamma (≥0.169) | **+0.99** | 1.00 | 33/95 |
| 2020-2026 | LOW-gamma (<0.169) | +0.73 | 0.93 | 4/95 |

Higher spread variance → more harvest (higher median trade-added) in both windows — the demon eats dispersion, and gamma measures dispersion. eta (harvest efficiency) sits near **1.0 across the whole stratum** (census-wide median 0.97–1.0, q25–q75 ≈ 0.91–1.06), materially *higher and tighter* than the 0.62–0.81 that `harvest.py` found on the meme books: these oscillating commodity spreads are almost fully harvestable, realized premium ≈ the theoretical gamma/8. **This does not license a "buy high-gamma" screen** — §1.8's inversion warns that low-gamma books are the ones a death kills, and the high-gamma group here is exactly where the deep-drawdown legs (and thus the binds) concentrate. It is a description of the joint distribution, not a lever.

### F5. The oil × agriculture sub-table, in full (operator's stated interest)

The cointegration screen (v1.1 F9) found **no** ETF-level oil/ag equilibrium — USO/WEAT coint p = 0.48/0.55, BNO/WEAT 0.72/0.84. It could select nothing here. The demon does not need cointegration; it harvests oscillation. Here is what it actually did on every energy×ag pair (the v1.1 30-pair stratum: energy {BNO UGA USO UNG DBE XLE} × ag {CANE CORN SOYB WEAT DBA}), sorted by trade-added, **negatives included and not hidden.**

DESCRIPTIVE CENSUS — NOT A SELECTION. **2012-2019** (n=30, median ta/yr **+0.80**, 25/30 positive):

| pair | ta/yr | eta | gamma | drift | cross/yr | dd_a | dd_b | bind |
|---|---|---|---|---|---|---|---|---|
| WEAT/XLE | **−1.77** | 1.01 | 0.091 | 0.179 | 3.42 | −80.8 | −46.8 | 1 |
| CANE/XLE | −1.47 | 0.76 | 0.092 | 0.159 | 5.95 | −74.5 | −46.8 | 0 |
| CORN/XLE | −0.93 | 1.00 | 0.069 | 0.138 | 4.94 | −73.0 | −46.8 | 0 |
| SOYB/UNG | −0.21 | 0.95 | 0.183 | 0.160 | 1.90 | −50.3 | −84.8 | 1 |
| DBA/XLE | −0.02 | 1.05 | 0.043 | 0.077 | 4.94 | −51.2 | −46.8 | 0 |
| SOYB/USO | +0.43 | 0.96 | 0.112 | 0.097 | 3.42 | −50.3 | −81.0 | 1 |
| SOYB/XLE | +0.47 | 0.90 | 0.062 | 0.047 | 8.73 | −50.3 | −46.8 | 0 |
| DBE/SOYB | +0.54 | 0.76 | 0.075 | 0.041 | 5.06 | −71.7 | −50.3 | 0 |
| DBA/UNG | +0.55 | 1.08 | 0.160 | 0.130 | 0.63 | −51.2 | −84.8 | 1 |
| DBE/WEAT | +0.57 | 1.06 | 0.102 | 0.091 | 5.19 | −71.7 | −80.8 | 1 |
| CANE/UGA | +0.63 | 0.83 | 0.135 | 0.089 | 5.95 | −74.5 | −68.5 | 0 |
| DBA/USO | +0.68 | 0.98 | 0.092 | 0.068 | 3.42 | −51.2 | −81.0 | 1 |
| CANE/DBE | +0.69 | 0.91 | 0.104 | 0.071 | 4.43 | −74.5 | −71.7 | 0 |
| CORN/DBE | +0.72 | 0.95 | 0.082 | 0.050 | 3.16 | −73.0 | −71.7 | 0 |
| DBA/DBE | +0.73 | 1.09 | 0.055 | 0.011 | 2.28 | −51.2 | −71.7 | 0 |
| UGA/WEAT | +0.87 | 1.20 | 0.133 | 0.109 | 5.95 | −68.5 | −80.8 | 1 |
| CORN/UGA | +0.88 | 0.95 | 0.112 | 0.068 | 2.66 | −73.0 | −68.5 | 0 |
| BNO/SOYB | +1.01 | 0.89 | 0.105 | 0.041 | 4.56 | −80.3 | −50.3 | 1 |
| BNO/CANE | +1.04 | 0.91 | 0.134 | 0.071 | 4.18 | −80.3 | −74.5 | 1 |
| SOYB/UGA | +1.07 | 0.86 | 0.104 | 0.023 | 4.56 | −50.3 | −68.5 | 0 |
| BNO/WEAT | +1.10 | 1.13 | 0.134 | 0.090 | 2.40 | −80.3 | −80.8 | 1 |
| DBA/UGA | +1.17 | 1.11 | 0.085 | 0.007 | 3.80 | −51.2 | −68.5 | 0 |
| BNO/DBA | +1.18 | 1.12 | 0.085 | 0.011 | 2.78 | −80.3 | −51.2 | 1 |
| BNO/CORN | +1.19 | 1.02 | 0.113 | 0.050 | 4.68 | −80.3 | −73.0 | 1 |
| CANE/USO | +1.45 | 0.84 | 0.139 | 0.014 | 3.80 | −74.5 | −81.0 | 1 |
| CORN/USO | +1.46 | 0.96 | 0.121 | 0.007 | 7.09 | −73.0 | −81.0 | 1 |
| USO/WEAT | +1.75 | 1.05 | 0.142 | 0.034 | 4.94 | −81.0 | −80.8 | 1 |
| CORN/UNG | +1.85 | 1.03 | 0.180 | 0.069 | 5.95 | −73.0 | −84.8 | 1 |
| CANE/UNG | +2.38 | 0.96 | 0.218 | 0.048 | 3.54 | −74.5 | −84.8 | 1 |
| UNG/WEAT | **+2.57** | 1.05 | 0.201 | 0.029 | 8.10 | −84.8 | −80.8 | 1 |

DESCRIPTIVE CENSUS — NOT A SELECTION. **2020-2026** (n=30, median ta/yr **+1.06**, 23/30 positive):

| pair | ta/yr | eta | gamma | drift | cross/yr | dd_a | dd_b | bind |
|---|---|---|---|---|---|---|---|---|
| DBA/UNG | **−3.67** | 1.09 | 0.381 | 0.364 | 1.08 | −20.4 | −92.5 | 1 |
| SOYB/UNG | −2.76 | 1.03 | 0.388 | 0.336 | 0.77 | −31.0 | −92.5 | 1 |
| CANE/UNG | −1.76 | 1.05 | 0.420 | 0.324 | 1.08 | −41.7 | −92.5 | 1 |
| UGA/WEAT | −1.02 | 0.98 | 0.219 | 0.223 | 0.77 | −73.4 | −67.8 | 0 |
| CORN/UNG | −0.77 | 1.04 | 0.393 | 0.286 | 0.46 | −45.2 | −92.5 | 1 |
| WEAT/XLE | −0.24 | 0.97 | 0.174 | 0.175 | 1.70 | −67.8 | −60.6 | 0 |
| DBE/WEAT | −0.23 | 0.96 | 0.142 | 0.158 | 4.18 | −52.7 | −67.8 | 0 |
| CORN/UGA | +0.03 | 0.91 | 0.181 | 0.162 | 2.63 | −45.2 | −73.4 | 0 |
| CORN/DBE | +0.30 | 0.77 | 0.110 | 0.097 | 3.71 | −45.2 | −52.7 | 0 |
| CORN/XLE | +0.58 | 0.95 | 0.136 | 0.114 | 1.39 | −45.2 | −60.6 | 0 |
| BNO/WEAT | +0.70 | 0.96 | 0.202 | 0.149 | 2.94 | −72.3 | −67.8 | 0 |
| CANE/UGA | +0.88 | 0.97 | 0.173 | 0.124 | 5.41 | −41.7 | −73.4 | 0 |
| DBE/SOYB | +0.89 | 0.87 | 0.098 | 0.047 | 5.57 | −52.7 | −31.0 | 0 |
| SOYB/UGA | +0.99 | 0.94 | 0.168 | 0.112 | 5.41 | −31.0 | −73.4 | 0 |
| DBA/DBE | +1.06 | 0.97 | 0.089 | 0.020 | 5.57 | −20.4 | −52.7 | 0 |
| SOYB/XLE | +1.06 | 0.93 | 0.120 | 0.064 | 4.64 | −31.0 | −60.6 | 0 |
| CANE/DBE | +1.10 | 1.00 | 0.111 | 0.059 | 3.40 | −41.7 | −52.7 | 0 |
| DBA/XLE | +1.13 | 0.91 | 0.108 | 0.037 | 5.72 | −20.4 | −60.6 | 0 |
| DBA/UGA | +1.21 | 0.88 | 0.161 | 0.085 | 5.41 | −20.4 | −73.4 | 0 |
| CANE/XLE | +1.25 | 1.07 | 0.128 | 0.076 | 3.71 | −41.7 | −60.6 | 0 |
| UNG/WEAT | +1.31 | 0.96 | 0.426 | 0.225 | 1.08 | −92.5 | −67.8 | 1 |
| BNO/CORN | +1.44 | 0.97 | 0.169 | 0.088 | 3.09 | −72.3 | −45.2 | 0 |
| DBA/USO | +1.79 | 1.10 | 0.173 | 0.086 | 5.88 | −20.4 | −83.8 | 1 |
| BNO/SOYB | +1.80 | 0.97 | 0.158 | 0.038 | 4.02 | −72.3 | −31.0 | 0 |
| BNO/DBA | +1.94 | 1.04 | 0.149 | 0.010 | 5.57 | −72.3 | −20.4 | 0 |
| BNO/CANE | +2.05 | 1.12 | 0.160 | 0.050 | 2.17 | −72.3 | −41.7 | 0 |
| SOYB/USO | +2.05 | 1.02 | 0.183 | 0.059 | 6.81 | −31.0 | −83.8 | 1 |
| CANE/USO | +2.47 | 1.13 | 0.187 | 0.047 | 4.02 | −41.7 | −83.8 | 1 |
| CORN/USO | +2.48 | 1.04 | 0.192 | 0.009 | 4.64 | −45.2 | −83.8 | 1 |
| USO/WEAT | **+2.50** | 0.97 | 0.224 | 0.052 | 2.48 | −83.8 | −67.8 | 1 |

**Strict oil × ag** (the operator's literal "oil/wheat" — BNO/USO × {CANE CORN SOYB WEAT DBA}, 10 pairs/window):

| window | n | median ta/yr | range | positive |
|---|---|---|---|---|
| 2012-2019 | 10 | **+1.14%/yr** | +0.43 … +1.75 | **10/10** |
| 2020-2026 | 10 | **+1.99%/yr** | +0.70 … +2.50 | **10/10** |

**Verdict on oil × ag:** every oil×ag pair posts positive actual-path trade-added in both windows — median +1.14%/yr then +1.99%/yr — and **USO/WEAT, the literal oil-and-wheat pair, is the single strongest oil×ag combo in both windows (+1.75, +2.50).** This is not a contradiction of the cointegration NO: there is no equilibrium spread to bet on, and none of this was selectable ex ante. What the demon collects is the ordinary dispersion harvest (eta ≈ 1.0, low drift gap, ~3–5 breaths/yr), the same +1%-ish it collects from most of the stratum — oil×ag is unremarkable *within* the census, neither the best nor a special linkage, just plainly positive. The negatives in the wider energy×ag table are where a corpse (UNG) or a one-way trend (XLE 2012-19, drift gap ≥ gamma) sits on one leg: WEAT/XLE −1.77 and DBA/UNG −3.67 are the two poles, and both are drift-gap-dominated (§1.6: the demon loses when 4·drift_gap overwhelms gamma).

## Verdict

> **Described without selection: the demon extracts a small, mostly-positive dispersion harvest (~+0.7–0.8%/yr median) from the commodity stratum, with eta ≈ 1.0 — these spreads are almost fully harvestable — but it does so while binding the starvation rule 13× more often than the wider atlas (32% of pair-windows vs 2.4%), because commodity ETFs routinely draw down past −80%.** The stratum splits cleanly on the corpse: UNG binds 100% of its pairs and flips from the stratum's best group (+1.24, when it oscillated 2012-19) to its worst (−3.67, when it decayed 2020-26). Oil×ag is plainly positive in both windows (median +1.14 then +1.99, USO/WEAT strongest) — the demon harvests it fine, but there is nothing to *select*, exactly as the cointegration screen found. This is a census of behavior, not a portfolio. Nothing here is crowned.

---
**Files:** `census.py`, `validate.py`, `commodity_census.csv` (380 rows), `census_summary.json`, this `REPORT.md`. All in `sidecars/commodity-roundrobin-20260715/`. No existing repo file was modified (R4).
