---
name: evidence-first-code-review
description: "Use when auditing code changes or model acceptance. Verify artifact identity, reproduce defects, and close an ordered remediation queue with explicit rollout evidence."
version: 1.4.1
author: Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [code-review, verification, evidence-first, static-web, testing, linting]
    related_skills: [requesting-code-review, github-code-review, test-driven-development]
---

# Evidence-first review and remediation

Use this when reviewing staged, unstaged, or mixed code changes, model-acceptance
handoffs, and their remediation. Apply the relevant web, parser, or learned-system
checks below; the shared contract is artifact identity, reproducible evidence,
and bounded conclusions.

## Scope and principle

- Determine review target from the request first:
  - **staged-only** => `git diff --cached --name-only`
  - **unstaged-only** => `git diff --name-only`
  - **mixed** => run both and dedupe
- If a request excludes noisy files, apply explicit path excludes when listing and
  reading changed paths (e.g. `:(exclude)nodes/.obsidian/graph.json` and
  `:(exclude)nodes/.obsidian/workspace.json`).
- Treat every actionable finding as evidence-backed: exact file, line, command,
  failure mode, and reproducible steps.
- For **read-only** audits, preserve canonical source and live state. Keep any authorized evidence files and fault-injection copies outside the target; distinguish observations from isolated controls.
- Close read-only audits by reconciling reviewer receipts, ledger dispositions and the proposed repair queue, then sealing the evidence. Report **audit complete** separately from **repairs applied**; a reproducer that passes by confirming a defect is not a passing repair test. Follow `references/read-only-integrity-audit-playbook.md` for the closure sequence.
- Do not let tooling-format noise become code findings.
- Include the directly called helpers and relevant unchanged dependencies in closed reviewer packets; a missing setup helper can turn an otherwise valid review into an unsupported major finding. Adjudicate against full source and a clean-checkout control before editing.
- Build reviewer packets from full files or directly captured subprocess output, not a terminal tool's truncated display. Record packet size/hash and an end marker; a schema-valid partial pass with omitted source is a capture failure, requiring a bounded complete follow-up over the missing scope.
- Record each receipt's hash convention explicitly: raw file bytes and normalized UTF-8 log text are different identities on Windows. Verify using the producer's declared convention; preserve earlier receipts and record any normalization diagnosis separately instead of rewriting historical hashes.
- In repositories with dirty live data, scope content diffs and `git diff --check` to the exact task paths before execution; whole-repository checks can dump growing archives and turn preserved CRLF into irrelevant whitespace noise. Inspect broad state with filename-only output, then narrow.

## Exact tree-lock mode (staged tree hash verification)

When the user provides an exact staged-tree SHA and/or expected HEAD commit (or asks for an exact audited release tree), run this sequence before any defect triage:

```bash
EXPECTED_HEAD="<expected_head_hash>"   # optional unless user requires head validation
EXPECTED_TREE="<expected_tree_hash>"   # optional unless user requires tree validation
ACTUAL_HEAD="$(git -C "<repo>" rev-parse HEAD)"
ACTUAL_TREE="$(git -C "<repo>" write-tree)"

echo "HEAD=${ACTUAL_HEAD}"
echo "TREE=${ACTUAL_TREE}"

if [ -n "${EXPECTED_HEAD}" ] && [ "${ACTUAL_HEAD}" != "${EXPECTED_HEAD}" ]; then
  echo "HEAD mismatch: expected ${EXPECTED_HEAD}, got ${ACTUAL_HEAD}"
  exit 2
fi

if [ -n "${EXPECTED_TREE}" ] && [ "${ACTUAL_TREE}" != "${EXPECTED_TREE}" ]; then
  echo "staged tree mismatch: expected ${EXPECTED_TREE}, got ${ACTUAL_TREE}"
  exit 2
fi
```

- Require exact match(es) before proceeding. If mismatched:
  - report a hard blocker to scope assumptions,
  - include both expected/actual values in the output,
  - and stop content review unless the user explicitly asks for a rerun against
    a different tree/HEAD.
- Keep this as the first verification checkpoint for release-readiness requests.
- If an independent reviewer later claims these hashes were not visible even though its transcript contains the labeled `HEAD=` / `TREE=` output, classify the verdict as a **review-capture failure**, not a code defect and not an approval. Launch a fresh bounded blocker-only reviewer whose first action is the single labeled command above, require its final structured summary to repeat the observed hashes, and keep the rerun to a small read-only call budget plus the staged diff.

For staged-only audits, verify working-tree drift is not present before reading content:

```bash
git -C "<repo>" status --short --untracked-files=no
git -C "<repo>" diff --name-only
```

- Any tracked output here means tracked unstaged changes exist.
- Treat this as a hard blocker for strict staged-only release-audit mode.
- Record those paths in the audit preamble and stop unless the user explicitly
  asks for a mixed-scope audit.
- Only after this check is clean should staged-only content proofs run.
Then confirm staged-only scope before opening files:

```bash
git -C "<repo>" diff --cached --name-only
git -C "<repo>" diff --cached --stat
git -C "<repo>" status --short --untracked-files=no
```

For read-only audits where users care only about staged state, avoid plain
working-tree reads of changed files. Use staged reads for any code proof:

```bash
git -C "<repo>" show :<path>
# or
git -C "<repo>" diff --cached -- <path>
```

If this staged-only audit needs a one-shot command list, follow `references/staged-only-no-unstaged-checklist.md`.
If staged diff is empty, state `NO STAGED CHANGES FOR THIS AUDIT` explicitly.

## Audit output shape for release-readiness reviews

Sort findings in this exact order:

`blocker` → `high` → `medium` → `low` → `nit`

Each finding entry must include:
- `file:line`
- trigger
- impact
- smallest fix

If clean, explicitly say: `PASS zero findings`.

For requested app-domain audits, also explicitly call out (in your severity buckets):
- IndexedDB v1 `{key,value}` → v2 migration and legacy-store cleanup,
- favorite persistence queue semantics and render/state freshness,
- wake-lock overlap/visibility/close lifecycle,
- cross-archive fallback identifiers,
- CSP policy coverage,
- service worker/version completeness,
- private corpus/fixtures inclusion check,
- `.assetsignore` coverage,
- root link/canonical discoverability path,
- vendored library licensing (license file + intended integration only).

## Step 0 — Scope, repository capture, and read-only guardrail

```bash
# Standard provenance capture
git -C "<repo>" rev-parse --is-inside-work-tree

git -C "<repo>" rev-parse --abbrev-ref HEAD
git -C "<repo>" rev-parse HEAD
git -C "<repo>" status --short --untracked-files=no
```

Pick diff source by scope:

```bash
# Staged-only review (default when user says "staged"/"git diff --cached")
git -C "<repo>" diff --cached --name-only

# Unstaged-only review (default when user says "current unstaged changes")
git -C "<repo>" diff --name-only

# Both staged + unstaged
(git -C "<repo>" diff --cached --name-only ; git -C "<repo>" diff --name-only)
```

If diff output is empty/untrusted, run fallback capture once:

```bash
git -C "<repo>" status --short
git -C "<repo>" write-tree
```

If `rev-parse` reports **not a git repository**, continue as an evidence-only audit:

- note repository provenance is unavailable in this pass,
- use file-path + diff-by-reading evidence from the filesystem and logs,
- explicitly label any conclusion that depends on commit history as provisional.

For non-repo integrity audits, capture the directory inventory and timestamps first,
then proceed directly to content checks.

## Handoff and acceptance audits

When Alex reports that a build session ended and another agent integrated it, audit the handoff boundary before judging the design: compare the intended manifest, tested copy, shipped commit, and current artifact. Separate integration fidelity, acceptance-test validity, and current runtime health; a pass in one does not establish the others.

- Inspect verification entrypoints before running them against a live system: `--check`, `--eval`, and imports can repair stores, advance cursors, save checkpoints, or start workers. Keep fault injection in memory or an isolated scratch copy, outside live data.
- Test decisive acceptance gates with a targeted corruption as well as the valid artifact. A gate accepting corruption proves a coverage defect, not that production data is corrupt.
- Assign each acceptance gate to the operation it controls before evaluating results: artifact construction, fitting, empirical validation, or serving. Preserve every original verdict and obtain authorization for any required waiver; proving a diagnostic unused by training is not permission to change an agreed acceptance requirement.
- Exercise one real-artifact tracer through the complete consumer path before accepting an integrated bundle. Unit tests or a schema-admission guard cannot substitute for actual capture, inference, downstream transformation, and scoring. Inventory non-code dependencies from their real loaders as part of this smoke; matching source files alone can omit required lookup tables or caches. Report plumbing correctness separately from model quality and untouched-test evidence.
- Separate observation/history context, gradient-update cadence, and serving-publication cadence before proposing changes; larger batches alone do not supply whole-episode understanding. Treat permission to keep learning as distinct from permission to change serving policy.
- In exploratory learned systems, honor Alex's preference for observable continuous adaptation unless slower updates have a demonstrated benefit. Preserve identity integrity, usable-evaluation checks and diagnostic receipts, but treat a temporary serving hold as a bounded experiment with an explicit review/release boundary rather than a permanent default. Propose consequential freezes, reversions or restarts instead of silently imposing them; record the chosen direction separately from the policy actually running.
- When Alex identifies a representation/capacity question for later, preserve it as a deferred research hypothesis with its evidence prerequisite, not an active acceptance blocker or permission for another experiment. Prefer a brief mechanism explanation grounded in the actual architecture; revisit empirical adequacy when per-identity observations and situation coverage support the question, rather than using total dataset size as the trigger.

Use `references/review-evidence-packet-completeness.md` for interrupted-build handoff provenance and `references/learned-model-acceptance-audits.md` for dataset, gate, checkpoint, and live-learning checks.

## Step 0.5 — Tooling entrypoint correctness

Some repo-local Python scripts use package-relative imports. Running them as direct
files can fail. Prefer package/module invocations when available:

```bash
cd "<repo>"
python -m scripts.lint.suite
```

If this is needed in the workflow, log both the command and observed behavior before
moving to code findings.

If `python -m ...` is unavailable, capture that as execution environment context
rather than a repository defect.

## Step 1 — Security and lint smoke for changed web assets

Keep checks scoped to the target asset type.

### HTML checks

```bash
# Validate only HTML pages you changed
npx --yes html-validate *.html
# or, for a subtree
npx --yes html-validate **/*.html
```

Do not include `.mjs`, `.js`, `.css`, or `.xml` in HTML validation globs unless your
`html-validate` configuration is explicitly wired for them. Mixed globs are a common
source of parser/tokenizer noise that is not a code defect.

### CSS checks

```bash
npx --yes stylelint "css/*.css"
```

## Step 1.5 — `.assetsignore` + deployability checks

Before/after code linting, validate staged asset packaging and runtime dependencies.
For any review that includes front-end assets, Worker Pages, or Cloudflare `wrangler pages deploy` flows, do this exact scope:

1. Capture staged ignore rules (read-only):

```bash
git -C "<repo>" show :'.assetsignore'
git -C "<repo>" diff --cached -- .assetsignore
```

2. Run a non-mutating packaging dry-run / asset metadata pass and keep the log path:

- If Wrangler is available, prefer `wrangler pages deploy --dry-run ...` with `--assets`-equivalent staged artifact path.
- Parse the `Ignoring asset:` lines and confirm only intentionally excluded paths remain.

3. If `.assetsignore` contains broad globbing (`**/*.md`, `**/*.py`, etc.), prove these patterns are not suppressing runtime-required files by scanning the changed app for dynamic fetch/import paths (regex or grep):

```bash
rg -n "fetch\(|import\(|\.md\$|\.json$|\.wasm$|\.png$|\.jpg$|\.webmanifest" <changed_frontend_files>
```

4. Any file required by runtime fetch/import/data paths that is also ignored is a **high** risk until justified by product intent.

5. For each suspicious exclusion, record smallest safe fix options:
   - tighten from `**/*.md` to explicit doc paths, or
   - add explicit un-ignore rule where supported,
   - or move runtime-data files out of ignored directories.

**Common pitfall:** broad `**/*.md` can hide page runtime dependency files (for example a `pokemon-zodiac` page that fetches `../md/*.md`) while preserving compile time; this is not caught by simple changed-file inspection.

## Step 2 — Runtime checks for worker-backed features

For changes that introduce or touch runtime endpoints alongside static assets:

1. **Run project scripts first**:

```bash
npm test
```

2. **Add explicit test runs for files outside scripted paths**.

Some repos pin scripts to legacy locations (`js/crm/*.test.js`, etc.) and will skip
new or ad-hoc tests. Always discover non-scripted test paths and run them directly.

Examples:

```bash
node --test tests/*.mjs
node --test tests/**/*.mjs
node --test static/*.test.mjs
python -m unittest tests/test_*.py
```

3. **Endpoint matrix smoke** (minimum set):

```bash
# unauthenticated + invalid methods
curl -i -X GET https://staging.local/api/suggestions

# malformed content-type/parse failure on parser-heavy endpoints
curl -i -X POST -H 'content-type: application/json' -d '{"password":"x"}' https://staging.local/login

# admin/report secret enforcement
curl -i -H 'authorization: Bearer wrong' https://staging.local/api/suggestions/report

# dependency missing/failing-path
# (run against an env without the DB binding to verify 4xx/5xx is explicit, not generic)
curl -i -X POST https://staging.local/api/suggestions -H 'Content-Type: application/json' -d '{"contributor":"Alex","page_path":"/wiki/Alex","page_title":"Alex","transcript":"x","source":"text"}'
```

4. For builds that emit multiple render tiers (for example household + medical or public/private splits), run the generator and prove isolation before final conclusions:

```bash
cd "<repo>/site" && python build.py
cd "<repo>"
rg -n "(medical|internal|secret|credential)" site/dist  # quick signal only; validate context line-by-line
```

5. Prefer fixture-level checks in unit tests for these isolation invariants:
   - run the project tests that target both views when present
   - ensure no forbidden terms/assets leak into non-protected outputs

6. Record each command result in your review evidence (pass/fail + output fragment).


## Step 2a — Auth/build-boundary checks for Worker + static dual renders

When the change touches authentication, route handling, asset build, or search/API surfaces:

1. Read the concrete runtime/build files and their tests together (diff + source):
   - `site/worker-core.mjs` (routing/auth/cookie/redirect code)
   - `site/build.py` (render sets, copy strategy, isolation assertions)
   - `site/static/wiki.js` (client-side paths/asset access)
   - dedicated tests (`site/worker-core.test.mjs`, `site/test_build.py`)

2. Validate both sides of the boundary:
   - verify medical/household/path-escape and encoded-path checks are tested
   - verify suggestion/report endpoints reject sensitive context
   - verify render splits (e.g., `/medical`) are smoke-tested and evidence-backed

3. Prefer explicit command evidence for isolation:

```bash
cd "<repo>/site" && python build.py
rg -n "medical|internal" site/dist site/dist/medical
rg -n "suggestions.mjs|github.com|/medical/login|/medical/" site/dist site/dist/medical
```

4. When a claim about a boundary exists only in docs or docs-like nodes, treat it as
   hypothesis until matched by executable checks in tests + generated output.

## Step 2b — Import/parser and local-first boundary checks

When a diff touches file importers, parsers, or bookmark/book-scraping code:

1. **Separate parser correctness from UI regression checks.**
   - Review parsing code paths first (`*.mjs`/`*.ts` parser modules), then review rendering consumers.
   - Classify payload fields as **trusted** vs **untrusted** immediately.

2. **Threat-model untrusted URL-bearing fields before UI wiring.**
   - Fields like `source.originalUrl`, `sourceLink`, `photo_url`, remote `href`s, and any `recipe.source` copy should be
     allowlisted/validated before they are placed in DOM attributes.
   - Explicitly verify:
     - only safe schemes are accepted (`https:`/`http:` for links unless app requirements are stricter);
     - `javascript:`, `vbscript:`, and bare `data:` are rejected for navigational links;
     - if data-only URLs are expected, confine usage to image `src` and guard MIME types.

3. **Generate parser-specific repro fixtures (offline when possible).**
   - For JSON/ZIP/Paprika/Recipe Keeper imports, create minimal fixtures that intentionally contain:
     - invalid entity payloads,
     - oversized or malformed ZIP directory/trailer fields,
     - dangerous protocol URLs,
     - remote image URLs in fields that should stay local-first.
   - Run parser unit tests against each fixture and confirm failures are explicit/intentional.

4. **Confirm local-first promise before release.**
   - If the UI claims "local-only"/"device-only," verify image/photo/link fields are not unexpectedly remote,
     and that any allowed remote fallback path is intentionally documented in UI copy.

5. **Sanity script pattern (example):**

```bash
cd "<repo>"
node --input-type=module - <<'NODE'
import { parseRecipeFile } from './recipe-book/lib/importers.mjs';
const payload = new TextEncoder().encode('{}');
// TODO: swap in per-test fixture bytes and assert sanitizer/parser behavior
console.log(typeof parseRecipeFile);
NODE
```

Only use this as a deterministic template; keep each test fixture minimal and checked into a fixtures folder.

For local manifest/asset checks in static app audits, prefer parser-safe commands:

```bash
node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('recipe-book/manifest.webmanifest','utf8')); console.log('manifest-ok')"
node -e "const fs=require('fs'); console.log(fs.readFileSync('recipe-book/.assetsignore','utf8').split(/\n/).includes('/recipe-book/tests'))"
```

Avoid `require('*.webmanifest')` in these checks; Node treats many app manifests as JSON text that should be parsed via `fs.readFileSync` + `JSON.parse`.

## Step 2d — Accessibility and responsive-release checks for UI-facing changes

For diff sets that add, remove, or restructure controls, dialogs, menus, or import interactions:

1. **Keyboard/focus behavior**
   - Confirm actionable widgets are keyboard reachable (`tabindex`, event handling, Enter/Space behavior).
   - Confirm modal/dialog flows return focus (open + close), and escape/overlay click semantics remain consistent.
   - Confirm `aria-live`, `role`, and explicit labels are present where screen-reader semantics changed.

2. **Screen-reader copy and status semantics**
   - Verify `status` and announcement nodes use `role="status"` or equivalent where the review code mutates user-facing state (counts, import progress, toast/error states).

3. **Responsive layout regression checks**
   - Inspect changed CSS/layout tokens for new breakpoints and container sizing assumptions.
   - Ensure long content and compact screens don’t overflow/fold under `max-width`, `overflow`, and fixed-height containers.
   - If card/list density changed, verify the small-screen experience still exposes discoverability controls (filters/search, actions).

4. **Lightweight verification commands**

```bash
# Optional, if the repo has a browser test harness
npm run test:e2e -- --project=chromium --grep "accessibility|responsive"

# or, if Playwright/axe tooling is in place
npx playwright test --reporter=list
npx playwright test --grep "a11y"
```

If these commands are unavailable, capture that explicitly and classify it as verification-environment context (not a blocking code finding).

## Step 3 — Evidence checks for new relationship/brand pages

For changes introducing a new page and discoverability links:

- Verify canonical URL appears in the new HTML and points to the intended canonical host.
- Verify links are present and correct from every intended source page.
- Verify sitemap includes the new `loc` entry with expected `<changefreq>` and `<priority>`.
- Verify external navigation targets are intentional (especially cross-brand or business-domain links).

## Step 4 — Failure classification

- **High**: wrong external routing, broken critical user path, missing canonical/sitemap,
  security-relevant regression.
- **Medium**: broken discoverability paths, wrong page copy that changes user intent,
  inconsistent business intent between pages.
- **Low**: style-only or non-user-facing lint noise.

### Common false-positive handling

A command-level parser or format error in a validator should be downgraded to a
verification workflow issue only when:

- the changed code is syntactically correct,
- the command arguments are the likely cause (e.g. wrong file glob),
- rerunning on the correct file-type scope passes.

Re-run with corrected command scope before deciding it is a defect.

## Program closure and pre-rebuild review

When Alex asks whether the list is exhausted, reconcile the whole agreed queue before proposing a rebuild or rollout; a passing final patch review covers only its named artifact.

1. Recover the original numbered queue, subsequent triage, append-only ledger, current release manifest, and any earlier source installations. Give every original item one evidence-backed status; the latest agent's shorter working plan is not the whole program.
2. Separate implementation status from evidence and activation: deployed, installed-but-uncommitted, verified isolated candidate, incomplete, or blocked. Name unresolved data adjudication, independent validation, policy choices and runtime checks even when their supporting tools pass tests.
3. Reconcile older TODO markers with current code and receipts before counting defects. Duplicates, superseded notes, future-data requirements and proposed features are backlog entries, not verified remaining bugs.
4. Freeze a bounded pre-rebuild contract for labels, features, capture provenance and evaluation boundaries. Investigate disagreements without automatically relabeling unknowns, and choose untouched test boundaries before fitting another candidate.
5. Distinguish source installation, model retraining and dataset rebuilding. Recommend a store rebuild only when accepted changes alter stored features/labels or establish a repair need; keep unrelated product ideas and storage projects outside the critical path unless a real dependency is demonstrated.
   Trace each changed stored column to actual training consumers before recommending a fit. A diagnostic-action linkage repair can require a versioned audit sidecar or metadata re-scan without changing model features/targets. Report that source installation does not retroactively repair old rows.
   Treat validation-admission checks as structural unless source hashes, exposure history, clock alignment and actor provenance are independently substantiated. Exercise the actual unset draft plan as well as unit fixtures, require the declared freeze artifacts and consequential choices, and preserve INCONCLUSIVE rather than equating a schema pass with untouched-test evidence.
6. Report scoped diff counts and remaining acceptance criteria before recommending the next action. Exhaust the prerequisites, not the entire future product roadmap.

Use `references/review-evidence-packet-completeness.md` for multi-batch diff accounting and manifest identity checks.

## Ordered remediation and bounded continuation

1. Save a queue ordered by estimated task length and complexity, respecting dependencies; flag urgent operational exceptions rather than hiding them in the sort. Distinguish hands-on effort from compute or data-collection waiting time.
2. Map each task to finding IDs, exact file scope, acceptance tests, and unresolved behavior choices. A documentation correction closes an overclaim, not the corresponding implementation defect.
3. Apply Alex's latest direct authorization to the queue and correct stale authorization labels in its current status; preserved task lists do not reinstate superseded holds. Single-task permission ends at that task; permission to keep working the list removes routine between-task pauses. When Alex delegates routine engineering or outcome-blind test-rule choices, select and justify them before examining test outcomes rather than repeatedly returning empty fields for approval. Keep the listed order and park only consequential policy, sampling, storage, spending, or serving choices that the authorization did not settle. Treat slow execution as one verified slice at a time, not artificial delays or repeated plan-only passes.
4. For bounded overnight work, record an absolute deadline with timezone and check it before each new task or worker dispatch. Bound worker timeouts by the remaining window; authorization to work until a cutoff does not require filling the window with extra review or unrelated work.
5. Draft and test outside watched source trees when source edits trigger reloads. When Alex requests sequential completion before live integration, finish and review one dependent slice at a time, then test the coherent combined candidate before one controlled handoff; unrelated operational backlog need not block that bundle. Track `draft verified`, `applied to source`, `committed/pushed`, `loaded by the running process`, and `policy activated` as separate milestones. Scope rollout permission to the named changes; continuation permission alone does not expand it. For the poker-companion stack, `poker-companion-change-control` carries the concrete pipeline mechanics: source-override candidate tests, dual-interpreter suite gates, EOL-safe patch scripts, and the install/receipt discipline.
6. Close each task with changed files, actual test results, unresolved findings, and an append-only ledger entry. When ABS coordination is requested, post and verify that task's completion receipt before opening the next task; identify draft-only results explicitly and name one rollout owner to prevent competing edits.
7. Reserve capacity for the current task's receipt and handoff before another reviewer pass. When Alex is ending or restarting the session, prioritize a durable handoff over opening another implementation slice: capture latest intent, timestamped actual state, evidence/backup paths, dirty-worktree status and the exact unfinished transition. Put a short discovery pointer in the project and return one absolute continuation path. Distinguish active user-owned services from task workers and desired policy from installed policy; a handoff is context, not an unattended execution trigger. Use the restart-handoff procedure in `references/review-evidence-packet-completeness.md`.
8. Gate requested wiki closeout on the verified milestone Alex named. Keep partial progress in the execution ledger, and record remaining evidence or deployment limits in the eventual closeout; a prepared plan or completed code review is not a completed rebuild.

### Partial-failure acceptance

Support partial failure explicitly throughout remediation. Record process exit/timeout separately from each deliverable's state: `verified`, `partial-unverified`, `blocked`, or `not-started`. After an interrupted worker, preserve surviving artifacts and logs, compare the input/output manifest, and independently test the smallest coherent bundle. Retain verified slices, quarantine unsafe partials, and retry only unresolved scope; a missing final report does not erase working code, and an exit-zero report does not certify it. Continue independently authorized tasks while a separate dependency is blocked. Re-test dependent slices after integration, and keep deployment or serving gates closed whenever their required evidence is incomplete.

Reconcile delayed completion notifications against the exact run's existing receipt before changing status; a late notice does not authorize a rerun or rollback.

## Iterative review convergence

When the user asks for an improvement loop, adversarial loop, or repeated reviewer pass, measure the **trajectory of verified findings** rather than suggestion volume.

1. Freeze a finding contract before the first pass: stable ID, pass, reviewer provenance, severity (`BLOCKER`, `MAJOR`, `MINOR`, `NIT`), exact evidence, consequence, remedy, verification, and disposition.
2. Adjudicate each suggestion for correctness, evidence, novelty, proportionality, and measurable artifact improvement before applying it.
3. For a claimed semantic defect, write the smallest fault-injection or reproducer test before editing production code. Confirm it fails for the claimed reason—not a typo, wrong key, or earlier validation branch. If the current artifact already rejects the corruption, mark the finding partially supported or unsupported and do not manufacture a fix.
4. Keep an append-only ledger. Link duplicates, reopened findings, and superseding dispositions to their original IDs.
5. Summarize every pass by new verified material findings, unresolved blockers/majors, reopened findings, accepted nits, duplicates, and unsupported suggestions.
6. Expect a falling severity curve: major findings become minor findings, then bounded nitpicks, then zero material findings. A stalled or regressed curve returns to human adjudication.
7. Use Opus or the strongest independent reviewer as a **bounded terminal sanity checker** after local tests/builds and deterministic artifact checks are green. Supply the locked contract, final artifact, verification receipts, and prior ledger.
8. Close at zero unresolved blockers/majors after every verified fix is re-tested. Residual minor/nit findings remain explicit as accepted tradeoffs or docketed work.
9. Run a confirmation pass when a verified material fix changed the artifact; otherwise the first zero-material terminal report closes the loop.

Detailed schema, trajectory labels, JSONL example, and completion receipt: `references/review-loop-convergence.md`.

For multi-report recursive sidecar attacks, credential/privacy containment ordering, complete-output capture, and the five-major-round reassessment gate, use the class-level `cross-system-adversarial-audit` skill and its `references/recursive-sidecar-convergence.md`. Keep this skill focused on code-review evidence and post-fix confirmation rather than duplicating the full sidecar protocol.

## Output format for independent review notes

Use one of these shapes:

- `NO BLOCKERS` — when no evidence-backed blockers remain.
- Or exact findings as:
  `file:line -> severity -> issue -> trigger -> minimal repro`

## Support files

- `references/forecast-action-provenance.md` for final-probability/action joins, protocol vocabulary, timestamp provenance, malformed-header rejection, and honest inconclusive reports.

- `references/online-learning-acceptance-audits.md` for model-rebuild handoffs, nested validation, post-blend calibration, approval-stamp lifecycle, and safe evaluator fault injection.
- `references/import-parser-security-checks.md` for parser + import/URL boundary checks in staged front-end import features (allowlist schemes, fixture-based poison cases, local-first validation).
- `references/static-web-review-pitfalls.md` for command scoping and parser pitfalls.
- `references/assetsignore-runtime-dependency-checks.md` for staged asset rule safety,
  broad-ignore glob pitfall detection, and runtime dependency cross-checks.
- `references/worker-suggestions-review-pitfalls.md` for worker-backed, form/API
  endpoint, and runtime-failure adversarial checks.
- `references/read-only-integrity-audit-playbook.md` for audit runs that must avoid
  writes, including branch-provenance fallbacks when git metadata is unavailable.
- `references/review-loop-convergence.md` for reviewer-quality adjudication,
  falling-severity trajectories, bounded Opus sanity checks, and convergence receipts.
- `references/staged-release-tree-audit-checklist.md` for read-only release audits
  against an exact `git write-tree` hash (preflight + required verification buckets).
- `references/staged-release-audit-executable-checks.md` for concrete command snippets
  used in strict staged-tree audits.

