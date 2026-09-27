# Medical vs household boundary review checklist

Use when a change introduces separate auth buckets (for example household + medical,
medical + internal), path-specific route gating, or split static renders.

## Mandatory evidence sequence

1. **Scope + exclusions**
   - Confirm the exact intent: staged / unstaged / mixed and any file exclusions.
   - Exclude noisy runtime UI files when requested (e.g. `nodes/.obsidian/graph.json`,
     `nodes/.obsidian/workspace.json`) from the file-change set.

2. **Read both implementation and tests in lockstep**
   - `site/worker-core.mjs`
   - `site/worker-core.test.mjs`
   - `site/build.py`
   - `site/test_build.py`
   - `site/static/wiki.js`

3. **Boundary command checks**
   - For auth/build changes, run the build and inspect generated artifacts:
     - `cd site && python build.py`
     - `rg -n "medical|internal|secret|credential" dist dist/medical`
   - For route/cookie behavior, confirm tests cover encoded/bypass paths and next-redirect
     confinement.

4. **Suggestion/API guardrail checks**
   - Ensure any sensitive-context rejection path has explicit test coverage with
     expected status code and side-effect checks (e.g., DB/email writes stay empty).

5. **Evidence rubric for findings**
   - Every blocker claim must include:
     - file:line,
     - command/output snippet,
     - minimal reproduction path,
     - why this is a boundary/authorization/surface leak or not.

## Pitfall notes

- Passing diff review on docs-only updates without verifying built outputs can miss
  leakage through generated `search-index.json`, copy paths, or category/recent-change
  pages.
- If `secret` or `credential` appears in any tracked payload content (even `internal`
  pages), treat it as a separate evidence item: whether the secret is only in docs,
  build artifacts, or git history.
- When one command appears empty, run the scoped equivalent with explicit pathspecs
  and excludes; do not assume absence of change.
