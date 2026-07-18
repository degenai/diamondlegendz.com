---
visibility: internal
---

# Captain's Log — the protocol

The captain's log is this wiki's narrative layer. At the end of any substantive session — or any time you say **"captain's log"** — Claude prompts you (*"Captain's log — go ahead."*) and you dictate freeform; Claude then (a) saves your **raw verbatim** words, untouched, to `YYYY-MM-DD-nn.md` with tiny frontmatter (date, session context) as the permanent reference copy, (b) writes a **lightly-edited readable rendering** below it under a `## Readable` heading — fixing voice-to-text mangling and punctuation ONLY, keeping your voice, idioms, profanity, and digressions (never summarizing away personality), and (c) extracts any durable facts into wiki nodes with `[[links]]` and logs the extraction in `_meta/log.md` as `CAPTAINS-LOG YYYY-MM-DD-nn — extracted: X, Y`. These files live outside the graph — the lint suite doesn't scan them — because they're the story, not the node set.

## Example — `2026-07-16-01.md`

```markdown
---
date: 2026-07-16
context: first session after installing WikiKit
---

# Captain's Log 2026-07-16-01

alright captains log uh so we got the wiki thing installed today finaly, its
the thing alex has been on about. played some la chona on the panther after,
gcf is finaly clicking. tell claude to make a node for the friday commune run

## Readable

Alright, captain's log. So we got the wiki thing installed today, finally —
the thing Alex has been on about. Played some La Chona on the Panther after;
GCF is finally clicking. (Told Claude to make a node for the Friday commune
run.)
```

Then Claude appends to `_meta/log.md`:

```
CAPTAINS-LOG 2026-07-16-01 — extracted: Friday commune run node
```

The append-only log stays diagnostic and terse. The captain's log is where the voice lives.
