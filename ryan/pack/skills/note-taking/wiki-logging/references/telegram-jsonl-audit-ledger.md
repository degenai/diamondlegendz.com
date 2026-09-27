# Telegram JSONL audit ledger for AlexPedia cross-checks

Use this when Alex asks for an exhaustive audit over a bounded date window of Telegram exports and asks for a **candidate ledger** against AlexPedia.

## Canonical goals

- Capture **every user turn** in range (exhaustive), including voice-memo turn text, then classify with evidence.
- Preserve provenance per line: `message_id`, `session_id`, UTC timestamp, and source file path.
- Produce a line-level ledger with explicit match status:
  - `CANON_MATCH` (already in wiki/log with sufficient evidence)
  - `MISSING_CANDIDATE` (durable but not present)
  - `STALE_CONTRADICTION` (wiki differs from transcript)
  - `NOISE_TOOLING` (tool telemetry/chatgpt/tts runtime boilerplate)
  - `VERBATIM_DEFER` (user-intent but not durable yet)

## Recommended one-pass extraction pattern

1. **Load the export file(s)** for the range into memory with a line parser.
2. For each JSONL row, map a clean text field:
   - prefer `text`
   - fallback `content`
   - if it starts with `"[The user sent a voice message...` extract quoted speech
3. Keep original order, but preserve `message_id` for stable dedupe and citation.
4. Count total rows before and after filtering duplicates/noise.
5. Keep duplicate messages as a signal for automation context:
   - repeated `Test  Test` blocks
   - repeated run instructions
   - repeated runner summaries
6. Build a **`session_id` map** and keep per-session snapshots for traceability.

## Recommended candidate-ledger row schema

Use this exact schema for the ledger table body:

`idx | message_id | session_id | timestamp | match_status | alexpedia_anchor | evidence_summary | source_notes`

- `evidence_summary` should be ~30-120 tokens, quote-correct for factual claims.
- `alexpedia_anchor` should list node paths (e.g. `nodes/robinhood-lab.md`) or be `UNVERIFIED`.
- `source_notes` should include commands/results snippets (e.g. `search in _meta/log`), not interpretation.

## Normalization pitfall notes

- **Voice placeholder noise** can appear as compact bracket strings and not always with a trailing quote char. Parse leniently with regex boundaries.
- **Tool artifact sentences** often look user-authored but are non-user intent (e.g. background process completion notices).
  Tag as `NOISE_TOOLING` unless Alex explicitly asked for a report from those tool outputs.
- **Repeated transcript clones** with only timestamp differences are common if sessions auto-replay after recovery; preserve them as evidence and dedupe only by explicit request.
- If a phrase appears in a wiki node and the same phrase is in many test iterations, classify once per **distinct decision event**, not as a separate fact multiple times.

## Source-check loop (evidence-first)

For each candidate:

1. Find canonical target(s): `~/.claude/wiki` nodes + `_meta/log.md` + dockets.
2. Verify by exact term/phrase search first, then read surrounding blocks.
3. If a candidate is unproven:
   - classify as `MISSING_CANDIDATE` and add follow-up question or docket item
4. If wiki contains a contradictory older claim:
   - classify `STALE_CONTRADICTION` and trigger fix-discipline across all touched surfaces.
5. If durable but provisional:
   - classify `VERBATIM_DEFER` and do not promote.

## One-pass output contract (required)

Every bounded run should emit a stable, machine-readable contract (in stdout or a footer file) so the next operator can verify integrity without rerunning the whole pass.

Required keys:

- `rows_input`
- `rows_parsable`
- `rows_in_window`
- `rows_output`
- `rows_deduped`
- `rows_malformed`
- `status_counts`
- `ledger_path`

`rows_output` is the final ledger count, not the intermediate TSV count.

Final audit response should include:
- Row counts by `match_status`
- Top 5 strongest evidence anchors touched
- Any contradictions unresolved pending user confirmation
- Warnings on false-positive candidates (high repetition / rehearsal text)
- `git diff --cached --check` + commit hash after `wiki-logging` write pass
- A short note if malformed rows were skipped (line count + excerpt sample)

Keep the final output compact; the ledger file itself is the evidence artifact.

## Repro command patterns

- Count total rows:
  - `python - <<'PY'` + JSONL read loop
- Build message-index preview (first N rows):
  - CSV/TSV table with cleaned message text + IDs
- Search wiki anchors:
  - `grep`/`search_files` by target term(s)
- Verify ordering:
  - Ensure newest lines are most recent in `_meta/log.md` sections
