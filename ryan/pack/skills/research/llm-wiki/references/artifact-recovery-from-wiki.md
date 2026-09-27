# Recovering a rendered artifact from wiki context

Use this when the user remembers a concept documented in the wiki but wants the newest concrete deliverable: HTML, PDF, image, deck, sheet, or other rendered artifact.

## Retrieval model

The wiki is often the **canonical semantic source**, while the newest presentation artifact may live in another repo, workspace, temp export, or public site. Do not assume the wiki file itself is the deliverable.

## Procedure

1. **Inspect any direct source the user names first.** A live URL, repo, path, or app is stronger evidence of current state than conversation history.
2. **Search the wiki by concept, not only by requested filename.** Try title fragments, aliases, character/project names, dates, and uncommon remembered mechanics.
3. **Read the canonical node and extract fingerprints.** Capture distinctive strings such as a title, tagline, companion name, class/build, motto, uncommon feature, or creation date.
4. **Search likely artifact roots using those fingerprints.** Search filenames first, then content across relevant HTML/PDF/source extensions. If indexed search misses, use a bounded read-only scan of likely user-document roots rather than treating zero results as absence.
5. **Reject false positives by reading candidates.** Generic terms such as `character`, `sheet`, `inspired`, or `summit` can match unrelated finance sheets, game articles, or scraped pages.
6. **Establish recency with multiple clocks.** Compare the wiki node's creation/history, artifact modification time, and repository commit history. A later render can legitimately be newer than its source note.
7. **Verify the artifact itself.** Confirm title and content, parse/read the file, render it locally when practical, and visually check legibility, clipping, overflow, and missing assets.
8. **Verify delivery separately from existence.** Check the public/live route. A committed local artifact and a deployed public artifact are different claims.
9. **Deliver a working copy.** If the live route is absent or stale, attach the exact local file. Use a friendly filename and verify the copy is byte-identical (`cmp`/hash) before sending.
10. **Report confidence and provenance compactly.** Name the canonical source, artifact date/version, key fingerprints, render result, and any deployment gap.

## Voice-transcription clue handling

Resolve a likely STT substitution only when the recovered artifact makes the intended term unambiguous. For example, a remembered "AI-inspired summit" may resolve to an AI-inspired **summon/familiar** when the canonical sheet contains a uniquely matching owl familiar. State the inference rather than silently rewriting the user.

## Incident pattern captured

The canonical AlexPedia node documented **The Second**, a D&D Mastermind Rogue created July 11. Unique fingerprints—`FABLE the Owl`, `NOW PIVOT`, `pocket sand`, and the deliberately flat ability array—located a newer standalone parchment HTML in another repo. Git history showed the HTML was committed July 19. Unrelated files named `candidate-sheet` and scraped Magic articles were rejected after content inspection. The HTML rendered cleanly locally, while the public route returned 404; the correct delivery was therefore a verified byte-identical HTML attachment, not a dead link.