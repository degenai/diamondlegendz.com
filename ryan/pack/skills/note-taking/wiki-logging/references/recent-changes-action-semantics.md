# Recent Changes Action Semantics

Use this reference when historical `_meta/log.md` entries render as muted prose, raw wikilink markup, wrong links, or palette fallbacks on Recent Changes.

## Symptom-to-cause map

- `ACTION [[Page]], [[Page|Label]] — note` rendered as `<b>[[Page]], ...</b>` means the target resolver received the entire source string instead of parsed target members. Resolution fails, then the unresolved-target fallback faithfully bolds the raw markup.
- A test using only `Page A + Page B` can be green while production uses comma-separated Obsidian wikilinks. This is **fixture-grammar drift**: the test proves a neighboring input, not the actual source contract.
- Legacy `ACTION note` lines can fall through to generic prose when the parser recognizes only targeted entries. CSS cannot repair this because no action class reaches the markup.
- A recognized action without a dedicated palette class inherits the generic badge color. Treat neutral gray as an explicit semantic choice rather than an accidental fallback.

## Durable target grammar

Support these forms deliberately:

```text
ACTION [[Exact Page]] — note
ACTION [[Page A]], [[page-b|Readable Label]] — note
ACTION Page A + Page B — note              # historical compatibility
ACTION diagnostic prose                    # action-only compatibility
```

For wikilink target lists:

1. Parse with the renderer's canonical wikilink expression.
2. Resolve each page name independently.
3. Preserve `|Display Label` in visible text.
4. Preserve `#Anchor` by slugifying the fragment exactly as normal article links do.
5. Escape both label and final `href`.
6. Feed the same parsed page names to audience/visibility filtering; a target parser used only by HTML output can create a disclosure seam.
7. Preserve a conservative fallback for malformed mixed syntax. Unparseable text may remain escaped prose/bold text, but complete valid `[[...]]` lists must never leak raw brackets.
8. Preserve legacy `Page A + Page B` behavior until the historical log has been explicitly migrated.

## RED-first regression matrix

Start with an exact current `_meta/log.md` target, including its commas, aliases, dollar amounts, and case. The first run must reproduce the real bad HTML—not merely fail a generic link assertion.

Minimum cases:

- exact production `[[Page]], [[Page|Label]]` list emits one anchor per member;
- alias label is shown while the canonical page name resolves the URL;
- anchor fragments use the same slug rules as ordinary article wikilinks;
- legacy `Page A + Page B` still emits separate links;
- full Recent Changes and compact main-page preview use the same target semantics;
- excluded/private member in a parsed target list suppresses the complete row;
- labels and fragments are HTML-escaped;
- malformed mixed syntax cannot become executable HTML;
- generated HTML contains no raw `[[`/`]]` for known target lists;
- action-only, allowlist, repository-reference, and palette behavior remains green.

A screenshot is excellent symptom evidence. The tight loop is a unit test that returns the exact prior HTML such as `<b>[[Page]]</b>` on RED and anchors on GREEN.

## Generated-artifact proof

After the focused test turns GREEN:

1. Run the complete renderer/visibility suite and `python build.py`.
2. Inspect `dist/wiki/Special__RecentChanges.html` (NTFS-safe `Special__`, not a literal colon).
3. Assert every newest-row target URL and visible label.
4. Assert raw `[[` target markup is absent from both Recent Changes and `dist/index.html`.
5. Assert a hidden-member fixture suppresses the row.
6. Run the Worker/frontend suite when the same deploy ships Worker code/assets, even if the Python renderer is the only changed module.

### Shell-safe verification

Inline shell commands can corrupt the verifier itself. In POSIX/Git Bash, `$100K` inside a double-quoted `python -c` payload is subject to shell expansion and can turn a correct label into a false failure. Prefer a quoted script file or quoted heredoc. If an inline command is unavoidable, construct the dollar sign in Python (`chr(36)`) or escape it for the shell. When unit tests/builds pass but an artifact assertion fails, print each expected anchor and nearby emitted context before changing production code.

## Publication discipline

Recent Changes is generated at build time. Git synchronization backs up source but does not refresh the live Worker. Commit only owned files, deploy from the pushed commit—using an isolated worktree when the shared vault is dirty—and record the Wrangler deployment version separately. For an auth-gated site, generated-content proof plus the live login challenge is sufficient; do not type or expose a password solely to inspect the body.

For exact shared-log staging, use `references/concurrent-wiki-commits-with-shared-log.md`. For clean publication from a dirty vault, use `references/clean-render-deploy-from-dirty-worktree.md`.
