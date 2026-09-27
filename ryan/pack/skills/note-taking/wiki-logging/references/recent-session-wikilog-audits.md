# Recent-session wikilog audits

Use this procedure when Alex asks to dig through recent sessions, especially Telegram, and make sure durable material was wikilogged and linted.

## Audit sequence

1. **Lead with the live response.** If the request follows casual conversation, answer that conversational turn first, then state the audit scope briefly and begin the durable-work lane.
2. **Discover the real session universe.** Browse the session index and separate human conversation lineages from cron, SEO, monitoring, and other automated sessions. If browse only exposes the newest few lineages, widen discovery with several overlapping durable anchors (wiki terms, recurring people, work, family, and explicit preference phrases), search in both chronological directions when useful, and deduplicate by session ID. One shallow query is not evidence that older sessions do not exist.
3. **Reconstruct each lineage piecewise.** Read the session by ID for its bookends and tail, then scroll bounded windows using the last returned message ID as the next anchor. Telegram may carry many days inside one long lineage whose title describes only its opening topic. Conversely, genuinely older CLI and Telegram sessions may sit outside that lineage and require discovery first.
4. **Strip tool-heavy spans to user-led evidence.** Process polls, giant compaction handoffs, and tool payloads can bury the conversational turns. When a result is persisted because it is large, inspect the saved result and extract the user/assistant messages with IDs rather than rereading every tool blob. Durable-category searches are a valid way to jump to user-led regions, but reopen each hit in context before promoting it.
5. **Build a provenance-aware candidate ledger.** For each candidate, record both status and source:
   - already canonical and backed up;
   - durable but missing;
   - stale or contradictory across nodes;
   - conversational texture or rejected artifact that does not belong in canon;
   - direct user statement, current-file evidence, prior assistant claim, or later synthesis.

   Always capture `message_id`, `session_id`, and timestamp on each row; for Telegram `jsonl` exports this is required for replay continuity and duplicate-lineage proof.

   Keep repeated clones in the ledger as evidence unless you can prove they add no distinct decision signal.
6. **Check the live wiki before writing.** Inspect the relevant nodes, newest `_meta/log.md` entries, git history, and working-tree status. A prior assistant saying “logged” is not proof; current files and commits are. A failed or empty search is also not proof of absence — retry with direct file reads, a narrower path, or an alternate search strategy before deciding the wiki lacks something.
7. **Promote with attribution and evidence boundaries.** User-origin facts may become canon when durable. Assistant synthesis should become canon only when Alex endorsed it, repeated it, or later behavior clearly stabilized it; otherwise label it as an interpretation, proposed framing, or precursor rather than converting it into Alex's quote. Preserve the relationship between dated evidence and standing assumptions: one strong field sample can support a model without becoming a universal rate. If Alex rejected a generated artifact, preserve only any durable positive preference or recurring metaphor, not the rejected asset itself.
8. **Use Alexpedia's log ordering.** Insert the newest audit section immediately below `# Log` in `_meta/log.md`; do not append it to the oldest tail. Read back the inserted block and following entry.
9. **Run the canonical lint suite.** From `wiki/scripts`, run `python -m lint.suite`. Record the total and category counts plus findings on touched files. The scanner can exit successfully while reporting backlog issues; success does not mean zero findings.
10. **Measure regression, not backlog size.** Compare the post-edit total, category counts, and touched-file findings with the baseline. Fix issues introduced by the audit. Report pre-existing findings without broadening the task.
11. **Back up exactly the intended files.** Stage only touched nodes and `_meta/log.md`, run `git diff --cached --check`, inspect the staged file list, commit, push, and verify synchronization. Leave concurrent Obsidian state such as `nodes/.obsidian/workspace.json` and `nodes/.obsidian/graph.json` unstaged.

## Promotion boundary

Promote standing truths, operational evidence, resolved decisions, recurring preferences, and durable conceptual frames. Leave routine game banter, grocery navigation, recipe execution, transient provider/model configuration, one-off errands, and other conversational texture out unless Alex identifies why it matters beyond the moment.

A metaphor or discarded creative attempt may still reveal a durable preference. Preserve the positive standing insight only when it recurs or Alex affirms it; do not archive a rejected artifact merely because the session contains a URL.

## Compact receipt

Report:
- which session lineage(s) were audited;
- what was already canonical;
- what was newly promoted or reconciled;
- lint result and whether the change added regressions;
- commit hash and push status;
- any unrelated dirty file intentionally left untouched.

Do not bury the receipt under a transcript of the audit.