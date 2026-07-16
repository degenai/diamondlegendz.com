# JOB 1 — THE BITE CENSUS (Royal Rumble, Batch 4 entrant)

**Frozen protocol declared 2026-07-16, before any computation. Immutable Friday 2026-07-18 (R12).**
**Arena: SANDBOX ONLY, 2012–2018 (R13). Belts and sampling: exactly as RUMBLE.md Batch 2/3.**
**Two phases in one packet. Phase A is a gate; Phase B is the entrant's actual fight and is only reachable if Phase A clears.**

---

## 1. OBJECTIVE

The corpse belt is vacant (three Rumble batches, two real death eras, no sensor beats base rate) and the season's identified physics is *pair-demons die of divorce, not fire*. The Bite Census is the first Rumble entrant read from the demon's **own trade ledger** rather than from prices: when the rebalancer's buy-side **alternates** between legs it is ping-ponging a healthy oscillation (feeding well); when its buys **cluster** on one leg it is repeatedly feeding a laggard (feeding a corpse). The 40:1 starvation-rule bind ratio already lives in this divergence family. This job asks whether a **trailing bite-alternation rate** is (a) persistent and (b) predictive of forward trade-added in the sandbox — a feast reading with a corpse-belt aim. **The Bite sensor reads the demon's own ledger, so its very existence depends on whether the engine surfaces per-trade buy legs. Phase A settles that; Phase B is the census and only runs if Phase A produces a ledger source validated to reproduce known numbers.**

---

## 2. FROZEN PROTOCOL

### 2.0 Phase A — LEDGER ASSESSMENT (the gate; no census statistic is computed here)

**The question:** does the engine you actually have (`sidecars/demon-atlas-20260709/engine_v2.py`, resolved via `DEMON_RANCH_ROOT`) expose the **buy-side leg of each rebalance event**?

**Known state of the committed kit engine (author's finding, 2026-07-16, branch `kit-v3-meteorology`):** the engine committed on this branch is the **full 1204-line engine** (`README_ANDY.md`'s claim is accurate here). By default `simulate_batch(P, weights, policy, dates, rates, ...)` returns **only `(equity, max_dd, rebals)`** (`engine_v2.py:1092`) — **the tax-free actual-path book, the book EVERY project number is measured on (including the +2.171%/yr fortress), exposes NO per-trade ledger.** A full per-trade ledger DOES exist, but **only through `trace_world=w` in the `tax_mode="perfect"` path** (which requires `tax_rate>0` and `exec_mode="chunked"`), for a **single world**, surfaced as `tax_out["trades"]` — tuples of `(date, sleeve_index, "BUY"/"SELL", shares, price, cost, basis, …)`. It was built for the `accountant.py` spot-check gate, not as a census surface. **The catch (R10):** the perfect-tax path charges taxes at year-ends, perturbing cash and therefore the rebalance events, so **the traced ledger is NOT automatically a faithful read of the tax-free book's bites** — it must be validated to reproduce the tax-free book before its buy legs are trusted.

**Phase A therefore does two things, in order:**

1. **Confirm the ledger surface** of the engine actually mounted (read `simulate_batch`'s parameter list, its default `return`, and the `trace_world`/`tax_out["trades"]` path). Record verbatim: default return, and whether a trade ledger is reachable and by what parameter. Then choose a **LEDGER_SOURCE**:
   - **wrapper (trace):** run the actual-path pair as a single world with `trace_world=0`, `tax_mode="perfect"`, `exec_mode="chunked"`, and the lightest tax settings; read the `BUY` rows → buy-side leg per event. **Only valid if V1 below confirms the traced book's terminal equity matches the tax-free `book_metrics` equity within tolerance** — otherwise the tax perturbation disqualifies the trace for this purpose.
   - **replication (preferred if the trace perturbs the book):** a **pure-python replication of the tax-free 5%-band equal-weight buy waterfall, ported verbatim from the engine's chunked lockstep buy loop** (the argmax-deficit `pick`; same `exec_mode="chunked", quantum_bps=10` semantics; same `configs/costs.default.json` spreads), instrumented to **record `pick` (the bought sleeve) per rebalance event**. Cite the ported buy-loop by file:line (R4).

2. **VALIDATE the chosen ledger source against two known numbers BEFORE any census (R5, R10):**
   - **(V1) Fortress provenance.** The ledger source's terminal equity for the fortress `[DBB, EWU, EWZ, GDX, TUR]`, equal weight, 5% band, 2020-01-01→2026-06-29, must reproduce `v12_target_swap.validate_fortress`'s **+2.171%/yr** trade-added (demon terminal / hold terminal), to within Yahoo-vintage tolerance (|Δ| ≤ 0.05 %/yr). This uses the **same `simulate_batch` invocation the whole project trusts** — if the replication's own equity path diverges from `simulate_batch`'s `equity` on this book, the replication is wrong and Phase B does not run.
   - **(V2) A known pair-year TA.** For a handful of sandbox pair-years present in `sidecars/kayfabe-20260715/rumble_batch1/batch1_pairs.csv`, the ledger source's per-pair-year trade-added must reproduce the cached `target_ta_per_yr` to ≤ 1e-3 (the batch machinery already reproduces pair-year TA; this proves the replication runs the same book).

**Phase A output is a verdict, not a sensor:** `LEDGER_SOURCE = wrapper | replication`, plus `V1_PASS`, `V2_PASS`. **Phase B is reachable iff `V1_PASS and V2_PASS`.** If either fails, Phase B is **documented and skipped** (R12) — no tuning.

### 2.1 Phase B — THE BITE ENTRANT (the census; runs only if Phase A cleared)

- **Sensor — `bite_alt_126` (defined precisely):** at the **first trading day of year y** (Rumble yearly sampling convention), simulate the pair `(a,b)`'s actual-path book over the trailing 126 trading days `[fp−126+1 : fp+1]` under the frozen policy `POL = {"type":"threshold_pct","band":0.05}`, `exec_mode="chunked"`, `quantum_bps=10`, costs from `configs/costs.default.json`, equal weight, capital 1000, seeded at equal weight at window start. Collect the ordered list of **rebalance events** in the window and, for each, its **buy-side leg** (for a 2-leg book, the argmax-deficit / under-weight leg). **`bite_alt_126` = the fraction of consecutive event-pairs whose buy-side leg differs from the immediately preceding event's buy-side leg**, i.e. `#{i : leg[i] ≠ leg[i−1]} / (E−1)` over `E` events in the window. **Eligibility: `E ≥ 2` events required; otherwise the sensor is UNDEFINED (NaN, excluded, and the eligible-n is reported honestly per year.)**
- **Declared direction:** **alternation +** (more alternation → healthier feeding → higher forward TA; low alternation = clustering = feeding a corpse).
- **Forward target:** year y's actual-path trade-added %/yr via the **verbatim `book_metrics` invocation** (`v12_target_swap.book_metrics`), **restricted to target years ≤ 2018 (R13).**
- **Belts (exactly as RUMBLE.md Batch 2/3):**
  - **FEAST (primary):** median across the 7 sandbox yearly cross-sectional Spearman ρ(`bite_alt_126`, forward TA) + correct-sign year count. **Statistic-of-record.**
  - **RELIABILITY:** median across the 7 yearly Spearman ρ(`bite_alt_126`, `1[forward TA > 0]`) + correct-sign year count. Declared direction +.
  - **CORPSE (severity):** pooled 2012–2018, does the sensor's **LOW decile** (bottom 10% of `bite_alt_126`, per the + direction) capture forward-year catastrophe better than base rate — report precision at decile for (i) forward bottom-decile TA and (ii) **severity, forward TA ≤ −5%/yr** (the Batch-3 severity definition), each against its pooled base rate. This is the belt the Bite is aimed at.
- **ELIMINATION BAR (declared):** **correct-sign (positive) feast median AND ≥ 4/7 correct-sign years** → SURVIVES; else ELIMINATED with cause of death logged (noise-death vs sign-flip vs redundancy). Same bar as Batch 1.
- **REDUNDANCY FOLD:** pooled Spearman(`bite_alt_126`, `gamma_126d`) (join γ from `batch1_pairs.csv` on `(pair, year)`). If `|ρ| > 0.8`, the junior folds into the living ancestor and the Bite is recorded as redundant-with-γ, not a new belt.
- **R-rules in force:** R1 (medians/counts only — no means anywhere), R4 (engine imported read-only; the replication ports the buy waterfall verbatim with a file:line citation, edits nothing a worker imports), R10 (forward target = the verbatim `book_metrics`; sensor and any γ comparison measured the same way, paired), R12 (protocol frozen; deviations logged not absorbed), R13 (sandbox only; quarantine never touched), R14 (an exciting positive result is recorded with its n and noise band, not crowned), R16 (the Bite reads the ledger — it estimates no drift; house-physics clean).

### 2.2 Registered honest caveats (on record before the run)

- **Sparsity.** A 5% band on a 2-leg book over 126 trading days may fire very few events; many pair-years will have `E < 2` and be UNDEFINED. If the sensor is undefined for the bulk of pair-years, that is a **documented skip (R12), NOT a window retune** — the 126d window is frozen. Report eligible-n per year prominently.
- **Reset convention.** Simulating the trailing 126d slice from an equal-weight seed (rather than reading events off a full path) is the batch-consistent convention (matches kayfabe/batch1 trailing-window handling); logged as a deviation.
- **Sandbox monoculture.** 2012–2018 is corpse-poor (Batch-2 warning). A positive Bite feast sign here is a sandbox reading only; a GFC/dot-com corpse-arena extension is a FUTURE batch needing the annex panels from Drive — **explicitly not Friday.**

---

## 3. DATA PREREQUISITES (kit-relative; Drive flags per DATA_MANIFEST.md)

| artifact | kit path | in git? | needed for |
|---|---|---|---|
| engine | `sidecars/demon-atlas-20260709/engine_v2.py` | **yes (full 1204-line engine; per-trade ledger via `trace_world` in the `tax_mode="perfect"` path)** | Phase A ledger assessment + buy-waterfall port |
| provenance wrapper | `sidecars/cointegration-20260715/v12_target_swap.py` (`book_metrics`, `validate_fortress`, `rr_for`, `POL`, `COSTS`) | yes | V1/V2 validation, forward target |
| costs | `configs/costs.default.json` | yes | cost model |
| panel loader | `sidecars/cointegration-20260715/coint_test.py` (`load_yf_panel`, `cohort_tickers`) | yes | reads the panel below |
| **2008–2026 panel** | `sidecars/cointegration-20260715/yf_panel_2008_2026.csv` | **NO — Drive/USB (7.5 MB)** | **Phase B sandbox census (2012–2018) and V2** |
| in-git panel (2020–2026) | `data/derived/total_return_panel_v4_2020_2026.csv` | yes | **V1 fortress check can run on this without Drive** (pivot `close` by `ticker`, 2020–2026 covers the fortress window) |
| cached sandbox features | `sidecars/kayfabe-20260715/rumble_batch1/batch1_pairs.csv` | yes | V2 known TAs, γ join for redundancy |

**Drive-riding prerequisite: `yf_panel_2008_2026.csv`.** Phase A's V1 (fortress, 2020–2026) can be validated **without Drive** on the in-git v4 panel. **Phase B (the sandbox census) cannot run without `yf_panel_2008_2026.csv`** — either set `DEMON_RANCH_ROOT` to a mounted tree that contains it, or drop it into `sidecars/cointegration-20260715/` per DATA_MANIFEST. If it is absent Friday, Phase A still completes (assessment + V1) and Phase B is deferred — that is a legitimate done-state.

---

## 4. THE VERBATIM AGENT PROMPT (Andy pastes this to an Opus agent)

```text
You are executing JOB 1 (THE BITE CENSUS) from the DemonRanchKit, a Royal Rumble Batch-4
entrant. The protocol is FROZEN in commune/DemonRanchKit/jobs/JOB1_bite_census.md, declared
2026-07-16. You may NOT re-register, retune, or change any window, direction, target, or bar.
A protocol found broken is DOCUMENTED and SKIPPED, never tuned (R12). All paths below are
relative to the kit root (commune/DemonRanchKit/). Scripts resolve data via DEMON_RANCH_ROOT
(defaults to the kit root). Read RUMBLE.md (sidecars/kayfabe-20260715/RUMBLE.md) for belt
definitions and CLAUDE_BRIEF.md §4 for the house rules before you write code.

HOUSE RULES (binding): R1 — medians, win-rates, and counts ONLY; no means anywhere in a
statistic of record. R4 — import the engine READ-ONLY; edit NO module that any worker imports;
if you replicate the buy waterfall, port it VERBATIM from engine_v2.py with a file:line citation
in a standalone sidecar. R10 — the forward target is the verbatim v12_target_swap.book_metrics
invocation; never compare quantities produced by different estimators. R13 — SANDBOX ONLY,
target years 2012..2018; quarantine (2019+) is never touched.

PHASE A — LEDGER ASSESSMENT (a gate; compute NO census statistic here):
1. Open sidecars/demon-atlas-20260709/engine_v2.py. Read simulate_batch's parameter list, its
   default `return` line, and the trace_world / tax_out["trades"] path. Record verbatim: the
   default return is (equity, max_dd, rebals) — the tax-free book exposes NO ledger; a per-trade
   ledger is reachable only via trace_world=w in the tax_mode="perfect" path (single world),
   surfaced as tax_out["trades"]. Choose a LEDGER_SOURCE:
   - wrapper (trace): run the actual-path pair as one world with trace_world=0, tax_mode="perfect",
     exec_mode="chunked", lightest tax settings; read BUY rows -> buy-side leg per event. VALID
     ONLY IF V1 confirms the traced book's terminal equity matches the tax-free book_metrics
     equity within tolerance (the perfect-tax path perturbs cash flows -> R10 hazard).
   - replication (PREFER this if the trace perturbs the book): a pure-python replication of the
     tax-free 5% band equal-weight buy waterfall, ported VERBATIM from the engine's chunked
     lockstep buy loop (the argmax-deficit pick; exec_mode="chunked", quantum_bps=10; costs from
     configs/costs.default.json), instrumented to record the bought sleeve (`pick`) per rebalance
     event. Cite the ported buy-loop by file:line (R4).
2. VALIDATE the chosen source against two known numbers before any census (R5/R10):
   V1 (fortress): reproduce v12_target_swap.validate_fortress's +2.171%/yr trade-added for
      [DBB,EWU,EWZ,GDX,TUR], equal weight, 5% band, 2020-01-01..2026-06-29. Tolerance |Δ| <= 0.05
      %/yr. V1 may run on the in-git panel data/derived/total_return_panel_v4_2020_2026.csv
      (pivot `close` by `ticker`; the 2020-2026 window covers the fortress) — no Drive needed.
   V2 (known pair-year TA): for ~5 sandbox pair-years in
      sidecars/kayfabe-20260715/rumble_batch1/batch1_pairs.csv, reproduce the cached
      target_ta_per_yr to <= 1e-3. (V2 needs the 2008-2026 panel; see PHASE B data note.)
   Write LEDGER_SOURCE, V1_PASS, V2_PASS. Phase B is reachable IFF (V1_PASS and V2_PASS).

PHASE B — THE BITE ENTRANT (run ONLY if V1_PASS and V2_PASS; else document and skip):
Data: load sidecars/cointegration-20260715/yf_panel_2008_2026.csv via coint_test.load_yf_panel;
cohort via coint_test.cohort_tickers (assert 61 tickers / 1830 pairs, matching batch1). If this
panel is absent (Drive/USB not mounted), STOP Phase B, record "deferred: 2008-2026 panel absent",
and finish with Phase A only.
For each of the 1830 cohort pairs, for each target year y in 2012..2018:
  - fp = index of the first trading day of year y in the pair's dropna-aligned series.
  - Require fp+1 >= 126 trailing rows; else skip (record).
  - Simulate the pair's book over the trailing slice [fp-126+1 : fp+1], seeded equal-weight,
    POL band 0.05, exec_mode chunked, quantum_bps 10, costs.default.json, capital 1000, using
    LEDGER_SOURCE. Collect ordered rebalance events and their buy-side legs.
  - bite_alt_126 = #{i: leg[i] != leg[i-1]} / (E-1) over E events; UNDEFINED (NaN) if E < 2.
  - forward target = book_metrics for year y (verbatim), restricted to y <= 2018.
Compute the three belts (declared direction alternation +):
  FEAST (statistic-of-record): median of 7 yearly Spearman rho(bite_alt_126, forward TA) +
    correct-sign year count. (Spearman convention: mask non-finite in either array, n>=10.)
  RELIABILITY: median of 7 yearly Spearman rho(bite_alt_126, 1[forward TA>0]) + correct-sign count.
  CORPSE (severity): pooled 2012-2018, precision of the LOW bite_alt_126 decile at capturing
    (i) forward bottom-decile TA and (ii) severity forward TA <= -5%/yr, each vs its pooled base rate.
Redundancy: pooled Spearman(bite_alt_126, gamma_126d) joining gamma from batch1_pairs.csv on
  (pair, year); if |rho|>0.8 mark the Bite redundant-with-gamma.
VERDICT: SURVIVES iff feast median > 0 AND >= 4/7 correct-sign years; else ELIMINATED with a
  logged cause of death. Report eligible-n per year prominently (sparsity caveat is on record).

OUTPUT (write all artifacts under jobs/results/job1_bite_census/):
  - REPORT.md         — Phase A verdict (LEDGER_SOURCE, V1/V2, the engine return-signature quote),
                        then Phase B standings if run, deviations, eligible-n per year, and the
                        DESCRIPTIVE-CENSUS / EXPLORATION-only banner (sandbox result, unpublishable).
  - bite_pairs.csv    — per pair-year: pair, year, bite_alt_126, n_events, forward TA, eligible_fwd.
  - bite_results.json — belts, verdict, redundancy, sanity/validation block, deviations list.
  - phaseA_notes.md   — the verbatim engine return-signature finding + V1/V2 numbers.
  - bite_census.py    — the standalone sidecar (imports engine read-only; ports the waterfall if replicated).

Determinism: no RNG. Set OMP/MKL/OPENBLAS/NUMEXPR thread envs to 1 for reproducibility.

TERSE FINAL REPORT back to the pilot (<= 12 lines): LEDGER_SOURCE and whether the engine exposed
a ledger (one-line quote of its return signature); V1_PASS/V2_PASS with the two numbers; whether
Phase B ran or was deferred and why; if it ran — the feast median rho, correct-sign year count,
verdict (SURVIVES/ELIMINATED + cause), corpse-belt severity precision vs base, redundancy-with-gamma
rho, and min/max eligible-n per year; every artifact path written. State plainly if anything was
infeasible as specified.
```

---

## 5. DONE-CRITERIA + FABLE REFEREE STAGING

**Done (any of these is a legitimate finished state):**
- **A-only:** engine assessed, V1 reproduced (fortress +2.171%/yr), and Phase B deferred because `yf_panel_2008_2026.csv` was not mounted OR V2 could not be checked — recorded honestly. This is DONE.
- **A+B survive:** Phase A cleared, Phase B ran, verdict recorded (SURVIVES or ELIMINATED with cause), all four artifacts written.
- **Broken-and-skipped:** a protocol step found unworkable (e.g., sparsity leaves < 2 events for the bulk of pair-years) is documented in REPORT.md and skipped, NOT retuned (R12).

**Stage for the end-of-day Fable referee pass:**
- `jobs/results/job1_bite_census/REPORT.md` and `bite_results.json`, with the Phase A verdict foregrounded (**the ledger question is the load-bearing claim** — the referee should confirm the engine return-signature quote and that the replication, if used, actually reproduced +2.171%/yr and the known pair-year TAs before trusting any belt).
- The **redundancy-with-γ** number, flagged for R6 scrutiny: if the Bite's feast tracks γ (|ρ|>0.8), the referee must decide whether it is a genuinely new corpse-belt reading or γ in costume (the correct-conclusion-false-mechanism shape).
- The **eligible-n per year** table — a positive feast sign on a handful of events per year is a noise band, not a finding (R14).
- **Note for the brief regeneration (prompt #2):** record which LEDGER_SOURCE was used (trace-wrapper vs replication) and the perfect-tax faithfulness finding — i.e. whether the engine's only per-trade surface (`trace_world` in the `tax_mode="perfect"` path) can be read without the tax cash-flows perturbing the tax-free book. If the wrapper was disqualified by that perturbation, that is a durable fact about the engine the next brief should carry (the Bite family will keep needing a faithful tax-free ledger read).
