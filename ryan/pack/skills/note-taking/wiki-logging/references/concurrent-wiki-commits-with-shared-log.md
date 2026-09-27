# Scoped commits in a shared dirty wiki worktree

Use this when a wiki update must be committed while Obsidian or another agent owns unrelated staged/unstaged files—especially `_meta/log.md`.

## Goal

Create a commit containing only the current operation's nodes and temporal-log block while preserving every unrelated worktree and index change exactly where it is.

## Decide the path

- **Clean index, unrelated unstaged files only:** stage explicit owned paths. For a shared log, stage only the operation's hunk.
- **Unrelated staged changes already exist, or `_meta/log.md` mixes two writers:** use an alternate index.
- The shared worktree remains authoritative. Never use `git add -A`, broad stash, hard reset, or checkout over another writer's files.

## Preparation

1. Capture `git status --short` and distinguish index (`X`) from worktree (`Y`) columns.
2. Read the current `_meta/log.md` top/tail and the exact blocks being edited.
3. Insert the operation's log entry with `scripts/append_log.py`; read it back with the neighboring concurrent entry visible.
4. Build a **desired index log** from `HEAD:_meta/log.md` plus only the current operation's entry. Materialize the Git object stream directly (for example with Python `subprocess.check_output`) rather than round-tripping a large log through capped terminal/tool output.
5. Confirm the desired log preserves the full base byte count/tail and contains the new heading exactly once.

## Alternate-index recipe

The alternate index starts from `HEAD`, so unrelated staged content is absent from the commit by construction.

```bash
set -euo pipefail
ALT_INDEX="$(mktemp)"
rm -f "$ALT_INDEX"
export GIT_INDEX_FILE="$ALT_INDEX"

git read-tree HEAD
git add -- path/to/owned-node-1.md path/to/owned-node-2.md

LOG_BLOB="$(git hash-object -w /path/to/desired-index-log.md)"
git update-index --add --cacheinfo "100644,$LOG_BLOB,_meta/log.md"

git diff --cached --check
git diff --cached --name-only
git diff --cached --stat
git commit -m "wiki: <bounded change>"
NEW_HEAD="$(git rev-parse HEAD)"

unset GIT_INDEX_FILE
# Refresh only paths owned by this operation in the real index.
git reset "$NEW_HEAD" -- \
  _meta/log.md \
  path/to/owned-node-1.md \
  path/to/owned-node-2.md
rm -f "$ALT_INDEX"
```

Why the path-scoped reset matters: advancing the branch changes `HEAD`, while the real index still reflects the previous commit. Refreshing only owned paths makes the committed paths clean without disturbing unrelated staged entries.

## Verification gates

Before push:

```bash
git show --format=fuller --stat --name-status HEAD
git diff --cached --name-status
git status --short
git diff -- _meta/log.md
```

Required invariants:

- The new commit names only intended nodes plus `_meta/log.md`.
- `_meta/log.md` in the commit contains only this operation's block; concurrent log blocks remain as worktree changes.
- Unrelated staged/unstaged status is unchanged in substance.
- Owned node paths are clean after the path-scoped index refresh.

After push, compare `git rev-parse HEAD` with `git ls-remote origin refs/heads/main` and re-run `git status --short`.

## Pitfalls

- A short-status line's leading space is meaningful: ` D file` is an unstaged deletion; `D  file` is staged.
- `git commit --only _meta/log.md` reads the whole worktree version of that path and can accidentally absorb another writer's log block.
- A temporary index alone is not enough: after advancing `HEAD`, refresh the real index for the paths just committed.
- If another writer changes the same owned node—not merely the shared log—stop and reconcile that node before committing.
