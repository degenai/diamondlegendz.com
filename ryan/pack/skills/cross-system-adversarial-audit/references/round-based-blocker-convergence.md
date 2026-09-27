# Round-Based Blocker-Set Convergence

Use this reference for adversarial reviews of migration, release, recovery, or cutover plans that cross machines/services and need more than a one-pass finding dump.

## Deliverable set

Keep these separately versioned:

1. Original blocker/runbook document.
2. Round-1 reviewer prompt.
3. Raw model wrapper output.
4. Normalized strict JSON review.
5. Human-readable Markdown rendering.
6. Revised document with a Round-1 closure map.
7. Round-2 prompt, raw wrapper, normalized JSON, and Markdown rendering.

Never overwrite the document that a completed review actually read. Subsequent fixes belong in a new revision so counts remain auditable.

## Round-1 purpose

Round 1 should be broad and hostile. Ask for:

- critical omissions by severity;
- false/overstated controls;
- sequencing and atomicity failures;
- secret/authentication gaps;
- rollback gaps;
- acceptance-test gaps;
- concrete repairs and evidence requirements.

Make the reviewer read-only and require anchors into the source document. Preserve the full structured result, not only a prose summary.

## Integration discipline

A correction is integrated only when the revision contains all three:

1. **Control:** what must be true or prevented.
2. **Sequence:** when it happens relative to freeze, copy, restore, activation, and rollback.
3. **Evidence:** a falsifiable artifact with an exact pass/fail rule.

Add a closure map from every Round-1 critical to its revision section. Fix misleading claims as well as missing controls. Distinguish observed facts, future placeholders, and operator decisions.

## Round-2 prompt contract

Give Round 2 the revised document and the complete Round-1 JSON. Explicitly instruct it:

- convergence is the goal, not raw finding volume;
- an old finding cannot be relabeled as new;
- placeholders for facts observable only during preflight/freeze are acceptable when execution is gated on filling them;
- overlapping categories must not inflate the deduplicated blocker ledger;
- every genuinely new finding must say why it is not a Round-1 restatement;
- overcorrections and controls that conflict with one another must be evaluated;
- document readiness and machine/service readiness are separate verdicts.

Minimum structured output:

```json
{
  "document_verdict": "PASS|PASS_WITH_ACTIONS|BLOCK",
  "machine_readiness": "NOT_READY|READY_FOR_PREFLIGHT|READY_FOR_CUTOVER",
  "round1_critical_resolution": {
    "original_total": 0,
    "fully_resolved": 0,
    "partially_resolved": 0,
    "unresolved": 0,
    "items": []
  },
  "round1_category_closure": {},
  "deduplicated_remaining_findings": [],
  "new_findings": [],
  "overcorrections": [],
  "quantity": {
    "deduplicated_remaining_total": 0,
    "remaining_P0": 0,
    "remaining_P1": 0,
    "remaining_P2": 0,
    "genuinely_new_total": 0,
    "genuinely_new_high_value": 0,
    "restatements_rejected_as_new": 0,
    "likely_false_positives": 0
  },
  "quality_assessment": {
    "structural_count": 0,
    "implementation_detail_count": 0,
    "edge_case_count": 0,
    "high_value_summary": "",
    "diminishing_returns_assessment": ""
  },
  "top_required_edits": [],
  "summary": ""
}
```

## Deterministic validation

Parse the result as JSON before reporting it. Assert:

```python
assert full + partial + unresolved == original_total
assert len(items) == original_total
for category in categories.values():
    assert category["resolved"] + category["partial"] + category["unresolved"] == category["original"]
assert remaining_P0 + remaining_P1 + remaining_P2 == deduplicated_remaining_total
assert set(new_ids) <= set(ids_marked_origin_new)
```

Also reject duplicate IDs and ensure every residual/new item contains severity, quality class, exact revision anchor, impact, and required repair.

## Quality interpretation

A useful convergence pass has these characteristics:

- Original criticals mostly close or downgrade.
- Remaining count is deduplicated.
- New findings explain their novelty.
- Structural interactions outrank implementation details and edge cases.
- Restatements are counted as rejected, not silently omitted.
- The reviewer identifies the point of diminishing returns.

A smaller list is not automatically better. A single structural P0 can matter more than dozens of Round-1 omissions.

## Control-interaction checklist for host/service migrations

These are prompts for analysis, not universal facts about every platform:

- **Recovery proof:** readable archives are not demonstrated restores. Rehearse both system-image and application-state recovery before destructive cutover.
- **Live databases:** stop writers, handle WAL/sidecars, run engine integrity checks, then use the product-supported backup/import path.
- **Single-consumer services:** disabling a process is insufficient when Scheduled Tasks, services, startup entries, or supervisors can revive it. Prove restart behavior and queue/offset/backlog disposition.
- **Schedulers:** inventory time zone, last-run state, missed-run behavior, idempotency, external side effects, and controlled one-at-a-time activation.
- **Windows-bound auth:** separate EFS, DPAPI, TPM/passkeys, TOTP recovery, browser session state, SSH keys, and ordinary files. Raw profile copying is not authentication proof.
- **Copy fidelity:** account for reparse points, junction recursion, sparse files, alternate streams, long paths, OneDrive placeholders, filesystem ACL behavior, and full manifests for irreplaceable data.
- **Git estate:** preserve working trees and complete metadata, including LFS, submodules, stashes, reflogs, local branches/tags, and linked worktrees. A remote clone is not a backup of local state.
- **Enforced freeze:** close/stop writers and sync clients, fingerprint before and after the final copy, and abort on unexplained drift.
- **Reverse rollback:** before switching back, capture state created on the new primary. Otherwise “rollback” silently discards new sessions/files/commits/messages.
- **Storage roles:** inventory rollback image, transfer payload, restore-rehearsal destination, and new-primary proving-window backup. Do not collapse them into one failure domain.
- **ACL/SID translation:** preserving old descriptors onto a clean Windows profile can retain unresolved SIDs. Specify preserve-and-translate versus data-only/new-ACL per lane and verify the declared destination policy.
- **Destination provenance:** prefer a clean install. Any inherited-install exception needs a closed evidence list and explicit decision; “evidence it is clean” is not falsifiable by itself.

## Intended-divergence register

Exact zero-diff gates conflict with runbooks that deliberately mutate files. Before each approved mutation, record:

- path/object;
- reason and actor/tool;
- pre-change hash/count/state;
- expected transformation;
- post-change hash/count/state;
- acceptance owner.

Examples include database checkpoint side effects, regenerated indexes, repaired worktree metadata, recreated junctions, path rewrites, and ACL translation. Unregistered objects must match exactly. Registered objects must match the approved post-state. Never replace this with a blanket “expected differences” waiver.

## Large-artifact reliability

For large generated documents:

1. Write bounded sections to temporary part files when the file tool or transport may truncate a large payload.
2. Concatenate deterministically.
3. Verify byte count, line count, required headings/phrases, absence of literal truncation markers, and SHA-256 before review.
4. Have the reviewer read only the verified final path.

The durable lesson is verification after write, not any particular transient truncation error.

## Model-run audit

For an external reviewer, preserve:

- invoked model alias and canonical model(s) reported by the wrapper;
- context window when exposed;
- session ID, turn count, permission denials, result status, and cost;
- prompt and raw wrapper.

Some runners may report helper-model usage alongside the main reviewer. Report that transparently; do not misstate the helper as the primary review model. Restrict tools to read-only surfaces for document review.

## Human handoff

Lead with:

1. document verdict and operational readiness;
2. original critical closure (`full / partial / unresolved`);
3. deduplicated remaining severity counts;
4. genuinely new/high-value/restatement/false-positive counts;
5. structural vs implementation vs edge-case quality;
6. the highest-leverage remaining P0;
7. whether another review round has value or evidence gathering should begin.
