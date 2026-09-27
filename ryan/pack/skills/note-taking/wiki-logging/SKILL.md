---
name: wiki-logging
description: "Maintain temporal logs and dockets that feed a durable personal wiki — check-in, capture, promote, fix-discipline."
version: 1.8.16
author: agent
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [wiki, logging, journaling, note-taking, memory]
---

# Wiki-Logging

> **Alexpedia validation note (2026-08-06):** discover and run the repository's current entrypoints from the working directory they expect. For the present checkout, either run `cd <wiki-root>/scripts && python -m lint.suite` or, from the repository root, `python -m scripts.lint.suite`. Validate the renderer from `<wiki-root>/site` with `python build.py` and `python -m unittest test_build.py`; from the repository root, `python site/test_build.py` is the equivalent direct-file invocation. The root-level module form `python -m unittest site.test_build` resolves Python's standard-library `site` module rather than the repository directory. If another target repository contains additional linters or tests, run the discovered real paths in addition.

A disciplined pattern for maintaining a temporal workspace (log + docket) that feeds a durable personal wiki. The separation: **if it has a date, it starts in the log/docket; if it's a standing truth, it ends up in the wiki.**

## Meta: The User's Preference

Alex wants **fanatical wiki-logging**: durable facts should reliably leave transcript context and reach the right lasting surface. Capture is generous; promotion is audience-scoped. Dated events and ideas enter the temporal log, while confirmed standing truths enter the private family graph. The fix-discipline (correcting every durable and operational surface where a fact lives) fires immediately on any factual or routing correction.

### Alexpedia audience and publication boundary

Alexpedia is Alex's private family archive. Its renderer, source graph, media, and generated surfaces remain inside the authenticated household/medical audience model.

**Layered visibility model (corrected 2026-08-07 — Alex's authoritative read):** visibility is a lattice of audience layers, not a binary. The build matrix in `site/build.py`:

- **Household view (Alexpedia, current):** `public` + `family` + `private` + `internal` all render. **`medical` is the ONLY audience hidden from this view.**
- **Adamczykpedia view (next layer):** `--visibility public family` — hides `internal` AND `medical`. This is the family-facing layer.
- **Auto-Bio-Graph (stretch):** public product layer.

`internal` pages (tooling, devlogs, credential registries, intake artifacts) are household-visible — an internal log entry like `UPDATED [[Demon Ranch]]` MUST render on Recent Changes. If a section's entries vanish, do not assume internal is meant to be hidden; the model says internal shows.

**Credential redaction:** internal pages that hold secrets (`api-keys.md`, `google-cloud-credentials.md`, tagged `secrets`) render to household but with the actual credential values scrubbed at build time. `site/build.py` keeps a `REDACT_SECRETS` tuple of exact tokens (login passwords, OAuth client secrets) and `redact_secrets()` applies it in `Page.plain_text` (search index) and `page_shell` (every generated HTML surface, including Recent Changes/log rows). When adding or rotating a credential that appears in a wiki node, extend `REDACT_SECRETS`; a rendered `«redacted»` marker is the proof it worked. Assert zero leaks in built household HTML before deploy.

Run this routing gate before every write:

1. **“Wiki log,” “log this,” and idea capture** → add a dated entry to `_meta/log.md` by default. The receipt may point to an explicitly named external project; it remains a temporal receipt rather than a standalone node, media archive, backlink, Recent Changes article, or search entry.
2. **Durable personal/family canon** → create or update an Alexpedia node when the fact belongs in the private family graph beyond the current event.
3. **Public standalone content** → work exclusively in an explicitly named public repository or destination, such as `degenai/thisisez`.
4. **Ambiguous audience** → preserve the dated private log receipt and leave publication routing open until Alex names the destination.

Authentication and `noindex` are defense-in-depth for the private archive. Publication authorization comes from Alex naming the public destination. Search opportunity, shareability, and renderer capability are topic signals rather than promotion signals.

Before promotion, verify all three gates:
- **Audience:** private family canon or explicitly named public destination?
- **Artifact:** temporal receipt or durable standalone object?
- **Repository:** does the target repository's declared purpose match that audience?

A routing correction closes the full projection: remove the accidental node and private media, remove backlinks/index references, retain the intended dated log receipt, rebuild locally, and verify that the generated Alexpedia surface contains only the receipt.

### Repository configuration and publication proof

Use `.cursorrules` for Alexpedia repository-level agent policy. The renderer treats root-level Markdown as candidate wiki content, while `.cursorrules` supplies supported project context without becoming an article. Every policy-file change gets a clean build assertion that the configuration has no generated HTML/search/category projection.

When private source evidence becomes a public derivative, create a new sanitized artifact in the explicitly public repository: crop owner chrome, use opaque identity masks, strip metadata and embedded thumbnails, enforce an exact asset allowlist, and scan all shipped text for private paths/identifiers. Publication completes only after strict hostname-validating HTTPS succeeds on the canonical domain; CI success or an insecure diagnostic fetch proves upload, not safe public reachability.

Detailed correction, screenshot-sanitization, clean-deploy, and GitHub Pages TLS workflow: `references/private-archive-public-artifact-routing.md`.

### Proactive closure after durable conversation

Alex expects durable business decisions, rates, operating triggers, relationship developments, and confirmed corrections to reach the wiki **without a follow-up “wiki log this” prompt**. Commentary that recognizes durable value is the trigger for the maintenance lane, not the completion state.

Before closing a substantive conversation, run this quick gate:

- Did a person enter Alex's recurring orbit or change roles?
- Did a price, capacity rule, phase boundary, schedule, or operating doctrine settle?
- Did direct evidence correct an existing fact?
- Did the exchange create a real follow-up, launch gate, or relationship commitment?

A “yes” completes through the relevant canonical node, temporal log, docket/reminder when actionable, diagnostic `_meta/log.md`, exact-file commit/push, and Alexpedia refresh. For voice-led or time-sensitive work, preserve the existing brief-first sequencing, then execute this durable lane in the next available turn. The user-facing receipt reports what was persisted; it does not ask Alex to remember to request persistence.

The wiki is an **Obsidian vault** — nodes use `[[wikilinks]]`, tags, aliases, and YAML frontmatter (`visibility`, `tags`, `aliases`). The canonical path is `C:\Users\alexa\.claude\wiki\` (the alexpedia repo, `degenai/alexpedia`). When creating a new node, follow the existing Obsidian conventions: frontmatter, wikilinks to related nodes, concise declarative body.

## When to Load This Skill

Load when:
- Operating inside a workspace that has a `log.md` + `docket.md` that feed a wiki
- User asks you to "capture this," "log that," or "put this in the wiki"
- User asks you to audit recent sessions or Telegram history for durable material that may not have reached the wiki
- After a session check-in — logging what was discussed, updating the docket, promoting durable facts
- User corrects a fact or framing — the fix-discipline applies

## Live delivery before maintenance

For time-sensitive meetings, active negotiations, rapid voice-transcribed questions, and other live decision support, the user-facing handoff leads and the durable pipeline follows.

1. Give the compact usable answer as soon as the supplied facts support it. Label a provisional read when live lookup is still needed.
2. Use one concise progress note for a research pass, then return with the decision, language, or next move.
3. Complete full log/docket reads, append-only verification, wiki promotion, and artifact maintenance after the user has the live answer.
4. Batch successive corrections from the same briefing into a later durable-write pass when that preserves responsiveness.
5. When Alex asks whether work stalled, answer the status plainly and restate the current bottom line immediately.
6. Preserve all existing read-before-write, fix-discipline, verification, and backup requirements inside the later maintenance lane.

The operating order for urgent work is: **brief first → maintenance second → compact receipt**.

## The Pipeline

```
Check-in (read state) → Log (temporal record) → Docket (forward-looking) → Wiki (durable facts)
```

### 1. Check-in (session start)
Read `log.md` (last 1-2 entries), `docket.md`, and relevant wiki nodes. Ask what happened and what's coming. Capture answers.

### 2. Log (append-only, temporal)
Dated entries in the MCU `log.md`. Diagnostic-not-narrative. "What did the user do / how did the ball move." Mirror the existing style. Newest MCU entries stay at the bottom.

**Alexpedia `_meta/log.md` has the opposite ordering:** newest dated sections go immediately below `# Log`. Insert the new audit/promotion block at the top of that chronology rather than appending it to the file tail. Read back the heading, inserted block, and following entry so mixed ordering does not accumulate.

**Receipt format and provenance (Alex, 2026-09-02):** every receipt carries its source — cite the Hermes conversation/session or the visible evidence (screenshot, message thread, tool output) the fact came from; provenance beats yapping. Format: one dated `## YYYY-MM-DD (Topic)` section per event, each line a `VERB [[Target]] — note` action row (the Recent Changes parser accepts both `- VERB ...` bulleted and bare forms as of the 2026-09-02 bullet-tolerant parser fix). Backfilled entries use the EVENT's date as the section date, not the logging date, and say where the record comes from. **Never append bare dateless entries** — unbulleted dateless lines fall into the parser's prose branch and get attributed to whatever dated section sits above them (live miss: megaprime receipts rendered under the wrong date until restructured into their own `## 2026-09-02 (…)` section).

**Grief pauses are legitimate; backfill is offered, never self-started.** A multi-week gap in the log cadence can be exactly that (Aug 19–29 2026, after Oreo died: Alex said don't push it, and the pause took the whole wiki's heartbeat with it). The log is append-only — a gap is a gap, not lost data. When logging resumes after a pause: verify the gap is empty-not-corrupted (date cadence grep), name the gap plainly without dressing it up, and offer (once) to mine session history for backfill receipts. Backfill only on explicit request — do not nag, do not touch memorial nodes (Oreo's node stays untouched unless Alex reopens it).

**"Captain's Log" = wiki log (2026-09-18):** when Alex opens a voice memo with "Captain's Log" (typically dictating while driving to a job), he means a dated `_meta/log.md` receipt — "Captain's Log means wiki log. It's not verbatim, but ingest the context." Treat it as context ingestion, not transcription: structure the rambling dictation into action rows (WORKED / CONTEXT / DECLARED / PLANNED), while preserving his load-bearing phrases verbatim (e.g. the "I'm like a bartender" line to a client, "I felt like a labor organizer… I need a structure") and clinically useful specifics (session structure, pressure-caution notes for next visit). Clinical identities and encounter details belong in private client `.txt` records; shared log receipts identify the clinical collection and source session only. Link only real, audience-appropriate nonclinical nodes. Same-day follow-on declarations grow the SAME dated section (add a `DECLARED` line) rather than opening a duplicate section for the same event stream, and durable takeaways (docket items, standing intentions) also land on the appropriate docket in the same pass.

### 3. Docket (forward-looking)
Current arcs, near-term todos, open questions, leads. When items close, they graduate to `log.md`. When durable facts emerge, they promote to the wiki. Keep the docket current — advance/close/add items every check-in.

### 4. Wiki Promotion (durable)
When a standing truth emerges — a new venue, a recurring commitment, a person, a rate, a settled decision — promote it into the wiki:
- Create or update the relevant wiki node
- Insert a newest-first dated section immediately below `# Log` in `_meta/log.md`, with one diagnostic `CREATED`/`UPDATED` line per action
- Keep wiki entries compact and declarative

#### Audience-layer promotion

Treat Alexpedia visibility as an **audience and promotion lattice**, not a binary synonym for worldwide publication. A private personal node may promote selected facts or images upward into a family layer, collaborator layer, or other group-facing tier while the underlying personal evidence remains private. Before changing `visibility` or moving material upward, identify the intended audience, keep source evidence at its narrowest useful tier, and promote only the derivative facts or images appropriate to the next layer. Renderer authentication and discoverability are separate controls from the node's semantic promotion tier; verify both before describing material as publicly available.

#### Cross-instance private evidence capture

When Alex says to log something privately so another Hermes surface or agent instance can retrieve it, optimize for **shared source clarity**, not transcript storage.

1. Create or update a `visibility: private` node with a searchable class-level title; link it from the relevant person, venue, business, or project node.
2. Start with a **Source status** section that distinguishes what the user actually supplied from missing proof, attachments, declarations, signatures, dates, or external confirmation.
3. Summarize the operationally relevant clauses or facts rather than mirroring a long pasted document. Keep exact language only when it controls a decision.
4. Separate **evidence**, **interpretation**, and **next-action checklist**. Label professional or legal seams for carrier, attorney, accountant, or other authoritative confirmation instead of canonizing an agent opinion.
5. Update `nodes/reminders.md` plus the active MCU log/docket when the evidence creates a live task or launch gate. Another agent should be able to retrieve both the durable facts and the next move.
6. Run wikilint, fix only findings introduced by the touched files, commit/push only intended wiki paths, and leave concurrent Obsidian workspace state unstaged.
7. In the receipt, name the private nodes and operational surfaces updated so the next instance has explicit retrieval handles.

#### Sensitive generated-media evidence nodes

When Alex asks to preserve a provocative or reputationally sensitive synthetic-media chain, archive it as evidence rather than converting it into household-facing commentary.

1. Load the `generative-ai-output-audit` skill and reconstruct the full prompt/edit chain before writing. Prefer one class-level umbrella node for a coherent test sequence over one node per image turn.
2. Use `visibility: private` for raw prompts, inflammatory outputs, public-figure or sacred-figure juxtapositions, tragedy imagery, and forensic manifests. Start with **Source status**: provider surface, model/version when visible, UI-proven prompts, user-reported stages, visually observed stages, and missing evidence.
3. Copy untouched prompt screenshots and outputs into `nodes/assets/` with descriptive dated filenames. Record byte sizes and SHA-256 hashes when integrity matters; embed each artifact beside the stage it proves.
4. Separate visible facts, provenance, interpretation, reputational risk, and policy/legal status. Preserve exact prompt text only where the screenshot supports it. A missing final edit prompt remains missing even when the visual delta is clear.
5. Keep the diagnostic receipt in internal `_meta/log.md`. A narrow-audience node may link outward to broader conceptual pages, but do not add a household-visible backlink or sensitive summary merely to satisfy graph neatness. Private/internal classes may be intentionally exempt from orphan pressure.
6. Read `.cursorrules` before backup, verify the remote's actual visibility, run renderer tests/builds that enforce the audience boundary, and inspect the generated redlink/projection report.
7. In a dirty shared worktree, stage the node and exact assets directly, stage only the owned `_meta/log.md` hunk, and inspect both `git diff --cached` and the remaining unstaged diff. Push only after the cached packet is clean, then verify local and remote heads are synchronized.

Worked evidence layout and scoped-push procedure: `references/sensitive-generated-media-evidence-capture.md`.

#### Software backlog capture from business and operating conversations

When a meeting or live business conversation surfaces software work, treat the engineering backlog as a durable operating artifact rather than leaving it in transcript context.

1. Classify each statement before promotion: **current shipped state**, **requested bounded work**, **discovery hypothesis**, or **interface/access still to verify**.
2. Create or update one private, class-level operations node under the owning project. Use `Source status`, `Active backlog`, `Governance`, and `See also` so another instance can recover both evidence and execution state quickly.
3. Split the backlog into named work lanes with observable acceptance criteria—for example, a conversion-state correction, a bounded external audit, and a system-discovery lane. Record implementation ownership separately from the audit or advisory contribution.
4. Apply fix-discipline to stale current-state claims in the canonical project/person nodes and active docket. A newly enabled production feature advances the old blocker into the remaining copy, integration, regression, or deployment work.
5. Promote each layer to its proper surface: standing facts to canonical nodes, executable work to `nodes/reminders.md` and the MCU docket, the meeting outcome to the MCU log, and diagnostic promotion lines to `_meta/log.md`.
6. For systems shared by multiple businesses or practices, record the positive boundaries explicitly: each party retains its own records, consent state, branding, booking links, account ownership, export rights, and lawful operating authority; shared code and channel adapters have named governance and cost ownership.
7. Keep private implementation and client-data plans in private nodes. Public business nodes carry publishable operating truth.
8. Read back the touched blocks, run wikilint, stage exact wiki paths, commit/push, rebuild/deploy Alexpedia, and preserve unrelated concurrent workspace state.

Reusable structure and promotion matrix: `references/business-meeting-software-backlog-capture.md`.

#### High-volume Telegram image intake and GitHub-backupable storage

When Alex sends batches of photographs or screenshots through Telegram, treat the work as evidence intake, archive design, visual census, and selective semantic promotion. The default architecture is a stable private original archive plus a compact Git retrieval index and a deliberately small set of repository derivatives.

1. Establish the batch boundary from the source Telegram messages and attachment paths before using cache timestamps. Record message/session attribution and reconcile any independent manifests by filename plus SHA-256.
2. Copy originals into a stable Tier 1 archive, create a portable recovery bundle, and verify count, total bytes, and checksums. Preserve application-cache copies until the durable archive is verified.
3. Freeze the preservation manifest with the recovery bundle: source filename, source message/session, receive/import date, dimensions, byte size, SHA-256, and archive locator remain an immutable receipt for the ZIP. Maintain related wiki nodes, clarification state, selected derivatives, and remote locator in a separate mutable enrichment ledger. After each clarification round, recompute and report the enrichment-ledger hash; the original/ZIP receipt stays tied to the exact bundled bytes.
4. Use SHA-256 for exact duplicates and perceptual hashes for resized/recompressed or burst-photo candidates. Compare the intake against existing tracked wiki assets as well as against itself.
5. Generate numbered contact sheets and inspect every image in bounded batches. Group clarification questions by recurring face, animal, room, or event so one answer labels many files. Persist a working queue with `pending → answered → integrated` status, then present one numbered sheet and no more than three high-leverage grouped questions per conversational round. A static question list is intake scaffolding, not yet an active queue. After Alex answers, update every affected manifest row and canonical node, select any representative derivatives, log/lint/commit/push, rebuild/deploy Alexpedia, and only then advance the next batch. Unresolved identities remain questions rather than canon. When Alex pauses the exercise, mark the queue `paused` with the exact contact-sheet and next-image anchor, stop the interrogation immediately, and preserve every integrated round as closed work so resumption starts at the anchor rather than replaying earlier questions.
6. Select the minimum representative derivative set that materially proves a person, place, event, or project claim. Measure every encoded output and visually verify text/scene legibility; a nominally efficient format is accepted only when the actual file is smaller and useful.
7. Check OAuth scopes before remote offload. Prepare and checksum the local archive first, obtain explicit approval for scope refresh/folder creation/upload, then read back remote metadata and record the verified locator.
8. Search current history for parallel intake work before creating a node. Merge duplicate nodes/manifests into one canonical record, union unique evidence, explain count differences through set/hash reconciliation, repoint links, correct the diagnostic log, and remove only the fully absorbed duplicate.
9. Stage only intended wiki paths. When `_meta/log.md` contains another writer's unstaged hunk, stage the intended log hunk separately and inspect the cached diff before commit.
10. Run Wikilint, verify staged file sizes/list, push, and confirm the remote branch. The resulting clone remains a usable backup of the graph while the external archive preserves full-resolution evidence.

Detailed worked procedure: `references/high-volume-telegram-photo-intake.md`.

For local PDFs, certificates, scans, and other source artifacts, follow `references/local-document-evidence-promotion.md` for direct-source inspection, text-plus-visual verification, privacy-preserving provenance, and evidence-state transitions.

#### Full lint round (sweep the whole wiki)

When Alex asks for "a round of lint" (or the wiki has accumulated broken links, orphans, and bare mentions), treat it as a **full-suite sweep with a delta contract**, not a per-file awareness pass. Run `cd <wiki-root>/scripts && python -m lint.suite`, then fix in priority order: broken wikilinks → orphans → unlinked mentions.

1. **Broken wikilinks (5 → 0 in the 2026-08-07 round):** decide per target — real-world entity worth a node → minimal verified stub (`Honeybee Salon`, `Cancun Grill`, `Etowah High School`); model/tool name → `{nolink}` (`Fable`); never leave a dead redlink.
2. **Orphans (7 → 2 intentional):** link each into its natural home (grep which existing nodes discuss the entity; see `Brian Beal` ← Cherokee, `formspree` ← integrations, `July 2026 Logs` ← devlogs). Dated test artifacts and concurrent writers' untracked files are acceptable intentional orphans.
3. **Unlinked mentions (96 → 14):** the lint flags only the FIRST bare mention per (page, target) — fixing one reveals the next, so batch-fix with a script and re-run until stable. Classify per mention: genuine person/entity → `[[wikilink]]`; descriptive place/brand/address → `{nolink}`. **Never wrap YAML frontmatter values** (tags/aliases — the lint now skips frontmatter, keep it that way), **never wrap URL domains** (blacklist them in `scripts/lint/__init__.py` instead), and **verify identity before linking a bare first name** — `Anna` in `Anna Stauffer.md` is NOT `Anna.md` (Anna Brownlow), `Kevin's Rule` is NOT the `Kevin.md` neighbor. Those two traps were live bugs in the 2026-08-07 round.
4. **Safety rails:** never edit concurrently-dirty files (build a DIRTY skip-set from `git status` first); verify no `{braces}` leaked into YAML after batch edits; run build + tests; commit ONLY the touched files with a before→after stats summary; log the round in `_meta/log.md`; deploy from an isolated snapshot.

Full worked procedure, the batch-fixer script pattern, post-fix verification, and commit scope: `references/wiki-lint-round.md`.

#### Conceptual "wiki log" from live conversation
When Alex says "wiki log" after a conceptual/philosophical/business-strategy exchange, preserve the durable synthesis as a dated `_meta/log.md` receipt rather than a chat transcript. Promote that synthesis into a canonical node only when it is a confirmed standing truth in Alex's private personal/family graph. Public-facing concepts route to the explicitly named public repository.

**Listen-first sequencing for voice-led work:** when a voice exchange calls for both a spoken synthesis/council and slower log, docket, wiki, research, or artifact work, do only the minimum grounding needed to make the speech accurate, then generate the matching text + TTS and **finish that Telegram turn with the transcript and media attachment**. Telegram delivers the user-facing response at turn completion, so a generated TTS file or commentary inside an open tool turn is not yet a delivered speech. **Hard stop:** after the TTS tool succeeds, the next assistant action is the final media-bearing response; do not resume research, logging, or file work in that turn. Begin the durable-work lane in the following turn, after Alex has actually received the standalone listenable response. Preserve the Telegram rule that the audio repeats the delivered text exactly. A successful TTS tool result is generation evidence; the completed media-bearing turn is delivery evidence.

1. Orient through the wiki conventions, recent `_meta/log.md`, and `_meta/tags.md`.
2. Search existing nodes for the topic before creating anything. Prefer updating established conceptual nodes (`ai-philosophy`, `ai-economics`, `Nous Research`, project nodes, etc.) over making a narrow one-off page.
3. Capture the durable turn in 1-3 concise paragraphs: the new frame, why it matters, and how it links to existing wiki concepts. Preserve one sharp user phrase only if it is load-bearing.
4. If Alex says to include “the rest of these convos” / “the whole arc,” capture the durable conversation arc across the session, not just the latest utterance: operational context, conceptual synthesis, sidecar/council outputs, and settled framing. Still summarize; do not transcript-dump.
5. Append diagnostic log lines for each node touched.
6. Run wikilint for awareness, but do not detour into unrelated pre-existing lint cleanup unless Alex asks. Use the vault's canonical protocol rather than guessing a root-level script:
   ```bash
   cd /c/Users/alexa/.claude/wiki/scripts && python -m lint.suite
   ```
   Fix findings introduced by the touched files; report unrelated pre-existing findings without widening scope.
7. Commit and push the wiki changes immediately.
8. Final reply should be short: files/nodes touched, commit hash, and any lint result that matters.

#### Song-lyric annotation pages (Rap-Genius style)

When Alex asks to cross-reference a significant song's lyrics with his own life/wiki ("Rap Genius style pages"), create a private annotation node per song and anchor any brand-origin facts into the owning node.

1. **Confirm the artist before searching.** STT commonly swaps lookalike names (Aesop Rock → "ASAP Rocky"). Verify spelling via search before pulling lyrics; a wrong artist wastes the whole pass.
2. **Pull lyrics from Genius** (`genius.com/<artist>-<song>-lyrics`) via web extract. Use short quoted line fragments in the node — never reproduce a full copyrighted lyric dump.
3. **Create one `visibility: private` node per song** with `tags: [music, annotation, cross-reference]` and an aliases list. Structure: frontmatter → one-line song provenance (artist, track, album, label, year) → an explicit boundary line ("the song's intent stays the artist's; the annotations are Alex's side of the record") → blockquote lyric lines each followed by a wikilinked interpretation → `## See Also`.
4. **Only link real nodes.** Every `[[wikilink]]` in an annotation must resolve to an existing node (per canon-first rules); verify before writing. If a lyric maps to a node that doesn't exist, describe the mapping in prose or create the node deliberately — never a dead redlink.
5. **Anchor durable facts into the owning node, not just the annotation.** When a lyric explains a brand choice (e.g. PE's palette comes from "Canary-yellow, Zelda green, blueberries in heavy cream" in Aesop Rock's Secret Knock), add the origin note to the brand's own node (`peoples-elbow.md`) so the annotation is a pointer and the brand node carries the canon.
6. **Log with a dense `CREATED` line** mapping the key line→node pairs, plus `ANCHORED` for any brand-origin fact promoted into an owning node. Commit/push per the Git Backup contract.

Worked examples (both pushed 2026-08-07): `[[Secret Knock]]` and `[[Checkers]]` Aesop Rock annotations, plus the PE palette-origin anchor.

#### Personal/wedding contact capture from live conversation
When Alex gives a real-world person, mailing address, and invite/save-the-date intent, treat it as durable private wiki material plus a live action item.
1. Search the existing wiki for the person/address before creating anything.
2. Create or update a concise `visibility: private` person node with `tags: [person, friend, wedding]` when applicable. Capture the address as a blockquote and keep relationship context declarative.
3. Link at least two relevant nodes, usually `[[Alex]]`, `[[Sarah]]`, `[[sarahandalexforever]]`, and any mutual friend such as `[[Andy]]`.
4. If the user wants something done later, also update `nodes/reminders.md` so the invite/save-the-date survives as an operational reminder, not just biography.
5. Append `_meta/log.md`, run wikilint, and commit/push only the touched wiki files; leave unrelated dirty files unstaged.
6. If Alex says “step it out,” include the immediate next-step checklist after confirming the wiki update.

#### Image-backed relationship and work-transition capture
When Alex shares a screenshot of a farewell, congratulations, departure, or other relationship moment and asks to “wikilog” it or “comment with context,” preserve both the artifact and the durable relational meaning.

1. Read the image first and distinguish visible facts from interpretation. Treat names, timestamps, message text, and delivery state as evidence; do not infer an unseen reply or job role.
2. Search existing person, workplace, organization, and `Alex.md` nodes before writing. Create private person/org nodes only when the user has confirmed the identity or destination.
3. Archive the supplied image under `nodes/assets/` with a descriptive dated filename and embed it only in the relevant private node unless the user explicitly wants public visibility.
4. Capture the standing facts declaratively: where the person fits in Alex's orbit, what practical support they provided, what transition occurred, and what remains unspecified. If a new employer is named but role/location is unknown, say so rather than filling it in.
5. Put interpretation in a clearly labeled section such as `Why the farewell matters`. Ground it in the confirmed history so the comment explains why the message lands; avoid generic sentiment analysis or turning a human goodbye into business strategy.
6. Update the shared workplace/relationship node as well as the person node, then append `_meta/log.md`.
7. Run wikilint and fix findings introduced by the new files. Report unrelated pre-existing findings without detouring into cleanup. Commit and push only the touched wiki files and archived asset.

#### Multi-screenshot negotiation progression

A single live negotiation often arrives as a series of screenshots in one session (notice text → reply → scheduling → confirmation → strategy). Do NOT create a new dated log section per screenshot.

1. Open ONE dated `_meta/log.md` section (e.g. `## 2026-08-07 (Massage Envy two-week notice initiated)`) and grow it with progression verbs as each screenshot lands: `NOTICED` (initial message) → `UPDATED` (records written) → `CONFIRMED` (reply received) → `REFINED` (logistics change) → `PLANNED` (forward strategy). Each new line references the same `[[person]]`/`[[workplace]]` nodes.
2. Grow the person node's transition section and the workplace node's people section incrementally with each beat — never rewrite the whole section from memory; append the new beat to the prior paragraph.
3. Commit/push after each meaningful beat (each screenshot exchange) so the progression is recoverable, not one giant commit at the end. Recheck `git log origin/main --oneline -1` after interrupted pushes — a local commit can land while the push dies.
4. When the user states an exit/transition strategy with a conditional (e.g. "exit date is X, but if the day is unbooked it can move"), record the variable explicitly as an open question (`PLANNED` line + `Open question for <day>: is X booked`), not as a settled fact — this honors the logging-before-confirming rule while preserving the decision frame.
5. Date arithmetic belongs in the record: two-week notice starting Sunday = exit 14 days later (check with `date -d`), and the announced launch date may be shorter than a full two weeks (e.g. notice Sun 8/9 → 8/20 launch is ~11 days). Surface the gap so Alex can decide whether the two full weeks matter to the counterparty.

Worked example and phrasing pattern: `references/image-backed-relationship-transitions.md`.

### 5. Git Backup (mandatory)
After any wiki write — new node, edit, or log update — commit and push to the remote. Treat the wiki as a shared working tree: inspect status first and stage only the files this operation intentionally touched.

```bash
cd ~/.claude/wiki
git status --short
git add path/to/touched-node.md _meta/log.md
git diff --cached --check
git diff --cached --name-only
git commit -m "wiki: <brief description>"
git push origin main
```

The wiki is the `degenai/alexpedia` repo. If lightning strikes or the drive dies, the canon survives on GitHub. Do this after every wiki session, not just at the end of a long one. Untracked new nodes are especially vulnerable — they're not in git until committed.

**Preserve concurrent workspace state:** Obsidian or another agent may modify `.obsidian/workspace.json`, `.obsidian/graph.json`, logs, or unrelated nodes while the session is active. Leave unrelated changes unstaged and unmodified; never use `git add -A` as a reflex. After pushing, verify `HEAD...origin/main` is synchronized and report unrelated dirty files only when they matter to the handoff.

**Finished-but-uncommitted sibling receipts in YOUR files:** when the dirty set is confined to exactly the files your write belongs to (e.g. `_meta/log.md` plus the node you must edit) and the hunks look like another instance's complete receipts, decide by evidence: read the full diff (every block well-formed), `stat` the files (mtime hours-old, not minutes — the writer finished), and confirm nothing else is dirty. Complete-and-idle sibling hunks are safe to CARRY into your own commit — finished receipts that never get committed exist only in the worktree. Stage the whole touched files and credit the carried sections in the commit message, naming the sibling session. If any block looks mid-edit or the mtime is fresh, treat it as a live writer: use the isolation procedure in `references/concurrent-wiki-commits-with-shared-log.md` and stage only your own hunk.

**Atomic `_meta/log.md` insertion:** use this skill's linked `scripts/append_log.py` helper instead of assuming a repo-local `lint/append_log.py` exists:
```bash
python <wiki-logging-skill-dir>/scripts/append_log.py \
  --wiki-root <wiki-root> \
  --entry-file <entry-file>
```
The helper rereads beneath a lock and writes via temp file + `os.replace`. **On Windows, pass native-style paths** (e.g. `C:/Users/alexa/.claude/wiki`) — a bare MSYS `/c/Users/...` path resolves incorrectly inside the Python process and produces a file-not-found error. Use `C:/` prefix. If the log already has unrelated worktree changes, stage only your entry's hunk rather than the whole shared file.

### Chat-to-log transfer (requested logging validation)
When the user explicitly asks for a wiki pass-through test (e.g., "pass chats," "log this chat," or a Deepseek-style validation), treat this as a **logging-only lane** unless promotion is explicitly requested:

1. Create a short entry draft outside the node system (a temporary cache file) for clarity and easy rollback.
2. Append it to `_meta/log.md` using `scripts/append_log.py`.
3. Re-read the top section immediately to verify insertion order and unchanged nearby entries.
4. Stage only `_meta/log.md`, commit, push, and report whether `HEAD == origin/main`.
5. Leave unrelated concurrent worktree edits unstaged and report that state explicitly in the handoff.

### Alexpedia live-site refresh

Alexpedia's Tier 3 site is generated from the current wiki tree and deployed through its auth-gated Cloudflare Worker. **Git backup and live visibility are separate completion states:** a commit/push updates the Tier-2 source archive; only `build.py` plus a successful Worker deploy updates Tier 3. When Alex asks why a pushed item is absent from Alexpedia, inspect the deployment state before changing content. Do not report a wiki promotion as visible merely because Git is synchronized.

**Auto-deploy is the default path (2026-09-18):** schtask `AlexpediaAutoDeploy` runs `C:/Users/alexa/AppData/Local/hermes/scripts/alexpedia_autodeploy.py` every 15 minutes — hash-gated (builds + deploys only when repo HEAD differs from the last deployed hash) and self-healing (a failed build/deploy does not advance the hash, so the next cycle retries automatically), logging version IDs to `alexpedia_deploy.log`. A wiki push lands live within ~15 minutes with no manual step; when Alex reports a stale site, check that task/log FIRST before re-deploying or touching content. Manual `cd site && python build.py && npx wrangler deploy` remains the fallback and the immediate-verification path. Pipeline detail: `references/alexpedia-auto-deploy-pipeline.md`.

After wiki promotion commits are pushed, treat publication as two lanes: repo backup **and** live-site refresh.

If Alex asks for the change to be on the **actual Alexpedia worker** (not just Git), run the post-push publication contract: verify `HEAD == origin/main`, build+test, prove the promoted phrase in generated HTML, deploy, and keep the deploy version as proof. For dirty shared worktrees, do this from an isolated snapshot of pushed `HEAD` so unrelated concurrent edits are not accidentally published.

```bash
cd C:/Users/alexa/.claude/wiki/site
python build.py
wrangler deploy
```

1. Re-fetch or re-check `main` immediately before the build. A concurrent wiki writer may have landed promotion commits after an earlier build.
2. Run the build from the current complete tree, then deploy. Generated `dist/` output is ignored; Cloudflare's incremental asset upload makes routine refreshes fast.
3. Verify the build's article count, category count, and redlink report, then confirm local `HEAD` equals `origin/main`. Treat known redlinks as baseline and investigate only regressions introduced by the changed nodes.
4. For an auth-gated deployment, verify the generated article locally contains the intended text, confirm the unauthenticated live route returns the expected auth challenge, and retain Wrangler's changed-asset list plus deployment version as the publication receipt. Do not request, expose, or type the access secret merely to prove deployment.
5. Check `Current Version ID` from deploy and include it in the receipt.
6. Report wiki push and live-site deployment as separate states. A pre-push snapshot may correctly show renderer files pending while a later renderer commit has already synchronized and deployed.
7. Keep Worker credentials and private access material out of the repo, wiki, logs, and reports.

For a reusable full flow, use `references/actual-worker-promotion-contract.md`.

#### Recent Changes completion and investigation contract

`Special:RecentChanges` is a build-time projection of `_meta/log.md`, not a runtime view of GitHub. Treat it as an interface with an explicit navigation contract:

1. Prefer canonical Obsidian targets in diagnostic rows: `ACTION [[Exact Page Target]] — note`; for multiple targets use `[[Page A]], [[Page B|Display Label]]`. Keep legacy plain `Page A + Page B` support because historical receipts still use it. Free-form operational receipts remain prose when they have no canonical article to open.
2. Make investigation affordances visible on mobile. Do not rely on visited-link color alone: resolved targets and resolvable dated section topics should be visibly underlined or otherwise marked as links.
3. Parse compound targets from the grammar actually present in `_meta/log.md`. Resolve each wikilink's page name separately, preserve `|Display Label` and `#Anchor`, and apply the same parsed members to visibility filtering. Never send an entire comma-separated `[[...]]` string to the resolver or fall back to bold raw markup.
4. Resolve a dated section topic against the exact topic, `topic + date`, and `topic — date` conventions. This lets a heading like `YYYY-MM-DD (Topic)` open a dated evidence node whose filename or title carries the date suffix.
5. Add RED-first renderer tests using an exact current production row—not only a nearby synthetic grammar—for heading, compound-target, alias, main-page-preview, and mobile behavior. The regression must first reproduce the emitted `<b>[[...]]</b>` or equivalent raw-markup symptom before production code changes.
6. After GREEN, inspect `dist/wiki/Special__RecentChanges.html` directly—the NTFS-safe generated filename uses `Special__`, not a literal colon. Assert every expected anchor and label, assert zero raw `[[` target markup on both Recent Changes and the main-page preview, and assert hidden target members suppress the row.
7. Keep verification harnesses literal-safe. Dollar amounts and other shell metacharacters inside inline assertions can be expanded by the shell and create false failures; use a quoted script file/heredoc or construct the character inside the verifier.
8. Audience claims come from executable renderer truth. Read the allowed-visibility sets and isolation tests before calling a node owner-only, household-visible, medical, or excluded; frontmatter labels and prose policy can drift from the actual build matrix.
9. For the live receipt, pair local generated-content proof with Wrangler's version/deployment record and unauthenticated route probes. An authenticated body need not be fetched by exposing or typing a password merely to prove publication.
10. Support canonical targeted entries and legacy `ACTION note` entries through one explicit action allowlist so arbitrary uppercase prose remains prose.
11. Keep parser vocabulary and CSS palette synchronized: every allowlisted action gets an explicit palette declaration, including actions intentionally assigned neutral gray. Test that investigation-relevant actions do not inherit generic gray.
12. Render action-only rows as a semantic badge plus readable note. Infer an article target only through the visible resolver, with conservative prefix rules; possessives and single-word lowercase candidates remain prose.
13. Link backticked repository references only when they satisfy a conservative `owner/repo` slug. Local paths such as `site/build.py` and `_meta/log.md` must not become dead GitHub links.
14. Apply the same privacy guard and safe wikilink renderer to the compact main-page preview, and word-truncate free-form notes to a bounded length.
15. Treat **source freshness, action-vocabulary coverage, and Worker freshness as three separate gates** when a screenshot looks stale. First compare the newest visible heading with the current `_meta/log.md`; then inventory every unambiguous targeted receipt (`ACTION [[Target]] — note`) and assert its leading verb exists in `LOG_ACTIONS` and has an explicit `.rc-<verb>` palette selector; finally build and deploy the pushed snapshot. A redeploy cannot repair unsupported verbs, and a parser fix cannot refresh an older Worker. Add a RED-first fixture using the exact current production verbs before extending the allowlist, run the full renderer suite, and inspect generated `Special__RecentChanges.html` for every expected badge/link and zero raw wikilinks before deployment.

Detailed symptom map, renderer contract, exact-production-fixture matrix, and shell-safe verification notes: `references/recent-changes-action-semantics.md`.

**Dirty shared-worktree publication:** when unrelated uncommitted wiki changes remain after the scoped commit, build and deploy from an isolated snapshot of the pushed `HEAD` rather than from the shared worktree. Verify `HEAD == origin/main`, run the renderer/tests inside the snapshot, prove the promoted phrase exists in generated HTML, deploy, check the unauthenticated auth challenge, and confirm the unrelated worktree status is unchanged. On Windows, inspect tracked symlinks and use native `C:/...` or `cygpath -w` paths for Git worktree/archive arguments; a bare MSYS `/c/...` argument can be interpreted as a literal `C:\c\...` destination. Full procedure: `references/clean-render-deploy-from-dirty-worktree.md`.

## Multi-Document Fix Discipline

**When the user corrects a fact or framing, fix it EVERYWHERE it lives.** The correction typically needs to land in:
1. `log.md` — the session entry where the wrong framing was captured
2. `docket.md` — if the item appears there
3. The relevant wiki node(s) — canonical reference
4. The wiki's `_meta/log.md` — if the original promotion is recorded there
5. **Operational surfaces** — active reminders, cron-job names/prompts, queued messages, or other automation payloads that would otherwise repeat the stale fact later

**Check every applicable surface.** A correction that only lands in one place leaves the other records stale and contradictory. The log, wiki, and scheduler are separate stores — they do not sync automatically. When a correction changes an upcoming reminder, update that job immediately rather than allowing the stale payload to fire.

## References

- `references/absence-claim-verification.md` — independent evidence ladder before declaring a node absent or creating a duplicate; includes correction sweep after a false absence claim.
- `references/telegram-jsonl-audit-playbook.md` — evidence-first procedure for long Telegram corpus audits from `*.jsonl` exports: normalize repeated tool/voice artifacts, preserve message IDs + session IDs, classify evidence buckets, and generate a durable candidate ledger (including missing/stale/contradictory candidates).
- `references/telegram-jsonl-evidence-ledger-bounded-pass.md` — one-pass bounded-date-window template for `jsonl -> dedupe -> classify -> final ledger` (with output-count invariants and failure fallbacks).
- `references/recent-session-wikilog-audits.md` — Telegram/CLI session-history audit workflow: discover older lineages with overlapping anchors, strip tool-heavy spans to user-led evidence, classify canon/gaps/contradictions/noise, preserve source attribution, measure lint regressions, and back up exact files.
- `references/concurrent-wiki-commits-with-shared-log.md` — alternate-index procedure for committing only owned nodes and one `_meta/log.md` block while preserving another agent's staged/unstaged workspace state.
- `references/deepseek-chat-log-transfer.md` — practical lane for chat-validation requests ("pass chats," Deepseek-style dry-runs), including cache-entry template and commit scope discipline.
- `references/clean-render-deploy-from-dirty-worktree.md` — build/test/deploy the pushed wiki commit from an isolated snapshot while concurrent shared-worktree edits remain untouched, including Windows symlink/archive handling.
- `references/layered-visibility-and-secret-redaction.md` — the corrected audience lattice (household renders internal; medical hidden; Adamczykpedia hides internal), the `REDACT_SECRETS` build-time redaction implementation and its dead-code pitfall, the all-filtered-section renderer fix, and the pre-deploy leak-sweep checklist.
- `references/actual-worker-promotion-contract.md` — concrete lane for user-requested worker publication: sync check, test/build proof, live deploy version capture, and auth-route verification.
- `references/private-operating-dashboard-capture.md` — reusable chart → MCU docket → private wiki workflow, including inspectable service-business math, gross → cash deals → taxable-profit boundaries, capped venue formulas, tax-classification caveats, Monitor-surface design, real-browser interaction checks, true-mobile CDP capture, and concurrent Obsidian-state preservation.
- `references/worked-examples.md` — annotated case studies: Cloud Nine/smokeshop merge, Pedro Alicano correction. Load this when a fix-discipline question comes up and you want to see the pattern applied to real data.
- `scripts/extract_telegram_jsonl_to_ledger.py` — reusable extractor/classifier to normalize Telegram JSONL into a stable TSV ledger with date-range filtering and turn-class tags.
- `references/direct-message-contact-research-and-correction.md` — reusable direct-message/screenshot → identity research → linked person/company nodes workflow, including private contact handling, founder-role ambiguity, reminder correction, positive-name sweeps, and warm-contact boundaries.
- `references/jules-pr-triage.md` — workflow for triaging automated Jules PRs across Alex's repos (clone, fan-out diffs, merge gems, close slop, leave crumbs in `.jules/` agent files).
- `references/wiki-lint-round.md` — full-suite lint sweep procedure: broken-link stub-vs-nolink decisions, orphan natural-home linking, the unlinked-mention batch fixer (with person-name traps, frontmatter/URL guards, whack-a-mole convergence), dirty-file exclusion, post-fix verification, and scoped commit.
## Pitfalls

### Bare log entries render as plain text — wikilink every subject
Every `_meta/log.md` entry must link its subjects with `[[wikilinks]]` to **existing** wiki nodes. The Alexpedia renderer turns resolved wikilinks into blue article links; an entry written as bare prose renders as a wall of white text while sibling entries show blue links — Alex reads this as incomplete logging. Before writing each entry, confirm every target node exists (check `nodes/` for the filename), and never link non-node concepts such as Hermes skill names (`[[wiki-logging]]`) or tool paths — those become dead redlinks. After the build, assert the rendered HTML contains the expected `href="/wiki/<target>"` for each link (e.g. in `dist/wiki/Special__RecentChanges.html`) before deploying.

**Unknown ACTION verbs break wikilink resolution in that row.** An entry whose leading verb is NOT in the renderer's `LOG_ACTIONS` allowlist (`site/build.py`) takes the parser's plain-text branch, which `html.escape`s the note **without resolving wikilinks** — so even correctly written `[[Target]]` links render as literal `[[Target]]` brackets in gray. Symptom seen live: `LOGGED` was missing from the palette, so the "LOGGED this as a dated [[Alexpedia]]" row showed raw brackets while sibling CAPTURED/ROUTED/UPDATED rows rendered fine. Two-part fix: (1) add the verb to `LOG_ACTIONS` in `site/build.py`, and (2) add a `.rc-<verb>` background declaration in `site/static/style.css` (group it with the semantically closest color family — e.g. LOGGED with the purple captured/archived group). Palette membership and CSS color are separate; missing either leaves the gray/plain fallback. After the build, assert BOTH the badge class (e.g. `rc-logged">LOGGED`) AND zero literal `[[` sequences in the generated row.

### Blank log sections are an audience-filter signal, not a renderer glitch
A dated section on Recent Changes that shows its heading but zero bullets usually means **every entry in that section was suppressed by the audience filter** (`log_entry_hidden`), not that the log data is missing. The renderer emits the section heading before filtering, so an all-filtered section leaves an orphan heading. Two distinct causes, both seen live:

1. **Target page hidden from this view** — the entry's `[[target]]` resolves only in the all-pages resolver, not the current view's resolver (e.g. `medical` target on the household view). Fix: check the target's `visibility` frontmatter against the view's allowed set.
2. **Model over-restriction** — an audience class that should render is excluded. Live example: `internal` pages (Demon Ranch) were excluded from the household view, so `UPDATED [[Demon Ranch]]` sections went blank. Alex's model says household renders `internal`; only `medical` is hidden. A blank section here is the symptom that the build matrix is wrong.

Diagnosis order: read the target node's `visibility`, check `build()`'s allowed-visibility sets, then decide between hiding the section (fix renderer) or including the class (fix model). The renderer fix is to collect rows first and only emit the heading if any row survives the filter — do this in BOTH render sites (`recent_changes_page` and `main_page` preview). The model fix is the `build()` allowed set. Fixing only the renderer while the class should render hides the underlying mistake.

### Redaction on a template-literal return is dead code if placed after `return`
When adding a post-processing pass to a function whose body is a `return """...""" % {...}` template, the pass must be applied to a bound variable — not appended after the original `return`. `return redact_secrets(out)` placed after `return """...""" % {...}` is unreachable, `out` is undefined, and the redaction silently never runs while the build still succeeds. Convert the template to `out = """...""" % {...}` and end with `return redact_secrets(out)`. The renderer test suite (which asserts redaction markers in output) catches this; run it before declaring a redaction shipped.

### Evidence-first when image analysis is unavailable
If image evidence is requested but analysis cannot proceed (including tool/model input limitation), do **not** infer or fabricate text from pixels. Keep that item as pending evidence, ask for a trusted transcription/source text, or defer promotion until the user supplies readable content. Only promote facts after confirmation; until then, avoid adding assumptions to `log.md`, dockets, or wiki nodes.

### Over-formalizing human relationships
When Alex shares a friend's early experiments, identify the relational meaning before offering technical evaluation. Shared curiosity and relief from solitary learning can be the point of the exchange. Match guidance to the learner's current stage; reserve detailed audits and onboarding plans for an actual request, while keeping any necessary risk warning brief and proportionate.

Do not reach for business-strategy language ("greenlit," "approved," "brand clearance," "strategic alignment") when the user's actual framing is human-scale. 

- **Wrong:** "Morgan greenlit the smokeshop as a PE venue — Stauffer Chiropractic isn't PR-compatible there."
- **Right:** "Ran it by Morgan as a courtesy — new working relationship, non-essential side thing, just making sure it didn't land weird. Morgan's fine with it."

When the user describes checking something with a collaborator, default to the simpler read: a human courtesy between people who work together. The user will tell you if there's a formal clearance process. Don't invent one.

### Inventing strategic narratives
Don't synthesize a strategy out of a simple decision. If the user says "I asked Morgan if he was uncomfortable with it," don't reframe it as a brand-compatibility assessment. The user's words are the story — add structure, not spin.

### The Reading Law — read the node before riffing on Alex's life (2026-08-19)

Alex's own law, minted after an agent riffed about the old Hustle House location from fuzzy memory, wrote a WRONG "correction" into the log, and had to fix it again: *"Reading is cheaper than writing. You got to read more — it'll save you the writing."*

- Before commenting on Alex's businesses, family, venues, or lived context — in chat, councils, or anywhere — read the relevant node(s) first. The wiki holds the canon; a riff from session memory forces correction-text afterward (two writes where one read would have done).
- The wiki does not hold every detail of his life; conversation flushes out the rest — but you can only flush it out from what you've read. When a fact surfaces that canon lacks, ADD it (the flush-out direction), don't riff around it.
- When corrected, apply fix-discipline to every durable surface (memory, log, node) AND welcome the correction as refinement — Alex's frame is "we're refiners, we're not slop." The miss became law; canon example recorded in `nodes/ai-philosophy.md` under The Reading Law.

### Cast / people disambiguation — load Alex.md first

The open-session ritual says to read "relevant career nodes" — in practice this means **always load `Alex.md`** before the check-in, not just the venue/project nodes. People errors (confusing two cast members, misattributing a story to the wrong person) happen when you skip the people node and rely on fuzzy session memory instead.

Alex's wiki has distinct nodes for every recurring person. When a name comes up (friend, family, collaborator) and you're even slightly unsure who they are relative to Alex — **look up the node before speaking.** A quick grep of `~/.claude/wiki/nodes/` for the name prevents the kind of slip where Andy (Coca-Cola, media server, CLI-anxiety friend) gets merged onto Mike (dad, retired salesman, journaling use case).

If conflicting signals arise mid-conversation — the user says "that's my dad" or "that's a different person" — treat it as a fix-discipline trigger: correct memory, correct any log/docket entries written with the wrong person, and note the disambiguation in the wiki if the person doesn't have a node yet.

### Canon-first identity resolution before asking
When a person, nickname, relationship, or STT rendering appears uncertain, **search the full canonical wiki before asking Alex to identify it.** Search the exact token plus semantic descriptors such as role, company, relationship, project, or venue; then directly inspect likely person nodes, hub tables, aliases, and backlinks. The referent may already be mapped outside the note currently under review.

Treat one zero-result as a retrieval result, not proof of absence. Validate the search root, file coverage, case/normalization, and perform an independent store-wide inventory or direct hub read. When the latest user statement agrees with existing canon, resolve the candidate immediately instead of asking Alex to repeat known context. A correction like “you know that” means this canon-first gate was skipped.

**Absence claims require an independent inventory.** A filename/content search that returns zero results cannot authorize “no node exists” or creation of a new node. Validate the canonical root, search filenames and contents separately with aliases/role anchors, enumerate tracked and untracked Markdown paths independently, and directly read likely canonical paths or hub nodes. Only after those checks may the node be classified as absent. If a false absence claim was written, link the existing canonical node and remove the false wording everywhere it landed.

Detailed evidence ladder and correction sweep: `references/absence-claim-verification.md`.

Keep raw evidence separate from derived surfaces: raw transcripts preserve literal source renderings, while canonical nodes, temporal logs, adjudication ledgers, and generated snippets use the accepted identity only. After correction, update the owning node/hub, prior diagnostic language, and derived caches; run the Randy Hunter zero-match sweep over durable surfaces; lint; and isolate unrelated concurrent work at staging time.

Detailed gate and correction sweep: `references/identity-transcript-adjudication.md`.

### Safe targeted edits and concurrent writers

Treat `log.md`, `docket.md`, and `_meta/log.md` as shared records that may change while the session is active.

1. **Never use a prefix-only replacement anchor.** A fuzzy patch such as `old_string: "## Fundraising events"` or the first few words of a long line may consume the unquoted suffix or neighboring line. Match the complete line plus one stable line before/after, or use a V4A patch with explicit context.
2. **Inspect the unified diff for collateral shortening.** If an adjacent heading, sentence, or checklist line loses its suffix, restore it immediately. Do not trust a successful patch response by itself.
3. **Read back the whole touched block.** For docket insertions, read from the preceding heading through the following section. For append-only logs, read the insertion plus the next entry so concurrent additions are visibly preserved.
4. **Reread append-only tails before writing.** Another agent may append between the first read and the patch. Anchor on the exact current terminal line or insert relative to a stable heading; preserve every externally added entry.
5. **Verify at the content level, then lint.** `git diff --check` catches whitespace problems, not clipped prose. The readback catches semantic damage; wikilint catches graph regressions.

Detailed failure/recovery examples: `references/safe-targeted-editing-and-concurrent-writers.md`.

### Windows path backslashes in patched prose

Writing a Windows path like `Desktop\riemann67` into wiki/docket prose via the patch tool can materialize `\r` as a carriage return — the line silently breaks in two (`Desktop` / `iemann67`) and the split may only surface in a diff readback or `cat -A`. Hit live 2026-08-15 while docketing the math-bounty lanes. Rule: **forward slashes in all prose paths** (`Desktop/riemann67`, `C:/Users/alexa/...`); reserve native backslash paths for actual filesystem arguments, and after any patch that inserts a path, read back the touched block and verify the line did not split.

### Clinical-record privacy on shared log surfaces
Clinical identities, individual chart filenames, symptoms, findings, treatment details, and appointment particulars belong in the canonical private `.txt` file under `clinical/clients/`, outside the wiki graph. `_meta/log.md` can feed household and room-visible displays, so its clinical receipts identify only the collection and source session. Plain text and `{nolink}` affect linking, not audience exposure. Use `verbal-soap` and `clinical-soap-addendum-workflow` for clinical capture and same-visit merging; retrieve patient-specific provenance from the chart itself.

### Duplicate entries — merge, don't just edit or delete
When the user reveals that two separately-tracked items are the same entity (e.g. "the smokeshop IS Cloud Nine"), merge them across ALL documents:
1. `log.md` — corrected, unified framing
2. `docket.md` — absorb the duplicate into the primary entry
3. The relevant wiki node(s) — merge into canonical reference
4. The wiki's `_meta/log.md` — correct the earlier promotion

Deleting the duplicate without merging loses context. The fix is a merge, not a deletion.

### Bounded one-pass requirement for Telegram evidence ledgers
When the user requests a date-bounded Telegram-to-Alexpedia ledger, treat it as an **audit with a hard single-pass output contract**:

1. **One bounded extraction run** over the canonical source JSONL (or equivalent exports) for the requested window.
2. **Normalize → dedupe → classify → write final ledger in the same pass.**
3. **No “I’ll do the final file in another pass” unless the first pass raises a parse blocker**.

The audit is not complete until the final ledger file exists and is populated.

What to capture in the same run:

- `rows_input` — raw rows read from source
- `rows_parsable` — rows that were valid JSON/processable
- `rows_in_window` — rows inside the requested date interval
- `rows_output` — final rows written to the requested ledger
- `rows_deduped` — collapsed duplicates
- `rows_malformed` + line-level diagnostics (`line_no`, short `raw_excerpt`)
- `status_counts` (`CANON_MATCH`, `MISSING_CANDIDATE`, `STALE_CONTRADICTION`, `NOISE_TOOLING`, `VERBATIM_DEFER`, etc.)
- final artifact path (for example `02_ledger.md`, `03_ledger.md`, or the user-requested filename)

- If malformed JSON/line parsing occurs, log and continue; never abort the whole date run because of one bad row.
- If no wiki anchors are found for a user text, still include it as `NOISE_TOOLING`/`MISSING_CANDIDATE` with evidence notes rather than dropping the row.
- If this is a voice wrapper like `[The user sent a voice message~ ...]`, keep both raw wrapper text and extracted speech text for provenance.
- Keep deterministic ordering by ascending timestamp in the final ledger.

For user-facing completion, include a compact status block and the final artifact path:

```json
{"rows_input":0,"rows_output":0,"status_counts":{},"ledger":"<path>"}
```

This one-shot contract should be reusable; if a run cannot produce it, report the blocker before returning anything that looks like a finished ledger.
### The Randy Hunter Rule — positive declarations only

From Alex's sax teacher Randy Hunter: *"Never think of the notes you're NOT gonna play. Never think IT'S NOT B FLAT. Just think B. Just think the right thing."*

Applied to this skill: never store a negative prohibition in memory, a wiki entry, a log entry, or a skill when a positive declaration would do the job. A memory entry that says "NEVER call it X" still contains X — every future session reads the forbidden word and keeps it alive. The correction is not to suppress the wrong thing; it's to replace it entirely with the right one.

- **Wrong (memory):** A correction that repeats a rejected alias while warning against it. — The rejected wording remains in the record forever.
- **Right (memory):** `"Robinhood Lab — the trading project."` — The accepted name and frame stand alone.

This applies to ALL durable records — memory entries, wiki nodes, skill pitfalls, log entries, docket items. Frame positively. The wrong name dies from disuse; a record that repeats it keeps it alive indefinitely.

**Correction verification:** after replacing a rejected name or mistranscription, run a case-insensitive zero-match sweep across every durable store touched in the session, including the MCU log/docket, wiki nodes, `_meta/log.md`, and active reminder payloads. The rejected token should have zero remaining matches. Write the correction log with the accepted name only; do not preserve the rejected wording as an explanation of what changed.

### Logging before confirming
- Don't promote a fact to the wiki until the user has confirmed it. Tentative items stay in the docket. Wait for the user to settle a decision before writing it as standing truth.
- **An offer is not a settled deal.** In negotiation receipts (notice threads, schedule changes, exit terms), distinguish proposed terms from confirmed facts. Quote the exact visible wording of the source thread; when no reply accepting the offer is visible, record the terms as proposed with "acceptance not visible in the latest receipt" — never as settled, and never skip re-reading the actual screenshot before a status write. Hit live twice on 2026-08-19: a final-day was logged as settled before the manager replied, and a split-shift offer was promoted to a done deal from the offerer's own messages alone. The user's own outbound messages are not proof of agreement.
- **Honor explicit no-edit instructions.** When the user says a memorial or node is already in the wiki and "don't edit it," do not edit it and do not propose edits — record the prohibition in memory so a future session doesn't "helpfully" touch the node.
- If a client name or identity is uncertain in-session, add a small "Client identity follow-up" docket item and a temporary admin note in `log.md` if timing is deferred ("tonight at work", "later this evening", etc.). Update dossier entries only when name/details are confirmed.
- Reference helper: `references/client-identity-deferred-updates.md`.
- For one-off workflow check-ins (e.g., spreadsheet follow-up deferred), keep the forward-facing commitment in the docket and avoid forcing a clinical update until confirmation, then sync both log and docket in the same pass.

### "On the docket" means use the MCU docket, not session todos
Alex's active professional docket lives at `C:\Users\alexa\Desktop\My Cinematic Universe\docket.md` (with `log.md` beside it). When Alex says "what's on the docket," "dock at me," "put this on the docket," or asks what to push forward, do **not** rely on Hermes session `todo()` or vague memory. Open the MCU docket and recent MCU log, then answer or update from that board.

**Two dockets exist (clarified 2026-09-02) — route by content:** the MCU docket holds professional arcs and gig strategy; `C:/Users/alexa/.claude/wiki/nodes/Docket.md` is the personal standing-orders list (`- [ ]` / `- [x]` checkboxes, optional `!` attention flag) that the Command Deck tower displays live. Personal/standing items and anything Alex wants visible on the wall go to the wiki Docket; business/gig/project arcs stay on the MCU board. When the ask is ambiguous, pick by content and name the board you used in the receipt.

For a **docket read / rainy-night menu**:
1. Read `C:\Users\alexa\Desktop\My Cinematic Universe\docket.md`.
2. Read the recent bottom of `log.md` if needed for freshness.
3. Skim the relevant wiki node(s) only if the menu depends on current project truth.
4. Offer a low-friction priority menu grouped by energy level: talk-only, quick facts, light execution, save-for-fresh-context.
5. If the user sounds tired/chilling, recommend the lowest-energy high-leverage option instead of turning it into work-work.

For a **docket write**:
1. Open the active MCU docket.
2. Add a concise checkbox in the appropriate forward-looking section.
3. If the docket contains a now-stale adjacent fact surfaced by the same turn, update that stale line in the same pass.
4. For date-sensitive asks ("later," "tomorrow," "actually tomorrow," holidays, protected rest/family days), check live date/time, rewrite the docket date in place, and schedule or update a one-shot reminder when useful.
5. Treat a scheduled docket session as a **self-contained execution payload**, not a bare reminder. Cron runs in a fresh session: include the ordered checklist, exact project/PR/URL identifiers, current status, truth/consistency constraints, and the first action. Use a timezone-qualified one-shot timestamp. Set the job continuable/attached when the user will likely reply and work the checklist with the agent.
6. Keep the scheduled prompt bounded: it may execute the listed work, but it must not recursively schedule more jobs.
7. Read back only the touched lines to verify.
8. After a multi-hour or evidence-heavy session, do not make Alex reread the audit. Put full detail in the docket/reminder and make the immediate handoff a compact **must-do lane of no more than five items**, followed by a short “if time” lane.
9. Final reply should be short: state it was docketed, give the scheduled time and path/essence, and identify anything already completed. Do not turn it into a full plan unless Alex asks.

Tentative implementation ideas belong in the checkbox wording only when useful (e.g. "likely via gateway/API-server pairing"); avoid over-specifying architecture before the build session.

### Password/passphrase candidates are not project names
If Alex floats a phrase as a possible password/passphrase for a private review area, admin page, or collaborator portal, do **not** canonize it as a product/site/workflow name, and do not preserve it in repo docs, wiki nodes, logs, memory, or skills. Treat it as sensitive-ish inspiration: the durable record should say only that the future area is unlisted/password-protected and that the real password/passphrase will be set privately at implementation time.

If you already wrote the candidate phrase into durable files, apply the fix-discipline immediately: replace it everywhere with a boring descriptive name for the thing (e.g. "Elbow Room Draft Review") and a generic note that credentials/passphrases are not stored in repo docs. Avoid keeping the rejected phrase alive in the correction line.