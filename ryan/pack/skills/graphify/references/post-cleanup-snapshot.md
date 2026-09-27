# Post-cleanup Graphify rerun pattern

Use this when Graphify output is part of a repo cleanup/review loop rather than a one-off exploration.

## Pattern

1. Run the first Graphify pass to expose structure and graph hygiene issues.
2. Run cleanup/review agents against `graphify-out/GRAPH_REPORT.md` and `graphify-out/graph.json`.
3. Apply accepted code/docs/config fixes first. Do **not** rerun Graphify after every small patch.
4. After tests/regeneration pass and the tree is stable, rerun Graphify once:

```bash
graphify extract . --backend deepseek --out . --api-timeout 600 --max-concurrency 2
graphify cluster-only . --backend deepseek
graphify diagnose multigraph --graph graphify-out/graph.json --max-examples 10 > graphify-out/diagnose_multigraph.txt
```

5. Keep volatile `graphify-out/` ignored when it contains caches/deduplicated mirrors. If the repo needs a reviewable graph artifact, copy only the curated outputs into a stable path such as `sidecars/graphify/<date>/`:

```bash
mkdir -p sidecars/graphify/$(date +%Y%m%d)
cp graphify-out/GRAPH_REPORT.md graphify-out/graph.json graphify-out/manifest.json graphify-out/diagnose_multigraph.txt sidecars/graphify/$(date +%Y%m%d)/
```

6. Verify the final graph is telling the intended story and not preserving cleanup targets as stale nodes:

- expected new concepts/nodes are present;
- phantom/stale file names from earlier docs are gone;
- `diagnose multigraph` has no collapse/dangling surprises;
- `GRAPH_REPORT.md` has no import cycles unless expected.

## Pitfalls

- `graph.json` uses `links` for edge records in some Graphify versions; do not assume the key is always `edges` when summarizing counts.
- Do not commit `graphify-out/cache/`, dated mirrors, or tool scratch output unless the repo intentionally wants full reproducibility of Graphify internals.
- If review-agent prompts mention obsolete filenames, do not commit those prompts into the corpus before the final rerun unless you want Graphify to rediscover those obsolete strings.
