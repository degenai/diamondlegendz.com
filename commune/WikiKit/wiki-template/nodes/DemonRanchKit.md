---
visibility: public
aliases: [Demon Ranch Kit, Demon Ranch]
tags: [project]
seeded-from: alexpedia, 2026-07-16, sanitized
---

# DemonRanchKit

The portable [[financial-demonology|Financial Demonology]] research lab — the first kit shipped through [[the-compute-commune|the compute commune]]. Lives at `commune/DemonRanchKit/` in the [[diamondlegendz|Diamond Legendz]] repo. Research code and one price panel only: **no secrets, no accounts, no money travels.**

## What it is
A self-contained lab you can drop onto any machine: the simulator, the engines and gates, a coin-flip laboratory, a price panel, a research docket of open questions, plus a human `README_ANDY.md` and a `CLAUDE_BRIEF.md` so a fresh Claude session picks up mid-campaign. Everything in it also backs the public pages at thisisez.com/demon-codex.html — read those first; the two minigames are the whole theory in ten minutes.

## The session pattern
1. **Shard the work.** `atlas.py --shard i/N` splits the multiverse by a deterministic hash — [[Alex]]'s machine runs one slice, {Andy}'s runs another, no coordination needed. Vaults merge by concatenation; re-runs skip finished cells.
2. **Brief the session.** Paste `CLAUDE_BRIEF.md` into a Claude Code session on the folder. It carries the house epistemics (ledger over theory, append-only vaults, agreement-gated engine changes, no live trading) and the current question queue.
3. **Report back.** New experiments go in new dated sidecar dirs, each with a `REPORT.md`. Ship results out-of-band; only small derived files enter git.

## The rules that matter
- Research only — no live trading, no advice.
- Append-only: never edit an existing vault or someone else's sidecar.
- Gate every engine change against the canonical reference engine before trusting it.

## See also
[[financial-demonology|Financial Demonology]] · [[the-compute-commune|the compute commune]] · [[diamondlegendz|Diamond Legendz]] · [[Alex]] · [[Andy]]
