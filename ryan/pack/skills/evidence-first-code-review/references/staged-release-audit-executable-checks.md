# Staged final-tree release audit executable checks

Use this as a compact command runbook for strict staged-only audits of local-first
static apps.

```bash
cd "<repo>"

# Identity + scope lock
git write-tree
git rev-parse --verify <target-tree-sha>
git status --short --untracked-files=no      # must be empty for staged-only

git diff --cached --name-only

git diff --cached --stat

git diff --cached -- .assetsignore | sed -n '1,120p'

git diff --cached -- recipe-book/index.html | sed -n '1,200p'

git diff --cached -- recipe-book/lib/db.mjs | sed -n '1,220p'

git diff --cached -- recipe-book/lib/core.mjs | sed -n '1,260p'

git diff --cached -- recipe-book/lib/importers.mjs | sed -n '1,420p'

git diff --cached -- recipe-book/sw.js
```

Read-only validations:

```bash
node --check recipe-book/app.mjs
node --check recipe-book/lib/core.mjs
node --check recipe-book/lib/db.mjs
node --check recipe-book/lib/importers.mjs
node --check recipe-book/sw.js
node --test recipe-book/tests/core.test.mjs
node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('recipe-book/manifest.webmanifest','utf8')); console.log('manifest-ok')"
```

Manifest/asset sanity:
- Confirm CSP and referrer lines in `recipe-book/index.html` before any network-facing claims.
- Confirm `.assetsignore` includes:
  - `/recipe-book/tests`
  - `/recipe-book/README.md`
  - root wildcard blocks (`/*-spec.md`, `/*-brief.md`, `/bundle-previewer/MICHI_BINDERS_FUTURE.md`)
  - local temp pattern `**/.hermes-tmp.*`
- Confirm SW cache/version bump and completeness for changed assets.

Security/parser checks (targeted for import flows):
- Confirm URL allowlisting in `safeSourceUrl` and `safeEmbeddedImage` paths
- Confirm merge preserves user-owned fields (`favorite`, `importedAt`)
- Confirm no remote links are rendered without safe scheme checks and safe rel attrs

