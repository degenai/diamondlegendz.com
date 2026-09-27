# Alexpedia actual-worker publication contract (post-push)

Use this when Alex asks for the pushed wiki change to appear on the live Alexpedia worker (not just GitHub).

## Why this exists
A successful `git push` only updates the source repository (Tier-2). Alexpedia visibility requires a fresh build + Worker deploy of the committed tree (Tier-3). This lane is separate and must produce explicit proof.

## Preconditions
1. Required log/node edit already committed and pushed.
2. `HEAD == origin/main` locally and remotely.
3. Optional: shared worktree may be dirty due concurrent writers.

## Procedure
1. Re-sync check:
```bash
cd /c/Users/alexa/.claude/wiki
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git ls-remote origin refs/heads/main | cut -f1)
```
2. If dirty unrelated files are present, use an isolated snapshot of `HEAD` before build/deploy (e.g., `git worktree add --detach ... HEAD`) and perform build/test there.
3. Build and test the committed tree:
```bash
cd site
python build.py
python -m unittest test_build.py
```
4. Prove the intended dated receipt text is present in generated HTML (at least `dist/index.html` and `dist/wiki/Special__RecentChanges.html`).
5. Dry-run deploy gate, then deploy:
```bash
npx --yes wrangler deploy --dry-run
npx --yes wrangler deploy
```
6. Capture the `Current Version ID` printed on deploy.
7. Verify auth boundary + route exposure using unauthenticated probes that should return 401 (or configured challenge):
- `/`
- `/medical/index.html`
- `/wiki/Special__RecentChanges.html`
- traversal sentinel currently guarded in your regression suite (for example `a:/..%2Fmedical/index.html`)

## Completion receipt template
- Source sync: local HEAD and remote HEAD
- Version: `<Current Version ID>`
- Build/test: green
- Verification: promoted phrase is present in generated `dist`
- Live guardrail: auth challenge confirmed on protected routes

## Failure notes
- If the model/agent cannot inspect an image to extract evidence, do not infer unseen facts in this lane.
- If deploy command succeeds but routes do not show expected auth posture, pause and fix auth/gate contract before declaring publication complete.
