# Read-only integrity audit playbook

Use when the user requests an evidence-based audit that preserves canonical source and live state. Store evidence and isolated fault-injection fixtures outside the target only when that artifact-writing scope is authorized.

## 1) Discovery with provenance guardrails

1. If the user provides a target staged tree hash, verify it immediately with
   `git write-tree` before normal diff inspection.

```bash
git -C "<repo>" write-tree
git -C "<repo>" rev-parse --verify <target-tree-sha>
```

2. Determine the candidate repo path and print a brief path inventory.
3. Run:

```bash
git -C "<repo>" rev-parse --is-inside-work-tree
```

- If this returns `true`, continue with commit/state capture.
- If it fails (`not a git repository`), explicitly switch to **observational mode** and
  state that commit history cannot be verified in this pass.

4. Capture commit + status context (best-effort):

```bash
git -C "<repo>" rev-parse --abbrev-ref HEAD
git -C "<repo>" rev-parse HEAD
git -C "<repo>" status --short --untracked-files=no
git -C "<repo>" diff --cached --name-only
```

## 2) Canonical evidence sources first

Read these in priority order when present:

- `nodes/Alexpedia.md`
- `_meta/log.md`
- `docket.md` / operating log equivalents
- project `nodes/` + `content/` index files
- changelog or migration manifests in `scripts/` / `nodes/` / `_meta/`

Avoid making claims outside observed files.

## 3) Lint/verification commands without mutation

Run only read-only validations by default. For this repo family, avoid direct
script-file execution for package-scoped lint runners that rely on relative imports.

Preferred:

```bash
cd "<repo>"
python -m scripts.lint.suite
```

Observed gotcha to capture:
- direct execution as `python scripts/lint/suite.py` can throw
  `ImportError: attempted relative import with no known parent package`.
- keep this as a tooling invocation note, not a code defect.

## 4) Finding rubric (audit reports)

Classify each finding with:

- `file` and exact context,
- `evidence` command/output excerpt,
- `severity`,
- `repro path` (or `why not reproducible`),
- explicit read-only boundary if command was non-destructive.

Reserve `high` for boundary/identity/security mismatches, `medium` for unresolved
operational seams, and `low` for deferred formatting/metadata cleanup.

## 5) Close a multi-pass audit without implying repairs

1. Validate each completed review's schema, pass ID, actual model and terminal receipt. Bind its prompt hash to the saved packet bytes with `hashlib.sha256(Path(packet).read_bytes()).hexdigest()`; hashing the pre-write string can disagree after newline conversion. Preserve failed starts and raw verdicts separately from completed-pass accounting.
2. Parse the append-only ledger and planned repair batches in code. Require unique finding IDs, a disposition for each reviewed candidate, and exactly one repair-batch mapping for every confirmed root. Count optional nits, unsupported claims, duplicates and clean controls separately. Fold extra triggers of an existing root into its acceptance tests instead of inflating the repair count.
3. Recheck the original identity window: HEAD, relevant remote ref, tracked-file inventory/hashes, explicitly preserved dirty or untracked files, and the selected frozen source. Keep the full preservation inventory separate from the smaller reviewer packet. For live sites, compare the relevant public asset window again; a code-path fixture does not establish that production still serves the same code.
4. Label each probe's success condition. `defect_present` means the harness successfully reproduced broken behavior; it must become a desired-behavior regression that fails on the original artifact before an authorized repair. Keep simulated network/storage effects distinct from observed delivery, persistence or user impact.
5. Generate the executive report, ordered repair queue and final state from the same reconciled data. Include exact scope, evidence handles, acceptance tests, unresolved choices and rollout boundary. State which defects remain open rather than presenting completed review passes as completed remediation.
6. Finalize those reports before creating a SHA-256 manifest of the evidence bundle, excluding the manifest itself. For script-produced bundles, verify the saved manifest against the files once and fail closure on a mismatch. Treat the seal as a reproducibility/integrity receipt, not a signature or independent certification; preserve it and record later work as a new artifact state.
