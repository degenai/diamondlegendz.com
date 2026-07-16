# jobs/ — PRE-ORCHESTRATED JOB PACKETS for the Friday commune session

**Built 2026-07-16 for Friday 2026-07-18, on Andy's machine, Opus-piloted.** Every protocol here was
**frozen before Friday** so the session is pure execution, not exploration. You are not hunting for
surfaces to explore — you are running frozen protocols and staging the results for the referee.

Each `JOBn_*.md` is a self-contained packet with five parts: (1) OBJECTIVE, (2) FROZEN PROTOCOL
(declared 2026-07-16, immutable Friday), (3) DATA PREREQUISITES, (4) THE VERBATIM AGENT PROMPT
(the fenced block Andy pastes to an Opus agent), (5) DONE-CRITERIA + what to stage for the referee.

---

## > THE ONE RULE THAT GOVERNS FRIDAY (R12)

> ## **NO PROTOCOL EDITS ON FRIDAY.**
> **A protocol found broken gets DOCUMENTED and SKIPPED — never tuned.** A window that leaves too few
> events, a threshold that won't calibrate, a bar that can't be reached: you write down exactly how it
> broke in that job's REPORT.md and you move on. You do not adjust a window, move a bar, or re-register
> a direction to make a result appear. **The whole value of a frozen protocol is that it was frozen
> before you saw the answer.** Retuning on Friday throws that away and manufactures a finding. The house
> was built on retractions of exactly that shape. Fervor in the sandbox; atheism at the referee table.

---

## RUN ORDER

**Jobs 1–4 are parallel-friendly** (independent data, independent agents — launch them in one batch if
the machine and prompt budget allow). **Job 5 runs LAST**, because it folds in Job 1's Bite verdict and
Job 4's γ-eligibility verdict.

| # | job | needs | data gate | can run without net/Drive? |
|---|---|---|---|---|
| 1 | **Bite Census** (Rumble Batch 4) | engine (stub) + panel | **Phase B needs `yf_panel_2008_2026.csv` (Drive)** | Phase A (fortress check) yes; Phase B no |
| 2 | **Divorce-first corpse training** | Hall price library | **needs `hall-of-the-dead/prices/` (Drive)** | no — deferred if prices absent |
| 3 | **N-PORT Phase 2 pipeline** | SEC EDGAR bulk files | **needs live web (no key)** | no — this is the one WEB job |
| 4 | **γ registered follow-up** | cached CSVs | Prong A needs `kayfabe_pairs.csv` (Drive); **Prong B runs in-git** | Prong B yes; Prong A no |
| 5 | **Quarantine-bullet design** | in-git protocol + Jobs 1/4 verdicts | none — **reads no quarantine data by design** | yes |

**Data that rides Drive/USB (per `../DATA_MANIFEST.md`), not git — mount `DEMON_RANCH_ROOT` or drop into the kit:**
- `sidecars/cointegration-20260715/yf_panel_2008_2026.csv` (7.5 MB) — Job 1 Phase B, Job 4 Prong A fallback.
- `sidecars/hall-of-the-dead-20260715/prices/` (14 MB) — Job 2, the whole job.
- `sidecars/kayfabe-20260715/kayfabe_pairs.csv` (1.9 MB, regenerable) — Job 4 Prong A (the `gap_756d` column).

**Web that rides the internet (no key):** SEC N-PORT bulk flat-files — Job 3, the whole job.

A job whose data gate fails is **deferred, not faked.** A deferred job with an honest "prerequisite absent"
note in its REPORT.md is a legitimate finished state.

---

## THE SESSION PATTERN (scarce big-model prompts — the house architecture, not a handicap)

Every batch, census, and sweep of the meteorology era was executed by **Opus agents**; the big model
(Fable) only wrote protocols, reviewed results, and sat at the referee table. Friday runs the same way:

1. **Opus pilots.** These five packets are protocol-bound execution — exactly what Opus does well. The
   pilot pastes each job's verbatim agent prompt to an Opus agent, collects the terse final reports, and
   stages the artifacts under `jobs/results/`.
2. **Bank the two Fable prompts for the referee table:**
   - **Fable prompt #1 — the REFEREE PASS.** An end-of-session adversarial review of everything built.
     R6: question the auditor after it agrees; hunt the correct-conclusion-false-mechanism shape. Each
     job's section 5 lists exactly what to stage and what the referee must check (the load-bearing claim
     in each). **Job 5's `BAR_PROPOSAL.md` is written *to* this prompt** — the referee ratifies or amends
     the quarantine bar here.
   - **Fable prompt #2 — the BRIEF REGENERATION.** Regenerate the next `CLAUDE_BRIEF` from the session
     record (R11: regenerate, never patch). Each job's section 5 flags what the next brief must carry
     (e.g., the kit-engine-integrity discrepancy from Job 1; the roster-Delta data spine from Job 3).
3. **Two prompts = one verdict + one testament. That is a complete session.** Fervor from the fleet,
   atheism from the referee.

---

## OUTPUT LAYOUT

Each job writes under its own results dir; nothing overwrites another's:

```
jobs/results/job1_bite_census/
jobs/results/job2_divorce_corpse/
jobs/results/job3_nport_phase2/
jobs/results/job4_gamma_followup/
jobs/results/job5_quarantine_bullet/
```

Every results dir gets a `REPORT.md` (CONTRIBUTING: one REPORT.md per experiment), the machine-readable
JSON/CSV artifacts named in each packet, and the standalone sidecar script. Raw/heavy pulls (Job 3's
N-PORT ZIPs) are NOT committed — note them for `DATA_MANIFEST.md`. Sandbox results carry the
EXPLORATION / DESCRIPTIVE-CENSUS banner and are unpublishable as champions; only a referee-ratified
quarantine result ever enters §1.
