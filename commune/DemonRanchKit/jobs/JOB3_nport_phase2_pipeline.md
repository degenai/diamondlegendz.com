# JOB 3 — N-PORT PHASE 2 PIPELINE (Roster-Delta's data)

**Frozen build-spec declared 2026-07-16, before any run. Immutable Friday 2026-07-18 (R12).**
**DESCRIPTIVE CENSUS — round-robin doctrine (run for the data, never for selection). NO predictive claims. NO champion.**
**This job builds a data pipeline and emits a first delta matrix. It does not test a hypothesis.**

---

## 1. OBJECTIVE

Roster-overlap *LEVEL* is dead as a feast explainer (refuted 2026-07-15, four hours after it was stated: 15 of 19 VR-passers share exactly zero holdings, passer mean overlap 7× below panel average). But roster-overlap *DELTA* — the quarter-over-quarter **change** in how much two funds' holdings overlap — survives as a **divorce-family instrument**: kin divergence as a shoot early-warning, the same physics the corpse belt is aimed at. Phase 1 built a single snapshot of current rosters. The instrument needs a **time series**, and the free, authoritative source is **SEC N-PORT** quarterly holdings filings (2019→present). This job builds the extraction pipeline: pull N-PORT bulk flat-files, filter to the panel's '40-Act funds, emit a tidy `holdings_history.csv`, and compute a **quarterly overlap-delta matrix** using the exact Σmin measure from `overlap.py`. Deliverable = a working pipeline + the first delta matrix. **The instrument waits on this data; nothing here is a finding, and no delta is crowned.**

---

## 2. FROZEN BUILD-SPEC

### 2.1 Source and scope

- **Source:** SEC **Form N-PORT structured data sets** (bulk flat-files), `sec.gov/data-research/sec-markets-data/form-n-port-data-sets` — quarterly ZIPs of pre-parsed TSV tables joined on `ACCESSION_NUMBER`. `FUND_REPORTED_HOLDING` carries `name`, `CUSIP`, `ISIN`, `LEI`, `pctVal` (percent of net assets); `SUBMISSION` / `REGISTRANT` / `FUND_REPORTED_INFO` carry the CIK, series, and fund identity. **Public — no API key** (the roster fetcher needs none either; this is the same no-key regime). Browser User-Agent + polite throttle per the SCOUT's fetch hygiene.
- **Coverage:** N-PORT structured sets begin **2019** (quarter-end months only). Pull **2019-Q1 → the most recent available quarter.**
- **Filter — the panel's '40-Act funds only.** Read `sidecars/roster-overlap-20260715/classification.csv`. Include `klass ∈ {equity_basket, bond_basket, leveraged_or_inverse}`. **Exclude:**
  - `commodity_pool` — these are '33-Act LPs (USO, UNG, Teucrium, BITO); **they file NO N-PORT** (SCOUT: "no N-PORT/N-Q; holdings from issuer pages or 10-K/Q"). Record them as out-of-scope with the reason.
  - `single_stock` — not funds.
  - `leveraged_or_inverse` funds hold swaps + collateral, not the reference basket. Emit their **reported** N-PORT holdings as-is (swaps/collateral lines), and **flag** them: their kinship is only meaningful through look-through to the reference index (as `overlap.py` already does via `proxy_ticker`). Do not synthesize look-through in this job; carry the flag.
- **Ticker→CIK/series crosswalk:** resolve each panel fund's CIK and series-id (SEC `company_tickers.json` / the N-PORT registrant tables). Record unresolved funds explicitly — a fund the crosswalk misses is a documented gap, not a silent drop.

### 2.2 Emitted artifacts (the deliverable)

1. **`holdings_history.csv`** — tidy long form, one row per (fund, quarter, security): columns **`fund, quarter, cusip, isin, name, pctVal`** (mirror `holdings_normalized.csv`'s schema + a `quarter` key so it feeds `overlap.py`'s machinery directly). Cash / money-market sweep / FX / derivative lines dropped and the equity/bond sleeve **renormalized to sum to 1 per (fund, quarter)** — the same normalization `overlap.py` and Phase 1 use (R10 — measure overlap the same way it was measured in Phase 1).
2. **Quarterly overlap matrices** — for each quarter q, the pairwise **Overlap_q(A,B) = Σ_g min(w_{A,g}, w_{B,g})** over the reconciled identifier space, using the **union-find identifier reconciliation from `overlap.py` verbatim** (ISIN/CUSIP/SEDOL/ticker/FIGI, US-ISIN→CUSIP bridge). Import/port `overlap.py`'s reconciliation and `sigmin` READ-ONLY (R4).
3. **`overlap_delta_matrix.csv`** (the first delta matrix — the headline deliverable) — for each adjacent quarter pair, **ΔOverlap(A,B) = Overlap_q(A,B) − Overlap_{q−1}(A,B)**. This is roster-Delta: negative Δ on a previously-kin pair = divergence beginning. Emit the full time series of delta matrices (or a stacked long form: `pair, quarter_from, quarter_to, overlap_from, overlap_to, delta`).

### 2.3 What this job is NOT

- **NOT a hypothesis test.** No forward-return regression, no "does delta predict a shoot," no correlation with corpses. That is a FUTURE job that consumes this pipeline's output. This job stops at "pipeline works + first delta matrix exists."
- **NOT a selection.** The DESCRIPTIVE-CENSUS banner rides on every artifact (R14 — recorded, not crowned). The round-robin doctrine: run for the data, document behavior, crown nothing.

### 2.4 R-rules in force

R1 (any distributional summary of the deltas uses medians/quantiles/counts — no means). R4 (import `overlap.py`'s reconciliation + `sigmin` read-only; edit nothing). R10 (the Σmin measure, the identifier reconciliation, and the drop/renormalize policy are **identical** to Phase 1 — a delta computed with a different overlap estimator than Phase 1's is an artifact, not a divergence). R12 (build-spec frozen; deviations — e.g., a quarter with missing N-PORT coverage — logged, not silently absorbed). R14 (descriptive census; nothing crowned).

---

## 3. DATA PREREQUISITES (kit-relative; this is the [WEB] job)

| artifact | kit path / source | in git? | needed for |
|---|---|---|---|
| **SEC N-PORT bulk flat-files** | `sec.gov/data-research/sec-markets-data/form-n-port-data-sets` (live web, **no key**) | **NO — WEB fetch** | the entire pipeline; the raw quarterly holdings |
| panel classification | `sidecars/roster-overlap-20260715/classification.csv` | yes | fund filter (klass), proxy_ticker for the leverage flag |
| overlap machinery | `sidecars/roster-overlap-20260715/overlap.py` (`sigmin`, union-find reconciliation) | yes | Σmin + identifier reconciliation, reused verbatim |
| Phase-1 schema reference | `sidecars/roster-overlap-20260715/holdings_normalized.csv` | yes | column schema to mirror in holdings_history.csv |
| scout | `sidecars/roster-overlap-20260715/SCOUT_holdings_data_20260715.md` | yes | source URLs, identifier gotchas, fund-type routing |

**WEB prerequisite: live internet to SEC EDGAR bulk endpoints.** This is the only one of the five jobs that needs **external web access** (no API key — SEC bulk files are public). If the commune session has no internet, this job **cannot run** and is deferred; there is no Drive substitute (the raw N-PORT sets were never fetched — Phase 2 is by definition new data). The roster raw pulls that DO ride Drive (`raw/`, 25 MB) are Phase-1 *current* snapshots, not N-PORT history — they do not substitute.

---

## 4. THE VERBATIM AGENT PROMPT (Andy pastes this to an Opus agent)

```text
You are executing JOB 3 (N-PORT PHASE 2 PIPELINE) from the DemonRanchKit. The build-spec is FROZEN
in commune/DemonRanchKit/jobs/JOB3_nport_phase2_pipeline.md, declared 2026-07-16. This is a
DESCRIPTIVE CENSUS under round-robin doctrine: build a pipeline and emit a first delta matrix; make
NO predictive claim and crown NOTHING (R14). All paths are relative to the kit root
(commune/DemonRanchKit/). Read sidecars/roster-overlap-20260715/SCOUT_holdings_data_20260715.md and
overlap.py BEFORE writing code.

WEB GATE (first): this job fetches SEC N-PORT bulk flat-files from
sec.gov/data-research/sec-markets-data/form-n-port-data-sets (public, NO API key). Confirm internet
access. If there is none, STOP and record "deferred: no web access for SEC EDGAR". There is no Drive
substitute — Phase-2 N-PORT history is new data.

HOUSE RULES (binding): R1 — medians/quantiles/counts for any delta summary; no means. R4 — import
overlap.py's identifier reconciliation and sigmin READ-ONLY; edit nothing a worker imports. R10 —
the overlap measure, identifier reconciliation, and drop-cash/renormalize policy MUST be identical to
Phase 1 (overlap.py); a delta computed with a different estimator than Phase 1 is an artifact.

SCOPE: read sidecars/roster-overlap-20260715/classification.csv. Include only klass in
{equity_basket, bond_basket, leveraged_or_inverse}. Exclude commodity_pool (they are '33-Act LPs and
file NO N-PORT — record them out-of-scope with the reason) and single_stock. Flag leveraged_or_inverse
funds: their N-PORT holdings are swaps+collateral, not the reference basket — emit as reported, carry
the flag, do NOT synthesize look-through here. Resolve each fund's CIK/series via SEC company_tickers /
N-PORT registrant tables; record any unresolved fund as an explicit gap.

BUILD:
1. Pull N-PORT structured data sets 2019-Q1 .. most recent quarter. Join tables on ACCESSION_NUMBER;
   FUND_REPORTED_HOLDING gives name/CUSIP/ISIN/LEI/pctVal. Polite throttle, browser User-Agent, cache
   raw ZIPs/TSVs by quarter (do NOT commit raw bulk files — they are heavy; note them for DATA_MANIFEST).
2. Emit holdings_history.csv: long form, columns fund,quarter,cusip,isin,name,pctVal. Drop cash/MMF/
   FX/derivative lines; renormalize the equity/bond sleeve to sum to 1 per (fund, quarter) — exactly
   as overlap.py/Phase 1 do.
3. Per quarter q, compute pairwise Overlap_q(A,B) = sum_g min(w_A[g], w_B[g]) over the reconciled
   identifier space, reusing overlap.py's union-find reconciliation and sigmin verbatim.
4. Emit overlap_delta_matrix.csv: for each adjacent quarter pair, delta(A,B) = Overlap_q - Overlap_{q-1}
   (stacked long form: pair, quarter_from, quarter_to, overlap_from, overlap_to, delta).

OUTPUT (write under jobs/results/job3_nport_phase2/):
  - REPORT.md               — coverage (quarters pulled, funds resolved vs gaps, commodity/single_stock
                              exclusions with reasons), a validation anchor (spot-check one quarter's
                              overlap against Phase-1's current snapshot for a stable pair, e.g. a
                              treasury-ladder or tech pair, and note expected drift), the shape of the
                              first delta matrix, and the DESCRIPTIVE-CENSUS / not-a-selection banner.
  - holdings_history.csv     — the tidy long-form history.
  - overlap_delta_matrix.csv — the first delta matrix (stacked long form).
  - nport_pipeline.py        — the standalone, re-runnable, resume-safe pipeline (imports overlap.py read-only).
  - coverage.json            — per fund: CIK, series, quarters present, resolution status.

VALIDATION (R5): before trusting deltas, confirm one recent-quarter overlap reproduces the SHAPE of
Phase-1's current snapshot for a known-stable pair (holdings drift, so expect close-not-identical);
if a pair Phase 1 had at ~0.6 shows ~0.0 in N-PORT, the identifier reconciliation is broken — fix the
join, do not ship the delta.

TERSE FINAL REPORT to the pilot (<= 12 lines): whether web access was available; quarters pulled and
funds resolved / gapped / excluded; the validation-anchor result (one stable pair, N-PORT vs Phase-1
snapshot); confirmation holdings_history.csv and overlap_delta_matrix.csv are written and their
row/pair counts; artifact paths. State plainly if anything was infeasible as specified.
```

---

## 5. DONE-CRITERIA + FABLE REFEREE STAGING

**Done (any legitimate finished state):**
- **Executed:** N-PORT pulled 2019→present, `holdings_history.csv` + `overlap_delta_matrix.csv` emitted, pipeline re-runnable, validation anchor passes. The instrument now has its time series.
- **Partial:** some quarters or funds unresolved (EDGAR coverage gaps, crosswalk misses) — recorded in `coverage.json`; a partial history is still a working pipeline and a legitimate deliverable, provided the gaps are documented.
- **Deferred:** no web access — recorded, no fabrication.

**Stage for the end-of-day Fable referee pass:**
- `jobs/results/job3_nport_phase2/REPORT.md`, `coverage.json`, and the head of `overlap_delta_matrix.csv`.
- **The referee's load-bearing check (R10):** confirm the overlap measure is byte-for-byte the Phase-1 Σmin with the same identifier reconciliation — the validation anchor must show a known-stable pair reproducing Phase-1's snapshot within holdings-drift tolerance. **A delta matrix computed with a subtly different join is the correct-conclusion-false-mechanism trap** (the deltas would look like divergence while being reconciliation noise).
- **The leverage/commodity flags:** confirm commodity_pool funds are excluded-with-reason (not silently missing) and leveraged funds are flagged, not accidentally compared basket-to-swaps.
- **Note for the brief regeneration:** record that roster-Delta now HAS its data spine, and that the *next* job (a real test of whether ΔOverlap leads a shoot) is a separate pre-registered experiment — this pipeline is infrastructure, not evidence.
