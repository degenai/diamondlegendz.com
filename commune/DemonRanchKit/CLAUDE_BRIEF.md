# FABLE'S BRIEF — DEMONRANCHKIT / FINANCIAL DEMONOLOGY
### Regenerated 2026-07-16 from `log.md` (the append-only source of truth). **Not patched. See R11.**
### CLAUDE_BRIEF v3 — "the meteorology era." For a model with no memory of any of this, running Friday's commune session on Andy's Fable tokens.

> **Read §0, then §2 (the graveyard — the deaths are more instructive than the survivals and you must not resurrect them), then §4 (the house rules; they were paid for in retractions). The Rumble and the Hall are the new machinery. The rest is reference.**
>
> **The campaign's signature failure, committed at least seven times in forty-eight hours in the old era and at least twice more this week: A CORRECT CONCLUSION RESTING ON A FALSE MECHANISM.** It survives *precisely because* the answer looks right, so nobody re-reads the argument. **Hunt for that shape. It is in this document too, and it has certainly not all been caught.**
>
> **And the deeper pattern, the one that matters: every retraction we ever made was something we WANTED to be true.** An exciting claim that agrees with you arrives **pre-authorized** — it skips the queue. This week we killed OUR OWN roster-kinship theory four hours after stating it (the fastest funeral the campaign has run) precisely by refusing that skip. **When a result flatters the hypothesis, that is when to look HARDER.**
>
> **Alex prefers a finding that dies tonight to one that dies in public.** Do not flatter the project and do not flatter him. He is a massage therapist and a self-taught coder, and he has personally caught errors that agents missed. **Fervor in the sandbox, atheism at the referee table.**

> ⚠️ **THIS BRIEF SHIPS TO A SHARED REPO FOR ANDY.** It carries all the science, all the house rules, all the epistemics — and **NONE** of the operator's personal money. **§6 (the operator's personal money) does not travel to the commune.**

## THE FILES
| what | where |
|---|---|
| **The log — APPEND-ONLY, NEVER EDITED. THE SOURCE OF TRUTH.** | `C:\Users\alexa\Desktop\My Cinematic Universe\log.md` (~1,440 lines) |
| The docket — **a cache. Corrected in place, so it lies by default. Regenerate, never trust cold.** | `...\Demon Ranch\RESEARCH_DOCKET.md` (items 1–84) |
| The prior brief — **ONE ERA STALE** (ends at the cointegration pivot; everything after the morning of 2026-07-15 is missing from it) | `...\Demon Ranch\FABLE_BRIEF_20260715.md` |
| §0 execution record (the cointegration hypothesis test, v1–v1.4) | `...\sidecars\cointegration-20260715\REPORT.md` |
| The Rumble — protocol + Batch 1–3 results | `...\sidecars\kayfabe-20260715\RUMBLE.md` · visualizer `rumble_tree.html` |
| The corpse library | `...\sidecars\hall-of-the-dead-20260715\{SCOUT,REPORT}.md` |
| Roster census (holdings kinship) | `...\sidecars\roster-overlap-20260715\REPORT.md` |
| Commodity round-robin census | `...\sidecars\commodity-roundrobin-20260715\REPORT.md` |
| **Public shareable state** | `thisisez.com/demon-rumble.html` · `thisisez.com/demon-codex.html` |

> **⚠️ COMMUNE NOTE ON THESE PATHS:** the `C:\Users\alexa\…` rows above are PROVENANCE — where the source-of-truth artifacts live on the operator's machine. **They do not exist in this kit and the log NEVER ships** (it is the operator's personal journal; this brief is its regenerated distillate). Your local ground truth is: this brief + the sidecar `REPORT.md`/`RUMBLE.md` files + `RESEARCH_DOCKET.md` (commune science edition) + `DATA_MANIFEST.md` for what rides Drive/USB instead of git. If this brief and a sidecar REPORT conflict, the REPORT (closer to the run) wins, and flag the conflict.

---
# §0 — THE STATE
## **The falsifiable question of the old brief — "does an in-sample cointegrated basket keep mean-reverting out of sample?" — is ANSWERED: NO. The program is now DEMON METEOROLOGY.**

**We ran the test the old brief demanded. Engle–Granger on 1,830 pairs, Johansen on the fortress, pre-registered, base rate (Clegg 2014: ~5% persistence ≈ the false-positive rate) locked before the run.** It failed every prong. Demon SELECTION and demon PREDICTION are both dead. What is alive is smaller, truer, and forecasts textures instead of specifics.

### The three kills of demon selection — with the numbers
1. **THE SCREEN HAS NO FORWARD VALIDITY.** Fit 2008–19 → test 2020–26: in-sample cointegration passers stay mean-reverting OOS at **3.9%** (19/488, frozen-β ADF) vs failers **2.9%** vs the **5%** nominal false-positive rate. On the Clegg-comparable fresh re-test, passers **8.8%** vs failers **9.7% — passers do WORSE than their own failers.** Reverse direction: identical shape. **We reproduced Clegg on our own universe.** Replicated again on the 93-ticker 2012 cohort (**12,216 pair-tests total, two cohorts, two directions, one mechanism stratum**).
2. **THE FORTRESS IS NOT COINTEGRATED IN ITS OWN ERA.** Johansen trace: **rank 2 on 2008–2019** (89.3 vs 69.8) but **rank 0 on 2020–2026** (59.7 vs 69.8 — fails even at 90%), the exact window where its +2.27%/yr edge was measured. Frozen 2008-vector carried forward: ADF **p=0.057** (near-miss FAIL), half-life 32d→83d, crossed the old equilibrium **0.15×/yr** (once per 6.5 years). Third independent line of evidence for the ex-post-drift-selection lookahead.
3. **THE SCREEN IS ANTI-PREDICTIVE OF HARVEST.** v1.2 target-swap: **ρ(in-sample EG p-value, OOS trade-added/yr) = +0.2513** (n=1,830). LESS in-sample cointegration → MORE out-of-sample harvest. Passers earn **+0.121%/yr** OOS vs failers **+0.317%/yr**. Not γ-mediation (partial ρ +0.226 controlling γ). The statistician's screen selects the wrong pairs.

### The imported-instrument scoreboard: 1-for-5
`v1` (EG/Johansen binary) LOSS · `v1.1` (oil/wheat mechanism stratum — USO/WEAT p=0.48/0.55, no in-sample relationship to persist) LOSS · `v1.2` (target swap) LOSS, inverted · `v1.3` (2-yr walk-forward, 12.7% vs 11.6% unconditional) LOSS · `v1.4` (variance ratio, corrected) **QUALIFIED WIN** — Fisher OR=32.3, p=2.2e-4, but n=**19 passers, 3 OOS hits**, and its passers are **structurally kin pairs** (MSCI country siblings, IYT/XLB, EWK⊂VEU, EWC/EZA, DBB/EWZ), not statistically-screened ones. The 0-for-3 stopping rule did **not** fire; the imported program survives on its single most conservative instrument.

> ### **CONVERGENCE OF THE NIGHT, three instruments, one sentence: THE DEMON'S PERSISTENT FOOD IS STRUCTURAL KINSHIP, NOT STATISTICAL COINTEGRATION AT CONVENTIONAL THRESHOLDS.** (v1.2 self-persistence ρ≈+0.20 · v1.4's passer census · the commodity stratum's η≈1.)

### THE LADDER, as the operator now speaks it (Alex, 2026-07-15)
- **Demon SELECTION** (pick the golden basket) — **DEAD, unlicensed.** Object-level selection is the proven hindsight trap.
- **Demon PREDICTION** (pick winners ex ante) — **DEAD physics.** Was never alive.
- **★ Demon METEOROLOGY** — forecasting the environment's **TEXTURES** (dispersion, co-movement, divorce hazard: the *estimable family*) and **never its SPECIFICS** (which asset, which direction, who wins) — **ALIVE.** Licensed selection returns ONLY as the act of reading the weather report.

### THE TWO ERA-STABLE CHAMPIONS (awaiting the one quarantine bullet)
Cross-era feast sign (sandbox targets 2012–18 / GFC arena targets 2008–11 / dot-com arena targets 2000–03):
- **γ_126d → STABLE and STRENGTHENING: +0.180 / +0.237 / +0.314.** The incumbent gets stronger in death eras. Corpse-blind everywhere (channel is largely mechanical — *vol predicts vol, and vol is the food*).
- **Anti-Kinship (low 252d return correlation / cross-league) → STABLE: +0.234 / +0.132 / +0.261.** Wild, uncorrelated pairs out-earn kin even where things die. **Honest asterisk on record:** flips negative *inside* acute 2008 (correlations → 1 in the crash quarter); its stability is recovery-era.

**Neither is crowned. Neither has fired its quarantine shot. That is the next referee event, and it goes through pre-registration (below).**

### THE CORPSE BELT IS VACANT — and the demon's true cause of death is named
Three batches including two real death eras, and **no sensor beats the base rate at flagging forward catastrophe.** The feast champions *anti-select* corpses (they concentrate in survivors). What the corpse hunt found instead is the season's most important unregistered finding:

> ## **PAIR-DEMONS DIE OF DISPERSION, NOT CRASHES.** Severity base rate (forward TA ≤ −5%/yr): **GFC 3.22% vs dot-com 0.16% — a 20× gap**, despite dot-com holding the scarier index charts. Coordinated collapse keeps legs tethered (the demon barely notices); **DECOUPLING manufactures the catastrophe.** The smoke detector, when built, must listen for **divorce, not fire** — which re-aims the corpse program at divergence-family instruments (roster/kinship DELTA, correlation-decay) and explains §1.7's RSX mechanism (sanction→halt→delist = the ultimate one-leg divorce).

**What still stands from the old era, on its own feet:** the D=80 **starvation rule** (interim tail guardrail, free on low-γ books, 40:1 bind ratio) and the actual-path residual as a description of the PAST. Both are independent of everything that died this week.

---
# THE ROYAL RUMBLE — the fractal instrument search, formalized
### The sensor tournament. `RUMBLE.md` is process design, not doctrine. It governs sandbox-era search only.

**The shape:** an evolutionary tournament over invented instruments — WorldQuant's factory aesthetic with the target swapped, *"when does the rivalry turn shoot"* instead of *"where does the line go."* Corpse-first, because hazard detection lives in the estimable family and drift never does.

### How it works
- **THE SANDBOX/QUARANTINE FIREWALL.** Arena = **SANDBOX ONLY (2012-01-01 → 2018-12-31)** — unlimited exploration, no referee, all results labeled EXPLORATION and unpublishable. **QUARANTINE (2019-01-01 → 2025-12-31) is NEVER touched by the Rumble.** A sandbox survivor earns exactly **ONE pre-registered confirmatory shot** in quarantine, bar declared first. A quarantine result is the only kind that can enter §1.
- **An entrant** is a tuple over five levers: `(basis, timescale, form, target, habitat)`. Losers are ELIMINATED and logged **with cause of death** — the graveyard is half the value (noise-death vs sign-flip vs redundancy-with-γ are different lessons).
- **DEATHS BREED.** Every eliminated v0 spawns v1s along ONE lever at a time (that is the fractal). Sign-flips become mirror entrants; mis-classed entrants re-enter in their correct weight class. Redundancy-fold at ρ>0.8 into the living ancestor.
- **THE ONE BULLET.** When the operator calls time, the single best surviving lineage gets one quarantine shot. **The bar must be declared with the full lineage size disclosed and calibrated by permutation of the quarantine years** — the more branches examined, the stiffer the bar. *A survivor of 400 sandbox branches that squeaks p=0.04 is NOT a finding.* Standing bars: beat γ_126d (incumbent), beat naive persistence, beat-or-complement the D=80 starvation rule's 40:1 tail ratio.
- **HOUSE PHYSICS: no entrant may require estimating drift.**

### The ladder of Rumbles (operator architecture ruling, Alex)
Tournaments exist ONLY where pre-registration is possible.
- **Level 1 (demons/baskets): NO RUMBLE.** Object-level selection is the proven hindsight trap. **The Atlas serves this level as a CENSUS — a map, no winners — upgraded like a telescope, never tournamented.**
- **Level 2 (sensors): THIS Rumble.** Runs first.
- **Level 3 (strategies): the SECOND Rumble**, convened only after Level 2 yields quarantine-confirmed survivors. **Incumbent champion already known: MONTHLY CALENDAR REBALANCING, equal weight** — the dumbest entrant captures ~85% of the fortress effect (+1.90 of +2.21 %/yr). Every strategy must beat the calendar and survive Perold–Sharpe cancellation (no strategy that is secretly `buy-and-hold minus fees`).

### Batch results
**BATCH 1** (sandbox targets 2012–2018, 7 cross-sections × 1,830 pairs):
| entrant | primary ρ | yrs | verdict |
|---|---|---|---|
| **γ_126d** | **+0.180** | 7/7 | SURVIVES — corpse-flag precision 0.001 (pure feast, blind to corpses) |
| Title-Change (tc_126, honest 3× costume penalty) | +0.048 | 5/7 | SURVIVES |
| Breath (252d zero-crossing rate) | +0.026 | 5/7 | SURVIVES |
| Same-League Tag | −0.119 gap | 2/7 | ☠️ ELIMINATED — same-league pairs harvest LESS |
| Factor-Kinship (252d corr) | **−0.234** | 2/7 | ☠️ ELIMINATED — sign-flip, and the strongest \|signal\| in the batch |
| DD-γ Ratio | +0.063 | 3/7 | ☠️ ELIMINATED — sign-flip (declared −) |
**Payload: all three deaths are sign-flips.** Kinship is real and INVERTED for feast (tight tether → small oscillation → little food). γ is the fire, not the smoke detector. Corpse belt VACANT.

**BATCH 2** (deaths breed; new RELIABILITY belt = win-indicator fitness):
- **🏆 γ TAKES BOTH BELTS**: feast +0.180 (7/7) AND reliability **+0.241 (7/7)** — its reliability is *stronger* than its feast. High-γ pairs pay more AND win more.
- Passers: **Anti-Kinship** feast **+0.234 (5/7)** — #1 contender; Cross-League +0.119 (4/7); DD-γ v1 both belts 4/7.
- **☠️ THE RELIABILITY-TRADEOFF HYPOTHESIS REFUTED.** Kinship-Reliability −0.185 (1/7), League-Reliability −0.100 (2/7). Kin pairs do NOT win more often — they pay less AND win less. **Kinship is now 0-for-4 across economic weight classes.** (v1.4's "persistence" was spread STATIONARITY — a third thing, neither harvest nor wins.)
- **⚠️ ERA MONOCULTURE WARNING:** every sandbox signal points one way (wild/uncorrelated/volatile/deep-drawdown = more pay AND more wins) — the signature of a 2012–2018 bull era where every dip recovered. **Batch 3 (the corpse annex) is therefore the identification strategy, not an extension.**

**BATCH 3 — THE CORPSE ANNEX** (GFC + dot-com arenas; sign stability across all three eras = the new crown criterion; corpse belt gains a SEVERITY fitness):
- **γ STABLE, Anti-Kinship STABLE** (numbers in §0). **Cross-League stable-weak** (+0.119/+0.035/+0.036).
- **TC-126, Breath, DD-γ v1 → REGIME-BOUND, BENCHED from quarantine** — all flip negative where things die. DD-γ's Batch-1 era caveat fired exactly as registered.
- **CORPSE BELT STILL VACANT** even with the severity fitness. Best fragmentary leads live on sign-flipped losers only (Breath GFC decile 0.136). → the divorce-not-fire finding (§0).

*Public record kept pace: `demon-rumble.html` updated with Batch 3 (PR #69); Codex gained the retraction-and-radar chapter.*

---
# §2 — THE GRAVEYARD, UPDATED
### **Do not resurrect these. Each carries its cause of death.**

**Inherited from the old era (compressed — full autopsies in `FABLE_BRIEF_20260715.md §2):**
- ☠️ **"γ\* IS HARVESTABLE YIELD"** — the project's central claim. RETRACTED. Buy-and-hold captures **96.5%** of γ\*; the rebalancer's expected-growth edge is **+0.088%/yr**, below costs. Chambers & Zdanowicz (2014) and Cuthbertson et al. (2016) said so in print; we proved them right with our own simulator. **The theorem is real. It does not pay this century.**
- ☠️ **"THE FORTRESS'S EDGE GENERALIZES"** — the lookahead, and it is real. Its drift dispersion is **PERCENTILE 0** against random baskets from the same panel; a random 5-asset rebalanced book loses to buy-and-hold **90%** of the time. We selected, ex post, five assets whose realized growths landed within a point of each other.
- ☠️ **"THE HODL GATE IS A TIME MACHINE"** — false; we indicted the wrong line of code. The lookahead lives in the drift, not that line.
- ☠️ **"2020–2026 WAS THE DEMON'S WORST HABITAT"** — exactly backwards; the KINDEST window on the tape.
- ☠️ **"THE DEMON IS *EXACTLY* A SHORT STRADDLE"** — an oversimplification (caught by Alex within the hour). The concavity is real (Perold & Sharpe 1988); the honest object is **variance / negative convexity**, not an option.
- ☠️ **"DBB IS A §1256 CONTRACT"** — FALSE; it is a K-1 partnership. An auditor asserted it, it agreed with what we expected, published within the hour. **This is the scar R6 is named after.**
- ☠️ Also dead: the −34% wash tax, the +11.1% lot lever, the phantom $18,829, "an irreducible five-node formation."

**Killed THIS WEEK — the new stones:**
- ☠️ **EG/JOHANSEN COINTEGRATION SCREEN → ANTI-PREDICTIVE.** ρ(IS EG p, OOS trade-added) = **+0.2513**. Do not resurrect via pair-picking: ex-post survivors exist (EWZ/GDX passes everything) but with 1,830 pairs × 2 directions that is exactly what the false-positive floor produces (counter-exhibit: EWZ/TUR fails IS at p=.54, "passes" OOS at p=.005). **RECORDED, NOT CROWNED.**
- ☠️ **KAYFABE (K = γ_126d − 4·gap_756d).** Referee killed it on every prong: K median ρ **−0.055 (6/14)** vs naive prev-year-TA **+0.031 (9/14)**. The drift-gap input flipped sign under rolling estimation (+0.082). **§1.6's boundary is a theorem about REALIZED whole-period quantities; its inputs do not survive translation into ex-ante rolling estimates. The theorem stands; the state variable dies.**
- ☠️ **ROSTER-OVERLAP LEVEL as the explanation of v1.4 persistence.** REFUTED four hours after it was stated — our own theory. **15 of 19 VR-passers share exactly ZERO holdings; passer mean overlap 0.00194 vs panel 0.01292 — 7× BELOW average.** The v1.4 passers share LEAGUE (country×country, sector×sector), not roster. Roster-overlap *DELTA* survives as a separate (divorce-family) instrument, but its habitat on this panel is thin (the ≥0.5-overlap pairs are mostly leverage identities).
- ☠️ **KINSHIP-RELIABILITY / LEAGUE-RELIABILITY.** 0-for-4 across weight classes. Kin pairs pay less AND win less in the sandbox.
- ☠️ **SAME-LEAGUE TAG (feast).** −0.119; same-league pairs harvest LESS. Re-enters ONLY as its mirror, Anti-Kinship (which lives).
- ☠️ **TC-126, BREATH, DD-γ — REGIME-BOUND, benched.** They read the 2012–18 bull monoculture, not a stable texture. Not dead everywhere, but disqualified from a quarantine shot until a regime-conditional form is registered.
- ☠️ **THE OIL/WHEAT EQUILIBRIUM.** Failed at the FIRST hurdle: USO/WEAT coint p=0.48/0.55 — no ETF-level relationship to persist. (The futures-roll wrapper breaks the spot linkage — the caveat registered ex ante.) *Note: the demon still HARVESTS oil×ag dispersion fine (census below); it just cannot SELECT it.*

---
# THE HALL OF THE DEAD (docket #84)
### A corpse library to train a divorce-first failure sensor. **DESCRIPTIVE CENSUS — NOT A SELECTION.**

**What it is:** real delisted price paths — dying firms matched to firms that fell hard and *lived* — so a sensor can be trained to tell them apart. Built free on Tiingo (survivorship-bias-free by design), key read in-process, never written to disk. **58 of 500 monthly symbols spent; zero 429s.**

**Library after two builds: 56 series / 318,788 daily rows.** Four death classes now populated, plus a new fifth:
| class | examples | status |
|---|---|---|
| **slow_melt** | Sears (SHLDQ→$0.006), Rite Aid, BBBY-via-Q, Express (EXPRQ→$0.0001), WeWork, Tupperware, RadioShack, Pier 1, Party City, GNC, Revlon | strongest class |
| **crisis_kill** | SVB, Signature, First Republic, Silvergate (the 2023 bank run, 98–99.9% collapses) | 0→4, matched to WAL/PACW/BANC/SCHW — the Ford-and-GM pairs of 2023 |
| **fraud_collapse** | Wirecard (full arc ×2 instruments) + Nikola; **Luckin as the fraud-SURVIVOR control** (crashed to $1.38, relisted to $32) | *a detector must tell Wirecard from Luckin, or it's just a scandal detector* |
| **geopolitical** | RSX + ERUS (both Russia ETFs, frozen-NAV deaths) | 2 |
| **died_and_resurrected** | Hertz, Chesapeake (old stub + healthy successor) | new class |

**★ THE RECYCLED-TICKER TRAP DOCTRINE — the library's immune system, now 7-for-7 lifetime.** A dead company's ticker gets reassigned to a live one; fetch it naively and you train on the wrong firm. Caught and quarantined: **BBBY** (a recycled NYSE listing showing **$18** on the real corpse's Ch11 date — the real death is BBBYQ at $0.25→pennies), **BLIAQ** (a 2017 shell, not 2010 Blockbuster), plus SI, LUCK, CHKAQ-warrants, naive-GM. **Never fetch a dead name by its recycled live ticker.** Known poison traps: shld→Global X Defense ETF, cc→Chemours, gm→new-GM, wm→Waste Management. **The guard is the manifest date-range check against the known death date — load-bearing, not paranoia.**

**What is missing** — nine pre-2011 legends whose common stock is absent from every *free* tier (era-gated coverage, not death-type-gated): **Enron, WorldCom, Bear Stearns, WaMu, Blockbuster, Circuit City, Lehman-common, GM-old, Kodak-old** (+ JCPenney, the day's small mystery — dead 2020 yet absent from all free tiers). These are a single one-time ~$20 EODHD pull (or FMP-paid) that would OWN the CSVs forever. **Alex has DEFERRED it ("tomorrow / some other time") — the Hall trains on the free 56 meanwhile, and all four classes are populated.** There is no purchase pressure here; the free tier already carries a trainable modern cohort.

**★ For Andy: you EXTEND the Hall, you do not CONSUME it.** Getting past the free-tier walls (Tiingo 500/month, AV/FMP) requires **your own free keys** — sign up, read in-process, never commit. Free vendor sweeps this week: Alpha Vantage clean-zero (delisted list is exchange-only; OTC ghosts structurally invisible), FMP clean-zero-with-a-receipt (every delisted symbol 402-paywalled — which *confirms* the legends exist behind the paid tier). Ford cross-vendor QC: penny-exact across vendors.

---
# §4 — THE HOUSE RULES. These were paid for in retractions.
### Inherited R1–R11 (verbatim in spirit — full text in the prior brief):
- **R1 — THE CANONICAL VAULT** carries three scars. **NO MEANS. Medians, win-rates, median-of-paired-differences ONLY.** (And R1 is not neutral — on the rebalancing question it flatters us ~5×.)
- **R2 — THE NAMING LANDMINE.** Our `mintax` = Fidelity's "Tax-Sensitive" = winner; our `opt` = Schwab's "Tax Lot Optimizer™" / Vanguard "MinTax" = loser. Name the broker product beside the internal name or a reader reads the result backwards.
- **R3 — DO NOT PUBLISH A HEADLINE BEFORE THE RUN THAT SUPPORTS IT FINISHES.**
- **R4 — NO MID-RUN EDITS TO ANY MODULE A POOL WORKER IMPORTS.** (Sidecars import the engine READ-ONLY and cite policy invocations file:line.)
- **R5 — VALIDATE THE INPUTS BEFORE YOU GATE THE MACHINE.** A gate proves the machine computes what you told it; it cannot tell you that you told it the wrong thing. *(v1.4's first run: two arithmetic bugs produced a dramatic "0% mean-reverting" artifact, VOID — caught by mechanical sanity-check of a known case before belief.)*
- **R6 — KEEP QUESTIONING THE AUDITOR AFTER IT AGREES WITH YOU.** The moment an auditor confirms your prior is when its output is LEAST examined. Confirmation is when to look HARDER.
- **R7 — CONFIGURATION TRAVELS IN THE CELL TUPLE, NEVER IN A MODULE GLOBAL.** Windows spawns; workers re-import; `main()`'s globals reach nobody.
- **R8 — A PANIC IS A PUBLICATION.** Bad news gets published early for the same reason good news does: it feels like rigor. It isn't.
- **R9 — A RETRACTION IS NOT FINISHED UNTIL EVERY DOWNSTREAM QUOTATION IS FIXED. THE SEARCH IS `grep`, NOT MEMORY.**
- **R10 — MEASURE THE SAME THING THE SAME WAY. ALWAYS PAIR. NEVER COMPARE ACROSS ESTIMATORS.** Before you subtract two numbers, say out loud what estimator produced each one. *(A difference between estimators is an artifact of your own arithmetic, and it will ALWAYS look like a finding.)*
- **R11 — ★★★ A DOCUMENT YOU CORRECT IN PLACE IS MORE DANGEROUS THAN ONE YOU ONLY EVER APPEND TO.** The log self-corrects perfectly; the edited-in-place docket rots. **THE LOG IS THE SOURCE OF TRUTH. THE DOCKET IS A CACHE. A CACHE IS REGENERATED, NEVER PATCHED.** *(This brief was regenerated from the log. Do the same — do not patch it.)*

### NEW RULES, minted this week (they earned their numbers):
- **R12 — PRE-REGISTRATION WITH DECLARED BARS.** Protocol, statistic-of-record, direction, and elimination bar are locked in a REPORT/RUMBLE file BEFORE any computation. Base rates are established before the run, thresholds untouched after. Deviations are documented in the agent log, not silently absorbed.
- **R13 — THE SANDBOX/QUARANTINE SPLIT.** Sandbox (2012–2018) = unlimited exploration, unpublishable. Quarantine (2019–2025) = untouched until one pre-registered confirmatory shot, bar declared first, calibrated to the full lineage size by permutation. Only a quarantine result enters §1. **Fervor in the sandbox, atheism at the quarantine window.**
- **R14 — RECORDED, NOT CROWNED.** An exciting result that agrees with the operator's hypothesis is written down with its n and its noise band, and explicitly NOT promoted, until a pre-registered replication clears it. (Applied to: the commodity "lift" that was binomial noise; the individual cointegration survivors; the demon-native self-persistence whisper.)
- **R15 — REGIME-BOUND BENCHING.** A sensor whose sign flips across eras is not eliminated — it is characterized and BENCHED from quarantine eligibility until a regime-conditional form is registered. Sign stability across all arenas is a crown criterion.
- **R16 — ESTIMABLE-FAMILY ONLY (house physics).** No instrument may require estimating drift. Vol and structure are forecastable; direction is not. This is the technical content of "meteorology, not selection."

---
# §5 — THE LITERATURE
### **Stop inventing vocabulary. Every object we named already has a name.** (Amended by Alex: invent first, collision-check the literature *after* — own-vocabulary is a feature. But the collisions below are load-bearing.)
- **Our formula is Fernholz & Karatzas (2009) eq. 7.10.** μ (the market portfolio) **IS buy-and-hold**; the second term is our γ\*·T; the first is the change in **relative entropy (KL divergence)** between fixed and drifting weights. "Our divergence term is literally a divergence."
- γ\* = **excess growth rate** (Fernholz & Shay 1982) · **diversification return** (Booth & Fama 1992) · **volatility return** (Hallerbach 2014). "JensenGap" = **the dispersion discount** (Hallerbach 2014). Concave-vs-linear is just **AM–GM** (Hillion 2016). "Short straddle" → **negative convexity** (Perold & Sharpe 1988). Never say "short gamma."
- 🚨 **THE TWO PAPERS THAT BEAT US:** **Chambers & Zdanowicz (2014)** — *"diversification return is not a source of increased expected value… any enhanced value emanates from mean-reversion."* **Cuthbertson et al. (2016)** — *"either rebalanced or buy-and-hold… no additional rebalancing return."*
- 🚨 **THE COINTEGRATION CANON (the §0 machinery):** **Engle–Granger (1987)**, **Johansen (1991)**, **Clegg (2014)** — the ~5% persistence base rate ≈ the false-positive rate, which we reproduced. **Lo–MacKinlay** variance ratio — the one imported instrument that half-survived (v1.4). Statistical-arb pairs literature: Rad/Low/Faff (2016).
- Trend-following is a **lookback straddle** (Fung & Hsieh 2001) — convex where rebalancing is concave — but **beware Perold & Sharpe's cancellation:** hedge the concavity fully and you have paid two spreads to own nothing. This is why we chose **truncation over hedging** (the starvation rule).
- **⚠️ CITATION DISCIPLINE:** two numbers landing near 1.2 on unrelated universes is numerology, not confirmation (R10 applied to a citation).

---
# §6 — THE MONEY
## **§6 (the operator's personal money) does not travel to the commune.** Nothing about accounts, holdings, tax positions, income, or the freeze is in this document, by design.

---
# §7 — FRIDAY'S OPEN BOARD (for Andy's Fable)
### Each item tagged by what it needs: **[ENGINE]** simulator · **[STATS]** pure computation on local data · **[WEB]** external data/keys.

1. **THE BITE CENSUS build** — **[ENGINE]**. The corpse program's first *purpose-built* challenger: regime read from the demon's own trade ledger (rebalancing buys *alternate* legs = feeding well; buys *cluster* on one leg = feeding a corpse). The 40:1 bind ratio already lives in this family. First step: **assess whether the engine exposes per-trade logs; if not, a validated replication.** Then: is alternation persistent, and does it predict forward trade-added? (A divergence-family sensor — the corpse belt is vacant and this is aimed at it.)
2. **N-PORT PHASE 2 pipeline for Roster-Delta** — **[WEB]**. Roster-overlap *LEVEL* is dead as a feast explainer, but *DELTA* (kin divergence as a shoot early-warning) survives as a divorce-family instrument. It needs **holdings history** (current rosters were Phase 1; N-PORT filings give the time series). Build the extraction pipeline; the instrument waits on it.
3. **CORPSE-SENSOR TRAINING RUNS against the Hall** — **[STATS]** (data already local: 56 series / 318,788 rows). **Divorce-first**, per the dispersion-not-crashes finding. Train a separator on the modern cohort (2018–2025 deaths) + full survivor controls; the whole point is telling Wirecard from Luckin, SVB from SCHW. No engine, no web — the CSVs are on disk.
4. **γ's REGISTERED FOLLOW-UP** — **[STATS]** (+ **[ENGINE]** for the forward book). The unregistered γ observation (γ_126d alone: median ρ +0.153, 14/14, p=0.0001, beats naive) is a candidate quarantine shot, but the channel is suspected mechanical. Registered form: **partial correlation ρ(γ, fwd TA | gap) + a γ-decile forward book WITH corpse accounting** (GME/AMC was our highest-γ book). Bar: beats naive AND survives the worst tail.
5. **QUARANTINE-BULLET DECISION PREP** — **[STATS]**. Two era-stable champions (γ_126d, Anti-Kinship) are eligible. Design the one-bullet bar: **count the full lineage** (Batch 1 = 8 scored costumes; Batch 2 adds 5; the multiplicity ledger travels), then **permutation-calibrate the quarantine bar** against that count. This is the referee-table work that must be done BEFORE any quarantine shot is fired.

*Also live as descriptive science (round-robin doctrine — run for the data, never for selection): the 190-pair commodity census is done (median +0.73/+0.78 %/yr, η≈1.0, starvation binds 32.1% vs 2.4% atlas = 13×; UNG/URA is the best pair of window A at +3.03 and the worst of window B at −8.88 — the corpse mechanism photographed mid-transformation). Nothing there is crowned.*

---
# THE COMMUNE
- **Publication ruling (Alex, 2026-07-15): PUBLIC.** *"The reason I don't get rich isn't gonna be because I published this."* Structure-type findings are publication-proof (nobody arbs a referee system) and discovery credit is the prize. The only holdback: a future quarantine-confirmed champion's LIVE book publishes on a lag (method immediately, book later). **The public pages ARE the shareable state** — `thisisez.com/demon-rumble.html` (the live Rumble tree: belts, lineage, causes of death, arena status) and `thisisez.com/demon-codex.html` (the pedagogy: demon → why you can't pick one → the radar). House voice: *"Falsification theater. Still not advice."*
- **The commune is mutual aid at the infrastructure layer** — a symmetric protocol (Andy can shard work back). The Atlas is already distribution-ready: deterministic sha256 seeds (any machine computes identical cells), append-only JSONL (merge = concat), done-set resume. Friday 2026-07-18 is the first Andy session, on his Fable tokens, via the **DemonRanchKit** commune channel.
- **PORTABILITY CONTRACT (CONFIRMED — shipped with this kit, 2026-07-16 night build):** every ported script resolves its root via **`DEMON_RANCH_ROOT`** (env var; defaults to the kit root via `Path(__file__).resolve().parents[N]`, so running from the kit needs no setup). All 17 kit scripts py_compile clean; the engine passed a bit-parity gate against the canonical reference (`backtest_duos`) from the kit tree ($1546.6905 final equity, identical to the reference, 0.0000% diff). The repo's **CONTRIBUTING.md** governs the commune: branch + PR always (never push main), append-only dated sidecars, no vaults in git (heavy data rides Drive/USB per `DATA_MANIFEST.md`), REPORT.md per experiment, secrets read in-process and never committed, regenerate-don't-patch.

---
> # THE SHORTEST TRUE STORY
> **The old brief ended by asking whether a cointegration test could select the demon ex ante. We ran it, pre-registered, and the answer is NO — the screen has no forward validity, is anti-predictive of harvest, and cannot even certify our own flagship in its own era. Demon selection and demon prediction are both dead.**
>
> **What survived is a smaller, truer program: DEMON METEOROLOGY — forecast the weather's textures (dispersion, co-movement, divorce), never its specifics. Two sensors are era-stable across three decades of data and await a single pre-registered quarantine shot. The corpse belt is still empty — but we learned its physics: pair-demons die of DIVORCE, not fire, and the next detector listens for decoupling.**
>
> ## **The demon is not a stock-picker and never was. It is a barometer. Read the weather; do not bet the forecast.**
