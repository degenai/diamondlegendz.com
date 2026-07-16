# Kayfabe Detection — first pre-registered shot (docket item 82)

**Date: 2026-07-15 · Author: Fable (Claude) · Status: research finding, NOT doctrine**
**Script:** `sidecars/kayfabe-20260715/kayfabe_test.py` (implementation delegated to protocol-bound agent)
**Data:** cached yfinance panel `sidecars/cointegration-20260715/yf_panel_2008_2026.csv` (single source), 61-ticker 2008 cohort, 1,830 pairs.
**Method:** rolling kayfabe margin vs forward actual-path harvest, engine estimators verbatim.

## Question

§1.6's validated boundary (`γ > 4·(g_max−g_min) − 8ln2/T`; called GME/AMC within 1.2 points ex post) — is it measurable EX ANTE as a rolling regime state ("worked" vs "shoot"), and does that state forward-predict the demon's harvest better than naive persistence?

## PROTOCOL — locked 2026-07-15 BEFORE any run. Invented-instrument program rules: one shot, referee kills without appeal.

1. **The state.** At the first trading day of each year y ∈ {2012…2025} (14 samples), per pair:
   - `γ_t` = annualized variance of the daily return spread over the trailing **126** trading days (harvest.py:26 convention).
   - `gap_t` = |annualized log growth difference| over the trailing **756** trading days.
   - **K_t = γ_t − 4·gap_t.** The 8ln2/T horizon term is dropped (conservative omission; stated, not fitted). Windows chosen from first principles (γ needs a regime-scale window; drift needs length); **no window shopping permitted.**
2. **Forward target:** calendar-year-y actual-path trade-added %/yr of the equal-weight 5%-band pair book, computed with the VERBATIM engine invocation already validated in `sidecars/cointegration-20260715/v12_target_swap.py` (which reproduced the fortress at +2.171%/yr). R10: no parallel estimators.
3. **PRIMARY 1 — is it a state?** Pooled P(K>0 at year y+1 | K>0 at year y) vs unconditional P(K>0). A state requires material lift.
4. **PRIMARY 2 — does it pay?** Per year: cross-sectional Spearman ρ(K_t, forward-year trade-added) over all eligible pairs. **Statistic of record: the median of the 14 yearly ρ's, with a sign test (advocate predicts median > 0 with ≥10/14 years positive; sign-test p<0.09).** Yearly cross-sections avoid pooled pseudo-replication.
5. **THE BAR (declared before running):** kayfabe must BEAT the naive champion — the same statistic computed for `trailing-year trade-added` as the predictor (v1.2's self-persistence, ρ≈0.20 at long horizon). If K ranks forward harvest no better than "what did it earn last year," it adds nothing and LOSES regardless of significance.
6. **Comparison arms (all declared, none selectable after the fact):** (a) γ_t alone; (b) gap_t alone (expected NEGATIVE — high gap = shoot); (c) **Title-Change count** (item 81: number of cumulative-return lead swaps over trailing 252d) — the rank-based kayfabe; (d) naive trailing-year trade-added (the bar). Same statistic-of-record for each.
7. **Eligibility:** pair-year requires full 756d trailing history and ≥240 aligned days in forward year. Report the eligible-n per year.
8. **R1: medians and counts only. R6/R8: no headline until the full 14-year table exists.**

## Findings

**Run executed 2026-07-15 by protocol-bound agent. Deviations: three documented boundary/definition literalisms (results.json), none material. Validation gate: fortress reproduced +2.171%/yr to the digit. 25,620 pair-years, all 14 years fully eligible.**

### F1. Kayfabe is barely a state
P(K>0) = 7.5% of pair-years; persistence P(K>0 @ y+1 | K>0 @ y) = 8.8% vs 6.8% from K≤0 — a +1.2pt lift. The "worked" regime as defined is rare and nearly memoryless.

### F2. THE DECLARED BAR — KAYFABE LOSES. Referee kills docket item 82's first form, no appeal.
| arm | median yearly ρ vs forward trade-added | positive years | sign p |
|---|---|---|---|
| **K = γ − 4·gap** | **−0.055** | 6/14 | 0.79 |
| γ_126d alone | **+0.153** | **14/14** | **0.0001** |
| gap_756d alone | +0.082 | 10/14 | 0.09 |
| Title-Change (252d) | −0.019 | 5/14 | 0.91 |
| naive (prev-yr TA) | +0.031 | 9/14 | 0.21 |

K needed median>0, ≥10/14, and to beat naive. It got median<0, 6/14, and ranked *below* "use last year's number." **Title-Change in this form (252d lead-swap count) is also null-to-negative — item 81's first costume fails alongside.**

### F3. WHY it died is the finding: the gap sign surprise
The advocate expectation (registered in arm (b)) was gap → NEGATIVE (high gap = shoot = bad). **Observed: gap → +0.082, POSITIVE.** At regime scale, the 756d drift-gap estimate is (i) noise-dominated and (ii) cross-sectionally confounded with γ (dispersive pairs are volatile pairs). So K = γ − 4·gap **subtracts one positively-correlated-with-target quantity from another at 4× weight, inverting a +0.15 signal into −0.05.** The §1.6 boundary is true of *realized whole-period* quantities; its inputs do not survive translation into rolling ex-ante estimates. The theorem is fine. The state variable isn't.

### F4. UNREGISTERED OBSERVATION — recorded, NOT crowned, with its tautology named
**γ_126d alone: median ρ +0.153, 14/14 positive years, beats naive outright.** Before anyone falls in love (the signature failure — an exciting result that agrees with what we want): the channel is substantially mechanical. Harvest scales with spread variance (γ/8 is the theoretical ceiling), and volatility is the one persistently-forecastable quantity in finance — so "trailing γ ranks forward trade-added" is at least partly *"vol predicts vol, and vol is the food."* What it does NOT establish: that high-γ selection survives corpse years net (GME/AMC was the highest-γ book we ever held, §1.5), nor the γ⊥gap disentanglement (partial correlations were not in protocol). **If pursued, the next pre-registered shot is: ρ(γ, forward TA | gap) + a γ-decile forward portfolio WITH corpse accounting, bar = beats naive AND survives the worst-year tail.** One shot, referee rules, as always.
