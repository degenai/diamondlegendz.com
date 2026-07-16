# Cointegration Persistence — the §0 Hypothesis Test

**Date: 2026-07-15 · Author: Fable (Claude) · Status: research finding, NOT doctrine**
**Script:** `sidecars/cointegration-20260715/coint_test.py`
**Data:** yfinance auto-adjusted Close, 2008-01-01 → 2026-06-29, single source end-to-end (primary); `data/derived/total_return_panel_v4_2020_2026.csv` (yahoo adjusted close, 97 tickers) as a paired same-window source check only. **Both are survivor panels — every delisted ETF (RSX-class deaths, §1.7) is invisible, which biases cointegration pass rates UP. This caveat applies to every number below.**
**Method:** Engle–Granger residual tests on pairs (statsmodels `coint`, MacKinnon p-values), Johansen trace test on the 5-asset fortress (statsmodels `coint_johansen`), out-of-sample persistence per the pre-registered protocol below.

## Question

**Does a basket/pair that passes a cointegration test IN-SAMPLE continue to mean-revert OUT-OF-SAMPLE?** (§0 of FABLE_BRIEF_20260715; log L1247–1253.)

If YES → a real strategy with a named mechanism. If NO → the demon is dead and we know.

## PROTOCOL — pre-registered 2026-07-15, BEFORE any test was run

Locked ex ante per the literature sweep (Clegg 2014; Rad/Low/Faff 2016; statsmodels docs) and R10 (one estimator per quantity, paired comparisons only):

1. **Windows** (repo convention, both directions per docket L1400 "both directions or it proves nothing"):
   - **A = 2008-04-01 → 2019-12-31** (the fortress OOS era; TUR inception bound)
   - **B = 2020-01-02 → 2026-06-29** (the "OURS" era, v4 panel window)
   - Direction 1: fit A, test B. Direction 2: fit B, test A.
2. **Universe:** the 97-symbol v4 panel. **2008 cohort** = tickers whose yfinance history starts ≤ 2008-04-15, ends ≥ 2026-06-01, with ≥95% coverage of trading days in each window. All C(n,2) cohort pairs. Fortress pairs (10) reported separately.
3. **All price series are LOG adjusted closes.**
4. **In-sample pass:** Engle–Granger via `statsmodels.tsa.stattools.coint`, `trend='c'`, `autolag` at statsmodels default (AIC). Run BOTH normalization directions; a pair's statistic is the direction with the smaller p-value (direction recorded). **Pass = p < 0.05.**
5. **Out-of-sample metrics** (all three computed for every pair, pass groups compared to fail groups):
   - **PRIMARY — frozen-β spread ADF:** α, β from in-sample OLS of the chosen direction (log prices, intercept included). OOS spread s = y − α − βx built on the out-window. `adfuller(s, regression='c', autolag='AIC')`. **Still-mean-reverting = p < 0.05.**
   - **SECONDARY (Clegg-comparable) — fresh re-test:** re-run the full Engle–Granger test on the out-window. Clegg's base rate for this metric: **~5% persistence, ≈ the false-positive rate.** This is the number our result is benchmarked against.
   - **TERTIARY — tradeability gauges:** AR(1) half-life of the frozen spread (in-sample vs OOS; literature's tradeable range 5–30 days), and zero-crossings/yr of the OOS spread against (a) the in-sample mean, (b) the OOS mean.
6. **Fortress basket:** Johansen trace test (`det_order=0`, `k_ar_diff=1`) per window; rank = first r whose trace stat fails the 95% critical value. If rank ≥ 1 in-sample, freeze the first cointegrating vector, apply to out-window log prices, ADF as in 5a. Both directions.
7. **Multiple testing:** no p-value correction (dominant practice in this literature); instead every pass-count is reported next to its **expected-by-chance count (n × 0.05)**, and OOS survival is the decisive filter.
8. **Success criterion, stated before running:** in-sample passage is USEFUL only if the OOS still-mean-reverting rate among in-sample passers **materially exceeds both (a) the rate among in-sample failers and (b) the 5% nominal rate.** If passers ≈ 5%, we have reproduced Clegg and §0 is answered NO.
9. **Source check (R10):** for window B only, EG p-values computed on both yfinance and v4-panel prices for the same pairs; report pass agreement and rank correlation. Paired, same window, same estimator — never compared across windows.
10. **No means anywhere (R1). Medians and counts only.**

## PROTOCOL v1.1 — commodity extension (pre-registered 2026-07-15, while the v1 run was still executing and before ANY v1 result was read)

Operator request (Alex): more commodities in the test universe; named interest: OIL/WHEAT-type combos.

Rationale worth recording: the literature's grim ~5% persistence base rate is for *statistically screened* pairs. The one repeatedly-noted exception is pairs with a **named structural economic linkage**. Energy→agriculture is exactly that (diesel + natgas-derived fertilizer are major wheat input costs). This is a mechanism-first hypothesis, which is the §0 spirit.

1. **Candidate additions** (subject to data-availability check at run time): WEAT, CORN, SOYB, CANE (Teucrium singles), BNO, UGA, DBE (energy), PALL, PPLT (PGMs). Already in panel: USO, UNG, DBA, DBB, CPER, COPX, SLV, SIL, GLDM, PDBC, URA, XLE, XME.
2. **Cohort handling:** Teucrium singles incept 2011-09; they cannot join the 2008 cohort. A separate **2012 cohort** is defined: inception ≤ 2012-01-15, windows **A′ = 2012-02-01 → 2019-12-31**, B unchanged. Same estimators, same thresholds, same three OOS metrics, both directions. Commodity–commodity pairs reported as their own stratum vs. the all-panel base rate — the question is whether the *linkage stratum* beats the base rate.
3. **Caveats registered ex ante:**
   - These are futures-roll ETFs, not spot. Contango/roll drag can break ETF-level cointegration even where the spot relationship is real. A spot-level relationship that fails at the ETF level is a NO for tradeable purposes.
   - UNG is a known corpse in our own atlas (−98.9%); any pair containing it inherits §1.5 corpse risk.
   - Tax character flag for the live book (NOT for the simulator): most of these are K-1 commodity pools with §1256 60/40 treatment inside — at Alex's rates a blended ~4% on marked gains, but K-1 paperwork and the DBB precedent (§2: "DBB is §1256" retraction) both say: verify per-fund structure before any real-money conclusion.
4. **Execution order:** v1.1 runs only after v1 findings are recorded below, as a separate results block. No v1 threshold or metric changes in response to v1 results are permitted in v1.1 — it inherits the frozen protocol exactly.

## Findings

**Run executed 2026-07-15, single execution, no protocol changes after lock.** Panel: one yfinance pull, cached to `yf_panel_2008_2026.csv` for reproducibility. 2008 cohort: **61 tickers** (all five fortress members present). **1,830 pairs per direction.** Raw per-pair rows: `pairs_results.csv`. Machine summary: `results.json`.

### F1. THE §0 ANSWER IS **NO** — in-sample cointegration passage has no out-of-sample predictive value in this universe

Pre-registered criterion #8 required OOS mean-reversion among in-sample passers to materially exceed BOTH the in-sample failers AND the 5% nominal rate. It fails every prong, in both directions:

| direction | IS pass | PRIMARY: OOS frozen-β ADF, passers | …failers | CLEGG metric: fresh EG OOS, passers | …failers |
|---|---|---|---|---|---|
| fit 2008–19 → test 2020–26 | 488/1830 (26.7%) | **3.9%** (19/488) | 2.9% | **8.8%** (43/488) | 9.7% |
| fit 2020–26 → test 2008–19 | 173/1830 (9.5%) | **6.4%** (11/173) | 7.9% | **24.9%** (43/173) | 26.9% |

On the Clegg-comparable metric, in-sample passers persist **at or below the rate of in-sample failers** in both directions. On the primary frozen-β metric, passers sit at or below the 5% nominal false-positive rate. **We reproduced Clegg (2014) on our own universe.** The screen does not select next-window mean-reverters. Note the unconditional fresh-EG rates simply track each window's own in-sample pass rate (9.5% / 26.7%) — passage is a property of the window, not of the pair.

### F2. The fortress itself — the sharpest single result of the night

- **Fit 2008–2019 (n=2,960):** Johansen trace **rank 2 at 95%** (89.3 vs 69.8; 48.4 vs 47.9). The basket WAS cointegrated in the pre-2020 era. Frozen first vector (DBB +1.00, EWU +0.16, EWZ −0.84, GDX +0.20, TUR −0.21) carried into 2020–2026: **ADF p = 0.057 — a near-miss FAIL at the pre-registered α=0.05**, half-life degraded **32d → 83d**, and the OOS spread crossed the old equilibrium **0.15 times/yr** (once per ~6.5 years — the old mean was effectively never revisited).
- **Fit 2020–2026 (n=1,630): Johansen trace rank 0.** 59.7 vs 69.8 at r=0 — fails at 95% and even at 90%. **The fortress is NOT cointegrated in-sample on the very window where its +2.27%/yr trade-added edge was measured.** Whatever paid 2020–2026, it was not an equilibrium relationship detectable by the test that defines one. This independently corroborates §2's lookahead finding (the edge is ex-post drift selection), from a third direction.

### F3. In-sample pass rates are inflated, which makes the zero lift MORE damning

26.7% of all pairs "pass" on 2008–2019 (5.3× nominal); 9.5% on 2020–2026. Survivor-only panel + common-factor loading across country/sector ETFs manufactures in-sample cointegration in bulk. Bias flatters the screen in-sample — and it still shows no OOS lift.

### F4. Source check: yfinance vs v4 panel, window B, 1,830 pairs — pass agreement 1.000, Spearman ρ of p-values 1.000. No source artifact (v4 is yahoo-derived; the two are the same data).

### F5. Individual survivors exist and must not be crowned

EWZ/GDX passes everything in both directions (IS p=.031/.030; OOS frozen p=.024/.020); DBB/EWZ nearly (OOS p=.043/.055). With 1,830 pairs tested twice, naming the survivors after the fact is precisely the §2 lookahead — they are RECORDED here, not selected. Counter-exhibit in the same table: EWZ/TUR fails in-sample on A (p=0.54) yet its frozen spread "passes" OOS at p=0.005 — the false-positive floor produces pretty numbers in both directions.

### F6. Even the survivors are slow

Median OOS half-lives: 221d (passers) vs 310d (failers) in A→B; 443d vs 589d in B→A. The literature's tradeable band is 5–30 days. Nothing here trades.

### Verdict

> **The falsifiable question of §0 is answered: NO. A cointegration test passed in-sample does not predict out-of-sample mean reversion on this panel — the screen's hit rate among its own passers is indistinguishable from (and partly below) chance and below its failers.** The ~1.5%/yr residual mean reversion measured on the actual path (time-reversal, η>1) remains true as a description of the PAST; what died tonight is the claim that Engle–Granger/Johansen passage can select it EX ANTE. Per §0: "If NO: the demon is dead — and we will KNOW." We know.

Still open, pre-registered before this result was read: **v1.1** — the mechanism-linked commodity stratum (oil/wheat-class pairs, 2012 cohort). A linkage-first hypothesis is a different claim than a statistical screen and gets its own run. Also untouched by tonight: the starvation rule (§1.4) stands on its own empirical evidence as a tail guardrail; it never depended on this screen.

---

## Findings — v1.1 (commodity extension; run 2026-07-15, thresholds inherited frozen from v1)

2012 cohort: **93 tickers, 4,278 pairs per direction**; commodity members: 20; energy×agriculture stratum: 30 pairs. Raw rows: `v11_pairs_results.csv`; summary: `v11_results.json`.

### F7. The all-pairs NO replicates on the bigger cohort
fit 2012–19 → test 2020–26: passers OOS-frozen **3.2% vs failers 4.1%**; Clegg metric **9.3% vs 10.8%**. Reverse direction: **2.8% vs 4.8%** and **7.0% vs 8.2%**. In-sample passers do WORSE than failers on every metric in both directions. v1's conclusion is not a small-cohort artifact.

### F8. The commodity–commodity stratum shows a nominal lift that is noise
Clegg-metric lift among commodity pairs: 12.5% vs 6.0% (n=24 passers, k=3) and 23.1% vs 11.9% (n=13, k=3). Binomial check against each direction's failer base rate: P(k≥3) ≈ 0.16–0.19 — **inside noise at these n**. Per the campaign's own signature-failure warning (an exciting claim that agrees with the operator's hypothesis arrives pre-authorized): RECORDED, NOT CROWNED. If anyone wants to believe this, the test is more commodity pairs, pre-registered, not enthusiasm.

### F9. The OIL/WHEAT hypothesis fails at the FIRST hurdle — there is no in-sample relationship to persist
Of 30 energy×ag pairs: **USO/WEAT p=0.48 (2012–19) and 0.55 (2020–26); BNO/WEAT 0.72/0.84** — oil and wheat do not cointegrate at the ETF level in EITHER window. The stratum's only in-sample passers were **UNG-contaminated marginals** (DBA/UNG p=.039, SOYB/UNG p=.047, DBA/USO p=.010), and they went **0-for-3 OOS** — DBA/UNG's frozen spread's OOS half-life is 2,285 days, i.e., the "spread" is just UNG's corpse decay wearing a hedge ratio. The input-cost linkage (diesel/fertilizer → wheat) may be real in spot economics; **it does not survive the futures-roll ETF wrapper**, exactly the caveat registered ex ante in v1.1 §3.

### Verdict v1.1
> **NO again, mechanism stratum included.** The named-linkage hypothesis didn't fail out-of-sample — it failed in-sample, which is cleaner: there is no ETF-level oil/ag equilibrium to trade. The §0 answer stands at NO across 12,216 pair-tests, two cohorts, two directions, and one mechanism stratum.

## PROTOCOLS v1.2 / v1.3 / v1.4 — registered 2026-07-15 (operator approval: "nothing to lose"), locked before any of the three runs

**v1.2 — TARGET SWAP (the economically honest question).** Universe: the 61-ticker 2008 cohort, 1,830 pairs, windows A/B both directions as v1. OOS targets: (i) actual-path **trade-added %/yr** computed exactly per the repo's existing estimator (`the_2x2.py:31-33,46` convention — equal-weight two-leg vs buy-and-hold, annualized log basis), (ii) **η** exactly per `harvest.py:45-54`. IS features: EG p (continuous), spread half-life, IS η, IS trade-added, γ (annualized spread variance), drift gap |g_a − g_b|. **PRIMARY (one number): Spearman ρ between IS EG p-value and OOS trade-added/yr, all pairs, direction A→B. Null band |ρ| < 2/√1830 ≈ 0.047; the demon-advocate prediction of record is ρ < −0.047** (lower p → more OOS harvest). Everything else is a secondary matrix reported without selection. R4: engine imported read-only; policy invocation must be copied verbatim from a committed adversarial script and cited file:line.

**v1.3 — REGIME RESCALE (walk-forward at the decay timescale).** 2008 cohort. Consecutive **non-overlapping 504-trading-day (~2yr) windows** from 2008-04-01 (~9 windows). Per window per pair: EG per v1 estimator. **PRIMARY: adjacent-window persistence — P(pass in window k+1 | pass in window k) vs window k+1's unconditional pass rate** (Clegg at the 2-year scale, on our panel). Secondary: frozen-β spread from window k, ADF on window k+1. Pooled over transitions; α=0.05 frozen.

**v1.4 — INSTRUMENT SWAP (variance ratio).** Same pairs/windows/frozen-β spreads as v1. Statistic: Lo–MacKinlay variance ratio of spread increments, horizons q ∈ {5, 21, 63, 126, 252}d, heteroskedasticity-robust z. **PRIMARY: does IS VR(252) mean-reversion (z < −1.645, one-sided) predict OOS VR(252) mean-reversion above the failer base rate** — both directions. Descriptive: VR profile of the fortress's frozen Johansen-vector spread, IS vs OOS.

**Stopping rule (amended by the operator, 2026-07-15):** 0-for-3 on v1.2/1.3/1.4 ends the **imported-instrument** prediction program (tests borrowed from the literature). It does not end demonology: the operator has explicitly funded a continuing **invented-instrument program** (below) on the advocate's budget — belief until forced fold, one pre-registered shot per instrument, atheism at the referee table.

## THE INVENTED-INSTRUMENT PROGRAM — demon-native regime definitions (candidates, UNREGISTERED, no thresholds yet)

Operator doctrine amendment: own-vocabulary is a feature (novel approach), §5's rule becomes *invent first, collision-check the literature after*. Candidates the data seems to be begging for:

- **THE BITE CENSUS** — regime read from the demon's own ledger, not from prices: when rebalancing buys *alternate* legs (ping-pong) the demon is feeding well; when buys *cluster* on one leg it is feeding a corpse. Regime = trailing alternation rate. The 40:1 bind ratio already lives in this family. Test: is alternation persistent, and does it predict forward trade-added?
- **BREATH** — trailing zero-crossing count of the spread ("the basket is breathing" vs "holding its breath"). Rank-based, outlier-immune, already computed in v1. Test: crossing-rate autocorrelation window-to-window.
- **THE TITLE-CHANGE STAT** — number of lead swaps in cumulative return between legs over a trailing window. A rivalry with many title changes is the harvest phenotype; a champion-and-jobber pair is the corpse phenotype. No quant publishes this. It is exactly what "oscillating against each other" means.
- **KAYFABE DETECTION** — two-timescale state: HIGH short-run return co-movement + LOW trailing drift gap = a *worked* rivalry (the demon's habitat); high co-movement + widening gap = a *shoot* (someone is actually winning; get out). This is §1.6's validated boundary condition `γ vs 4·(g_max−g_min)` recast as a **rolling regime state** — "above the line / below the line" — instead of a fitted screen. Of everything on this list, this is the one the data is begging for: the boundary formula already predicted GME/AMC's death to within 1.2 points.
- Collision-check note: lead-swap ≈ "leadership changes" in ranking literature; crossing-rate ≈ level-crossing theory. Check before publishing, not before playing.

## Findings — v1.2 (target swap; run 2026-07-15 by protocol-bound agent; deviations: none)

Validation gate passed first: fortress 2020–26 actual path reproduced at +2.171%/yr via the byte-identical `the_2x2.py` invocation (residual vs documented +2.27 isolated to Yahoo adjusted-close vintage drift between pulls, not code).

### F10. The advocate's prediction of record FAILED — with the opposite sign
**PRIMARY: Spearman ρ(IS EG p-value, OOS trade-added/yr) = +0.2513 (n=1,830, A→B).** Null band was |ρ|<0.047; the advocate predicted ρ<−0.047. **The screen is ANTI-predictive on the economically honest target: LESS in-sample cointegration → MORE out-of-sample harvest.** In medians: IS passers earn +0.121%/yr OOS vs failers +0.317%/yr (A→B); −0.060 vs +0.136 (B→A). Not γ-mediation: partial rank correlation controlling IS γ stays +0.226 / +0.172.

### F11. The first positive whisper of the night — demon-native self-persistence (recorded, NOT crowned)
IS trade-added → OOS trade-added: **ρ=+0.199**; IS η → OOS η: **ρ=+0.216** — weak, outside the null band, symmetric across directions by construction. The demon's own quantities predict themselves better than any imported statistic predicts them. This is exactly the hunting ground of the invented-instrument program (Bite Census / Title-Change / Kayfabe). Unstable cells (IS γ → OOS ta: +0.296 A→B but +0.026 B→A) are recorded in `v12_results.json` without selection.

## Findings — v1.3 (regime rescale; run 2026-07-15)

### F12. No persistence at the 2-year scale either
9 non-overlapping 504-day windows, pooled over 8 transitions (n_pass=1,650): **P(pass k+1 | pass k) = 12.7% vs unconditional 11.6%** — a 1.09× "lift," oscillating in sign per transition (from 0.53× to 2.2×). Frozen-β ADF on the next window: passers 7.5% vs failers 7.8%. **Clegg reproduces at the 2-year scale on our panel.** Loss 2 of 3.

## Findings — v1.4 (instrument swap): FIRST RUN VOID — instrument defect caught before publication
The as-registered implementation contained two arithmetic bugs (VR divided by q twice — the Lo–MacKinlay normalizer already carries q; z-statistic missing its √n factor, deflating every z ~50×). Caught via internal inconsistency in the fortress profile (VR≈0.0008 alongside z≈−0.04 cannot coexist). **The "0% mean-reverting" output of the first run is an artifact and is VOID.** Script corrected, rerun same night. Per R10/R5: a broken estimator produced a dramatic result, and the defense was mechanical sanity-checking of a known case before belief.

### F13. Corrected v1.4 — the pre-registered criterion is MET: a qualified WIN, and it points at structure
Sanity restored (fortress vector VR(252)=0.209, z=−1.84, consistent with its 32d half-life). The VR criterion at z<−1.645 is far more selective than its nominal 5% on these spreads (IS pass: 0.87% / 0.16% of pairs). Among those rare passers, OOS mean-reversion persistence:

| direction | passers → OOS-MR | failers → OOS-MR |
|---|---|---|
| fit 2008–19 → test 2020–26 | **1/16 = 6.3%** | 4/1,814 = 0.22% |
| fit 2020–26 → test 2008–19 | **2/3 = 66.7%** | 17/1,827 = 0.93% |

Pooled Fisher exact (3/19 vs 21/3,641): **odds ratio 32.3, p = 2.2e-4.** Criterion met in both directions. Caveats owned: 19 passers total, 3 OOS hits — a real effect measured on a handful.

**Who the passers are is the finding:** near-exclusively structurally-kin pairs — MSCI country siblings (EWS/EZA, EWH/EWT, EWJ/EWN…), industrial-cycle siblings (IYT/XLB — an OOS survivor in B→A), a parent-child containment pair (EWK/VEU — Belgium inside all-world ex-US), commodity-market twins (EWC/EZA — OOS survivor), and DBB/EWZ (v1's fortress star). **The extreme tail of a conservative long-horizon MR statistic finds structural kinship — worked rivalries, in the invented program's vocabulary — and structural kinship is what persists.** This is the same lesson as F11 and the census's η≈1 stratum, arrived at by a third instrument.

### FINAL SCOREBOARD — imported-instrument program
| protocol | verdict |
|---|---|
| v1 (EG/Johansen screen, binary) | **LOSS** — no lift, fortress rank 0 in its own era |
| v1.1 (mechanism stratum, same screen) | **LOSS** — oil/wheat fails in-sample; commodity "lift" = binomial noise |
| v1.2 (target swap to trade-added/η) | **LOSS, inverted** — EG p ANTI-predicts harvest (ρ=+0.25); demon-native self-persistence ρ≈+0.20 is the night's one positive whisper |
| v1.3 (2-yr walk-forward) | **LOSS** — 12.7% vs 11.6%, no persistence |
| v1.4 (variance ratio, corrected) | **QUALIFIED WIN** — criterion met, OR=32, p=2.2e-4, n tiny, effect = structural pairs |

**The stopping rule does NOT fire** (not 0-for-3). The imported program survives on exactly one instrument — its most conservative — and what that instrument finds converges with F11 and the commodity census on a single sentence: **the demon's persistent food is structural kinship between assets, not statistical cointegration at conventional thresholds.** The invented-instrument program (docket items 81–82) inherits this as its working hypothesis.

## ROUND-ROBIN DOCTRINE (operator request, 2026-07-15)
Ablations and atlases continue **as descriptive science** — round-robin censuses run for the data, not for selection. First subject: the 190-commodity-pair census (`sidecars/commodity-roundrobin-20260715/`), including oil — a failed cointegration screen does not exempt a stratum from having its behavior documented.
