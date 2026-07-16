---
visibility: public
tags: [meta]
seeded-from: alexpedia, 2026-07-16, sanitized
---

# meta — what this is

A personal knowledge graph. Human- and LLM-parseable. You talk, Claude writes nodes, the graph compounds. It's built on the pattern Andrej Karpathy sketched for LLM-maintained wikis ([the gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)) — the lineage runs through {Alex}'s alexpedia, whose `karpathy-llm-wiki` node works out the divergences this kit inherits.

## The core idea (Karpathy's)
Most people use LLMs over documents like RAG: upload, retrieve chunks, answer, forget. The alternative is a **persistent, compounding wiki** — the LLM reads new material and *integrates* it: updates entity pages, revises summaries, flags contradictions, strengthens cross-references. Knowledge compiles once and stays current. The tedious part of a knowledge base was never the thinking — it's the bookkeeping, and an LLM doesn't get bored maintaining fifteen cross-links in one pass.

## The key divergence — no index. The index is grep.
alexpedia's headline break from Karpathy's schema, carried into this kit: **there is no `index.md`. Fuck the index — the index is grep.** An append-only `_meta/log.md` plus the filesystem are the only catalog. Reasoning:

- Anything findable through an index is already findable through `grep` + `ls`.
- An index is a hand-maintained sync layer over two other canonical sources — the worst topology, drift guaranteed.
- Retrieval here is **diagnostic, not topical.** You don't browse "all the music pages"; you ask *when did this idea enter the wiki* or *what was I working on last week.* The log answers those structurally.
- Retiring the index converts maintenance into **use-as-audit**: if the log says `CREATED X` and `X` isn't in `nodes/`, the discrepancy *is* the alert.

The lint suite in `scripts/` enforces the rest — broken links, orphan pages, bare mentions that should be wikilinks, and missing tags. Run it from `scripts/` with `python -m lint.suite`.

## This wiki's own signature divergence — the captain's log
Where alexpedia keeps a strictly diagnostic log and nothing else, **this kit adds a narrative layer: the captain's log.** At the end of a session (or on command), Claude prompts you — "Captain's log — go ahead" — and you dictate freeform. The raw dictation is saved verbatim as the permanent record; a lightly-edited readable rendering sits beneath it; durable facts get extracted into nodes. The append-only log stays diagnostic and terse; the captain's log is where the story and the voice live. See `_meta/captains-log/README.md`. It's the front door for anyone who thinks out loud better than they type.

## Design principles
- Every page gets `[[wikilinks]]`; facts live on their canonical page, not repeated in prose.
- `{PageName}` = intentional nolink — the page exists but this mention isn't a reference (second mentions, titles). The lint suite ignores it.
- Stubs are fine — a placeholder beats a gap.
- The log is diagnostic, not narrative. The captain's log is where narrative goes.
- Capturing an idea always beats tidying. Capture first, lint later.
- Every page carries YAML frontmatter with a `visibility` tag; `_meta/` holds the log and tags — tooling, not graph nodes.

## See also
The seed nodes this kit shipped with: [[Alex]] · [[Andy]] · [[diamondlegendz|Diamond Legendz]] · [[financial-demonology|Financial Demonology]] · [[DemonRanchKit]] · [[accordion-tab-forge]] · [[the-compute-commune|the compute commune]]
