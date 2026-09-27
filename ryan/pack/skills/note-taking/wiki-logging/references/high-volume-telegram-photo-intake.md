# High-Volume Telegram Photo Intake

Use this reference when a Telegram session receives dozens or hundreds of photos that must become durable evidence without turning the wiki repository into the bulk-media archive.

## Target architecture

- **Tier 1 originals:** stable private archive outside Git, copied unchanged from the application cache.
- **Portable recovery bundle:** one ZIP plus a manifest and checksums.
- **Git-backed retrieval index:** compact private node and CSV/JSONL manifest.
- **Wiki derivatives:** a deliberately small representative set, descriptively named and size-bounded.
- **Semantic promotion:** confirmed people, events, places, and projects updated only after visual inspection and identity/context confirmation.

## Practical batching and offload cadence

Treat three limits separately:

- **Conversational inspection:** use roughly 8–12 images per message, with 10 as the default. This keeps each visual pass legible and lets the user correct identities/context before a large mistaken promotion fans out.
- **Archive tranche:** close, checksum, and consider remote offload at a coherent 100–250-image boundary or at the end of a completed intake session, whichever gives the cleaner evidence boundary. This is a workflow heuristic, not a hard platform cap.
- **Storage pressure:** measure the actual batch bytes and current free disk before claiming urgency. Remote offload is primarily a durability and recovery step; a small compressed photo batch does not become urgent merely because it remains in the application cache.

Keep cache originals until the stable archive, frozen manifest, and ZIP checksum all verify. Remove or age cache copies only after the remote object has also been read back when remote backup is part of the requested workflow.

## Procedure

### 1. Establish the source boundary

Enumerate attachment paths from the source Telegram messages/session before looking at cache modification times. Record database message ID, source session ID, receive timestamp, and album position. Cache-time windows can include a file received immediately before the bulk dump.

When two independent archives disagree on count, reconcile by filename and SHA-256:

1. Compare filename sets.
2. Compare hashes for the intersection.
3. Identify the exact set difference.
4. Explain the wider intake window in the canonical node rather than treating either archive as corrupt.

### 2. Preserve before interpreting

Copy each source file into a stable private originals directory and retain the cache copy. Build:

- an **immutable preservation manifest** (`manifest.csv` or JSONL) containing source/provenance and integrity fields;
- a recovery ZIP containing the originals plus that exact preservation manifest;
- a **mutable enrichment ledger** for clarification status, related wiki nodes, derivative choices, and remote locators;
- count, total bytes, dimensions, and SHA-256 receipts for the originals, preservation manifest, and ZIP.

Freeze the preservation manifest when the ZIP receipt is issued. Its hash identifies the exact manifest bundled with the archive. Semantic integration updates the enrichment ledger instead of silently changing the preservation receipt. If a combined manifest must be changed, rebuild and re-checksum the recovery bundle in the same operation so the receipt remains truthful.

Preservation fields should include original filename, source message/session, receive/import date, bytes, dimensions, SHA-256, cache path, and durable archive path. Enrichment fields should include image ordinal or stable source key, clarification state and answer provenance, related wiki node, repository derivative, integration commit, deployment receipt, and remote archive locator when available.

### 3. Deduplicate at two levels

- SHA-256 finds byte-identical duplicates.
- A simple perceptual hash such as dHash flags resized, recompressed, or near-identical frames.
- Compare the intake against existing tracked wiki assets as well as against itself.

Treat perceptual matches as review candidates, not automatic deletions. A second frame can carry distinct event evidence even when composition is similar.

### 4. Build a numbered visual census

Create numbered 5×5 contact sheets so every image can be inspected in bounded batches. For each tile, classify:

- concrete visible content;
- likely person/event/place cluster;
- privacy sensitivity;
- exact or near duplication;
- high/medium/low wiki value;
- identity or context question.

Group questions by recurring face, animal, room, or event. One answer should label many images. Preserve unresolved identities as questions; visual resemblance alone does not create canon.

### 5. Run the clarification queue as a closed loop

A list of unresolved questions is intake scaffolding. It becomes a working queue only when each answer is carried through to durable integration.

Persist queue entries with: batch/contact-sheet ID, image ordinals or cluster, grouped question, `pending | answered | integrated | paused` status, answer source, affected manifest rows, affected wiki nodes, selected derivatives, integration commit, and live-site deployment receipt.

For each conversational round:

1. Present one numbered contact sheet and at most three high-leverage grouped questions. Skip clusters already established from direct evidence.
2. Let Alex answer compactly by question number. One identity or context answer should fan out across every matching image row.
3. Mark a queue item `answered` only after recording the supplied context and provenance. Do not promote tentative language as canon.
4. Join numbered contact-sheet ordinals back to stable originals through the census manifest, then verify filename and SHA-256 before changing enrichment rows. Update every affected person/event/place/project node and enrichment row. Keep deferred screenshots, uncertain dates, and “maybe after…” context pending or explicitly tentative.
5. For each duplicate/burst cluster, compare the candidate frames at a larger size and select one representative unless separate frames prove separate claims. Correct orientation in the derivative, strip unnecessary metadata, measure the encoded output, and visually verify a montage of the final derivatives for clarity, scene integrity, and upright orientation.
6. Append the diagnostic log, run Wikilint, stage only owned paths, commit/push, rebuild/deploy Alexpedia, and verify the rendered result. Compare lint with the pre-existing baseline and fix every finding introduced by touched files, including bare mentions in captions and queue text.
7. Mark the item `integrated` only after the durable files and live projection are verified; then present the next batch.

**Demo/defer boundary:** showing a batch is not itself an instruction to integrate it. If Alex says he is demonstrating the workflow or will review later, deliver the contact sheet and concise grouped questions, mark the queue `paused` with the exact contact-sheet and next-image anchor, keep its unresolved items `pending`, and stop prompting. Do not select derivatives or update canonical nodes until he supplies context. When he reopens the photo workflow, resume from the paused sheet unless he explicitly asks for a different batch. Lead the user-facing delivery with the numbered sheet and questions; archive/infrastructure status stays backstage unless requested.

Status reports must separate four lanes: archive integrity, visual-census coverage, semantic integration, and remote offload. “Preserved” does not mean “identified,” and “questions listed” does not mean “queue operating.”

### 6. Curate repository derivatives

Select the minimum representative set that proves the durable claim. Prefer one event-wide image plus one authoritative flyer/document over a whole burst.

Measure the encoded output before accepting it. Lossless WebP can exceed the source JPEG for graphic-heavy material. Compare byte size, choose an appropriate quality/format, then visually verify text legibility and scene integrity. Record the selected source row and derivative path in the Git-backed manifest.

### 7. Offload through authenticated storage

Before Drive or another remote archive:

1. Check current OAuth/authentication status and granted scopes without exposing token contents.
2. Prepare and checksum the local ZIP first.
3. Obtain explicit approval for scope refresh, folder creation, and upload.
4. Prefer one verified archive upload over hundreds of rapid individual uploads unless browsing originals in Drive is a stated requirement.
5. Read back remote metadata, file size, and link/ID; record them in the private intake node and manifest.

A missing Drive scope is an authorization-state question, not evidence loss: the stable local archive remains the source until remote verification completes.

### 8. Merge parallel intake work safely

Parallel wiki loggers may preserve the same batch independently. Before creating a new intake node:

1. Inspect current Git history/status and search for an existing intake node or manifest.
2. Choose one canonical node, usually the first-created or already-linked page.
3. Union unique retrieval handles, checksums, visual analysis, and questions.
4. Correct count differences through set/hash reconciliation.
5. Repoint inbound links and manifest rows.
6. Correct the diagnostic log from duplicate creation to canonical merge.
7. Delete only the fully absorbed duplicate page.

When `_meta/log.md` also contains another writer's unstaged hunk, stage the intended log hunk separately (for example with a small patch applied to the Git index) instead of staging the whole file. Verify the cached diff before commit.

### 9. Verify and back up

- Read back copied originals, the frozen preservation manifest, and the mutable enrichment ledger.
- Verify original counts/hashes and ZIP size/hash remain tied to the frozen receipt; separately compute the new enrichment-ledger row count, selected-derivative count, and SHA-256.
- Probe each derivative's codec, dimensions, and byte size, then visually inspect the final derivative set.
- Run Wikilint and remove every finding introduced by touched files while preserving the unrelated baseline.
- Build the site and verify each touched rendered page contains the intended text and asset references. Discover the generator's actual output slug/filename rather than assuming a source title with spaces maps literally.
- Inspect `git diff --cached --name-status` and `--check`.
- Commit/push only intended wiki paths and verify `HEAD` equals the remote branch.
- Deploy the final built tree, retain the changed-asset list and deployment version, and treat the expected unauthenticated challenge as confirmation that the protected route remains gated—not as page-content verification.
- Report unrelated concurrent workspace state without staging it.
