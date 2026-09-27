# Review-loop convergence protocol

Use this protocol when an artifact goes through repeated improvement or adversarial-review passes. The loop must demonstrate improving artifact quality rather than merely producing more commentary.

## Finding contract

Freeze the output shape before the first review pass. Each finding carries:

- stable finding ID
- pass number and reviewer provenance
- severity: `BLOCKER`, `MAJOR`, `MINOR`, or `NIT`
- exact evidence location
- claimed defect and consequence
- proposed remedy
- observable verification step
- disposition: `VERIFIED_FIX`, `ACCEPTED_TRADEOFF`, `DUPLICATE`, `UNSUPPORTED`, or `DEFERRED`

Keep the ledger append-only. Later records link to prior IDs rather than rewriting history.

## Suggestion-quality gate

Adjudicate every suggestion before editing the artifact:

1. **Correctness** — the claimed defect is real.
2. **Evidence** — the reviewer cites inspectable artifact evidence.
3. **Novelty** — the finding is distinct from prior findings and accepted tradeoffs.
4. **Proportionality** — severity matches consequence and likelihood.
5. **Improvement** — the remedy produces a measurable gain without uncontrolled scope expansion.

Repackaged findings, speculative scope expansion, and suggestion-count theater are reviewer-quality failures. Repeated major findings after a claimed fix are diagnostic evidence about the remediation or reviewer.

## Trajectory

Summarize each pass with:

- new verified material findings
- unresolved blockers and majors
- reopened findings
- accepted minor/nit findings
- duplicates
- unsupported suggestions

Classify the trajectory:

- `IMPROVING` — unresolved severity or count is falling.
- `STALLED` — the material ledger is unchanged.
- `REGRESSED` — new or reopened material findings increase.
- `CONVERGED` — zero unresolved blockers/majors; verified fixes are re-tested; residual minor/nit findings are explicitly accepted or docketed.

A healthy review arc descends from major findings to minor findings to bounded nitpicks, then reaches zero material findings. Stalled or regressed trajectories return to human adjudication.

## Terminal sanity checker

Use the strongest independent reviewer, such as Opus, as a bounded final sanity checker after local tests, builds, and deterministic artifact checks are green. Supply:

- final artifact
- locked contract or acceptance criteria
- local verification receipts
- complete finding ledger
- explicit request for evidence-backed contradictions, material omissions, and false-convergence signals

Adjudicate terminal-review suggestions through the same quality gate. Run one confirmation pass when a verified material fix changes the artifact; otherwise close on the first zero-material report.

## Minimal JSONL record

```json
{"finding_id":"R2-MAJOR-01","pass":2,"reviewer":"opus","severity":"MAJOR","evidence":"src/core.py:81-96","claim":"...","consequence":"...","remedy":"...","verification":"python -m unittest ...","disposition":"VERIFIED_FIX","supersedes":null}
```

## Completion receipt

Report:

- per-pass severity counts
- disposition counts
- final trajectory verdict
- terminal reviewer provenance
- commands and results used to re-test fixes
- accepted residual nits and their tradeoffs
