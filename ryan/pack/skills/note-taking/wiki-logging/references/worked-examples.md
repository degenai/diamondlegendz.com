# Worked Examples — Wiki-Logging Fix Discipline

These are annotated case studies from real sessions. Each shows the four-document fix discipline in action.

---

## Example 1: Cloud Nine = Smokeshop (2026-06-14)

**The error:** Agent created a separate "Smokeshop" entry alongside the existing "Cloud Nine on Hwy 92" entry in both docket and wiki. The user corrected: "the smoke shop IS cloud nine lmao."

**What was wrong:** Two separate entries for the same entity across log, docket, wiki node, and wiki log. The smokeshop entry also invented a strategic narrative ("Morgan greenlit as PE venue — PR compatibility") when the user's actual framing was a human courtesy check.

**Fix applied across all four documents:**

1. **log.md** — Rewrote the session entry: "Cloud Nine clarified — it IS a smokeshop" with the accurate sequence (cold visit → fundraising first → pivot → Morgan courtesy check)
2. **docket.md** — Merged the separate "Smokeshop" entry into the Cloud Nine entry. Removed the standalone smokeshop section.
3. **peoples-elbow.md** (wiki node) — Updated the Cloud Nine venue entry with the cold-visit sequence. Removed the separate "PE carries awkward venues" paragraph (invented narrative).
4. **_meta/log.md** (wiki log) — Corrected the promotion record from "smokeshop greenlit" to "Cloud Nine corrected: it is the smokeshop"

**Key lesson:** When the user says "X IS Y," merge everywhere — don't just delete the duplicate.

---

## Example 2: Pedro Alicano — Client, Not LMT (2026-06-14)

**The error:** User asked to add Pedro Alicano to the docket. Agent assumed he was an LMT being recruited, created a wiki node describing him as a therapist, and titled the docket section "Recruitment."

**What was wrong:** Pedro is a client — the Spanish-speaking client whose discrimination at ME Woodstock was the catalyst for Alex leaving. The wiki already contained this fact in Alex's career arc node, but the agent didn't grep before writing.

**Fix applied:**

1. **Pedro Alicano.md** — Completely rewritten: not an LMT, a client. The discrimination incident is the key fact.
2. **docket.md** — Section renamed from "Recruitment" to "Client outreach." Pedro description corrected.
3. **_meta/log.md** — Entry corrected from "LMT recruited" to "client, discrimination incident."

**Key lesson:** Grep the wiki BEFORE creating or updating a node. The wiki already knew Pedro was a client — the agent just didn't check.
