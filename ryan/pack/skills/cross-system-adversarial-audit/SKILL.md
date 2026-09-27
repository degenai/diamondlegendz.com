---
title: Cross-System Adversarial Audit Playbook
description: Deterministic adversarial audits for cross-system code, service, and host migrations, with fail-closed evidence and round-based convergence.
name: cross-system-adversarial-audit
tags: [addon, lua, sync, security, migration, release-blocker, convergence, test-driven-development, defensive-programming, code-review, web, deployment]
created: 2026-07-17
owner: session-handoff
---

# Cross-System Adversarial Audit Playbook

Use this skill for audits where a change can silently cross trust or recovery boundaries:
- in-game account state machines (mail/queue/inventory/auction workflows)
- offline sync/export surfaces (CLI, JSON schemas, SQLite ingest)
- workstation, server, or service migrations where data, credentials, schedulers, queues, and rollback state cross machines
- release-blocker documents that need adversarial Round-1 → revision → Round-2 convergence measurement
- any multi-realm/faction identity domain where authority scoping can bleed.

## Core principle

Treat **scope** (`realm + faction + character` where applicable) as a first-class security boundary. Any durable key, queue request, or transit record without explicit scope should fail-closed.

## Quick trigger checklist

Start this workflow when one is true:

1. User asks for cross-realm/faction feasibility or safety.
2. There is a persistent request pipeline (mail/queue/transit/sync bundles).
3. A parser ingests external data that should be schema-bound.
4. Async outcome handling has timeout/protected-action risk.
5. You need a cross-repo PR lint + runtime preview audit for front-end/runtime changes.
6. A host/service migration crosses databases, credentials, schedulers, queues, filesystem semantics, or rollback authority.
7. A large Round-1 correction list needs a revision and a quantified Round-2 convergence review.

When a PR touches user-visible surfaces across repositories, this workflow also applies to static/site-like apps and worker-deployed front ends.

## Round-based blocker convergence (host/service migrations)

Use this lane when a migration or release plan receives a large adversarial correction set and the user wants to know whether the next round is genuine convergence.

1. **Freeze the evidence chain.** Preserve the original plan, Round-1 prompt/wrapper/normalized JSON, and each reviewed revision as separate immutable artifacts. Never edit the reviewed revision after the next review; create another version.
2. **Integrate findings explicitly.** Add a closure map from every Round-1 finding to a concrete control, sequence step, and falsifiable acceptance artifact. Correct false assurances, not just missing bullets.
3. **Send Round 2 both inputs.** The reviewer gets the complete revision *and* full Round-1 structured review. This prevents old findings from being relabeled as new.
4. **Demand count invariants.** Require per-finding statuses (`fully_resolved|partially_resolved|unresolved`), deduplicated residuals, severity totals, category totals, and assertions that all sums reconcile.
5. **Measure quality, not volume.** Separate genuinely new findings from restatements; classify each as structural, implementation-detail, or edge-case; report high-value and likely-false-positive counts.
6. **Distinguish readiness layers.** A document can pass while the machine/service remains unready because evidence is not yet collected. Report document verdict and operational readiness separately.
7. **Register intended divergence.** Exact hash/count gates become self-contradictory when the runbook deliberately mutates databases, indexes, link metadata, paths, or ACLs. Record each approved mutation with actor/reason/pre-hash/post-hash; unregistered paths must still match exactly.
8. **Stop at diminishing returns.** When residuals shift from missing control classes to a few control interactions, fix the structural items and move to physical evidence gathering instead of farming another review round.

For the strict prompt contract, artifact set, validation checks, Windows migration control interactions, and large-document write/verification pattern, see `references/round-based-blocker-convergence.md`.

## Recursive sidecar-attack convergence

Use this lane when several independent reports must be distilled, attacked, revised, and re-attacked before integration.

1. **Freeze one exact source snapshot.** All reviewers, reproducers, and sidecar attackers inspect the same immutable commit/tree. Keep the working checkout out of scope.
2. **Preserve independent voices before synthesis.** Archive every original report in full. The sidecar may deduplicate root causes, but its disposition ledger must show each source finding, regrade, partial confirmation, contradiction, and rejection.
3. **Version sidecars immutably.** `vN` is the object attacked; valid findings go into `vN+1`. Never overwrite an already reviewed sidecar.
4. **Attack the sidecar and source together.** Give the attacker the sidecar, original reports, exact snapshot, and a required claim-by-claim verification contract. Put all inputs inside the reviewer's accessible worktree/sandbox.
5. **Capture the complete reviewer result.** Write full stdout to a durable file with `tee`; use `tail` only for display. A successful exit is not evidence if findings were truncated or lost.
6. **Define a bounded major.** Count only factual contradictions, severity errors over one level, omitted MEDIUM-or-higher defects, or omissions/order flaws that change containment or verification. Omitted LOW/nit material cannot keep the loop alive forever.
7. **Measure the trajectory.** Record per-round major count and disposition. Expect a falling curve. Explain rebounds through a newly exposed surface, policy contradiction, or reviewer-scope change.
8. **Use an explicit stop rule.** Stop at `NO MAJORS`. If five consecutive rounds contain at least one major, stop and reassess the audit model, source boundary, prompt, and unresolved owner decisions instead of burning unbounded rounds. When the rule fires (executed 2026-08-07 on the Alexpedia audit: 9→6→3→4→6, never zero), the working reassessment outcome is: **factual convergence can be complete (five attacks, zero fabricated evidence, zero misquoted lines, no severity error over one level) while document-level convergence is unreachable, because every folded fix adds new plan surface for the next attacker to probe.** That is not loop failure; it is the signal to freeze the current sidecar as the integration specification WITHOUT another attack, log the findings, and pivot the adversary to attacking integration diffs (each real change) instead of the plan document. Record this decision in the loop log as the stop receipt.
9. **Separate convergence from integration.** A clean sidecar authorizes presentation and planning, not automatic patching. Emergency operational containment may precede source integration when a live credential or privacy breach is independently verified.
10. **Verify complete projection surfaces.** For privacy/secret systems, inspect headings, action-less rows, note text, duplicate homepage/recent-change projections, generated article bodies, indexes, category/list pages, and the final deployed asset set. Row-target filtering alone is not a boundary.
11. **Split verification by sandbox reality.** Claude's `-p` sandbox typically refuses file reads outside the worktree and denies Python execution. Give the attacker every input staged inside its worktree (e.g. `_loop/`), have it verify claims statically (`git ls-files`, regex over generated artifacts, direct reads), and have the orchestrator run the actual builds/tests/reproductions separately. A static confirmation plus an orchestrator reproduction is stronger than either alone.
12. **Self-check the sidecar for secrets before staging.** After folding findings in, programmatically verify the sidecar contains no credential values (AST-parse `REDACT_SECRETS`, regex known key shapes), no account identifiers, and no client slugs before copying it into the attacker's worktree. Mid-fold edits can leak an identifier the inventory said it would redact (the MED-7 client-slug leak in the 2026-08-07 run). See `scripts/verify_sidecar_redaction.py`.

Alex's preferred loop is deliberately token-generous but bounded: keep attacking while majors shrink; after five major-bearing rounds, stop and reassess rather than rationalizing another pass.

See `references/recursive-sidecar-convergence.md` for the artifact schema, attack prompt contract, security ordering, and stop receipt.

## Cross-repo PR adversarial lint + preview audit (static + worker-backed sites)

Use this lane when changes span **two repos or two branches** and you need both static correctness and runtime smoke checks.

### 0) Repo + ref stabilization

1. Ensure both repos are on the expected remote and branch set:

- `git remote -v`
- `git branch --show-current`
- `git status --short --branch`

2. Fetch PR head refs explicitly:

- `git fetch origin pull/<N>/head:pr-<N>`
- If merge-base commands return empty in shallow clones, run `git fetch --unshallow origin` and retry.

3. Validate ancestry before diffing:

- `git merge-base --all origin/main <pr-branch>`
- `git rev-list --left-right --count origin/main...<pr-branch>`

### 1) Exact change scope first

- `git diff --name-status $(merge-base origin/main <pr-branch>)..<pr-branch>` to lock changed files.
- Limit heavy checks to that file set; avoid broad repo-wide tests when auditing just PR impact.

### 2) RED lint and integrity checks

For each changed file set:

- `git diff --unified=<n> origin/main..HEAD -- <file>` for human review.
- JS parse checks (if changed): `node --check <file>` for each JS path.
- Lint/format/tests that exist in repo scripts:
  - run tracked project test/lint commands first (e.g., `npm test`, `npm run test:workers`, `npm run lint`/`stylelint`/`html-validate` if configured).
  - capture failures as **triage buckets**:
    - `repo script missing/misconfigured` (environment/workflow debt)
    - `code regression` (PR-authored failure)

### 3) Preview validation (adversarial)

- For worker/static projects, run deployment dry-runs if available:
  - `wrangler deploy --dry-run`
- Spin local preview server and exercise changed routes/entry points.
- Use browser tooling to capture:
  - page snapshot for DOM regressions
  - console output + JS exception counts (`browser_console`)
- Any runtime exception with empty messages still counts as a warning; use screenshot/DOM evidence to localize if message text is not surfaced.

### 4) Diff + security skim

- Grep changed files for secret-bearing patterns (`api[_-]?key`, `secret`, `token`, `-----BEGIN`, etc.).
- Remove placeholder/user-facing scaffolding checks (e.g., accidental `Loading...` flashes, fake test text intended as temporary).

### 5) Evidence packaging

- Keep one evidence block with:
  - commit-distance confirmation
  - changed file list
  - lint/test results with pass/fail
  - preview URLs / local routes checked
  - console error summary and risk classification

## Standard audit pattern (RED-first)

### 1) Reproduce first, then code

- Reproduce with minimal fixtures before touching production code.
- Add/update a failing test first.
- Keep cases minimal:
  - one valid baseline
  - one expected-fail edge
- Only after the failure is proven, patch implementation.

### 2) Scope model and authority map

Map each flow stage:

- **Producer identity**: who creates request/transit/config.
- **Carrier identity**: where request is stored.
- **Consumer identity**: who can execute/consume it.

In this stack, require all relevant dimensions:

- `realm`
- `faction`
- `character`
- `peer/source id` (for sync)

No match function should infer missing authority.

### 3) Typed schema, unknown-field rejection

- Reject malformed container shapes at parse time.
- Reject unknown fields at every object level.
- Reject implicit coercion for identity types (e.g., `123` as peer ID).
- Numeric-ness constraints should include SQLite-safe bounds where relevant.

### 4) Producer + consumer hardening

- Producer side:
  - stamp authority metadata on snapshots/requests as soon as they are captured.
- Consumer side:
  - materialize only exact authority scope requests.
  - ignore stale/legacy cross-scope entries.

### 5) Keep behavior closed, not permissive

- Prefer explicit rejects over best-effort fallback.
- For failures, return controlled validation errors/ingest records instead of runtime exceptions.

## Reusable verification sequence

1. **Lua replay tests**
   - `replay/test_inventory.lua`
   - `replay/test_outbox.lua`
   - `replay/test_executor.lua`
   - `tools/lua/lua5.1.exe replay/run_tests.lua`
2. **Python tests**
   - `sync/tests/test_krabsync.py`
   - `python -m unittest -v sync/tests/test_krabsync.py`
3. **Syntax + static checks**
   - luac parse all touched Lua
   - luacheck on Lua + exported/sync lua
   - ruff + bandit on Python paths
4. **Live sync parity checks**
   - `python sync/krabsync.py --root <root> status`
   - `python sync/krabsync.py --root <root> verify`
   - `python sync/krabsync.py --root <root> market --house ... --item-id ...`

## Assertion matrix (keep as a single audit checklist)

- [ ] Cross-realm inventory is not used for sourcing logistics.
- [ ] Cross-faction inventory is not used for sourcing logistics.
- [ ] Legacy/unknown-faction snapshots fail closed.
- [ ] Transit entries outside authority are ignored for sourcing and purgatory.
- [ ] Mail request keying includes required scope and does not execute by accident.
- [ ] Unknown schema fields are rejected in envelope/source/record.
- [ ] Invalid config shape and malformed payload fail with controlled errors.
- [ ] Timeout states preserve intent without duplicate execution.

## Pitfalls

1. **Realm-only keys are insufficient** when faction differs.
2. **Schema permissiveness leaks unknown private fields** and weakens guarantees.
3. **Type coercion masks invalid identity** and can create synthetic trust paths.
4. **Parsing exceptions outside validation** can drop one file and stall the rest of ingest.
5. **Legacy data migration** must preserve behavior via explicit compatibility decisions, not silent trust.
6. **Shallow clones can yield empty merge-base artifacts** during PR scope detection.
   - Fix: run `git fetch --unshallow origin` before ancestry checks.
7. **Browser console in headless checks can surface anonymous exceptions** (empty `source: exception`).
   - Fix: pair with DOM snapshots/screenshot and route-level smoke checks to preserve evidence.
8. **Project scripts can fail for path/config drift unrelated to the PR** (e.g., missing `workers` path). Don't over-classify as regression until scope attribution is done.

## Post-fix closure

After green checks:

- Update interface docs/spec for exact authority model.
- Keep diff scoped to invariant fixes.
- Capture an evidence list with exact test outputs and gate counts.

## Neighboring skills

- `evented-lua-addon-review`
- `adversarial-replay-audit`
- `requesting-code-review`

If curatorial consolidation is needed, keep this as the generic cross-system template and move session-specific artifacts to `references/`.

## Session references

- See `references/cross-system-adversarial-audit-notes.md`.
- See `references/pr-cross-system-lint-preview-checklist.md`.
- See `references/recursive-sidecar-convergence.md` (sidecar-attack lane: artifact contract, attack prompt, executed 5/5 stop receipt, credential ordering).
- See `scripts/run_adversarial_audit_checks.sh`.
- See `scripts/verify_sidecar_redaction.py` (structural secrets/account/slug check to run before staging a sidecar into an attacker sandbox).
