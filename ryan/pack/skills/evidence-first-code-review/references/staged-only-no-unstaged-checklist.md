# Staged-tree + no-unstaged checklist

Use this whenever the review scope is explicitly **staged-only**.

1. Verify the staged tree identity first:

```bash
git -C "<repo>" write-tree
git -C "<repo>" rev-parse --verify <target-tree-sha>
```

2. Confirm there are no unstaged tracked diffs:

```bash
git -C "<repo>" diff --name-only
```

- If this command prints any path(s), treat it as a hard blocker for this pass.
- Report: `unstaged tracked changes detected` and list the paths.
- Do **not** claim release-readiness until the user re-runs audit on a clean staged scope.

3. Capture staged scope explicitly:

```bash
git -C "<repo>" diff --cached --name-only
git -C "<repo>" diff --cached --stat
```

4. Confirm unstaged status cleanly, excluding untracked files:

```bash
git -C "<repo>" status --short --untracked-files=no
```

- Empty output is required for strict read-only staged-only audit preflight.
- If non-empty, call out whether changes are unstaged modifications, renames, or staged deletions.

5. Only then continue with staged-content inspection (`git show :path`, `git diff --cached -- path`) and requested domain checks.
