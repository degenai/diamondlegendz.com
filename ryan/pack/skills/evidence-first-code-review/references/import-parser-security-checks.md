# Import parser + URL boundary checks

Use this file when review code introduces/updates file import, archive parsing, or recipe/bookmark ingestion logic.

## What to check first

1. **Find trusted/untrusted seams.**
   - Treat everything from `.json`, `.zip`, `.paprikarecipes`, or uploaded files as untrusted until validated.
   - Track where parsed values become DOM attributes (`href`, `src`, `action`, inline styles).

2. **URL sink audit before acceptance.**
   - For navigational links, enforce an allowlist (`https:`/`http:` only unless product spec differs).
   - Reject `javascript:`, `vbscript:`, `file:`, and `data:` for `href` sinks.
   - If `data:` is intentionally allowed, restrict to image sinks only and explicit MIME checks.
   - Verify sanitization is centralized (one function, one path) so multiple parser branches cannot bypass it.

3. **Size/structure guardrails on binary parsing paths.**
   - Confirm archive/path parsers reject malformed headers/trailers and enforce explicit size/entry limits.
   - Confirm integer conversions are bounded to safe JS ranges and cannot under/overflow silently.

4. **Minimal deterministic repro fixtures (always keep tiny).**
   - JSON with malicious `source_url` (`javascript:`).
   - Recipe-keeper HTML with `recipeSource` link using non-safe scheme.
   - Paprika payload with remote image URL when local-only UX claim exists.
   - Malformed numeric HTML entities / malformed zip structures.

5. **Local-first claim verification.**
   - If app copy says "stored only in this browser," confirm parsed recipes do not introduce implicit remote fetches for core recipe content without explicit disclosure.
   - Remote image links are allowed only as clearly documented tradeoffs.

6. **Evidence output style.**
   - Report concrete `file:line`, exact fixture payload, parser branch, and observed behavior.
   - Classify as:
     - `BLOCKER`: untrusted navigation sink execution or data-loss risk,
     - `MAJOR`: inconsistent local-only contract,
     - `MINOR`: parser robustness gaps that do not lead to user-facing harm.