# Clean renderer deployment from a dirty shared wiki worktree

Use this when a wiki promotion is committed and pushed while unrelated edits remain in the shared worktree. The publication build must represent the pushed commit exactly, without leaking or discarding concurrent changes.

## Invariants

- The intended wiki commit contains only owned paths and the owned diagnostic-log block.
- Local `HEAD` equals `origin/main` before snapshot creation.
- The renderer reads an isolated snapshot of that commit.
- The shared worktree, real index, and unrelated edits retain their prior state.
- Publication receipts include build/test output, generated-content proof, live auth behavior, and deployment version.

## Procedure

### 1. Close and push the scoped commit

Use `references/concurrent-wiki-commits-with-shared-log.md` when `_meta/log.md` mixes writers. Then verify:

```bash
git push origin main
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git ls-remote origin refs/heads/main | cut -f1)"
test "$LOCAL" = "$REMOTE"
```

### 2. Build from an isolated commit snapshot

A detached worktree is the first choice:

```bash
TMP="$(mktemp -d)"
git worktree add --detach "$TMP" HEAD
cd "$TMP/site"
```

On Git Bash/MSYS, `git.exe` is a native Windows program. Convert a scratch path before passing it as the worktree destination; a bare `/c/...` argument can become a literal `C:\c\...` tree:

```bash
TMP_POSIX="$(mktemp -d -p /c/Users/<user>/AppData/Local/hermes/scratch wiki-deploy-XXXXXX)"
TMP_NATIVE="$(cygpath -m "$TMP_POSIX")"   # C:/Users/<user>/...
rmdir "$TMP_POSIX"                         # git worktree requires a new destination
git worktree add --detach "$TMP_NATIVE" HEAD
git worktree list --porcelain               # authoritative recorded path
cd "$TMP_NATIVE/site"
```

If Windows path conversion or a repository symlink prevents a usable detached worktree/archive extraction, inspect the tracked tree before retrying:

```bash
git ls-tree HEAD index.md site
git cat-file -p HEAD:index.md
git ls-tree -r --name-only HEAD
```

Then create a ZIP snapshot using a native Windows output path:

```bash
TMP="$(mktemp -d -p /c/Users/<user>/AppData/Local/hermes/scratch wiki-render-XXXXXX)"
TMP_WIN="$(cygpath -w "$TMP")"
git archive --format=zip -o "$TMP_WIN/repo.zip" HEAD
python -c "import pathlib, zipfile; root=pathlib.Path(r'$TMP_WIN'); zipfile.ZipFile(root/'repo.zip').extractall(root)"
cd "$TMP/site"
```

Git ZIP extraction may materialize a symlink as a small text file containing its target. Read the renderer's source-collection code before altering it. If the renderer explicitly skips that path by name or symlink status, the placeholder is harmless. If the renderer consumes the path, materialize it from a committed target blob; a missing committed target is a reproducibility blocker.

### 3. Build, test, and prove the promoted text rendered

```bash
python build.py
python -m unittest test_build.py
python -c "import pathlib; phrase='<load-bearing promoted phrase>'; hits=[str(p) for p in pathlib.Path('dist').rglob('*.html') if phrase in p.read_text(encoding='utf-8', errors='ignore')]; print(hits); assert hits"
```

Record article/category counts and redlink baseline. Fix only regressions attributable to the intended commit.

For a Recent Changes or log-projection change, assert the exact generated surface rather than only searching all HTML:

```bash
python -c "from pathlib import Path; p=Path('dist/wiki/Special__RecentChanges.html'); s=p.read_text(encoding='utf-8'); assert '<load-bearing newest receipt>' in s; assert 'href=\"/wiki/<expected-slug>\"' in s; assert '<known stale fragment>' not in s"
```

Also assert the main-page preview when it carries Recent Changes navigation. Keep artifact presence, target links, stale-text absence, and referenced-asset counts as separate booleans so a failing gate names the broken contract.

### 4. Deploy and verify the auth boundary

Run the provider's configuration gate before the side effect, then retain the resulting version record:

```bash
npx --yes wrangler deploy --dry-run
npx --yes wrangler deploy
npx --yes wrangler deployments list
curl -sS -o /dev/null -D - 'https://<worker>/<promoted-route>'
```

For an auth-gated site, the unauthenticated route should return the configured challenge (for example `401`) without exposing the protected page. Probe one household route, one medical route, and any encoded traversal sentinel already established by the Worker tests. Retain the Worker deployment version ID and confirm it is the active 100% deployment. Local generated-content assertions prove what entered the static bundle; live unauthenticated probes prove the gate. Do not type or expose the household password merely to fetch the protected body.

### 5. Verify preservation and clean the snapshot

Back in the shared worktree:

```bash
git status --short
git rev-parse HEAD
git ls-remote origin refs/heads/main
```

Confirm unrelated status is unchanged in substance. Remove only the temporary snapshot/worktree created for this deployment:

```bash
git worktree remove --force "$TMP_NATIVE"   # or "$TMP" on non-Windows shells
git worktree list --porcelain
```

On Windows, Wrangler or antivirus scanning can let Git unregister the worktree while directory deletion returns `Permission denied`. Treat Git's registry as authoritative before retrying. If the worktree no longer appears in `git worktree list --porcelain`, remove only that known disposable directory with a targeted write-bit recovery rather than a broad repository cleanup:

```python
import os, shutil, stat
path = r"C:\Users\<user>\AppData\Local\hermes\scratch\wiki-deploy-..."
def recover(func, target, _exc):
    os.chmod(target, stat.S_IWRITE | stat.S_IREAD)
    func(target)
shutil.rmtree(path, onerror=recover)
```

Read `git status --short` and `HEAD...origin/main` from the canonical worktree after cleanup.

## Pitfalls

- A source push is a backup state, not evidence that a build-time Recent Changes page or article is live.
- Building from the dirty shared tree can publish another writer's uncommitted edits.
- Passing an MSYS `/c/...` path directly to native `git.exe` can create an unintended literal `C:\c\...` worktree; convert to `C:/...` with `cygpath -m` and verify with `git worktree list --porcelain`.
- A root symlink can point to a local file absent from the committed tree. Inspect whether the renderer reads it before materializing or ignoring it.
- Broad stash/reset/checkout operations violate shared-worktree ownership.
- A successful deploy proves upload, while generated-content inspection proves the intended wiki text was present in the deployed asset set.
- Frontmatter labels alone do not prove the audience projection; read the renderer's allowed-visibility matrix and isolation tests before describing a route as owner-only, household, medical, or excluded.
