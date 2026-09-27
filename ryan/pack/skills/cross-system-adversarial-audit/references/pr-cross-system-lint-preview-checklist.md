# Cross-Repo PR Adversarial Lint + Preview Checklist

Use this reference for front-end and worker-backed site PR audits when two repositories/branches are involved.

## Scope discovery

```bash
git fetch origin pull/<PR>/head:pr-<PR>
git branch --show-current
git status --short --branch
```

If ancestry data is incomplete:

```bash
git fetch --unshallow origin
```

```bash
git merge-base --all origin/main pr-<PR>
git rev-list --left-right --count origin/main...pr-<PR>
```

```bash
git diff --name-only $(git merge-base origin/main pr-<PR>)..pr-<PR>
```

## Change-set linting

- For each changed JS path: `node --check <path>`
- Run repo verification:
  - `npm test`
  - `npm run test:workers` (if script exists)
  - project-specific lint scripts as configured
- Secret/PII sweep (changed files only):
  - `api[_-]?key|secret|token|password|private[_-]?key|auth|bearer|-----BEGIN|AKIA|AIza|ghp_`

## Preview checks

- If Cloudflare/Wrangler project: `wrangler deploy --dry-run`
- Serve locally on changed branch and smoke-check impacted routes/pages.
- Browser checks:
  - verify DOM snapshot loads expected content and key sections
  - collect console errors (`browser_console`) and page output evidence
  - treat anonymous exceptions as warning and capture screenshot/snapshot context

## Failure triage buckets

1. **PR code regression**: failure appears only on changed lines and aligns with code paths under test.
2. **Script/config debt**: repo scripts fail before touching changed logic (`test:workers` missing target path, etc.).
3. **Preview environment mismatch**: local smoke passes but deployment behavior differs.

Use this checklist to produce final risk reports with explicit pass/fail and residual warnings.
