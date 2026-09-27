# Staged release-audit checklist (exact-tree mode)

Use this when user asks for a **final release readiness audit** against an exact staged tree hash.

## Required preflight

1. **Tree identity lock**

```bash
git -C "<repo>" write-tree
git -C "<repo>" rev-parse --verify <target-tree-hash>
```

- If the hashes do **not** match exactly, stop with a blocker and report both values.
- If the hashes match, include the exact `write-tree` command output in evidence.

2. **Staged scope capture**

```bash
git -C "<repo>" diff --cached --name-only
git -C "<repo>" diff --cached --stat
git -C "<repo>" status --short --untracked-files=no
```

- Use only staged paths for review unless user explicitly allows unstaged.
- For each changed file, pull evidence from staged content:
  - `git -C "<repo>" show :path`
  - or `git -C "<repo>" diff --cached -- path`

## Mandatory evidence buckets for app-domain releases (when relevant)

If the request enumerates feature areas, force explicit check pass/fail for each:

- IndexedDB migration `{key,value}→v2` shape + legacy store deletion,
- single-record favorite write queue and UI/state freshness,
- wake-lock request/release around visibility and dialog state,
- cross-archive fallback IDs,
- CSP policy (especially image/url allowlists),
- service worker versioning/completeness,
- absence of private recipe corpus in staged assets,
- `.assetsignore` correctness and runtime dependency closure (no required dynamic asset path is excluded),
- root link/canonical discoverability path,
- vendored third-party library licensing (license presence + integration only).

## Test commands (read-only)

Run targeted checks that are cheap and relevant:

```bash
cd "<repo>"
node --test <test-path>
node --check <file>.mjs
node -e "JSON.parse(require('fs').readFileSync('<manifest>', 'utf8')); console.log('manifest-ok');"
```

Only record command evidence that directly validates a stated requirement.

## Reporting contract

- Ordered buckets: `blocker` `high` `medium` `low` `nit`
- Each finding: `file:line`, trigger, impact, smallest fix
- If no findings: explicit `PASS zero findings`

## Example non-blocking proof for no findings

1. Exact tree match confirmed.
2. All requested buckets inspected with commands.
3. Tests/checks pass.
4. Conclude: `PASS zero findings`.
