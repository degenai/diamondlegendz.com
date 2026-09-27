# `.assetsignore` runtime dependency checks

Use this checklist when a staged `.assetsignore` change is part of a review/audit:

## 1) Capture staged ignore rule state (read-only)

```bash
git -C "<repo>" show :'.assetsignore'
git -C "<repo>" diff --cached -- .assetsignore
```

## 2) Capture deploy-time inclusion evidence

Run the project’s non-mutating package deployment dry-run/log generation and extract ignored assets (for Wrangler, inspect `Ignoring asset:` lines).

## 3) Cross-check against runtime dependencies

- Grep changed frontend/runtime code for externalized resources and lazy fetches:

```bash
rg -n "fetch\(|import\s+['\"][^'\"]+['\"]|\.md\b|\.json\b|\.wasm\b|\.png\b|\.jpg\b|\.webmanifest\b|\.svg\b" <changed_frontend_paths>
```

- If any matched path suffix/segment appears under an ignored pattern, validate one of:
  - route now points to an explicit included path, or
  - `.assetsignore` is narrowed to avoid excluding that asset type, or
  - runtime dependency is intentionally de-scoped.

## 4) Risk bucket mapping

- **High**: runtime-facing dependency is excluded by ignore rule (runtime breakage is immediate user-facing).
- **Medium**: internal fixture/fixture-helper is excluded but only affects non-release path.
- **Low**: intentionally excluded debug/test asset with clear alternative.
- **Nit**: redundant/duplicate directory + glob exclusions.

## 5) Example pitfall to catch

A broad rule like `**/*.md` can pass static review yet silently drop runtime-loaded markdown references.

If code does `fetch('../md/<slug>.md')` and `.assetsignore` has `**/*.md`, the staged tree can look clean and small but shipped assets miss the markdown corpus and case pages render empty/error states.

Smallest fix pattern:
- replace broad `**/*.md` with explicit exclusions for intended source docs, and
- keep runtime data directories out of global ignore rules.
