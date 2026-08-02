# Kathie’s Kitchen

A local-first recipe browser for tablet and mobile. The public room contains only the app shell; imported cookbooks live in the browser’s IndexedDB.

## Supported imports

- Recipe Keeper `.zip`
- Paprika `.paprikarecipes`
- Kathie’s Kitchen v1 `.json`

## Local verification

```bash
node --test recipe-book/tests/core.test.mjs
python -m http.server 4173
```

Then open `http://localhost:4173/recipe-book/`.

The vendored `fflate` module is pinned at 0.8.2; its MIT license is in `lib/fflate.LICENSE`.
