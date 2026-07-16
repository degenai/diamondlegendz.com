# JOB 5 — QUARANTINE-BULLET DESIGN (referee prep, staged for the Fable pass)

**Frozen spec declared 2026-07-16. Immutable Friday 2026-07-18 (R12).**
**This is NOT A RUN. It is a computation SPEC + a one-page bar proposal for the Fable referee prompt to review.**
**The quarantine years (2019–2025) are NOT touched Friday. No champion statistic is computed against quarantine data (R13).**

---

## 1. OBJECTIVE

Two sensors are era-stable across three decades and eligible for the single pre-registered quarantine shot: **γ_126d** (incumbent, both belts, strengthens in death eras) and **Anti-Kinship** (feast +0.234 / +0.132 / +0.261 across sandbox / GFC / dot-com). The Rumble's law is explicit: *"the bar must be declared with the full lineage size disclosed and calibrated by permutation of the quarantine years — the more branches examined, the stiffer the bar. A survivor of 400 sandbox branches that squeaks p=0.04 is NOT a finding."* This job does the **referee-table arithmetic that must happen BEFORE any quarantine shot is fired**: count the full scored-entrant lineage, define the permutation calibration precisely, and produce a **one-page bar proposal** for the Fable referee to review and ratify. It fires nothing. It runs nothing against 2019–2025. Its output is the specification the referee critiques and the eventual shooter obeys.

---

## 2. FROZEN SPEC

### 2.1 Count the full scored-entrant lineage (the multiplicity ledger)

Enumerate, from `RUMBLE.md`, every **scored** entrant/costume across the batches — this count `L` is what stiffens the bar:

- **Batch 1 — 8 scored costumes:** `gamma_126d`, `tc_126`, `tc_252`, `tc_504` (Title-Change's three costumes are three scored entries — the multiplicity is real, per RUMBLE Batch-1), `breath_252`, `same_league`, `factor_kinship_252`, `ddgamma_ratio`.
- **Batch 2 — +5 new scored entries:** `Anti-Kinship`, `Kinship-Reliability`, `Cross-League`, `League-Reliability`, `DD-γ v1`. *(Re-scorings of Batch-1 survivors on the new reliability belt are the same entrants in a new belt, not new lineage members — but the reliability belt itself is a second family of tests; the proposal must state whether the bar counts belts as separate tests. Default: count distinct (entrant × belt) scored statistics, and disclose both the entrant count and the statistic count.)*
- **Batch 3 — cross-arena re-scoring** of the six standing fighters across the GFC and dot-com arenas (γ, TC-126, Breath, Anti-Kinship, Cross-League, DD-γ v1). These are additional scored statistics on existing entrants; disclose them in the ledger.
- **+ Batch 4 (the Bite Census, JOB1) IF its Phase B ran** — add its scored belts to `L`. If JOB1 Phase B did not run, the Bite is not yet in the lineage; note it as pending.

**Deliverable of this step:** an explicit ledger — the entrant count, the total scored-statistic count, and the two candidate champions (γ_126d, Anti-Kinship) with their sandbox+arena scores. `L` is the number the permutation bar is corrected against.

### 2.2 Define the permutation calibration (the bar's engine, specified not executed)

- **The champion's quarantine statistic (defined, not computed here):** for the chosen champion, the shot statistic is the **median across the quarantine-year (2019–2025) cross-sectional Spearman ρ(sensor, forward TA)** — the same statistic-of-record the sandbox batches used, ported to the quarantine window. (Consistency with R10: the quarantine statistic must be the identical estimator to the sandbox one.)
- **The permutation null (specified):** to calibrate the bar, **shuffle the quarantine years' cross-sections** — within each quarantine year, permute the forward-TA labels across pairs (breaking the sensor↔TA link while preserving each year's marginal TA distribution and cross-sectional sizes), recompute the champion statistic, **N = 1,000 permutations** → a null distribution of the median-yearly-ρ under "sensor carries no information." *(This permutation touches quarantine data — therefore it is NOT run Friday; it is the procedure the referee ratifies and the shooter executes at shot time.)*
- **The lineage-adjusted bar (the proposal's核心):** the champion's observed statistic must exceed a percentile of the null that is **corrected for the `L` scored entrants examined.** Propose and compare two honest options for the referee to choose:
  1. **max-statistic (max-T) permutation bar** — per permutation, recompute the statistic for **all `L` scored entrants** and take the **maximum**; the bar is the 95th percentile of that max-distribution. This is the exact family-wise permutation control and the Rumble's spirit ("the bar scales with the search").
  2. **Bonferroni-over-lineage** — bar = the `(1 − 0.05/L)` quantile of the single-champion null. Simpler, more conservative, requires only the champion's null.
- **The one-bullet rule restated:** exactly ONE champion gets ONE shot; the bar is declared (with `L` disclosed) before the shot; a pass enters §1, a miss ends that champion's candidacy. Standing bars the champion must ALSO clear (from RUMBLE Rule 8): beat γ_126d alone (if the champion is not γ), beat naive persistence, and — for a corpse-target — beat/complement the D=80 starvation rule's 40:1 tail ratio.

### 2.3 Output — the one-page bar proposal (the actual deliverable)

A single-page document, `BAR_PROPOSAL.md`, addressed to the Fable referee prompt, containing: (i) the lineage ledger and `L`; (ii) the champion recommendation (γ_126d vs Anti-Kinship) with the reasoning and JOB4's γ-eligibility verdict folded in if available; (iii) the exact permutation procedure; (iv) the two bar options with a recommendation; (v) an explicit statement that **the bar is unexecuted against quarantine and awaits referee ratification before any shot.**

### 2.4 Optional — a DRY-VALIDATED permutation harness (built, never pointed at quarantine)

The agent MAY build the permutation harness as code and **dry-validate it on SANDBOX data** (or synthetic) — e.g., prove the shuffle preserves per-year marginals and that under a null-injected sensor the observed statistic lands mid-distribution. **The harness must NOT be run against 2019–2025** (R13). Ship it disabled/guarded, with a comment that firing it against quarantine is the shooter's job after referee sign-off.

### 2.5 R-rules in force

R1 (the statistic-of-record is a median of yearly ρ — no means). R10 (quarantine statistic = identical estimator to the sandbox batches). R11 (this spec is regenerated from `RUMBLE.md` + the batch results, not patched from memory — cite the batch files). R12 (the bar is declared, with `L` disclosed, BEFORE the shot — this job IS that declaration). R13 (**quarantine is not touched Friday**; the permutation runs at shot time, post-ratification). R14 (neither champion is crowned; this job sets the bar that could someday crown one).

---

## 3. DATA PREREQUISITES (kit-relative)

| artifact | kit path | in git? | needed for |
|---|---|---|---|
| Rumble protocol + batch results | `sidecars/kayfabe-20260715/RUMBLE.md` | yes | the lineage ledger, statistics-of-record |
| batch results JSON | `sidecars/kayfabe-20260715/rumble_batch{1,2,3}/batch{1,2,3}_results.json` | yes | per-entrant scores, verdicts |
| JOB4 eligibility verdict | `jobs/results/job4_gamma_followup/partial_corr.json` | produced Friday | folds γ's eligibility into the champion recommendation |
| JOB1 Bite verdict | `jobs/results/job1_bite_census/bite_results.json` | produced Friday | whether Batch 4 adds to `L` |
| sandbox features (for dry-validation only) | `sidecars/kayfabe-20260715/rumble_batch1/batch1_pairs.csv` | yes | optional harness dry-run (NEVER quarantine) |

**No Drive dependency and NO web.** This job reads in-git protocol + result files and (optionally) the in-git sandbox CSV for a dry-run. **It deliberately does NOT read any quarantine (2019–2025) data** — the absence of a quarantine panel here is by design, not a gap. It runs last (after JOB1 and JOB4 produce their verdicts).

---

## 4. THE VERBATIM AGENT PROMPT (Andy pastes this to an Opus agent)

```text
You are executing JOB 5 (QUARANTINE-BULLET DESIGN) from the DemonRanchKit. The spec is FROZEN in
commune/DemonRanchKit/jobs/JOB5_quarantine_bullet_design.md, declared 2026-07-16. THIS IS NOT A RUN:
you produce a one-page bar proposal for the Fable referee, and you do NOT touch quarantine (2019-2025)
data (R13). You fire no shot. All paths are relative to the kit root (commune/DemonRanchKit/). Read
RUMBLE.md (especially Rule 7 THE ONE BULLET, Rule 8 standing bars) and the batch results JSONs before
writing anything.

HOUSE RULES (binding): R1 — the statistic-of-record is a median of yearly Spearman rho; no means.
R10 — the quarantine statistic must be the IDENTICAL estimator to the sandbox batches. R11 — build the
lineage ledger by regenerating from RUMBLE.md + the batch result files, citing them; do not recall from
memory. R12 — declare the bar WITH the lineage size L disclosed, BEFORE any shot (this document IS that
declaration). R13 — DO NOT touch quarantine data; any permutation that shuffles quarantine cross-sections
is SPECIFIED here and RUN LATER by the shooter, after referee sign-off.

STEP 1 — LINEAGE LEDGER: enumerate every scored entrant/costume from RUMBLE.md:
  Batch 1 = 8 scored costumes (gamma_126d, tc_126, tc_252, tc_504, breath_252, same_league,
  factor_kinship_252, ddgamma_ratio). Batch 2 = +5 (Anti-Kinship, Kinship-Reliability, Cross-League,
  League-Reliability, DD-gamma v1). Batch 3 = cross-arena re-scorings of the 6 standing fighters (GFC +
  dot-com). Read jobs/results/job1_bite_census/bite_results.json: if JOB1 Phase B ran, add the Bite's
  scored belts to L; else note the Bite as pending. Output BOTH an entrant count and a total
  scored-statistic count, and disclose whether belts are counted as separate tests.

STEP 2 — CHAMPION RECOMMENDATION: the two era-stable eligible sensors are gamma_126d and Anti-Kinship.
  Read jobs/results/job4_gamma_followup/partial_corr.json if present and fold gamma's
  quarantine-eligibility verdict into the recommendation. State the pick and the reasoning.

STEP 3 — PERMUTATION CALIBRATION SPEC (specified, NOT executed against quarantine):
  Champion quarantine statistic = median across quarantine-year (2019-2025) cross-sectional Spearman
  rho(sensor, forward TA) — identical estimator to the sandbox batches. Null = shuffle each quarantine
  year's cross-section (permute forward-TA labels across pairs within the year, preserving marginals and
  sizes), recompute the champion statistic, N=1000 permutations. Lineage-adjusted bar options:
  (1) max-T: per permutation take the MAX statistic across all L scored entrants; bar = 95th pct of the
      max-distribution (exact family-wise control). (2) Bonferroni: bar = (1 - 0.05/L) quantile of the
      single-champion null. Recommend one. Restate the one-bullet rule and RUMBLE Rule 8 standing bars.

STEP 4 (OPTIONAL) — DRY-VALIDATE a permutation harness on SANDBOX data only
  (sidecars/kayfabe-20260715/rumble_batch1/batch1_pairs.csv): prove the shuffle preserves per-year
  marginals and that a null-injected sensor lands mid-distribution. GUARD it so it cannot run against
  2019-2025. Never point it at quarantine.

OUTPUT (write under jobs/results/job5_quarantine_bullet/):
  - BAR_PROPOSAL.md   — THE one-page deliverable: lineage ledger + L, champion recommendation,
                        permutation procedure, the two bar options + recommendation, and an explicit
                        line that the bar is UNEXECUTED against quarantine and awaits referee ratification.
  - lineage_ledger.json — entrant count, scored-statistic count, per-entrant belt/arena scores, L.
  - permute_harness.py  — (optional) the guarded, dry-validated harness (NEVER fires at quarantine).

TERSE FINAL REPORT to the pilot (<= 10 lines): the entrant count and total scored-statistic count L
(including whether the Bite was added); the champion recommendation and why (with gamma's eligibility
verdict if available); the recommended bar option (max-T vs Bonferroni) in one line; explicit
confirmation that NOTHING was run against quarantine; artifact paths.
```

---

## 5. DONE-CRITERIA + FABLE REFEREE STAGING

**Done:** `BAR_PROPOSAL.md` and `lineage_ledger.json` written; `L` counted and disclosed; champion recommended; permutation procedure and lineage-adjusted bar specified; explicit statement that quarantine was not touched. (The optional harness is a bonus, not required for done.)

**This job's entire product IS referee-table material — stage all of it for the Fable pass:**
- `BAR_PROPOSAL.md` is written **to** the Fable referee prompt. The referee's job on it: (i) confirm `L` is honestly counted (undercounting the lineage is the way to sneak a soft bar — R6/R14); (ii) confirm the quarantine statistic is the identical estimator to the sandbox one (R10); (iii) choose between max-T and Bonferroni; (iv) confirm the permutation preserves per-year marginals; (v) verify **nothing touched 2019–2025**.
- **The referee ratifies or amends the bar. Only after ratification does a future session fire the one quarantine shot.** This job explicitly does not pre-empt that — it hands the referee a declared, `L`-disclosed bar to sign off, which is exactly what R12/R13 require before a shot exists.
- **Note for the brief regeneration:** record `L`, the recommended champion, and the ratified bar (once the referee sets it) so the next brief carries the declared quarantine bar as a standing, pre-registered commitment — the shot, when it comes, is then pure execution of a frozen bar, not a fresh negotiation.
