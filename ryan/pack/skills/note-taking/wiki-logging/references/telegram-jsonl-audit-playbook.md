# Telegram JSONL Evidence Playbook

Use this when a user asks to exhaustively audit a date-bounded Telegram turn set against Alexpedia.

## 1) Locate the canonical session corpus

Prefer the pre-indexed Hermes cache artifact first (JSONL line store) before reconstructing from source logs.

- File naming is usually: `C:\Users\alexa\AppData\Local\hermes\cache\wikilint\<run_slug>\*.jsonl`
- For one date window, gather all candidate source files for that window and normalize into a single pass.

## 2) Build an evidence-indexable working copy

Create a tabular export before analysis so every candidate can be referenced by stable `message_id`.

- Preserve at minimum: `message_id`, `session_id`, `timestamp`, `title`, and full `content`.
- Keep the timestamp ordering primary; do not rely only on row order.
- Keep one row per user turn (no tool-only rows unless they include user voice payload context).

## 3) Deduplicate and classify

Use deterministic classes to avoid false positives:

- `test`: explicit test probes (`Test`, `Another one`, `O`, `Blep`, etc.)
- `meaningful`: substantive user content, even short operational commands
- `image_voice`: user-provided image / “voice message” wrappers
- `relevant`: meaningful + includes user-facing decision content likely to map to durable wiki facts
- `noise`: duplicate system chatter, meta-bot logs, repeated crash traces without user signal

Do **not** infer meaning from message length alone; run phrase matching only on content + neighboring turns.

## 4) Compare against Alexpedia (evidence-first)

For each candidate:

1. Identify the candidate assertions + entities.
2. Check matching wiki surface (`Alex.md`, people/venue nodes, `_meta/log.md`) before writing.
3. Classify into:
   - already canonical and current,
   - durable but missing,
   - stale/contradictory,
   - should remain conversational/noise.
4. When uncertain, append to `docket` over immediate wiki promotion.

## 5) Build a candidate ledger table

Ledger rows should include:

- `message_id`, `session_id`, `timestamp`
- `claim_excerpt` (short, quote-safe)
- `evidence_path` (jsonl index + extracted TSV row number)
- `alexpedia_target` (node/path)
- `status` (canonical / missing / stale / reject)
- `next_action` (promote, defer, ignore)

Treat this ledger as the audit artifact itself; it is deliverable even before any wiki writes are completed.

## 6) Writeback protocol

- Apply the same fix-discipline used in `recent-session-wikilog-audits.md`.
- Keep all evidence links in the session notes and/or ledger.
- Stage only intended files in git after validation.
- Push promptly so the work is shared and recoverable.

## 7) Failure handling

If parsing/truncation fails:

- fall back to direct `json.loads` with explicit exception capture,
- continue-by-batch, logging bad rows,
- do not discard an entire run for isolated decoding failures.

This prevents a single malformed row from stopping an exhaustive audit.
