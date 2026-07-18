---
visibility: public
aliases: [DL, DLz, diamondlegendz.com, Diamond Legendz]
tags: [project]
seeded-from: alexpedia, 2026-07-16, sanitized
---

# diamondlegendz

The sandbox site and shared repo co-owned by [[Alex]] and [[Andy]], living at **diamondlegendz.com** (GitHub Pages for hosting, Cloudflare for DNS + email routing). Its README calls it a "Vibe Coding Sandbox," which is accurate: it's the homebase for research projects and AI/infra tinkering that doesn't need to be production-grade.

## What lives here
- **[[accordion-tab-forge]]** (`accordion-tab/`) — MIDI-to-accordion-notation tool, [[Andy]]'s pitch, built around his Hohner Panther. Feasibility stage.
- **[[DemonRanchKit]]** (`commune/DemonRanchKit/`) — the portable Financial Demonology lab. See [[the-compute-commune|the compute commune]].
- **WikiKit** (`commune/WikiKit/`) — this kit: the installable personal-wiki patch you used to stand up the wiki you're reading now.
- Other toys: a Pokemon-zodiac scholarly page, a browser MIDI player, a sealed-collectible tracker, and assorted stubs. The repo is where unfinished ideas get to live visibly.

## The commune channel
`commune/` is the shared-infrastructure corner of the repo — portable kits that travel between collaborators' machines. Rules for anyone contributing (human or Claude): branch and PR always, never push to `main`; append-only (new dated dirs, never edit someone else's work); big result files ship out-of-band, not in git. See [[the-compute-commune|the compute commune]].

## Kit history
- **[[DemonRanchKit]]** — first commune kit (July 2026): the portable demon-research lab, sharded across machines.
- **WikiKit** — second commune kit: this one. A personal wiki, seeded from alexpedia, with {Andy}'s captain's-log ritual bolted on.

## Infrastructure
- Hosting: GitHub Pages, branch = `main`
- DNS / edge: Cloudflare
- Commit style: Steam-patch-notes voice — user-facing news, not git jargon. See the repo's `CONTRIBUTING.md`.

## See also
[[Alex]] · [[Andy]] · [[accordion-tab-forge]] · [[DemonRanchKit]] · [[the-compute-commune|the compute commune]]
