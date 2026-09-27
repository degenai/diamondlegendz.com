# Full Lint Round — worked procedure

Reusable end-to-end workflow for a "round of lint" on Alexpedia (`~/.claude/wiki`), learned from the 2026-08-07 round (108 → 16 issues). Goal: knock down broken links, orphans, and unlinked mentions without touching concurrent writers' files and without corrupting YAML.

## 0. Baseline + safety

```bash
cd /c/Users/alexa/.claude/wiki/scripts && python -m lint.suite   # full suite
git status --short | grep "^ M"    # build the concurrent-dirty file list
```

**Never edit concurrently-dirty files** (another agent/Obsidian owns them). Live example set: `Alex.md`, `Blase Rhine.md`, `EVGA machine.md`, `Rob Miller.md`, `Watchtower.md`, `financial-demonology.md`, `reminders.md`, `sarahandalexforever.md`, `.obsidian/workspace.json`, plus untracked new nodes like `Watchtower migration.md`. Batch fixers MUST take a DIRTY skip-set.

## 1. Broken wikilinks → stub vs nolink decision

For each `[[Target]]` that doesn't resolve, decide by entity nature:

- **Real-world entity worth a node** (former employer, business lead, school) → create a minimal stub node with frontmatter + See Also, verified against the source line's context before writing. Live examples: `Honeybee Salon` (3+ yrs employer), `Cancun Grill` (outreach lead), `Etowah High School`.
- **Model/tool name, not a wiki subject** (e.g. `Fable` = claude-fable-5) → `{Fable}` nolink, never a dead redlink.
- Check `nodes/` for alias coverage first (`grep -rn "Name" nodes/*.md`), and check the resolver is case-insensitive (build resolves case-insensitively but the LINT is case-sensitive — use the actual filename casing, e.g. `[[formspree]]` not `[[Formspree]]`).

## 2. Orphans → link into natural homes

For each orphan page, find its natural home by grepping which existing nodes discuss the entity, then add a See Also entry or inline link. Live homes:

- `Brian Beal` ← `Cherokee Center for Change` (horse-program volunteer hook)
- `Daves Sports Cards` ← `Massage Envy` (near the West Roswell workplace)
- `Jennifer Dattolo` ← `Hustle House Gym` (she's a member)
- `formspree` ← `integrations` (infra catalog)
- `July 2026 Logs` ← `devlogs` (mirror the `April 2026 Logs` pattern)

Acceptable intentional orphans: dated test artifacts referenced only from `_meta/log.md`, and untracked files owned by concurrent writers.

## 3. Unlinked mentions — the batch fixer

The lint flags only the **first bare mention per (page, target) pair**. Fixing one reveals the next (whack-a-mole) — run the fixer until the count stabilizes, or fix all mentions of a name in a file in one pass.

Classification rules (hard-won):

- **Genuine person/entity reference** → `[[wikilink]]` (Andy, Sarah, Morgan Stauffer, Janice, Oreo, Randy Hunter, Goin Social, Bulk Graph Bundler, Cancun Grill once its stub exists).
- **Descriptive place/brand mention** (address "Woodstock GA", "Massage Envy West Roswell", "Elbow Room massage", second mentions) → `{nolink}` braces.
- **NEVER wrap YAML frontmatter lines** (`tags:`/`aliases:` values are structured metadata, not prose). The lint used to scan frontmatter; it now skips it (`body_start` logic in `lint/unlinked.py`).
- **NEVER wrap URL/domain tokens** (`peoples-elbow.com`, `diamondlegendz.com`). Add them to `BLACKLIST` in `scripts/lint/__init__.py` with a reason instead.
- **Person-name traps**: a bare first name may refer to a DIFFERENT person than the matching node. Live examples: `Anna` in `Anna Stauffer.md` is Anna Stauffer herself — `Anna.md` is Anna *Brownlow*, so `{Anna}` nolink, NOT `[[Anna]]`. `Kevin's Rule` in `Big Ass Calendar` is a planning-system term — `Kevin.md` is the Colemans Bluff neighbor — `{Kevin}` nolink. Verify the identity before linking.

Fixer script pattern (cache-only, not committed): parse lint output lines `^  (.+\.md):(\d+) -- bare '([^']+)'`, skip DIRTY set, skip frontmatter lines, word-boundary + URL-guard the replacement, dry-run print OLD/NEW first, then apply. Re-run 2–3 times for whack-a-mole convergence.

## 4. Post-fix verification

```bash
# frontmatter integrity (braces must never leak into YAML)
python - <<'PY'
import re
from pathlib import Path
for p in Path("nodes").glob("*.md"):
    t = p.read_text(encoding="utf-8")
    if t.startswith("---"):
        fm = t[4:t.find("\n---", 4)]
        if re.search(r"\{[^}]+\}", fm):
            print("BRACE IN FRONTMATTER:", p.name)
PY
cd site && python build.py && python -m unittest test_build.py
python -m lint.suite   # expect: unlinked only in dirty files, orphans only intentional
```

Also: assert the build's redlink count dropped as expected (stubs resolve previously-dead links), and confirm zero secret tokens in household HTML if any secrets-adjacent pages were touched.

## 5. Commit scope

Stage ONLY the files this round touched — explicitly, never `git add -A` or `git add nodes/`:
- all edited clean nodes + new stub nodes + edited `devlogs/*` + `scripts/lint/__init__.py` + `scripts/lint/unlinked.py`
- verify with `git diff --cached --name-only | grep -E "concurrent-file"` → expect no matches
- commit with a stats summary in the message (before → after per check), push, then build+deploy from an isolated snapshot (see `clean-render-deploy-from-dirty-worktree.md`).

## 6. Log the round

Per wiki discipline, append a dated `_meta/log.md` entry (`LINTED`/`HARDENED`/`VERIFIED` lines) recording the delta and the version ID, then redeploy so Recent Changes shows it.
