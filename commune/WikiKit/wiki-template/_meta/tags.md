---
visibility: internal
---

# Tag Library

Starter schema for YAML frontmatter. Every node gets frontmatter; `visibility` is required and always the most important field. Grow this file as your own conventions settle.

```yaml
---
visibility: public
aliases: [short name, alternate name]
tags: [person, friend]
---
```

## Visibility (required)
- `private` — you only, never exported
- `family` — visible to family
- `public` — safe to share
- `internal` — `_meta/` tooling, not a graph node

## Node type (add your own as they appear)
person · place · org · project · machine · concept · meta

## Relationship / context (optional)
family · friend · workplace · mutual-aid

Tags are additive — a page can be `[person, family]`. When in doubt, over-tag; completeness beats tidiness.
