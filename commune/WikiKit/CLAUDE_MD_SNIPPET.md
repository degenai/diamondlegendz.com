# WikiKit — CLAUDE.md snippet

Paste everything in the fenced block below into your global `~/.claude/CLAUDE.md`. Fix the wiki path on the first line if you didn't use `~/.claude/wiki/`. This is what tells your Claude how to run the wiki.

---

```markdown
## My Wiki

My personal knowledge wiki lives at `~/.claude/wiki/`. It is a persistent, LLM-maintained knowledge graph — nodes in `nodes/`, tooling in `_meta/`. I talk, you write and maintain the nodes. When I tell you something durable about my world, add or update the relevant node; don't let it evaporate into chat history.

### Conventions (non-negotiable)
- **Wikilinks everywhere.** Every page links to related pages with `[[wikilinks]]`. Facts live on their canonical page — link to them, don't repeat them in prose. Use `[[target|display text]]` when the prose wants a different surface form.
- **`{PageName}` = intentional nolink.** The page exists, but this particular mention isn't a reference (a second mention on the same page, a title, a joke). Written as `{PageName}`, it renders literally and the lint suite ignores it. Convention: first mention on a page is a `[[link]]`, later mentions are `{nolink}`.
- **Every page gets YAML frontmatter** with a required `visibility` tag (`private` / `family` / `public` / `internal`) and `tags:`. See `_meta/tags.md`.
- **NO index file, ever.** The append-only `_meta/log.md` plus the filesystem ARE the catalog. Do not create an `index.md`. Retrieval is *diagnostic* — grep the log for **when** something entered the wiki, or `ls` the nodes — never a hand-maintained topical index. Fuck the index; the index is grep.
- **Append to the log after edits.** Every time you create/change nodes, append a line to `_meta/log.md` in the format `ACTION PageName — note` (e.g. `CREATED Blase Rhine — Endless Summer event host`). Diagnostic, not narrative — terse, mechanical, what-changed-and-when. Group entries under a `## YYYY-MM-DD (short context)` heading.
- **Lint before you consider a batch done.** Run `python -m lint.suite` from `~/.claude/wiki/scripts/`. It flags broken links, orphan pages, bare mentions that should be wikilinks, and missing tags. Flags: `--only <check>`, `--skip <check>`.
- **Back up with git.** From the wiki root, `git add . && git commit -m "..." && git push` after a working session.
- **Capturing an idea beats tidying.** If I'm mid-thought, capture the node first; lint and cross-link after.

### The Captain's Log Protocol
I prefer captain's-log narration, and I want to be **prompted**. At the end of any substantive session, or whenever I say **"captain's log"**, do this:

1. **Prompt me:** say exactly *"Captain's log — go ahead."* Then let me dictate freeform. Don't interrupt.
2. **Save the raw verbatim text, untouched,** to `_meta/captains-log/YYYY-MM-DD-nn.md` (nn = 01, 02… for multiple logs in a day), with tiny frontmatter (`date`, `context`). This is the permanent reference copy — do not clean it up.
3. **Below the raw text, add a `## Readable` heading** and render a **lightly-edited** version: fix voice-to-text mangling and punctuation ONLY. Keep my voice, idioms, profanity, and digressions. Never summarize away personality — this is not a summary, it's the same words made legible.
4. **Extract durable facts into wiki nodes** with `[[links]]`, same as any other session, and log the extraction in `_meta/log.md` as `CAPTAINS-LOG YYYY-MM-DD-nn — extracted: X, Y`.

The captain's log is the narrative layer — the story and the voice. The append-only log stays diagnostic. The two never merge. Full protocol and an example: `_meta/captains-log/README.md`.
```
