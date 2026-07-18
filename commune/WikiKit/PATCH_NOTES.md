# WikiKit — Patch Notes

## v1.0.0 — "Captain's-Log Edition" (2026-07-16)

The commune's second drop. First we shipped you a lab (DemonRanchKit); now we're shipping you a memory. **WikiKit** stands up a personal knowledge wiki on your machine — same architecture as Alex's alexpedia, seeded with sanitized starter nodes about the world you two already share, and extended with the one ritual that's yours: the captain's log.

### NEW: The whole wiki, in a box
- Copy one folder, `git init`, paste one CLAUDE.md section, run the linter. You have a compounding, LLM-maintained knowledge graph. Full walkthrough in `INSTALL.md`.
- Eight seed nodes come pre-installed and fully cross-linked, so the graph isn't a blank page on day one — it's already got a shape you can push against.

### NEW: The Captain's Log Protocol
- Your headline feature. Say **"captain's log"** and Claude prompts you — *"Captain's log — go ahead."* — then you talk.
- Your raw words are saved **verbatim**, forever, untouched. A **lightly-edited** readable rendering lands right beneath them: voice-to-text mangling and punctuation fixed, everything else — voice, idioms, profanity, tangents — left exactly as you said it. No summarizing your personality into oatmeal.
- Durable facts get extracted into nodes automatically and logged. The narrative layer and the diagnostic layer stay separate on purpose.

### CHANGED: We took the index out back
- Inherited from alexpedia, on principle: **there is no index file, and there never will be.** The append-only log plus the filesystem are the entire catalog. You find things by *when they entered the wiki*, via grep — not by browsing a topical directory that drifts out of sync the moment you look away.
- Fuck the index. The index is grep.

### PORTED: The lint suite
- Alex's Python lint suite comes along, sanitized for a fresh install: `unlinked`, `orphans`, `broken_links`, `tags_present`. Personal blacklist entries and author-specific skip names stripped out; add your own as you go.
- Runs on Python 3.9+ with zero third-party dependencies. `python -m lint.suite` from `scripts/`. Ships green against the seeded tree.

### SEEDED: Starter nodes
- `Alex` — your collaborator, friendly-face version.
- `Andy` — a stub. It's *your* node; the name's reserved, the story's yours to write.
- `Marceline`, `Olivia` — family stubs. Names reserved, relations and details left blank for you to fill in.
- `diamondlegendz` — the shared site and repo, and the commune channel this kit rode in on.
- `DemonRanchKit` — the portable demon-research lab and its session pattern.
- `financial-demonology` — the field, public docs only, meteorology-era state of play.
- `accordion-tab-forge` — your MIDI-to-accordion tool, the three tiers, and the duet feature.
- `the-compute-commune` — the mutual-aid-infrastructure idea, the shard protocol, Friday sessions.
- `meta` — the design doc: Karpathy's lineage, the no-index divergence, and the captain's-log layer.

### PRIVACY & SECURITY
- **Hard privacy gate on the seed set.** Everything exported is public-face, shared-world, Alex-would-say-it-to-your-face material. No finances, no accounts, no clinical notes, no family-private content, no third-party assessments, no infra secrets. When in doubt, it was left out.
- Verified with a scan of the whole kit against a block-list of sensitive terms before shipping.

### KNOWN ISSUES / BY DESIGN
- The `Andy`, `Marceline`, and `Olivia` nodes are near-empty. That's the feature, not a bug — those are yours to author.
- No index. See above. Working as intended.

---

*"An injury to one is an injury to all" applies to idle CPU cores too. Now it applies to memory, too. — A&F*
