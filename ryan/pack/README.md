# Hermes starter pack for Ryan

From Alex's working Hermes setup, 2026-09-26. Everything here is what he actually runs, minus his secrets and the personal parts of his persona file.

## What's in it

- `SOUL.md`: how the agent should be. One pilot (you), disposable agents, propose before you mutate, evidence first, and the SYNC RATE rule: in any multi-step or delegated work the agent stops at every fork and asks you three or four multiple-choice questions, recommended option first, before launching the next worker. This is the single most useful habit in the pack.
- `config.yaml`: Alex's config with every key, token, id and path blanked. Use it to see how he wires providers, fallbacks, cron and the gateway; let Hermes' own login flow fill the secrets.
- `skills/`: the ones he reaches for.
  - `project-workflows/eva-pattern`: the EVA pattern. One piloted chat writes the design doc and phase briefs; a strong model builds one phase at a time; a cheap model nitpicks between; the pilot gates with questions to you. Includes the process-hygiene rules learned the hard way (kill only recorded PIDs, one builder at a time, no console pop-ups).
  - `software-development/nitpick-relay`: sequential cheap-model review passes, one tiny falsifiable scope each, findings verified before fixes.
  - `research/llm-wiki` and `note-taking/wiki-logging`: the personal wiki method (Karpathy-style, with a log instead of an index) and how the agent writes to it.
  - `graphify`: turn any folder into a knowledge graph you can query.
  - `evidence-first-code-review` and `cross-system-adversarial-audit`: review doctrines that demand receipts.

## Install

1. Find your Hermes data directory: on Windows it is `%LOCALAPPDATA%\hermes` (`C:\Users\<you>\AppData\Local\hermes`).
2. Copy `SOUL.md` over the one there (keep a backup of yours). Edit the first line if you want a different name.
3. Copy each folder under `skills/` into `hermes\skills\` at the same path (for example `skills\project-workflows\eva-pattern`). Restart Hermes or reload skills.
4. Do not copy `config.yaml` over yours wholesale. Open both side by side and take the parts you want (fallback providers, cron, gateway settings). Keys come from Hermes' login, never from a file you got from someone else.
5. First conversation: tell it "run it like the EVA pattern" on any multi-step job and answer the questions it asks.

## The one idea

The agents are disposable; you are not. Keep the intent and the judgment in one seat, rent compute in short bursts, and make the machine ask before it acts. Alex's line: "what's primarily important is our sync rate."
