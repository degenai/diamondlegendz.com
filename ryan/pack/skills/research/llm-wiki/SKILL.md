---
name: llm-wiki
description: "Karpathy's LLM Wiki: build/query interlinked markdown KB."
version: 2.2.0
author: Hermes Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [wiki, knowledge-base, research, notes, markdown, rag-alternative]
    category: research
    related_skills: [obsidian, arxiv]
---

# Karpathy's LLM Wiki

Build and maintain a persistent, compounding knowledge base as interlinked markdown files.
Based on [Andrej Karpathy's LLM Wiki pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f).

Unlike traditional RAG (which rediscovers knowledge from scratch per query), the wiki
compiles knowledge once and keeps it current. Cross-references are already there.
Contradictions have already been flagged. Synthesis reflects everything ingested.

**Division of labor:** The human curates sources and directs analysis. The agent
summarizes, cross-references, files, and maintains consistency.

## When This Skill Activates

Use this skill when the user:
- Asks to create, build, or start a wiki or knowledge base
- Asks to ingest, add, or process a source into their wiki
- Asks a question and an existing wiki is present at the configured path
- Asks to lint, audit, or health-check their wiki
- References their wiki, knowledge base, or "notes" in a research context

## Wiki Location

**Alex's wiki lives at `C:\Users\alexa\.claude\wiki\`** — also a private git repo at `degenai/alexpedia`. This is the canonical location. The `WIKI_PATH` env var and `~/wiki` default do NOT apply here.

On Windows: `C:\Users\alexa\.claude\wiki\`
Terminal path: `/c/Users/<you>/.claude/wiki/`

`C:\Users\alexa\Desktop\Personal Wiki` is just a Claude Code workspace directory, NOT the wiki.

The wiki is a directory of markdown files — open it in Obsidian, VS Code, or any editor. No database, no special tooling required.

### Alex's Wiki Divergences from Karpathy (CRITICAL)

Alex's wiki intentionally diverges from the Karpathy 3-layer pattern. The sections below describing `SCHEMA.md`, `index.md`, `raw/`, `entities/`, `concepts/`, etc. are the **Karpathy reference** — Alex's wiki overrides them as follows:

| Karpathy Pattern | Alex's Wiki |
|---|---|
| `SCHEMA.md` conventions | Conventions in `~/.claude/CLAUDE.md` + `_meta/tags.md` |
| `index.md` catalog | **Retired 2026-05-26.** Log + filesystem are canonical. Retrieval is diagnostic-not-topical. |
| 3-layer: `raw/` `entities/` `concepts/` | Flat `nodes/` directory + `_meta/` for tooling |
| `raw/` for immutable sources | `nodes/assets/` for images; no `raw/` layer |
| Frontmatter: `title` `created` `updated` `type` `tags` `sources` | Frontmatter: `visibility` (private\|family\|public) + `aliases` + `tags` |
| Tags from SCHEMA.md taxonomy | Tags from `_meta/tags.md` schema (node type + relationship tags) |
| `[[wikilinks]]` required on every mention | First mention = `[[wikilinks]]`, second mentions = `{PageName}` (intentional nolink, stripped by lint) |
| Log: `## [YYYY-MM-DD] action \| subject` | Log: `ACTION PageName — note` (diagnostic, not narrative) |
| Index updated per page | No index to maintain — log entry suffices |
| Lint by agent | Lint by `cd wiki/scripts && python -m lint.suite` (protocol over subagent) |

**Orientation sequence (Alex's wiki):**
1. Read `~/.claude/CLAUDE.md` — conventions, key pages, always-on rules
2. Read `wiki/_meta/log.md` — recent activity (last 30-50 lines)
3. Read `wiki/_meta/tags.md` — tag schema
4. Search `wiki/nodes/` for the topic at hand before creating anything new

**Special protocols (Alex's wiki):**
- **wikidoc** — document the current thing in the wiki obsessively
- **wikipic** — save image to `wiki/nodes/assets/` with descriptive filename, embed in page
- **wikilint** — `cd wiki/scripts && python -m lint.suite` (runs unlinked/orphans/broken_links in ms)
- **Curious Betsy** — interview persona at `~/.claude/agents/curious-betsy.md` for Auto-Bio-Graph
- **Wiki-fed council roleplay** — when Alex asks Rudy/Zizek/RPC voices to "read the wiki," use `references/wiki-fed-council-roleplay.md`: orient to the wiki, read high-signal nodes, extract concrete phrases, write dialogue grounded in the graph, and optionally dispatch Claude-P as a sidecar voice.
- **AI chat export ingest** — ChatGPT/Claude exports are **layer-one reference archives, not wiki nodes**. Preserve raw ZIP/JSON untouched with hashes and manifests, normalize transcripts separately, then digest only durable claims into existing nodes. See `references/ai-chat-export-ingest.md`.
- **Artifact recovery from wiki context** — when Alex remembers a wiki concept but wants the newest HTML/PDF/image/deck/sheet, use the node as the semantic key, extract unique fingerprints, locate and version the external render, verify it locally, check deployment separately, and attach a verified copy if the public route is dead. See `references/artifact-recovery-from-wiki.md`.

**Git:** `git add . && git commit -m "message" && git push` from `C:\Users\alexa\.claude\wiki\`

## Architecture: Three Layers

```
wiki/
├── SCHEMA.md           # Conventions, structure rules, domain config
├── index.md            # Sectioned content catalog with one-line summaries
├── log.md              # Chronological action log (append-only, rotated yearly)
├── raw/                # Layer 1: Immutable source material
│   ├── articles/       # Web articles, clippings
│   ├── papers/         # PDFs, arxiv papers
│   ├── transcripts/    # Meeting notes, interviews
│   └── assets/         # Images, diagrams referenced by sources
├── entities/           # Layer 2: Entity pages (people, orgs, products, models)
├── concepts/           # Layer 2: Concept/topic pages
├── comparisons/        # Layer 2: Side-by-side analyses
└── queries/            # Layer 2: Filed query results worth keeping
```

**Layer 1 — Raw Sources:** Immutable. The agent reads but never modifies these.
**Layer 2 — The Wiki:** Agent-owned markdown files. Created, updated, and
cross-referenced by the agent.
**Layer 3 — The Schema:** `SCHEMA.md` defines structure, conventions, and tag taxonomy.

## Resuming an Existing Wiki (CRITICAL — do this every session)

When the user has an existing wiki, **always orient yourself before doing anything**:

**For Alex's wiki** (`C:\Users\alexa\.claude\wiki\`):
① **Read `~/.claude/CLAUDE.md`** — conventions, key pages, always-on rules
② **Read `wiki/_meta/log.md`** — recent activity (last 30-50 lines)
③ **Read `wiki/_meta/tags.md`** — tag schema
④ **Search `wiki/nodes/`** for the topic at hand before creating anything new

**For a Karpathy-pattern wiki** (any other wiki):
① **Read `SCHEMA.md`** — understand the domain, conventions, and tag taxonomy.
② **Read `index.md`** — learn what pages exist and their summaries.
③ **Scan recent `log.md`** — read the last 20-30 entries to understand recent activity.

```bash
# Alex's wiki
read_file "$HOME/.claude/CLAUDE.md"
read_file "$HOME/.claude/wiki/_meta/log.md" offset=<last 50 lines>

# Karpathy-pattern wiki
WIKI="${WIKI_PATH:-$HOME/wiki}"
read_file "$WIKI/SCHEMA.md"
read_file "$WIKI/index.md"
read_file "$WIKI/log.md" offset=<last 30 lines>
```

Only after orientation should you ingest, query, or lint. This prevents:
- Creating duplicate pages for entities that already exist
- Missing cross-references to existing content
- Contradicting the schema's conventions
- Repeating work already logged

For large wikis (100+ pages), also run a quick `search_files` for the topic
at hand before creating anything new.

## Initializing a New Wiki

When the user asks to create or start a wiki:

1. Determine the wiki path (from `$WIKI_PATH` env var, or ask the user; default `~/wiki`)
2. Create the directory structure above
3. Ask the user what domain the wiki covers — be specific
4. Write `SCHEMA.md` customized to the domain (see template below)
5. Write initial `index.md` with sectioned header
6. Write initial `log.md` with creation entry
7. Confirm the wiki is ready and suggest first sources to ingest

### SCHEMA.md Template

Adapt to the user's domain. The schema constrains agent behavior and ensures consistency:

```markdown
# Wiki Schema

## Domain
[What this wiki covers — e.g., "AI/ML research", "personal health", "startup intelligence"]

## Conventions
- File names: lowercase, hyphens, no spaces (e.g., `transformer-architecture.md`)
- Every wiki page starts with YAML frontmatter (see below)
- Use `[[wikilinks]]` to link between pages (minimum 2 outbound links per page)
- When updating a page, always bump the `updated` date
- Every new page must be added to `index.md` under the correct section
- Every action must be appended to `log.md`
- **Provenance markers:** On pages that synthesize 3+ sources, append `^[raw/articles/source-file.md]`
  at the end of paragraphs whose claims come from a specific source. This lets a reader trace each
  claim back without re-reading the whole raw file. Optional on single-source pages where the
  `sources:` frontmatter is enough.

## Frontmatter
  ```yaml
  ---
  title: Page Title
  created: YYYY-MM-DD
  updated: YYYY-MM-DD
  type: entity | concept | comparison | query | summary
  tags: [from taxonomy below]
  sources: [raw/articles/source-name.md]
  # Optional quality signals:
  confidence: high | medium | low        # how well-supported the claims are
  contested: true                        # set when the page has unresolved contradictions
  contradictions: [other-page-slug]      # pages this one conflicts with
  ---
  ```

`confidence` and `contested` are optional but recommended for opinion-heavy or fast-moving
topics. Lint surfaces `contested: true` and `confidence: low` pages for review so weak claims
don't silently harden into accepted wiki fact.

### raw/ Frontmatter

Raw sources ALSO get a small frontmatter block so re-ingests can detect drift:

```yaml
---
source_url: https://example.com/article   # original URL, if applicable
ingested: YYYY-MM-DD
sha256: <hex digest of the raw content below the frontmatter>
---
```

The `sha256:` lets a future re-ingest of the same URL skip processing when content is unchanged,
and flag drift when it has changed. Compute over the body only (everything after the closing
`---`), not the frontmatter itself.

## Tag Taxonomy
[Define 10-20 top-level tags for the domain. Add new tags here BEFORE using them.]

Example for AI/ML:
- Models: model, architecture, benchmark, training
- People/Orgs: person, company, lab, open-source
- Techniques: optimization, fine-tuning, inference, alignment, data
- Meta: comparison, timeline, controversy, prediction

Rule: every tag on a page must appear in this taxonomy. If a new tag is needed,
add it here first, then use it. This prevents tag sprawl.

## Page Thresholds
- **Create a page** when an entity/concept appears in 2+ sources OR is central to one source
- **Add to existing page** when a source mentions something already covered
- **DON'T create a page** for passing mentions, minor details, or things outside the domain
- **Split a page** when it exceeds ~200 lines — break into sub-topics with cross-links
- **Archive a page** when its content is fully superseded — move to `_archive/`, remove from index

## Entity Pages
One page per notable entity. Include:
- Overview / what it is
- Key facts and dates
- Relationships to other entities ([[wikilinks]])
- Source references

## Concept Pages
One page per concept or topic. Include:
- Definition / explanation
- Current state of knowledge
- Open questions or debates
- Related concepts ([[wikilinks]])

## Comparison Pages
Side-by-side analyses. Include:
- What is being compared and why
- Dimensions of comparison (table format preferred)
- Verdict or synthesis
- Sources

## Update Policy
When new information conflicts with existing content:
1. Check the dates — newer sources generally supersede older ones
2. If genuinely contradictory, note both positions with dates and sources
3. Mark the contradiction in frontmatter: `contradictions: [page-name]`
4. Flag for user review in the lint report
```

### index.md Template

The index is sectioned by type. Each entry is one line: wikilink + summary.

```markdown
# Wiki Index

> Content catalog. Every wiki page listed under its type with a one-line summary.
> Read this first to find relevant pages for any query.
> Last updated: YYYY-MM-DD | Total pages: N

## Entities
<!-- Alphabetical within section -->

## Concepts

## Comparisons

## Queries
```

**Scaling rule:** When any section exceeds 50 entries, split it into sub-sections
by first letter or sub-domain. When the index exceeds 200 entries total, create
a `_meta/topic-map.md` that groups pages by theme for faster navigation.

### log.md Template

```markdown
# Wiki Log

> Chronological record of all wiki actions. Append-only.
> Format: `## [YYYY-MM-DD] action | subject`
> Actions: ingest, update, query, lint, create, archive, delete
> When this file exceeds 500 entries, rotate: rename to log-YYYY.md, start fresh.

## [YYYY-MM-DD] create | Wiki initialized
- Domain: [domain]
- Structure created with SCHEMA.md, index.md, log.md
```

## Core Operations

### 1. Ingest

When the user provides a source (URL, file, paste), integrate it into the wiki:

① **Capture the raw source:**
   - URL → use `web_extract` to get markdown, save to `raw/articles/`
   - PDF → use `web_extract` (handles PDFs), save to `raw/papers/`
   - Pasted text → save to appropriate `raw/` subdirectory
   - Name the file descriptively: `raw/articles/karpathy-llm-wiki-2026.md`
   - **Add raw frontmatter** (`source_url`, `ingested`, `sha256` of the body).
     On re-ingest of the same URL: recompute the sha256, compare to the stored value —
     skip if identical, flag drift and update if different. This is cheap enough to
     do on every re-ingest and catches silent source changes.

② **Discuss takeaways** with the user — what's interesting, what matters for
   the domain. (Skip this in automated/cron contexts — proceed directly.)

③ **Check what already exists** — search index.md and use `search_files` to find
   existing pages for mentioned entities/concepts. This is the difference between
   a growing wiki and a pile of duplicates.

④ **Write or update wiki pages:**
   - **New entities/concepts:** Create pages only if they meet the Page Thresholds
     in SCHEMA.md (2+ source mentions, or central to one source)
   - **Existing pages:** Add new information, update facts, bump `updated` date.
     When new info contradicts existing content, follow the Update Policy.
   - **Cross-reference:** Every new or updated page must link to at least 2 other
     pages via `[[wikilinks]]`. Check that existing pages link back.
   - **Tags:** Only use tags from the taxonomy in SCHEMA.md
   - **Provenance:** On pages synthesizing 3+ sources, append `^[raw/articles/source.md]`
     markers to paragraphs whose claims trace to a specific source.
   - **Confidence:** For opinion-heavy, fast-moving, or single-source claims, set
     `confidence: medium` or `low` in frontmatter. Don't mark `high` unless the
     claim is well-supported across multiple sources.

⑤ **Update navigation:**
   - Add new pages to `index.md` under the correct section, alphabetically
   - Update the "Total pages" count and "Last updated" date in index header
   - Append to `log.md`: `## [YYYY-MM-DD] ingest | Source Title`
   - List every file created or updated in the log entry

⑥ **Report what changed** — list every file created or updated to the user.

A single source can trigger updates across 5-15 wiki pages. This is normal
and desired — it's the compounding effect.

### 2. Query

When the user asks a question about the wiki's domain:

**For Alex's wiki** (no index.md):
① **Read `~/.claude/CLAUDE.md`** for key page pointers (Alex.md, projects.md, ai-philosophy.md, etc.)
② **`search_files`** across `nodes/` for key terms — log + filesystem are the catalog
③ **Read the relevant pages** using `read_file`.
④ **Synthesize an answer** from the compiled knowledge. Cite the wiki pages
   you drew from: "Based on [[page-a]] and [[page-b]]..."
⑤ **File valuable answers back** — create a page in `nodes/` if the synthesis is substantial.
   Don't file trivial lookups.
⑥ **Append to `_meta/log.md`**: `ACTION PageName — note` (diagnostic format)

**For a Karpathy-pattern wiki** (with index.md):
① **Read `index.md`** to identify relevant pages.
② **For wikis with 100+ pages**, also `search_files` across all `.md` files
   for key terms — the index alone may miss relevant content.
③ **Read the relevant pages** using `read_file`.
④ **Synthesize an answer** from the compiled knowledge. Cite the wiki pages
   you drew from: "Based on [[page-a]] and [[page-b]]..."
⑤ **File valuable answers back** — if the answer is a substantial comparison,
   deep dive, or novel synthesis, create a page in `queries/` or `comparisons/`.
   Don't file trivial lookups — only answers that would be painful to re-derive.
⑥ **Update log.md** with the query and whether it was filed.

### 3. Lint

**For Alex's wiki:** Use the existing lint suite — do NOT reinvent or run agent-based lint.
```bash
cd /c/Users/<you>/.claude/wiki/scripts && python -m lint.suite
```
Flags: `--only <check>` (unlinked, orphans, broken_links), `--skip <check>`.
`index_gaps` check was retired with index.md (2026-05-26).
Full docs in [[scripts]].

**For a Karpathy-pattern wiki:** Run agent-based lint as follows:

① **Orphan pages:** Find pages with no inbound `[[wikilinks]]` from other pages.
```python
# Use execute_code for this — programmatic scan across all wiki pages
import os, re
from collections import defaultdict
wiki = "<WIKI_PATH>"
# Scan all .md files in entities/, concepts/, comparisons/, queries/
# Extract all [[wikilinks]] — build inbound link map
# Pages with zero inbound links are orphans
```

② **Broken wikilinks:** Find `[[links]]` that point to pages that don't exist.

③ **Index completeness:** Every wiki page should appear in `index.md`. Compare
   the filesystem against index entries.

④ **Frontmatter validation:** Every wiki page must have all required fields
   (title, created, updated, type, tags, sources). Tags must be in the taxonomy.

⑤ **Stale content:** Pages whose `updated` date is >90 days older than the most
   recent source that mentions the same entities.

⑥ **Contradictions:** Pages on the same topic with conflicting claims. Look for
   pages that share tags/entities but state different facts. Surface all pages
   with `contested: true` or `contradictions:` frontmatter for user review.

⑦ **Quality signals:** List pages with `confidence: low` and any page that cites
   only a single source but has no confidence field set — these are candidates
   for either finding corroboration or demoting to `confidence: medium`.

⑧ **Source drift:** For each file in `raw/` with a `sha256:` frontmatter, recompute
   the hash and flag mismatches. Mismatches indicate the raw file was edited
   (shouldn't happen — raw/ is immutable) or ingested from a URL that has since
   changed. Not a hard error, but worth reporting.

⑨ **Page size:** Flag pages over 200 lines — candidates for splitting.

⑩ **Tag audit:** List all tags in use, flag any not in the SCHEMA.md taxonomy.

⑪ **Log rotation:** If log.md exceeds 500 entries, rotate it.

⑫ **Report findings** with specific file paths and suggested actions, grouped by
   severity (broken links > orphans > source drift > contested pages > stale content > style issues).

⑬ **Append to log.md:** `## [YYYY-MM-DD] lint | N issues found`

## Working with the Wiki

### Searching

```bash
# Alex's wiki
WIKI="/c/Users/<you>/.claude/wiki"

# Find pages by content
search_files "transformer" path="$WIKI/nodes" file_glob="*.md"

# Find pages by filename
search_files "*.md" target="files" path="$WIKI/nodes"

# Find pages by tag
search_files "tags:.*alignment" path="$WIKI/nodes" file_glob="*.md"

# Recent activity
read_file "$WIKI/_meta/log.md" offset=<last 50 lines>
```

For a Karpathy-pattern wiki, use `$WIKI` (default `~/wiki`) and search across `entities/`, `concepts/`, `comparisons/`, `queries/` subdirectories.

### Bulk Ingest

When ingesting multiple sources at once, batch the updates:
1. Read all sources first
2. Identify all entities and concepts across all sources
3. Check existing pages for all of them (one search pass, not N)
4. Create/update pages in one pass (avoids redundant updates)
5. Update index.md once at the end
6. Write a single log entry covering the batch

### Archiving

When content is fully superseded or the domain scope changes:
1. Create `_archive/` directory if it doesn't exist
2. Move the page to `_archive/` with its original path (e.g., `_archive/entities/old-page.md`)
3. Remove from `index.md`
4. Update any pages that linked to it — replace wikilink with plain text + "(archived)"
5. Log the archive action

### Obsidian Integration

**Alex's wiki:** Obsidian already sits on top of `C:\Users\alexa\.claude\wiki\` as a visual IDE. The vault is the wiki directory. Obsidian-specific conventions: `[[wikilinks]]` render as clickable links, Graph View visualizes the network, YAML frontmatter powers Dataview queries, `nodes/assets/` holds images referenced via `![[image.png]]`.

**For a Karpathy-pattern wiki:**
- `[[wikilinks]]` render as clickable links
- Graph View visualizes the knowledge network
- YAML frontmatter powers Dataview queries
- The `raw/assets/` folder holds images referenced via `![[image.png]]`

For best results:
- Set Obsidian's attachment folder to `raw/assets/`
- Enable "Wikilinks" in Obsidian settings (usually on by default)
- Install Dataview plugin for queries like `TABLE tags FROM "entities" WHERE contains(tags, "company")`

If using the Obsidian skill alongside this one, set `OBSIDIAN_VAULT_PATH` to the
same directory as the wiki path.

### Obsidian Headless (servers and headless machines)

On machines without a display, use `obsidian-headless` instead of the desktop app.
It syncs vaults via Obsidian Sync without a GUI — perfect for agents running on
servers that write to the wiki while Obsidian desktop reads it on another device.

**Setup:**
```bash
# Requires Node.js 22+
npm install -g obsidian-headless

# Login (requires Obsidian account with Sync subscription)
ob login --email <email> --password '<password>'

# Create a remote vault for the wiki
ob sync-create-remote --name "LLM Wiki"

# Connect the wiki directory to the vault
cd ~/wiki
ob sync-setup --vault "<vault-id>"

# Initial sync
ob sync

# Continuous sync (foreground — use systemd for background)
ob sync --continuous
```

**Continuous background sync via systemd:**
```ini
# ~/.config/systemd/user/obsidian-wiki-sync.service
[Unit]
Description=Obsidian LLM Wiki Sync
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/path/to/ob sync --continuous
WorkingDirectory=/home/user/wiki
Restart=on-failure
RestartSec=10

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload
systemctl --user enable --now obsidian-wiki-sync
# Enable linger so sync survives logout:
sudo loginctl enable-linger $USER
```

This lets the agent write to `~/wiki` on a server while you browse the same
vault in Obsidian on your laptop/phone — changes appear within seconds.

## Pitfalls

**Alex's wiki specific:**
- **Wiki is at `C:\Users\alexa\.claude\wiki\`** — NOT `~/wiki`. `Desktop\Personal Wiki` is a workspace, not the wiki.
- **No index.md** — retired. Do NOT create one. Log + filesystem are the catalog.
- **No SCHEMA.md** — conventions are in `~/.claude/CLAUDE.md` and `_meta/tags.md`.
- **Log format is `ACTION PageName — note`** — diagnostic, not narrative. Not `## [date] action | subject`.
- **`{PageName}` = intentional nolink** — do NOT convert these to `[[wikilinks]]`.
- **Use existing scripts** for lint (`wiki/scripts/lint.suite`) rather than agent-based lint.
- **`visibility` frontmatter is required** (private|family|public) — not `title`/`created`/`updated`/`type`.
- **Tags from `_meta/tags.md`** — node type + relationship, not the Karpathy taxonomy.
- **Never modify files in `raw/`** — sources are immutable. Corrections go in wiki pages.
- **Always orient first** — read CLAUDE.md + log + tags before any operation.
- **Don't create pages for passing mentions** — follow the Page Thresholds. A name
  appearing once in a footnote doesn't warrant an entity page.
- **Don't create pages without cross-references** — isolated pages are invisible. Every page must
  link to at least 2 other pages.
- **Working folders are allowed and should stay boring.** AlexPedia can contain non-graph working inventories under folders like `content/` or `clinical/`; these are not wiki nodes, should not force node frontmatter/wikilinks, and should be documented from a graph node with a short pointer. For marketing/content labs, prefer plain operational names (`Content Lab`, `Draft Queue`, `Review Area`) over clever protocol names unless Alex explicitly likes the name. If Alex corrects a project/protocol name, rename it across README/rubric/queue/templates/log/pointer nodes, search for stale mentions, run the project validator if one exists, then run `wikilint` to ensure the pointer node did not introduce new bare-link issues.
- **When porting a working folder, split engine from brand.** For AlexPedia content labs, port deterministic mechanics (template, queue helper, analytics loop, privacy gates) directly when the source workflow already works, but rewrite brand/rubric guardrails for the destination project. Example: Elbow Room's Instagram lab can be straight-ported to People's Elbow at the engine layer, but the brand wall inverts because ER bans kayfabe while PE requires it. Validate both the local project helper (`python queue.py lint/rank/stats` where present) and `wiki/scripts && python -m lint.suite` before reporting success. See `references/content-lab-porting.md` for the reusable porting pattern and validation ladder.
- **Future-site intent docs belong beside the working folder until implementation.** When Alex says a workflow will later live on a secret/unlisted website area, capture intent in a local design doc without building it: who can review, what actions exist, what stays canonical, and security language (`unlisted` is not enough; use password protection at minimum, individual logins later if needed). Keep publication gated by Alex.
- **Frontmatter is required** — it enables search, filtering, and staleness detection.
- **Keep pages scannable** — a wiki page should be readable in 30 seconds. Split pages over
  200 lines. Move detailed analysis to dedicated deep-dive pages.
- **Ask before mass-updating** — if an ingest would touch 10+ existing pages, confirm
  the scope with the user first.
- **BBL-graph concepts are nolinks.** BBL-internal concepts (labor, rebellion, stewardship, Sorcery, Facets, DBZ character names like son-goku, pan, hercule, aether-rangers, Aether Foundation, etc.) belong to the BBL graph, not the personal wiki. When the lint suite flags them as broken wikilinks, convert `[[Concept]]` → `{Concept}` — do NOT create stub pages for them. This is the most common lint fix.
- **Handle contradictions explicitly** — don't silently overwrite. Note both claims with dates,
  mark in frontmatter, flag for user review.

**General pitfalls (Karpathy pattern):**
- **Always orient first** — read SCHEMA + index + recent log before any operation in a new session.
  Skipping this causes duplicates and missed cross-references.
- **Always update index.md and log.md** — skipping this makes the wiki degrade.
- **Tags must come from the taxonomy** — freeform tags decay into noise.
- **Rotate the log** — when log.md exceeds 500 entries, rename it `log-YYYY.md` and start fresh.

## Related Tools

[llm-wiki-compiler](https://github.com/atomicmemory/llm-wiki-compiler) is a Node.js CLI that
compiles sources into a concept wiki with the same Karpathy inspiration. It's Obsidian-compatible,
so users who want a scheduled/CLI-driven compile pipeline can point it at the same vault this
skill maintains. Trade-offs: it owns page generation (replaces the agent's judgment on page
creation) and is tuned for small corpora. Use this skill when you want agent-in-the-loop curation;
use llmwiki when you want batch compile of a source directory.
