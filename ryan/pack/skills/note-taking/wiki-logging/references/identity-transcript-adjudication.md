# Identity and Transcript Adjudication

Use this gate when an evidence ledger surfaces a person, nickname, organization, or speech-to-text rendering whose referent appears uncertain.

## Canon-first resolution gate

1. Search the full canonical store for the exact token and likely semantic descriptors (role, company, relationship, project, venue).
2. Inspect likely hub nodes, relationship tables, aliases, and backlinks directly. A referent may already be mapped outside the note currently under review.
3. Validate search scope before treating a zero-result as evidence. Confirm root path, file coverage, case/normalization, and then use an independent store-wide inventory or direct hub reads.
4. Compare the latest user statement with existing canon. When they agree, resolve the candidate immediately instead of asking the user to repeat known context.
5. Ask a clarification only after the canonical store and likely hub nodes have been checked.

## Raw evidence versus derived surfaces

- Raw transcripts and source exports preserve the literal source rendering for provenance.
- Canonical notes, temporal logs, adjudication ledgers, generated snippets, and analysis caches carry the accepted identity only.
- Phonetic and transcription variants may be used transiently for retrieval; accepted labels are the only variants promoted into durable prose.

## Correction sweep

When the user resolves an identity or transcript rendering:

1. Update the canonical person/topic node and any hub table that owns the relationship.
2. Correct prior diagnostic or temporal-log language with positive, accepted wording.
3. Resolve the adjudication record and refresh or correct derived snippets/caches that copied stale canonical text.
4. Sweep durable wiki surfaces for the superseded token; preserve literal occurrences only inside clearly identified raw-source evidence.
5. Run the full wiki linter and scoped diff checks.
6. In a shared working tree, stage an isolated index or exact hunks so unrelated concurrent work remains untouched.

## Failure mode this prevents

A global search can return no hit because its path, normalization, or file coverage differs from the intended canonical scope. The correct response is a second independent canonical check, not an unnecessary identity question. A user saying “you know that” is a signal that the resolution gate was skipped.
