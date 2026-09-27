# Bounded Telegram ledger one-pass playbook

Use this when Alex asks for a date-bounded Telegram-to-Alexpedia evidence ledger that must be finished in a single bounded pass.

## Canonical requirement

1. **Run one bounded extraction from the source JSONL** that covers only the requested date window.
2. **Generate the final ledger file in that same pass** (do not pause mid-run for multiple ad-hoc intermediates unless they are read-only diagnostics).
3. Validate the run with stable counts and status totals before starting manual wiki matching.

## One-pass output contract

For each run, capture at minimum:

- `rows_input`
- `rows_parsable`
- `rows_in_window`
- `rows_kept`
- `rows_output`
- `rows_deduped`
- `rows_malformed`
- `status_counts` (`CANON_MATCH`, `MISSING_CANDIDATE`, `STALE_CONTRADICTION`, `NOISE_TOOLING`, `VERBATIM_DEFER`, etc.)
- path of final required artifact (typically user-specified, e.g. `02_ledger.md`, `03_ledger.md`)

Emit these as compact machine-readable values (JSON or TSV footer) so the next operator can confirm audit integrity without relying on terminal truncation.

`rows_output` is the number of entries written into the final ledger (post-filtering, post-dedupe).

For malformed JSON rows, emit sample diagnostics and continue; do not abort the whole run.

If the input has zero matches in the requested window, still write an explicit ledger with `rows_output=0` plus diagnostic reason.
## Normalization rules (mandatory)

Normalize each row before dedupe/classify:

- Prefer `text`, fallback `content`, fallback `message`.
- Strip user voice wrappers such as:
  - `"[The user sent a voice message~ Here's what they said: \"...\""]`
  - generic bracket wrappers `[...]` that only carry user speech quotes.
- Replace fancy quotes with ASCII, collapse whitespace, and strip leading/trailing quote wrappers.
- Keep both:
  - canonical normalized text (for matching/dedup)
  - original raw text (for audit traceability)

## Failure pattern and recovery

- If the parser fails on malformed JSON, skip the bad line, record `{line_no, raw_excerpt, error}` and continue.
- If no wiki hits are found from initial matching heuristics, do not treat it as a finished negative — still deliver the normalized + deduped ledger and mark those entries for manual adjudication.

## Delegation containment

Delegation may accelerate discovery, but the orchestrator owns the final ledger contract.

1. Give each worker a deterministic preprocessor, an exact output path, and an explicit checkpoint: **write the final ledger before spending calls on prose summaries or broad wiki tours**.
2. Treat a worker that returns candidate files without the required ledger as incomplete, regardless of its reported status. Reuse its normalized corpus; do not repeat source discovery.
3. Allow at most one narrower retry of the same artifact contract. If the retry also reaches its call/context budget without writing the ledger, finish locally from the machine-ready corpus rather than launching another equivalent fan-out.
4. Verify artifacts directly before adjudication:
   - file exists and is non-empty
   - table-row count equals `rows_output`
   - `sum(status_counts.values()) == rows_output`
   - raw, parsable, unique, and deduped counts reconcile
   - receipt/footer parses as machine-readable data
   - deterministic rerun produces the same receipt/hash when inputs are unchanged
5. Subagent summaries are reconnaissance, never proof that a file was written. Read and validate the artifact itself.

This keeps leaf call budgets from turning a bounded audit into repeated half-passes while preserving useful dedupe/candidate work already produced.

## Recommended command shape

- `python scripts/extract_telegram_jsonl_to_ledger.py --input <jsonl> --output <ledger.tsv> --start YYYY-MM-DD --end YYYY-MM-DD [--dedupe] [--summary-json <run_summary.json>]`
- `python` should be used from the active shell (some environments expose `python3` inconsistently); keep one command per stage.

Post-processing should append/compute only what is required to write the required final artifact (e.g., `03_ledger.md`) and preserve IDs:
`message_id`, `session_id`, `timestamp`, `first_seen`, `raw_excerpt`, `normalized_excerpt`, `match_status`, `alexpedia_target`.

## What to include in `03_ledger.md`

A practical minimal shape:

`index | count | status | message_id | session_id | first_seen | excerpt | evidence_anchor | notes`

Keep this artifact deterministic and ordered for diff-stability (`first_seen` ascending).

## Post-pass handoff

After final file generation:

1. Update `docket.md` for uncertain entries (no immediate wiki promotion).
2. Run wikilint only on files touched by this audit.
3. Stage only intended wiki/log paths and commit.
4. Send a compact summary: row totals, noise ratio, top unmatched candidate themes, and verification command outputs.