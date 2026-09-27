# Alexpedia auto-deploy pipeline (2026-08-16)

Status: the graph→render pipeline is AUTOMATED. Manual deploys are now the exception, not the rule.

## Current automation
- Cron job `aa629579220b` — "Alexpedia auto-deploy on wiki commit" (Hermes cron).
- Trigger: `monitor_script` = `alexpedia_wiki_head.py` (prints the wiki repo's git HEAD hash; stable bytes per state, so unchanged output suppresses the tick).
- Cadence: every 15 minutes, forever.
- On HEAD change the job runs, terminal-only:
  1. `cd C:/Users/alexa/.claude/wiki/site`
  2. `python build.py` (must exit 0)
  3. `python -m unittest test_build.py -q` (must pass)
  4. `npx --no-install wrangler deploy` (must succeed)
  5. Any failure → hard stop, report the failing step + error excerpt. No partial deploys.
- The job NEVER commits into the wiki repo (a receipt commit would change HEAD and self-trigger forever). Its one-line report is the cron delivery.

## Session rules
- When a wiki commit lands and Alex asks about live visibility: check the cron's recent runs BEFORE manually deploying. Lag ≤ 15 min is the design, not a fault.
- Do NOT create duplicate deploy watchers (git hooks, second crons) — they race the existing job.
- Manual smoke deploy is only for diagnosing the pipeline: same three commands, log to `~/AppData/Local/hermes/cron/output/`.
- First tick after job creation always fires as a baseline (idempotent — harmless self-test).

## Cron creation gotcha (hit while building this job)
`schedule='15m'` parses as "once in 15m" (repeat=once) — recurring intervals need `'every 15m'` (repeat=forever). And updating an existing job's schedule does NOT re-derive its repeat field: remove + recreate when the recurrence semantics must change. Always read the returned job object's `repeat` field to confirm.

## Renderer identity
- The LIVE site (`alexpedia.alex-adamczyk.workers.dev`) is the wiki repo's own Worker: `.claude/wiki/site/` → `build.py` + `worker.js` + `wrangler.jsonc` (+ D1 `alexpedia-suggestions`, email binding, AI binding).
- `Desktop/alexpedia-quartz` is a Quartz (jackyzha0) rendering EXPERIMENT — not the live renderer. Don't build/deploy from there for Alexpedia changes.
- `site/dist/` is gitignored; Cloudflare incremental asset upload makes routine refreshes fast (~6.5s deploy observed).

## Search pitfall: hidden-directory roots return false zeros
The wiki lives at `C:\Users\alexa\.claude\wiki` — a HIDDEN directory (leading dot). ripgrep-backed search tools skip hidden trees by default, so content searches inside the wiki return zero hits even when the term exists. Hit live 2026-08-16: "Massage Envy" and "Cherokee" both reported absent while `nodes/Atticus Franchise Group.md` and `nodes/Cherokee Center for Change.md` existed. When searching the wiki, use `rg --hidden` via the terminal instead of search_files. This is a standing member of the absence-claim evidence ladder: a zero-result search is a retrieval result, not proof of absence.
