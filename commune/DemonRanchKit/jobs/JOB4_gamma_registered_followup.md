# JOB 4 — γ's REGISTERED FOLLOW-UP

**Frozen protocol declared 2026-07-16, before any computation. Immutable Friday 2026-07-18 (R12).**
**Arena: SANDBOX ONLY, 2012–2018 (R13). Quarantine (2019–2025) is NOT touched — the forward book uses cached sandbox targets only.**
**Pure STATS on cached columns. NO engine run required. NO quarantine shot fired here.**

---

## 1. OBJECTIVE

γ_126d is the Rumble's incumbent — it takes both belts (feast +0.180, reliability +0.241, both 7/7) and strengthens in death eras (+0.180 / +0.237 / +0.314 across sandbox / GFC / dot-com). Its unregistered whole-history observation (γ alone: median ρ +0.153, 14/14, p=0.0001, beats naive) is a candidate quarantine shot. **But the channel is suspected largely mechanical — vol predicts vol, and vol is the food.** Before γ can be trusted as an *independent* sensor rather than a repackaging of the drift gap it partly contains, this job runs its **registered form**: (a) the **partial** Spearman ρ(γ, forward TA | gap_756d) — does γ still predict harvest once the drift gap is controlled — and (b) a **γ-decile forward book with corpse accounting** — because the campaign's highest-γ book was GME/AMC, and a sensor that predicts harvest while also predicting catastrophe needs its tail shown, not hidden. This keeps γ quarantine-*eligible* or benches it, on a pre-declared bar. It fires no quarantine shot (that is JOB5's referee prep).

---

## 2. FROZEN PROTOCOL

### 2.1 Prong A — PARTIAL correlation (the quarantine-eligibility test)

- **Statistic of record:** the **partial Spearman ρ(γ_126d, target_ta_per_yr | gap_756d)**, computed **per sandbox year** (2012–2018), then the **median across the 7 years + the count of years with partial ρ > 0.10.** (R1 — median and count, no means.)
- **Partial-Spearman method (frozen):** within each year's cross-section, rank-transform `γ_126d`, `target_ta_per_yr`, and `gap_756d`; regress rank(γ) on rank(gap) and rank(TA) on rank(gap) (OLS, intercept); the partial ρ is the Pearson correlation of the two residual vectors. Mask non-finite in any of the three arrays; require n ≥ 10 in a year (same convention as `batch1.sp_rho` / `v12_target_swap.sp`).
- **Declared direction:** **+** (γ predicts more forward TA even net of the drift gap).
- **DECLARED BAR (R12):** **partial ρ must remain > 0.10 with ≥ 5/7 years** for γ to stay **quarantine-eligible**. If the partial ρ collapses toward 0 (or below the bar), that is the "mechanical / gap-mediated" verdict — γ is characterized as not-independent-of-gap and its quarantine eligibility is downgraded, recorded honestly. **The 0.10 threshold and the 5/7 count are frozen now, untouched after the run.**
- **Why gap_756d specifically:** the killed Kayfabe state variable was `K = γ_126d − 4·gap_756d`; the drift gap is exactly the quantity γ might be smuggling. Controlling for it is the registered test of whether γ is its own signal. (This is R6 applied structurally — γ agrees with the operator's hope; the partial correlation is the harder look.)

### 2.2 Prong B — γ-DECILE FORWARD BOOK with corpse accounting (descriptive)

- Pool all eligible sandbox pair-years (2012–2018). Sort into **γ_126d deciles.** Per decile, report (all R1-clean):
  - **median forward TA** (`target_ta_per_yr`) — the feast gradient across γ.
  - **worst pair-year forward TA in the decile** — the tail (the GME/AMC-shaped catastrophe the highest-γ decile is suspected to carry).
  - **severity rate** — fraction of the decile's pair-years with **forward TA ≤ −5%/yr** (the Batch-3 severity definition), the corpse-accounting number.
  - decile n and the γ range of the decile.
- **This table is DESCRIPTIVE (R14 — recorded, NOT crowned).** It is not scored against a bar; it exists so that any future "γ pays" claim must be read next to "and here is what the top-γ decile's tail looks like." The registered question it answers descriptively: does γ's harvest gradient come bundled with a severity gradient (i.e., is high γ both the most feast AND the most corpse-exposed)?

### 2.3 Scope guards

- **Sandbox only (R13).** Every input is a 2012–2018 pair-year. The forward targets are the cached `target_ta_per_yr` (already restricted to sandbox in `batch1_pairs.csv`). **No engine run, no quarantine year, no forward book beyond 2018.** The brief's "[ENGINE] for the forward book" is unnecessary here because the sandbox forward TAs are already cached — and extending to quarantine would violate R13. If the agent believes an engine run is needed, that is a signal it is about to touch quarantine — STOP.
- **No means anywhere (R1).** Partial ρ is a rank statistic; the decile summaries are medians / worst-case / rates.

### 2.4 R-rules in force

R1 (medians, counts, rates — no means). R10 (γ, gap, and TA are the SAME cached quantities from the same estimator that produced Batch 1 / Kayfabe — the partial correlation compares like with like; do not recompute γ with a different window and subtract). R12 (bar 0.10 & 5/7 declared pre-run). R13 (sandbox only). R14 (decile table descriptive, not crowned). R16 (γ and gap are vol/drift-structure quantities read from the ledger of realized prices; the sensor forecasts texture, and the partial test is precisely to strip the drift term γ might be leaning on).

---

## 3. DATA PREREQUISITES (kit-relative; Drive flag per DATA_MANIFEST.md)

| artifact | kit path | in git? | needed for |
|---|---|---|---|
| **batch1 sandbox features** | `sidecars/kayfabe-20260715/rumble_batch1/batch1_pairs.csv` | **yes** | γ_126d, target_ta_per_yr, eligible_fwd — **Prong B runs entirely on this** |
| **kayfabe features (has gap_756d)** | `sidecars/kayfabe-20260715/kayfabe_pairs.csv` | **NO — Drive/USB (1.9 MB, regenerable)** | **Prong A: gap_756d column** (join on pair,year) |
| gap recompute fallback | `sidecars/kayfabe-20260715/kayfabe_test.py` (`drift_gap`) + `sidecars/cointegration-20260715/yf_panel_2008_2026.csv` | fallback: test.py in git, panel Drive | recompute gap_756d if kayfabe_pairs.csv absent |

**The gap_756d subtlety (flag honestly):** `batch1_pairs.csv` (in git) does **NOT** contain a `gap_756d` column — its columns are `pair, year, same_league, gamma_126d, sigma_126d, tc_126, tc_252, tc_504, breath_252, factor_kinship_252, dd_max_756d, ddgamma_ratio, naive_prev_ta_per_yr, target_ta_per_yr, eligible_fwd`. The drift gap lives in **`kayfabe_pairs.csv`** (columns `pair, year, gamma_126d, gap_756d, K, title_change_252d, naive_prev_ta_per_yr, target_ta_per_yr, eligible_fwd`, spanning 2012–2025), which **rides Drive**. So **Prong A has a Drive prerequisite**: either (i) join `gap_756d` from `kayfabe_pairs.csv` on `(pair, year)` for the sandbox years, or (ii) recompute `gap_756d` from `yf_panel_2008_2026.csv` (also Drive) using `kayfabe_test.drift_gap` verbatim (R10). **Prong B (the decile forward book) runs with NO Drive dependency — entirely on the in-git `batch1_pairs.csv`.** If neither Drive source is mounted Friday, Prong A is deferred and Prong B still completes — a legitimate partial done-state.

---

## 4. THE VERBATIM AGENT PROMPT (Andy pastes this to an Opus agent)

```text
You are executing JOB 4 (γ's REGISTERED FOLLOW-UP) from the DemonRanchKit. The protocol is FROZEN in
commune/DemonRanchKit/jobs/JOB4_gamma_registered_followup.md, declared 2026-07-16. You may NOT retune
the bar (partial rho > 0.10, >= 5/7 years) or move any window. SANDBOX ONLY (2012-2018); if you find
yourself needing an engine run or a post-2018 forward target, STOP — that means you are about to touch
quarantine (R13 violation). All paths are relative to the kit root (commune/DemonRanchKit/). Read
CLAUDE_BRIEF.md §4 (house rules) and the RUMBLE.md batch results for gamma's incumbency before coding.

HOUSE RULES (binding): R1 — medians, counts, rates ONLY; no means. R10 — gamma, gap, and forward TA
must be the SAME cached quantities that produced Batch 1 / Kayfabe; do NOT recompute gamma with a
different window and compare. R13 — sandbox only; quarantine untouched. R14 — the decile table is
descriptive, recorded not crowned.

PRONG A — PARTIAL correlation (quarantine-eligibility test):
Data: gamma_126d and target_ta_per_yr from sidecars/kayfabe-20260715/rumble_batch1/batch1_pairs.csv
(in git); gap_756d from sidecars/kayfabe-20260715/kayfabe_pairs.csv (Drive). Join on (pair, year),
sandbox years 2012-2018, eligible_fwd rows only.
  - If kayfabe_pairs.csv is NOT mounted, recompute gap_756d from
    sidecars/cointegration-20260715/yf_panel_2008_2026.csv (also Drive) using kayfabe_test.drift_gap
    VERBATIM (R10). If NEITHER Drive source is present, record "Prong A deferred: no gap_756d source"
    and proceed to Prong B.
Statistic: per year 2012-2018, compute partial Spearman rho(gamma_126d, target_ta_per_yr | gap_756d):
  rank-transform the three columns; OLS-regress rank(gamma) on rank(gap) and rank(TA) on rank(gap)
  (with intercept); partial rho = Pearson corr of the two residual vectors. Mask non-finite; require
  n >= 10 per year. Report median partial rho across the 7 years + count of years with partial rho > 0.10.
BAR (declared, do not move): gamma stays QUARANTINE-ELIGIBLE iff median partial rho > 0.10 AND
>= 5/7 years exceed 0.10. Else gamma is characterized as gap-mediated / not-independent and its
eligibility is downgraded. Report the verdict plainly either way.

PRONG B — gamma-DECILE FORWARD BOOK with corpse accounting (descriptive, runs on batch1_pairs.csv alone):
Pool eligible sandbox pair-years. Sort into 10 gamma_126d deciles. Per decile report: n, gamma range,
median forward TA, WORST pair-year forward TA, and severity rate (fraction with forward TA <= -5%/yr).
This table is DESCRIPTIVE (R14) — not scored against any bar. State whether gamma's feast gradient is
bundled with a severity gradient (is the top-gamma decile both the most feast AND the most corpse-exposed).

OUTPUT (write under jobs/results/job4_gamma_followup/):
  - REPORT.md          — Prong A per-year partial rho table + median + count + eligibility verdict;
                         Prong B decile table (median TA, worst pair-year, severity rate per decile);
                         a one-line read on whether gamma survives the gap control; deviations.
  - partial_corr.json  — per-year partial rho, median, n_years>0.10, verdict, gap source used.
  - gamma_deciles.csv  — decile, n, gamma_lo, gamma_hi, median_fwd_TA, worst_fwd_TA, severity_rate.
  - gamma_followup.py   — the standalone sidecar (imports kayfabe_test.drift_gap read-only if recomputing gap).

Determinism: no RNG.

TERSE FINAL REPORT to the pilot (<= 10 lines): the gap source used (kayfabe_pairs.csv / recomputed /
deferred); Prong A median partial rho and years>0.10 count and the eligibility verdict; Prong B — the
top-gamma decile's median forward TA AND its worst pair-year AND its severity rate (the bundled
feast+corpse read); artifact paths. State plainly if Prong A was deferred for lack of a gap source.
```

---

## 5. DONE-CRITERIA + FABLE REFEREE STAGING

**Done (any legitimate finished state):**
- **Both prongs:** partial ρ computed with a real gap source, eligibility verdict declared; decile forward book with corpse accounting emitted.
- **Prong B only:** no Drive gap source mounted — Prong A deferred, Prong B (the in-git decile book) completed. Legitimate partial done-state.

**Stage for the end-of-day Fable referee pass:**
- `jobs/results/job4_gamma_followup/REPORT.md`, `partial_corr.json`, `gamma_deciles.csv`.
- **The referee's load-bearing check (R6/R10):** γ agreeing that it "still predicts TA net of gap" is the flattering result — the referee re-derives one year's partial ρ from the residual method and confirms it is a genuine partial (rank residuals of both variables on gap), not a raw ρ mislabeled. If the partial ρ clears 0.10 but the raw ρ was ~0.15, the shrinkage tells the mechanical-content story and must be reported.
- **The decile tail:** the top-γ decile's worst pair-year and severity rate are the honest counterweight to any "γ pays" headline — the referee ensures REPORT.md shows the tail beside the median (the trade-added-flatters-garbage lesson, applied to γ itself).
- **Note for JOB5 / the brief:** the eligibility verdict feeds JOB5's lineage — if γ stays eligible, it is one of the two era-stable champions competing for the single quarantine bullet; if it is downgraded to gap-mediated, that reshapes which champion JOB5's bar is calibrated for. Record the verdict so JOB5 and the brief regeneration inherit it.
