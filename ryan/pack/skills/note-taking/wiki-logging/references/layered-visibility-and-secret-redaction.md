# Layered visibility model + build-time secret redaction (Alexpedia)

Worked implementation from 2026-08-07, when Alex corrected the audience model:
household renders `internal`; only `medical` is hidden; the future Adamczykpedia
layer excludes `internal` too.

## The model (Alex's authoritative framing)

```
Layer              Renders                                   Hides
Household (now)    public + family + private + internal      medical
Adamczykpedia      public + family                           internal + medical
Auto-Bio-Graph     public                                    family + internal + medical
```

- `build()` household call: `render_view(source_paths, {"public", "family", "private", "internal"}, DIST)`
- `build()` medical call: `render_view(source_paths, {"public", "family", "private", "internal", "medical"}, DIST / "medical", ...)`
- Adamczykpedia scope: `python build.py --visibility public family` (already existed in CLI help)
- `VIS_LABELS` in `site/build.py` already defines `internal` ("Tooling, not a graph node").

Consequences observed after enabling internal in the household build:
- Household articles 148 → 162; redlinks 11 → 6 (Demon Ranch, Agent Board System,
  subagents, dev-flashcards, Telegram image intake resolved).
- Previously-blank `UPDATED [[Demon Ranch]]` log sections now render (the blank
  section was the model being over-restrictive, not missing data).

## Secret redaction (chosen option: internal renders, values redacted)

Only two live secret tokens existed in internal nodes:
- Alexpedia login password (`orchid-vonnegut-trefoil-22`) in `api-keys.md`
- Google OAuth client secret (`GOCSPX-…`) in `google-cloud-credentials.md`
(DeepSeek key was already `«redacted:sk-…»` in source; medical password lives in
DPAPI, never in the tree.)

Implementation in `site/build.py`:

```python
REDACT_SECRETS = (
    "orchid-vonnegut-trefoil-22",
    "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",
)

def redact_secrets(text):
    for token in REDACT_SECRETS:
        text = text.replace(token, "«redacted»")
    return text
```

Hooks (BOTH required):
1. `Page.plain_text` — final `return redact_secrets(t[:limit])` scrubs the search index.
2. `page_shell` — `out = """...""" % {...}` then `return redact_secrets(out)` scrubs every
   generated HTML surface including Recent Changes rows and the main-page preview.

Pitfall that cost a test failure: appending `return redact_secrets(out)` after the
original `return """...""" % {...}` leaves it unreachable (dead code, `out` undefined);
the build still succeeds but nothing is redacted. Bind the template to `out` first.

When rotating/adding a credential that appears in a wiki node, extend `REDACT_SECRETS`.
Never store new raw secrets in nodes — prefer the `«redacted:…»` source convention.

## Renderer fix for all-filtered sections

`recent_changes_page` and `main_page` both emitted the heading/`<ul>` before filtering
entries. Fix: collect `rows` per section, `continue` if `rows` is empty, then emit
heading + rows + `</ul>`. Same shape in both render sites. Keeps visible sections intact
while suppressing orphan headings.

## Test shape (test_build.py)

`test_default_build_isolates_medical_but_renders_internal_redacted`:
- internal node with `tags: [meta, secrets]` containing a canary + the literal password
- log row mentioning the password
- asserts: internal canary IN household text; literal password NOT IN household text;
  `«redacted»` present; internal asset copied; medical canary absent; medical asset not
  copied to household; log rows mentioning the secret redacted on the main page.

## Verification checklist before deploy

1. `python build.py` — article/category counts + redlink report (regression check).
2. `python -m unittest test_build.py` — 14 tests, all green.
3. Household leak sweep: iterate `dist/**/*.html` outside `dist/medical`, assert no
   `REDACT_SECRETS` token appears; assert `«redacted»` present on the api-keys page.
4. `dist/wiki/Special__RecentChanges.html` contains the previously-blank section entries.
5. Build/deploy from an isolated detached worktree of pushed HEAD (see
   `clean-render-deploy-from-dirty-worktree.md`), keep the Worker `Current Version ID`.
6. Unauthenticated route probes still return the auth challenge (401).
