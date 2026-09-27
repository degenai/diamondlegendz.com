# Static web review pitfalls (practical notes)

## 1) Scope HTML validators to HTML files

If you pass mixed globs like `*.html tests/*.mjs` into an HTML validator,
non-HTML fixtures will trigger tokenizer/parser errors (for example on regex-heavy
JavaScript regex text) and fail the command even when HTML files are valid.

### Action

- Use explicit HTML-only globs (`*.html`, `**/*.html`) for html-validate.
- Re-run once validation passes on corrected glob before escalating.

## 2) Non-scripted tests are outside npm script scope

Some repos define `npm test` narrowly (e.g. only `js/crm/*.test.js`).
New or auxiliary test files (often `tests/*.mjs`) will be skipped and can hide
regressions if not run explicitly.

### Action

- Discover additional test paths and run directly with Node:
  - `node --test tests/*.mjs`
  - `node --test tests/**/*.mjs`

## 3) Package script entrypoint correctness

If a repo-local Python lint script fails with errors such as
`ImportError: attempted relative import with no known parent package`, run the
suite as a package module instead of a file path.

Example:

```bash
cd "<repo>"
python -m scripts.lint.suite
```

Log this as an execution-context issue and keep the focus on evidence-backed code
regressions.

## 4) Report command evidence explicitly

For each verification pass, record:

- command executed,
- exact pass/fail result,
- whether failure was code-regression or invocation-scoped (globs/paths).

## 5) Verify ignore-glob side effects on deployable assets

Broad broad-staged ignore patterns (`**/*.md`, `**/*.py`, `**/*.json`, etc.) are often
added for broad cleanup but can silently suppress runtime-required assets.

### Action

- Extract ignore and packaging evidence (`git show :'.assetsignore'`, `wrangler` dry-run logs).
- Cross-check ignored paths against runtime `fetch/import` usage in changed frontend code.
- Treat missing runtime data as a functional issue (not only config hygiene).
