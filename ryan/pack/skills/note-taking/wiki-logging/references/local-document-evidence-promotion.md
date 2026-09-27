# Local document evidence promotion

Use this workflow when the user supplies a `file:///...` URI or local document path and asks to preserve its durable meaning in the private wiki.

## Evidence ladder

1. **Inspect the direct artifact first.** Decode a file URI to the concrete local path and read that source before relying on session history, pasted excerpts, filenames, or earlier summaries.
2. **Extract the text layer.** Use the document/PDF extraction path appropriate to the file. Treat extracted text as evidence, not the final interpretation; PDFs may contain duplicate, reordered, hidden, or layout-detached text.
3. **Render and visually verify layout-dependent facts.** Check the page image whenever the decision depends on checked options, blank panels, signatures, stamps, certificate holders, named recipients, dates, limits, tables, or endorsements. A blank field can be decisive and may be invisible in text extraction.
4. **Reconcile both channels explicitly.** State which facts are text-confirmed, visually confirmed, ambiguous, or absent from this artifact.

## Privacy and provenance

- Keep the source document local by default when it contains addresses, identifiers, membership numbers, policy numbers, signatures, or other sensitive data. Do not add the binary to the wiki repository unless the user explicitly wants archival there.
- In a `visibility: private` note, record the local source path when another agent on the same machine needs retrieval, plus a SHA-256 checksum when stable provenance matters.
- Avoid duplicating sensitive identifiers into prose when the source file already preserves them. Record that an identifier is present without repeating it unless the workflow requires the exact value.
- Keep the user-facing receipt free of unnecessary addresses, phone numbers, IDs, and signatures.

## Evidence-state transition

Classify each requirement as one of:

- **Verified by this artifact** — the document establishes it directly.
- **Not evidenced by this artifact** — a field is blank or the required entity/endorsement is absent from the page.
- **Still unresolved** — another declaration, endorsement, signature, or authoritative answer is needed.

Closing one proof gap often reveals a narrower blocker. Rewrite stale language rather than appending a contradictory update. A generic certificate, for example, may verify active dates and limits while leaving a location-specific or additional-insured endorsement unresolved. A blank field proves only that this artifact does not evidence the item; it does not prove no separate endorsement exists.

## Promotion surfaces

1. Update the private evidence node with source status, verified facts, unresolved facts, and a next-action checklist.
2. Update the related person, venue, business, or project node so its current state is accurate.
3. Narrow reminders and docket items from the old broad blocker to the remaining specific action.
4. Add temporal diagnostic entries to the MCU log and wiki `_meta/log.md`.
5. Run content readback, `git diff --check`, and wikilint; stage and push only the intended wiki paths.

## Patch-safety note

A bulk or multi-file patch may report success after applying only part of the intended change. Inspect the returned diff. If any hunk is missing or surrounding prose is damaged, stop, reread the full target block, repair that file alone, and only then continue to the other surfaces.