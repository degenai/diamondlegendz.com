# THE ROYAL RUMBLE — the fractal instrument search, formalized

**Date: 2026-07-15 · Author: Fable, from Alex's spec ("branches on branches on branches — they keep getting stopped, and it keeps moving and growing around") · Status: PROCESS DESIGN, not doctrine. Governs sandbox-era search only.**

## The shape

An evolutionary tournament over invented instruments. WorldQuant's factory aesthetic with the target swapped: not "where does the line go" but **"when does the rivalry turn shoot"** (corpse-first, per the estimability map: vol/structure predict; drift never does).

## Rules

1. **Arena = THE SANDBOX ONLY (2012-01-01 → 2018-12-31).** Quarantine (2019–2025) is never touched by the Rumble. (Log ruling, 2026-07-15.)
2. **An entrant** is a tuple over the five levers: `(basis, timescale, functional form, target, habitat)` —
   basis ∈ {prices, the demon's own ledger, rosters/holdings, statutes/mechanics};
   timescale ∈ {21d … 756d};
   form ∈ {rank-based, parametric, count-based};
   target ∈ {corpse hazard (primary), forward harvest rank (secondary)};
   habitat ∈ {full panel, commodity stratum, kin-pairs, …}.
3. **Generation 0 seeds:** γ_126d (the 14/14 survivor), Title-Change (new costumes: multi-window, weighted swaps), Breath (crossing rate), Bite alternation (needs ledger extraction), **same-league tag** (pure metadata: country×country, sector×sector — post-hoc reading of the v1.4 passers after the roster refutation of 2026-07-15; enters as entrant, not conclusion), **factor-kinship** (rolling return correlation — estimable family), roster-overlap DELTA (kin divergence as shoot early-warning — habitat caveat: this panel's high-overlap pairs are mostly leverage identities, so its hunting ground is thin here), drawdown-vs-γ ratio (starvation rule's smarter sibling).
   *Roster-overlap LEVEL is demoted from Gen-0: refuted 2026-07-15 as the explanation of v1.4 persistence (passers share ~zero holdings — 7× below panel mean; see roster-overlap sidecar F4).*
4. **Elimination:** each entrant gets one sandbox statistic-of-record (declared per batch before running: median yearly cross-sectional ρ, or hazard lead-time vs base rate). Losers are ELIMINATED and logged **with cause of death** — the graveyard is half the value (noise-death vs sign-flip vs redundancy-with-γ are different lessons).
5. **Branching:** survivors spawn variants along ONE lever at a time (that's the fractal: a branch that stops feeds the next branch's design). Redundancy check: a variant that correlates >0.8 with a living ancestor's scores is folded into it, not counted as new.
6. **Batch mechanics:** agents implement + run each batch protocol-bound; no mid-batch metric changes; every entrant's result recorded regardless of outcome. R1 (medians/counts) applies even in the sandbox.
7. **THE ONE BULLET:** when the operator calls time, the single best surviving lineage gets ONE pre-registered quarantine shot. **The quarantine bar must be declared with the full lineage size disclosed** — the more branches the Rumble examined, the stiffer the confirmation bar (calibrated by permutation of the quarantine years, not hand-waved). A survivor of 400 sandbox branches that squeaks p=0.04 in quarantine is NOT a finding; the bar scales with the search.
8. **Standing bars any champion must also clear:** beats γ_126d alone (the incumbent), beats naive persistence, and — for corpse-targets — beats the D=80 starvation rule's 40:1 tail ratio or complements it measurably.
9. **No entrant may require estimating drift.** House physics.

## The ladder of Rumbles (operator architecture ruling, Alex, 2026-07-15)

Tournaments exist ONLY at levels where pre-registration is possible:
- **Level 1 (demons/baskets): NO RUMBLE.** Selection at object level is the proven hindsight trap. The Atlas serves this level as a CENSUS — a map, no winners — and the engine gets upgraded like a telescope as needs arise, never tournamented.
- **Level 2 (sensors): THIS Rumble.** Runs first.
- **Level 3 (strategies): the SECOND Rumble**, convened only after level 2 produces quarantine-confirmed survivors. Entrants are assemblies: sensor(s) + response rule + habitat + band + sizing. Fitness: OOS trade-added net of costs AND tail survival.
- **The strategy Rumble's incumbent champion is already known: MONTHLY CALENDAR REBALANCING, equal weight** — the dumbest possible entrant captures ~85% of the fortress effect (+1.90 of +2.21 %/yr, §1.3). Every assembled strategy must beat the calendar, not zero. Second standing bar: survive Perold–Sharpe cancellation analysis (no strategy that is secretly `buy-and-hold minus fees`).

## BATCH 1 — declared 2026-07-15, bell rung by Alex ("I am ready to rumble"), BEFORE any batch-1 computation

**Arena:** sandbox only. Sensor sampled at the first trading day of each year 2012–2018; forward target = that calendar year's actual-path trade-added %/yr (5% band, equal weight, engine convention verbatim — reuse kayfabe shot 1's validated machinery, RESTRICTED to target years ≤2018). 7 yearly cross-sections × 1,830 cohort pairs. Trailing features may reach into pre-2012 data (features are backward-looking; the sandbox boundary governs TARGETS).

**Batch-1 entrants** (6 of 8 — Bite Census awaits ledger extraction; Roster Delta awaits Phase-2 history):
1. **γ_126d** — the incumbent, re-baselined sandbox-only.
2. **Title-Change, three costumes:** lead-swap count over 126d, 252d, 504d (each a separate score; costumes of one entrant, best-of reported WITH the multiplicity noted).
3. **Breath:** trailing 252d zero-crossing rate of the pair log-spread (frozen-β from trailing 504d OLS) around its trailing mean.
4. **Same-League Tag** (static metadata; league map declared here): country-equity {ECH EWA EWC EWD EWG EWH EWI EWJ EWK EWL EWM EWN EWP EWQ EWS EWT EWU EWW EWY EWZ EZA FXI THD TUR} · US-sector {IYT XLB XLE XLF XLI XLK XLP XLU XLV XLY XME XBI} · bond {BND EMB HYG IEF LQD SHY TIP TLT} · commodity {DBA DBB GDX SLV UNG USO} · broad-equity {IWM QQQ SMH VEU VNQ VTI VYM} · single-stock {F GME MSTR NVDA}. Same-league pair = 1 else 0.
5. **Factor-Kinship:** trailing 252d Pearson correlation of daily returns.
6. **Drawdown-γ Ratio:** max(leg drawdowns from 756d running high) ÷ trailing 126d spread vol (annualized σ, not variance) — "how deep is the deeper leg, in units of this pair's own noise."

**Statistics of record (both declared now):**
- **PRIMARY (feast-rank):** median across the 7 yearly cross-sectional Spearman ρ(sensor, forward TA) + positive-year count.
- **SECONDARY (corpse-flag):** does the sensor's worst decile (per its predicted direction) capture forward BOTTOM-decile TA years at better than 10% base rate — precision at decile, pooled.

**Elimination bar (loose, sandbox-grade):** median ρ of wrong sign for the entrant's declared direction, or <4/7 positive years on the correctly-signed statistic → ELIMINATED, cause of death logged. Binary Same-League Tag is scored by group medians (same-league vs cross-league forward TA) instead of ρ.
**Redundancy folding:** pairwise Spearman between sensors' pair-year scores; ρ>0.8 → junior folds into senior.
**Declared directions:** γ+, TC+, Breath+, League+, Factor-Kinship+, DD-γ NEGATIVE (deeper-in-noise = corpse-adjacent = worse forward TA).

## BATCH 1 RESULTS — 2026-07-15 (full record: `rumble_batch1/`; protocol followed, deviations documented in agent log)

| entrant | primary median ρ | correct-sign yrs | corpse-flag prec (base .10) | verdict |
|---|---|---|---|---|
| **γ_126d** | **+0.180** | 7/7 | **0.001 — pure feast, blind to corpses** | SURVIVES |
| Title-Change (tc_126 best-of-3, costumes orthogonal → real 3× multiplicity penalty) | +0.048 | 5/7 | 0.082 | SURVIVES |
| Breath (252d) | +0.026 | 5/7 | 0.087 | SURVIVES |
| Same-League Tag | −0.119 (gap) | 2/7 | 0.112 | ☠️ ELIMINATED — same-league pairs harvest LESS |
| Factor-Kinship (252d corr) | **−0.234** | 2/7 | 0.082 | ☠️ ELIMINATED — sign-flip, and the strongest signal in the batch |
| DD-γ Ratio | +0.063 | 3/7 | 0.112 | ☠️ ELIMINATED — sign-flip (deep-in-noise → MORE forward TA in this era) |

**The three deaths are all sign-flips, and that is the finding:**
1. **Kinship is real and INVERTED for feast**: correlated/same-league legs harvest less — mechanically sensible (tight tether → small oscillation → little food; γ~kinship pooled −0.374, but kinship's magnitude EXCEEDS γ's, so it is not merely anti-γ). Reconciliation with v1.4: kin-pairs PERSIST (reliability) but pay SMALL (magnitude). **Reliability and magnitude trade off. Batch 1 only scored magnitude.**
2. **γ is the fire, not the smoke detector**: corpse-flag precision ≈0 — the worst forward years sit at HIGH γ. Feast sensor and corpse sensor cannot be the same instrument. **The corpse belt is VACANT — no Batch-1 entrant beat the 10% base meaningfully.**
3. **Sandbox-era caveat on DD-γ's flip:** 2012–2018 contains few true corpses (the UNG/COVID deaths cluster 2020+), so "deep drawdown → recovery harvest" may be era-specific. Do not promote the + sign without quarantine-era humility.

**Batch 2 design leads (declared as leads, not results):** (a) enter **Anti-Kinship** (low correlation / cross-league) as a feast-side sensor with declared + direction; (b) add a **consistency/reliability fitness** (win-rate or TA-stability target) where the kinship family's v1.4 persistence should show if real; (c) corpse belt needs purpose-built entrants (roster-delta when Phase-2 lands; Bite Census; regime-conditional DD-γ); (d) flipped entrants carry their born-from-sandbox multiplicity into any future quarantine bar.

## BATCH 2 — declared 2026-07-15 (operator doctrine: "v0s that die branch off to v1s; the other dead v0s should be reassessed to v1 attempts similarly"), BEFORE any batch-2 computation

**The evolutionary mechanic, ratified: every eliminated v0 breeds.** Sign-flips become mirror entrants; mis-classed entrants re-enter in their correct weight class. All v1 entrants carry a lineage tag; the running multiplicity ledger (batch 1: 8 scored sensor-costumes; batch 2 adds 5 new scored entries) travels with any future quarantine shot.

**NEW FITNESS — THE RELIABILITY BELT** (the kinship family's actual weight class, per the v1.4 reconciliation): Spearman ρ(sensor, forward-year WIN indicator 1[TA>0]) — median across the 7 sandbox years + positive-year count. Binary tags scored by win-rate gap. Declared direction per entrant below.

**Batch-2 entrants** (arena, sampling, feast/corpse belts identical to Batch 1; all computable from batch1_pairs.csv — no new sensor columns):
1. γ_126d — incumbent, all three belts.
2. TC-126 — survivor, all three belts.
3. Breath — survivor, all three belts.
4. **Anti-Kinship** (v1 of Factor-Kinship; = low 252d return correlation): feast +, reliability −(declared: wild pairs pay big but win LESS consistently — the trade-off hypothesis made falsifiable).
5. **Kinship-Reliability** (v1 of Factor-Kinship in its v1.4 weight class; = high 252d correlation): reliability +.
6. **Cross-League Tag** (v1 of Same-League): feast +.
7. **League-Reliability** (v1 of Same-League): reliability + (same-league pairs win more often even if they pay less).
8. **DD-γ v1** (accepts the sandbox's + sign for feast, era caveat on record): feast +, corpse-belt still contested.

## THE CORPSE ANNEX — data expansion declared 2026-07-15 (Alex: "any other death eras? dot-com, '08?")

The sandbox (2012–2018) is corpse-poor; the corpse belt cannot be honestly contested there. Annexations, all EXPLORATION-era (quarantine untouched):
- **GFC annex:** extend the panel pull to 2005-01 → 2012-12 for the 61-ticker cohort (subset with pre-2008 data: WEBS-era country funds ~1996, sector SPDRs 1998, QQQ/IWM ~1999-2000; DBB/GDX/TUR arrive 2006–2008). Target years 2009–2011, per-sensor first-usable-year rules honestly applied (756d-trailing sensors start later).
- **Dot-com annex:** separate pull 1996-01 → 2005-12; cohort ≈ 15–20 tickers (country funds + sectors + QQQ). Target years 2000–2002. XLK's −80% and QQQ's −83% are boundary-case gold: deep-drawdown eventual-survivors on horizons that would kill a rebalancer anyway.
- **The Death Panel:** assemble true corpses with fetchable history — RSX (halted→zero 2022), BBBY, NKLA, KOSS, EXPR (meme-era deaths, §7 board item), TMF (−92 shallowest corpse), UNG (−98.9 living corpse) — as a corpse-detector calibration set. yfinance delisted-ticker coverage is spotty; fetch feasibility to be reported, not assumed.
These become **Batch 3's arena** (corpse-belt tournament in corpse-rich eras). Data pulls launched as background prep on declaration.

## BATCH 2 RESULTS — 2026-07-15 (`rumble_batch2/batch2_results.json`; visualizer: `rumble_tree.html`)

**☠️ THE RELIABILITY-TRADEOFF HYPOTHESIS IS REFUTED.** Kinship-Reliability: −0.185 (1/7) FAIL. League-Reliability: −0.100 (2/7) FAIL. Kin pairs do NOT win more often — they pay less AND win less in the sandbox. v1.4's "persistence" was spread STATIONARITY, which is neither harvest nor wins: three different notions of reliable, and kinship only ever held the statistical one. **The kinship family is now 0-for-4 across economic weight classes.**

**🏆 γ TAKES BOTH BELTS**: feast +0.180 (7/7) AND reliability +0.241 (7/7) — its reliability is STRONGER than its feast. High-γ pairs pay more and win more. Corpse-blindness unchanged (≈0 precision).

**Passers:** Anti-Kinship feast +0.234 (5/7) — #1 feast contender; Cross-League +0.119 gap (4/7); DD-γ v1 feast 4/7 + reliability 4/7 (era caveat stands). TC-126 and Breath hold. **Corpse belt: still VACANT.**

**⚠️ ERA MONOCULTURE WARNING (the batch's deepest lesson):** every Batch-2 signal points the same way — wild, uncorrelated, cross-league, volatile, deep-drawdown pairs pay more AND win more. That is the signature of a 2012–2018 bull era where every dip recovered. The sandbox cannot distinguish "wildness is good" from "wildness was good when nothing died." **Batch 3 (the corpse annex) is therefore not optional — it is the identification strategy.** Annex data landed: GFC panel 61/61 tickers (2005–2012), dot-com panel 26/26 (1996–2005), death panel 7/10 (RSX/NKLA/EXPR wiped from Yahoo — true-corpse fetch needs another source; item for the docket).

## BATCH 3 — THE CORPSE ANNEX. Declared 2026-07-15, BEFORE any batch-3 computation.

**The question this batch exists to answer:** does the sandbox's monoculture verdict (wild/uncorrelated/volatile = more pay AND more wins) survive eras where things actually die? An entrant whose feast sign FLIPS across arenas is not eliminated — it is marked **REGIME-BOUND** and characterized; sign stability across all three eras is the new crown criterion.

**Arenas:**
- **GFC arena:** `annex/gfc_panel_2005_2012.csv` (61 tickers). Target years **2008–2011** (4 cross-sections). Trailing windows reach into 2005–2007 (legal; features are backward-looking).
- **Dot-com arena:** `annex/dotcom_panel_1996_2005.csv` (26 tickers → 325 pairs). Target years **2000–2003**. League map: country {EWA EWC EWG EWH EWJ EWK EWL EWM EWN EWP EWQ EWS EWU EWW} · sector {XLB XLE XLF XLI XLK XLP XLU XLV XLY} · broad {QQQ IWM} · single-stock {F}. ⚠️ Sector SPDRs incept Dec-1998: 756d-trailing sensors exclude sector pairs until ~2002 — per-sensor per-pair-year eligibility applied and reported honestly, n per year in the results.

**Fighters (the six standing):** γ_126d, TC-126, Breath, Anti-Kinship, Cross-League, DD-γ v1. Same definitions as Batches 1–2, unchanged.

**Belts:** feast + reliability exactly as Batch 2. **CORPSE BELT, now with teeth (two fitnesses, both declared):** (i) decile precision as before; (ii) **SEVERITY precision** — flagging pair-years with forward TA ≤ −5%/yr (absolute catastrophe), base rate reported per arena. Forward TA per the verbatim validated engine invocation, on annex panels.

**Elimination:** per-arena bar as before (correct-sign median, ≥3/4 years given only 4 cross-sections). Cross-arena verdicts: STABLE (same sign, all arenas incl. sandbox) / REGIME-BOUND (sign flips; characterized, benched from quarantine eligibility) / DEAD (fails everywhere).

## BATCH 3 RESULTS — 2026-07-15 (`rumble_batch3/`; validation gates passed; full eligibility honesty in agent log)

**CROSS-ERA VERDICTS (feast sign: sandbox / GFC / dot-com):**
- **γ_126d → STABLE** (+0.180 / +0.237 / +0.314) — the incumbent strengthens in death eras. Corpse-blind everywhere.
- **Anti-Kinship → STABLE** (+0.234 / +0.132 / +0.261) — **the batch headline: the monoculture warning is refuted for the champions.** Wild pairs out-earn kin even where things die. Caveat on record: flips negative inside acute 2008 itself (correlations → 1 in the crash quarter; its stability is recovery-era).
- **Cross-League → STABLE, weak** (+0.119 / +0.035 / +0.036).
- **TC-126, Breath, DD-γ v1 → REGIME-BOUND, benched from quarantine.** All three flip negative in both death eras. DD-γ's Batch-1 era caveat fired exactly as written.
**CORPSE BELT: STILL VACANT** — even with the severity fitness, in eras containing real death. The feast champions anti-select corpses (they concentrate in survivors). Best fragmentary leads: Breath's GFC decile 0.136, TC's GFC severity 0.050 — both on sign-flipped feast losers.
**THE UNREGISTERED GEM: pair-demons die of DISPERSION, not crashes.** Severity base rates: GFC 3.22% vs dot-com **0.16%** — a 20× gap, despite dot-com holding the scarier index charts. Coordinated collapses keep legs tethered (the demon barely notices); decoupling eras manufacture the catastrophes. **The corpse detector, when built, listens for divorce, not fire.** (This also re-frames roster/kinship DELTA instruments as the right corpse family — divergence detection — despite kinship LEVEL failing as a feast sensor.)

**Public record: demon-rumble.html updated with Batch 3 (PR #69); Codex gained the retraction-and-radar chapter (same PR).**

## Why this doesn't become the thing we hate

The Rumble is filter-one-proof by aesthetics (nobody arbs wrestling semantics) and filter-two-honest by construction (corpse targets live in the estimable family). The infinite branching Alex wants is *inside the firewall*; the market only ever sees the one confirmed champion, sized for a $1k–$5k book nobody competes for. Little hackers.
