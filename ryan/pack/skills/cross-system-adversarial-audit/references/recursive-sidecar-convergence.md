# Recursive Sidecar Convergence Reference

Use this reference when independent audits must converge through an adversarially reviewed synthesis before remediation begins.

## Artifact contract

Keep these immutable artifacts per exact snapshot:

```text
audit/
  snapshot.txt                 # repo, commit/tree, clean-status receipt
  reports/
    reviewer-a.txt
    reviewer-b.txt
    cross-review.txt
  sidecars/
    sidecar-v1.md
    sidecar-v2.md
    ...
  attacks/
    attack-v1-prompt.txt
    attack-v1-full.txt
    attack-v2-full.txt
  loop-log.md
```

Never edit an attacked `sidecar-vN.md`; create `vN+1`. Do not rely on a process exit code or a completion notification as a substitute for the full report.

## Safe reviewer command pattern

The durable file gets the complete output. The display tail is secondary:

```bash
claude -p --model opus "$(cat attack-prompt.txt)" --output-format text \
  2>&1 | tee attack-vN-full.txt
```

If concise console display is necessary:

```bash
claude -p --model opus "$(cat attack-prompt.txt)" --output-format text \
  2>&1 | tee attack-vN-full.txt | tail -250
```

Copy the sidecar, original reports, and any required evidence into the reviewer's accessible sandbox/worktree. Verify byte counts before launch. Keep secrets and client identifiers redacted in prompts and sidecars.

## Sidecar finding schema

Each finding should carry:

1. ID and source-reviewer mapping
2. root-cause family and duplicate IDs
3. exact path/line or artifact anchor
4. claim and mechanism
5. reproduction method and redacted result
6. evidence status: confirmed, partial, contested, refuted, inherited lint
7. severity and confidence as separate fields
8. affected audience/data
9. contradictory remedies and owner decisions
10. proposed failing test
11. candidate remediation and dependencies
12. superficial-fix risk
13. rollback/roll-forward policy
14. generated/live verification surface
15. latest attacker disposition

Add a reviewer-disposition ledger so deduplication does not erase who found what or silently regrade source reports.

## Attack prompt contract

Require the attacker to:

- read the sidecar and every original report;
- verify all path/line claims against the exact snapshot;
- attack unsupported claims, severity, duplication, omissions, and sequence;
- search for alternate projection channels, not merely the cited function;
- distinguish current realized leaks from latent recurrence paths;
- distinguish credential rotation, current-source removal, defensive redaction, history cleanup, and generated-output verification;
- detect remedies that hide symptoms without removing source/history exposure;
- verify runtime authentication and visibility assumptions;
- test whether acceptance criteria are actually satisfiable by the proposed mechanism;
- return `NO MAJORS` or `MAJORS PRESENT — N` under the frozen major definition.

## Bounded major definition

A major is one of:

- factual contradiction affecting the verdict;
- severity error by more than one level;
- omitted defect independently rated MEDIUM or higher;
- omitted channel or ordering flaw that changes emergency containment, test scope, deployment verification, or recovery policy.

Line drift, wording precision, optional hardening, and omitted LOW/nit material are not majors. This floor prevents an adversary from gaming an endless loop by finding one more trivial omission.

## Loop receipt

```markdown
| Iter | Sidecar | Verdict | Majors | Folded into | Streak |
|---|---|---|---:|---|---:|
| 1 | v1 | MAJORS PRESENT | 9 | v2 | 1/5 |
| 2 | v2 | MAJORS PRESENT | 6 | v3 | 2/5 |
| 3 | v3 | MAJORS PRESENT | 3 | v4 | 3/5 |
| 4 | v4 | MAJORS PRESENT | 4 | v5 | 4/5 |
| 5 | v5 | MAJORS PRESENT | 6 | v6 (frozen) | 5/5 STOP |
```

Expected shape: falling material severity, then zero. A rebound is not automatically failure, but it must be explained by a newly discovered surface or contradiction. After five consecutive major-bearing rounds, stop and reassess:

- Is the snapshot boundary incomplete?
- Is the sidecar trying to encode unresolved product policy as settled fact?
- Is the attacker redefining “major” each pass?
- Are reviewers searching a different artifact set?
- Is the synthesis too broad to converge?
- Should one root-cause family become a separately audited packet?

### Executed stop receipt (2026-08-07 Alexpedia audit)

The 5/5 rule fired with a rebound (9→6→3→4→6). Reassessment ruling, which worked:

- **Factual convergence was complete despite no `NO MAJORS`:** five Opus passes found zero fabricated evidence, zero misquoted lines, zero severity errors beyond one level. Every file:line citation survived every attack.
- **Document-level convergence was unreachable by design:** each folded fix adds new plan surface (the sidecar grew 14KB → 50KB), so the next attacker always has something new to probe. This is not loop failure.
- **Action taken:** fold iteration-5 findings into v6, freeze v6 as the integration specification WITHOUT a sixth attack, log the stop receipt, and pivot the adversary to attacking integration diffs (each real change) instead of the plan document.
- **Iteration-5 major classes observed** (patterns to expect in later rounds): a fifth documentation surface with a false security claim; no live-containment decision for the top-ranked privacy finding; test corpus becoming unimplementable mid-phase (credential-absence tests need a non-tracked corpus like `.dev.vars` with fail-closed behavior when absent); two findings being the same defect class graded three levels apart; a second hidden instance of a tracked state directory; and a lint/renderer page-model divergence where the lint graph and renderer graph measure different things (their numeric agreement is not validation).
- **Loop hygiene that the attacker itself flagged:** the major definition's "omitted defect MEDIUM or higher" makes majorhood partly depend on the adversary's own severity call; and the reassessment rule needs a defined action (now: freeze + pivot). Record both in the sidecar control block so later rounds do not relitigate them.

## Security/privacy lessons from projection audits

A content boundary is rarely just one predicate. Trace every producer-to-surface path:

- rows and section headings;
- recognized and unrecognized/action-less parser branches;
- target, note/body, and metadata text;
- recent-change panels and duplicated root/home projections;
- article bodies, search indexes, category/all-pages listings, source links;
- household/public versus medical/private trees;
- local generated artifacts versus uploaded/deployed bytes.

For sensitive identities, a target may be allowed while its note is not. A row-only filter can leave an identifying section heading. A substring deny-list can miss renamed paths. Prefer a typed, fail-closed classifier shared by all projections, and exercise it with fake identity fixtures.

## Credential ordering

When a live credential is independently confirmed in a rendered or tracked artifact:

1. revoke/rotate/disable it immediately, or take the service offline if rotation is blocked;
2. never commit the replacement;
3. remove old literals from current source and fixtures;
4. repair or retire defensive redaction with fake test tokens;
5. scan the entire tracked tree and every generated/deployed artifact;
6. plan Git-history rewrite separately after consumer migration and backups.

Repository/history exposure is not bounded by application authentication. Hiding an internal page does not remove plaintext from Git. Do not roll back a content-leak fix to a version already known to leak; roll forward or take the service offline. Record a deployment manifest digest so live asset bytes can be tied to the tested build.

## Completion states

- `CONVERGED`: final attack says `NO MAJORS`; source integration still requires user approval.
- `REASSESS`: five consecutive major-bearing rounds; stop the loop and redesign scope/policy.
- `BLOCKED`: required source/report/snapshot is unavailable or full reviewer output was not preserved.
- `CONTAINMENT REQUIRED`: independently verified live credential/privacy exposure needs operational handling before ordinary integration.
