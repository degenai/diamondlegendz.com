# JOB 2 — DIVORCE-FIRST CORPSE TRAINING against the Hall of the Dead

**Frozen protocol declared 2026-07-16, before any computation. Immutable Friday 2026-07-18 (R12).**
**DESCRIPTIVE CENSUS / sensor-training on real corpse paths — NOT a selection, NOT a champion. Sandbox-grade contender at most.**
**The honesty core: every threshold is calibrated on SURVIVOR-CONTROL data only. No corpse data enters any calibration.**

---

## 1. OBJECTIVE

Three Rumble batches left the corpse belt vacant, but the corpse *physics* is now named: **pair-demons die of divorce (decoupling), not fire (coordinated crashes)** — GFC severity 3.22% vs dot-com 0.16%, a 20× gap despite dot-com holding the scarier index charts. The Hall of the Dead ships 56 real corpse/survivor price series (318,788 daily rows), and its whole point is telling **Wirecard from Luckin, SVB from Schwab** — a dying firm from one that merely fell hard and lived. This job traces **divorce-family sensors** in the 504 trading days before each modern-cohort death, matched corpse-vs-survivor, and asks: does any sensor cross a **survivor-calibrated** alarm threshold with meaningful **lead time** before death, without constantly crying wolf on survivors? A sensor that leads by ≥60 trading days across ≥2 death classes while flagging ≤10% of survivor-control time is the **first genuine corpse-belt CONTENDER** — the first thing that could eventually fill the vacant belt.

---

## 2. FROZEN PROTOCOL

### 2.1 Cohort and pairing

- **Universe:** the Hall's **modern cohort** (2018–2025 deaths — the era of clean pennies-to-near-zero coverage per Hall REPORT.md §F1/BUILD-v2). Corpses are matched to survivors via the `matched_counterpart` column of `manifest.csv` / `manifest_v2.csv`.
- **Death classes carried (each with ≥1 matched survivor control):**
  - **crisis_kill:** SVB (SIVBQ), Signature (SBNY), First Republic (FRCB), Silvergate (SICP) → survivors WAL, PACW→BANC, SCHW.
  - **slow_melt:** Sears (SHLDQ), Rite Aid (RADCQ), BBBY (BBBYQ), Express (EXPRQ), WeWork (WEWKQ), Tupperware (TUPBQ), RadioShack (RSHCQ), Pier 1 (PIR), Party City (PRTYQ), GNC (GNCIQ), Revlon (REVRQ) → survivors BBY, GME, WSM, TGT, AEO, GAP, KSS, M, PTON.
  - **fraud_collapse:** Wirecard (WCAGY/WRCDF), Nikola (NKLA→NKLAQ) → **fraud_survivor control Luckin (LKNCY)** — the "crashed to $1.38 and relisted to $32" negative the sensor must NOT fire on permanently.
  - *(geopolitical (RSX, ERUS) and died_and_resurrected (Hertz, Chesapeake) have no clean matched equity survivor / are structurally different — carried as descriptive appendix only, NOT counted toward the ≥2-class success bar.)*
- **Truncations are load-bearing (R5 — validate inputs before trusting them).** Honor every truncation the Hall REPORT/manifests specify before computing anything: NKLA at 2025-02-25, SIVBQ at 2024-11-07, WRCDF at 2026-06-29, TUPBQ at 2025-06-11, GNCIQ at 2020-10-30, REVRQ at 2023-05-01, ERUS at 2022-04-19, CHK at 2021-03-01. The forward-fill zero-volume tails are artifacts, not signal. The recycled-ticker quarantine (BBBY, BLIAQ) and the poison-ticker list (SHLD/CC/GM/WM) are respected: **never load a corpse by its recycled live ticker.**

### 2.2 Sensors traced in the 504 trading days pre-death (all divorce-family, R16-clean)

For each corpse-survivor pair, build the aligned daily corpse-vs-survivor series and trace, as a function of trading days-before-death `τ ∈ [−504, 0]`:

- **(a) Correlation DECAY — `corr_decay`:** the **slope** of the 126d rolling Pearson correlation of daily returns (corpse vs survivor) over `τ`. Alarming direction = **declining** correlation (decoupling). Reuse the return-correlation convention from `batch1.py` (252d Pearson of daily simple returns) at a 126d window.
- **(b) BREATH stoppage — `breath_trend`:** the **trend (slope)** of the crossing-rate of the pair log-spread. Frozen-β log-spread via `coint_test.frozen_spread` / a trailing OLS β; crossing rate via `coint_test.crossings_per_yr` on a rolling window. Alarming direction = **falling** crossing rate (the pair stops breathing — spread stops mean-reverting, one leg is walking away).
- **(c) Relative drawdown DIVERGENCE — `rel_dd_div`:** the divergence between the corpse's drawdown-from-running-high and the survivor's, i.e. `dd_corpse(τ) − dd_survivor(τ)` and its trend. Alarming direction = **corpse DD deepening while survivor DD stays shallow** (the fell-hard-and-lived vs the dying).

All three are **rate/structure quantities — no drift is estimated (R16).**

### 2.3 Statistic of record — SURVIVOR-CALIBRATED lead time

**This is the whole method. Read it twice.**

1. **Calibrate each sensor's alarm threshold on SURVIVOR-CONTROL data ONLY.** For each sensor, form its distribution over the **survivor-control histories** (survivor-vs-survivor pairings within a class, and each survivor's own quiet-period sensor values, excluding any window within 504d of a real death). The threshold is the **95th percentile in the alarming direction** of that survivor-only distribution. **No corpse series contributes a single data point to any threshold.** (This is the core of the job's honesty — a threshold set on corpse data would be curve-fit hindsight.)
2. **On each corpse-survivor pair, find the FIRST day** in the 504d pre-death window where the sensor crosses its survivor-calibrated threshold in the alarming direction. **Lead time = (death-date index − first-cross index)** in trading days. No cross in the window → lead time = 0 (sensor never fired).
3. **Statistic of record = median lead time per death class** (R1 — median, not mean), reported per class, per sensor.
4. **False-alarm rate (reported alongside, decisive):** the fraction of **held-out survivor-control time** the sensor sits across its threshold. By construction of the 95th percentile this is ~5% in-calibration; measure it on **held-out survivor time** honestly (a sensor that flags 30% of survivor time is a wolf-crier regardless of its lead time).

### 2.4 Declared success bar (R12)

> **A sensor is the first genuine corpse-belt CONTENDER iff: median lead ≥ 60 trading days across ≥ 2 death classes, AND it flags ≤ 10% of held-out survivor-control time.** Any sensor clearing both is recorded as a **sandbox-grade contender — NOT a champion** (a champion requires a pre-registered quarantine shot, which this is not; R14). A sensor clearing neither is recorded with its numbers and benched. Report per death-class always — a sensor that leads on crisis_kill but not slow_melt is *characterized*, not crowned (R15 in spirit).

### 2.5 R-rules in force

R1 (median lead times, precisions, counts — no means). R5 (honor every truncation before computing; a forward-filled tail treated as signal is the input-validation failure this rule exists for). R6 (the sensor that separates Wirecard from Luckin is the flattering result — scrutinize it hardest; a scandal detector that fires on Luckin too is a failure wearing a success). R10 (calibration distribution and test statistic use the SAME sensor estimator; survivor-calibration and corpse-test are the same measurement on different data — never mix estimators). R12 (bar declared above, pre-run). R13 (this is entirely outside the Rumble's sandbox/quarantine price split — it trains on real corpse paths, all EXPLORATION-grade, unpublishable as a champion). R14 (a contender is recorded, not crowned). R16 (divorce-family sensors estimate no drift).

---

## 3. DATA PREREQUISITES (kit-relative; Drive flags per DATA_MANIFEST.md)

| artifact | kit path | in git? | needed for |
|---|---|---|---|
| **Hall price library** | `sidecars/hall-of-the-dead-20260715/prices/` (56 series, 318,788 rows) | **NO — Drive/USB (14 MB)** | **the entire job — corpse + survivor daily series** |
| manifest (v1) | `sidecars/hall-of-the-dead-20260715/manifest.csv` | yes | pairings, death dates, coverage verdicts |
| manifest (v2) | `sidecars/hall-of-the-dead-20260715/manifest_v2.csv` | yes | modern cohort pairings + truncation notes |
| Hall REPORT | `sidecars/hall-of-the-dead-20260715/REPORT.md` | yes | truncation points, contamination guards, class map |
| spread/crossing estimators | `sidecars/cointegration-20260715/coint_test.py` (`frozen_spread`, `crossings_per_yr`, `half_life`) | yes | breath sensor |

**Drive-riding prerequisite: `sidecars/hall-of-the-dead-20260715/prices/`.** This job **cannot run at all** without it — mount `DEMON_RANCH_ROOT` at a tree containing the Hall `prices/`, or drop the directory into the kit per DATA_MANIFEST. If it is absent Friday, the job **cannot be executed** and that is the honest done-state (do not fabricate from manifests alone — the manifests carry death dates and coverage verdicts but **no prices**). The manifests + REPORT confirm the *shape* of the data; the sensors need the actual daily series.

---

## 4. THE VERBATIM AGENT PROMPT (Andy pastes this to an Opus agent)

```text
You are executing JOB 2 (DIVORCE-FIRST CORPSE TRAINING) from the DemonRanchKit. The protocol is
FROZEN in commune/DemonRanchKit/jobs/JOB2_divorce_corpse_training.md, declared 2026-07-16. You
may NOT retune any window, sensor direction, threshold rule, or the success bar. A protocol found
broken is DOCUMENTED and SKIPPED, never tuned (R12). All paths are relative to the kit root
(commune/DemonRanchKit/). Read sidecars/hall-of-the-dead-20260715/REPORT.md AND both manifests
BEFORE writing code — the truncation points and contamination guards there are load-bearing.

DATA GATE (do this first): confirm sidecars/hall-of-the-dead-20260715/prices/ exists (resolve via
DEMON_RANCH_ROOT). If it is ABSENT, STOP: this job needs the real daily price series and cannot be
run from manifests alone. Record "deferred: Hall prices/ not mounted (Drive/USB)" and finish. Do
NOT fabricate series from the manifests.

HOUSE RULES (binding): R1 — median lead times, precisions, counts ONLY; no means. R5 — honor EVERY
truncation from REPORT.md/manifests before computing (NKLA@2025-02-25, SIVBQ@2024-11-07,
WRCDF@2026-06-29, TUPBQ@2025-06-11, GNCIQ@2020-10-30, REVRQ@2023-05-01, ERUS@2022-04-19,
CHK@2021-03-01; forward-filled zero-vol tails are artifacts). Never load a corpse by a recycled live
ticker (BBBY/BLIAQ are quarantined; SHLD/CC/GM/WM are poison). R6 — the Wirecard-vs-Luckin
separation is the flattering result; scrutinize it hardest and report the survivor false-alarm rate
next to every lead time. R10 — calibrate and test with the SAME sensor estimator. R16 — no drift
estimation.

COHORT: modern-cohort deaths (2018-2025) with a matched survivor per manifest `matched_counterpart`.
Classes counted toward the bar: crisis_kill (SVB/Signature/First Republic/Silvergate vs WAL/BANC/SCHW),
slow_melt (Sears/Rite Aid/BBBY-Q/Express/WeWork/Tupperware/RadioShack/Pier1/Party City/GNC/Revlon vs
BBY/GME/WSM/TGT/AEO/GAP/KSS/M/PTON), fraud_collapse (Wirecard/Nikola vs the fraud_survivor control
Luckin/LKNCY). Geopolitical (RSX/ERUS) and died_and_resurrected (Hertz/Chesapeake) are a descriptive
appendix only, NOT counted toward the bar.

For each corpse-survivor pair, build the aligned daily corpse-vs-survivor series and trace three
divorce-family sensors as a function of trading-days-before-death tau in [-504, 0]:
  (a) corr_decay  = slope of the 126d rolling Pearson corr of daily returns (corpse vs survivor);
                    alarming = declining correlation.
  (b) breath_trend = slope of the crossing-rate of the frozen-beta pair log-spread
                    (use coint_test.frozen_spread / a trailing OLS beta + coint_test.crossings_per_yr
                    on a rolling window); alarming = falling crossing rate.
  (c) rel_dd_div  = (corpse drawdown-from-running-high minus survivor drawdown) and its trend;
                    alarming = corpse DD deepening while survivor DD stays shallow.

STATISTIC OF RECORD — survivor-calibrated lead time:
  1. Calibrate each sensor's threshold on SURVIVOR-CONTROL DATA ONLY: build the sensor's distribution
     over survivor histories (survivor-vs-survivor pairings + survivor quiet periods, excluding any
     window within 504d of a real death). Threshold = 95th percentile in the alarming direction.
     NO corpse data may enter any threshold.
  2. On each corpse-survivor pair, find the FIRST day in [-504,0] the sensor crosses its
     survivor-calibrated threshold in the alarming direction. Lead time = death-index minus
     first-cross-index (trading days); 0 if it never fires.
  3. Statistic of record = MEDIAN lead time per death class per sensor (R1).
  4. False-alarm rate = fraction of HELD-OUT survivor-control time the sensor sits across threshold.

SUCCESS BAR (declared, do not move): a sensor is a corpse-belt CONTENDER iff median lead >= 60
trading days across >= 2 death classes AND it flags <= 10% of held-out survivor-control time. Record
contenders as SANDBOX-GRADE, NOT champions. Report per class always.

OUTPUT (write under jobs/results/job2_divorce_corpse/):
  - REPORT.md          — per-class median lead time x sensor table, survivor false-alarm rates, the
                         Wirecard-vs-Luckin and SVB-vs-SCHW separations called out explicitly, which
                         sensors (if any) clear the bar, and the DESCRIPTIVE-CENSUS / not-a-champion
                         banner. State the calibration-is-survivor-only guarantee explicitly.
  - lead_times.csv     — per corpse: entity, class, sensor, threshold, first_cross_tau, lead_days.
  - calibration.json   — per sensor: survivor-only threshold, n survivor points, held-out false-alarm rate.
  - corpse_sensors.py  — the standalone sidecar (imports coint_test read-only).

Determinism: no RNG (or fixed seed if survivor/held-out split needs one; record it).

TERSE FINAL REPORT to the pilot (<= 12 lines): whether the Hall prices/ were present; per-sensor
median lead time on each of the >=2 counted classes; each sensor's survivor false-alarm rate; which
sensors (if any) cleared the bar (>=60d lead on >=2 classes AND <=10% false-alarm); the
Wirecard-vs-Luckin result in one line; artifact paths. State plainly if anything was infeasible.
```

---

## 5. DONE-CRITERIA + FABLE REFEREE STAGING

**Done (any legitimate finished state):**
- **Executed:** Hall `prices/` mounted, all three sensors traced, survivor-only thresholds calibrated, per-class median lead times + false-alarm rates reported, bar evaluated. Contenders (if any) recorded sandbox-grade.
- **Deferred:** Hall `prices/` not mounted — recorded as "deferred: Hall prices absent" with no fabricated output. This is a legitimate done-state (the data rides Drive).
- **Broken-and-skipped:** a sensor whose survivor calibration is degenerate (e.g., too few survivor-vs-survivor pairs in a class to form a 95th-percentile) is documented and dropped for that class, not hacked.

**Stage for the end-of-day Fable referee pass:**
- `jobs/results/job2_divorce_corpse/REPORT.md`, `lead_times.csv`, `calibration.json`.
- **The referee's first check (R6):** confirm that **no corpse data touched any threshold** — the honesty core. Re-derive one threshold from `calibration.json` and verify it used survivor points only. A lead-time result resting on a corpse-contaminated threshold is the correct-conclusion-false-mechanism shape this whole campaign hunts.
- **The Wirecard-vs-Luckin separation**, flagged: a sensor that fires on Wirecard AND on Luckin is a scandal detector, not a corpse detector — the referee must confirm the survivor false-alarm rate is genuinely low, not just the corpse lead time high.
- **Per-class disaggregation:** if a sensor clears the bar on crisis_kill only, it is characterized (crisis-bound), not a general corpse contender — the referee records it as such (R15).
- **Note for the brief regeneration:** any sensor clearing the bar becomes a candidate Rumble corpse-belt entrant for a FUTURE batch (its quarantine shot, if it ever earns one, goes through JOB5's lineage-calibrated bar) — record it as a lead, not a finding.
