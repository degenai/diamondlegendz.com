# Porting AlexPedia content labs between brands

Use this when Alex asks to make a post pipeline, draft queue, content lab, review queue, or similar working folder for a related brand/project.

## Core distinction

Port the **engine**; rewrite the **brand wall**.

Engine elements usually port directly:

- `README.md` workflow
- `template.md`
- `queue.py` / deterministic lint-rank-stats helper
- `queue.md` generated queue
- `analytics.md`
- `privacy.md`
- `data/` templates
- `review-portal.md` future-site sketch

Brand elements must be rewritten:

- voice and tone rules
- hard gates
- banned claims
- CTA/funnel definitions
- IP/trademark guardrails
- project-specific privacy concerns
- what counts as a successful conversion

Example: Elbow Room bans kayfabe because it is the clinical/professional face. People’s Elbow requires kayfabe because it is the spectacle/outreach arm, but still bans fake science, WWE borrowing, bad 50/50 math, and client privacy leaks.

## Placement in AlexPedia

Working inventories belong under `content/<project>-<channel>/`, not `nodes/`, because drafts are mutable inventory rather than graph nodes.

Create or update one graph node as the pointer, e.g. `nodes/Peoples Elbow Propaganda.md`, with:

- folder path
- purpose
- current batch count
- helper command
- relationship to related nodes

Do not create an index. AlexPedia uses filesystem + `_meta/log.md`.

## Validation ladder

1. Run the local helper, if present:

```bash
python queue.py lint
python queue.py rank
python queue.py stats
```

2. Read the generated `queue.md` top rows.
3. Run AlexPedia lint:

```bash
cd /c/Users/<you>/.claude/wiki/scripts && python -m lint.suite
```

4. Fix new obvious wiki-link issues introduced in pointer nodes. Do not turn the whole-wiki backlog into the task unless Alex asks.
5. Append a concise `_meta/log.md` entry listing created/updated working folder and node pointers.
6. Commit and push from `C:\Users\alexa\.claude\wiki` when AlexPedia is the intended durable home.

## Future website review areas

If Alex says the queue could later live on a secret/unlisted website area, capture intent in a local design doc first. Do not build Cloudflare/Workers/D1 until the flat-file source system exists and Alex explicitly asks for a deploy.

Design doc should say:

- who reviews
- allowed actions: approve, request changes, retire, ready
- markdown files remain canonical
- no auto-publishing
- unlisted is not security; use password protection at minimum

## Source-backed lineage posts

For historical inspiration posts, create both:

1. a draft post in the content lab, and
2. a real graph node if the person/concept is central enough to become future reusable context.

The node should include source cautions: dates, what not to overclaim, and how to avoid flattening a person into mere mascot flavor.
