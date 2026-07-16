---
visibility: public
aliases: [compute commune, the commune]
tags: [concept, project]
seeded-from: alexpedia, 2026-07-16, sanitized
---

# the-compute-commune

Mutual-aid infrastructure for research that needs more compute (and more AI budget) than one person has lying around. The idea: **pool idle machines and spare Claude budget so nobody's cores sit cold while there's work to run.** [[Andy]] is the first confirmed node.

> "An injury to one is an injury to all" applies to idle CPU cores too.

## How it works
- **Symmetric protocol.** Work is packaged as a portable kit (the first is [[DemonRanchKit]]) that runs identically on any member's machine. No secrets travel — only research code and data.
- **Sharding.** A job splits by a deterministic hash (`--shard i/N`): each member computes their slice, results merge by concatenation, and re-runs skip finished work. No central coordinator.
- **Reciprocity is the design.** The protocol runs both directions — whoever has spare capacity this week takes the shard; the favor is expected to flow back, not banked.
- **Friday sessions.** The standing cadence: a research session on pooled resources, using whoever's plan has room to spare that week.

## The first commune
[[Andy]] offered a machine for sharded runs and AI budget for sessions, unprompted, and got the demon aesthetic immediately: *"I love the demon vibe. Fitting for how evil money making can be."* The first kit, [[DemonRanchKit]], shipped the same night. This wiki's kit (WikiKit) rides the same channel — infrastructure shared the same way the research is.

## See also
[[DemonRanchKit]] · [[financial-demonology|Financial Demonology]] · [[Andy]] · [[Alex]] · [[diamondlegendz|Diamond Legendz]]
