# Accordion-Tab Forge — Engineering Spec (v0, feasibility)

**Working title:** placeholder — final name TBD next session.
**Status:** feasibility research only. No code written.
**Origin:** Andy convo, 2026-05-04, accordion sheet music for *Gallo de Pelea* (commonly transcribed in Mi/E, conjunto-norteño tradition). Google AI Mode kicked the request to YouTube tutorials, no usable sheet music returned.
**Reference instrument:** Hohner Panther in **GCF** (Andy's, confirmed 2026-05-04). 3 rows, 31 treble buttons, 12 bass buttons. The conjunto / norteño workhorse. Panther GCF is also called "Sol" in Mexican accordion parlance — G/Sol is the dominant outer row.

---

## 1. Problem

Diatonic button accordion (DBA) players — particularly Tex-Mex / norteño / conjunto / vallenato communities — have **almost no sheet music access** for their repertoire. The tradition is overwhelmingly oral: learn from grandpa, learn from YouTube, transcribe by ear. The few standard-notation transcriptions that exist are usually in piano-roll or guitar-friendly formats that **do not address the actual button-pressing problem** the player faces.

A diatonic button accordion is *not* a piano. Each button plays:
- one note when the bellows are **pushed (closed)**,
- a *different* note when the bellows are **pulled (open)**.

So a B♭ might be on row-2 button-3 (push) AND row-1 button-5 (pull), and the player has to plan bellows direction across phrases. Standard treble-clef sheet music gives you the pitch but **not the button**, and definitely not the bellows direction. Standard bass clef gives you a 3-note chord stack, but the DBA's left hand is **12 single buttons** (each fires a bass note + a pre-built chord), so a typical chord notation is decoded incorrectly by self-taught players.

## 2. The insight (two threads, both 2026-05-04)

**Thread 1 — the original spark:**
> Andy: "Instead of giving you 3 notes of bass cleff harmony it can just tell you which left hand harmony button to press."

The diatonic button accordion's left hand is **12 buttons**, each pre-wired to a bass note + chord. Self-taught players decoding 3-note bass-clef stacks into button presses is a real, recurring friction point. The right-hand staff is solved if you tell the player *which button + which bellows direction*. The left-hand bass clef is solved if you map Roman-numeral harmony to *which of the 12 left-hand buttons*. Both reduce a notation problem to a **constraint-satisfaction problem**.

**Thread 2 — the spec turn (a few hours later):**
> Alex: "So you need tablature?"
> Andy: "Diatonic is what they call it." / "Not sure what you mean by tablature." / **"Normal music notation sounds good. And universal."**
> Alex: "Tablature is just guitar hero notation" — easier short-term, harder long-term. Standard notation is universal.

Andy doesn't actually want tab-only output. He wants standard music notation, with tab as an *option*, because notation transfers across instruments and tab locks you in. This pushes the spec from "MIDI → tab" to "MIDI → tiered output, user picks the friction level."

**The constraint set for the LLM mapping work:**
- the instrument's tuning (GCF default — Andy's Panther — plus FBbEb, EAD, ADG as extensions),
- bellows-direction continuity (you cannot reverse the bellows on every sixteenth note),
- which buttons physically exist on the player's instrument.

LLMs are good at this kind of mapping when given the button-layout table as fixed reference.

## 3. Why MIDI in, not audio in

Andy already worked this out in the convo:

- **Audio → sheet music** runs straight into copyright. You're effectively transcribing a recording. Even if the underlying composition is public domain, the recording isn't, and audio-source-separation pipelines look an awful lot like derivative-work generators to the labels.
- **MIDI → sheet music** is a **format conversion**. The user supplies the MIDI; the tool reformats it. This is the same legal posture as MuseScore, Sibelius, or any DAW. The user is responsible for the legality of their source material; the tool is a utility.
- Public-domain repertoire (pre-1925 traditional norteño, conjunto, vallenato folk songs) is large. There are MIDI archives on the open internet; quality varies but raw material exists.

Audio-front-end can be a Phase-N follow-up. Phase 1 is MIDI-only.

## 4. Prior art (existing tools — what's solved, what isn't)

**Solved already (don't rebuild):**
- MIDI parsing — trivial. Libraries: `@tonejs/midi` (browser), `mido` (Python), `midi-parser-js`.
- Standard-notation rendering — VexFlow, abcjs, Verovio (web), or LilyPond / MuseScore (desktop). Browser-side rendering is the right call for DLz.
- MIDI → standard sheet music (treble + bass clef, no tab) — MuseScore 4 does this for free, decently. Not our differentiator.

**Not solved (this is the gap):**
- MIDI → DBA tablature with bellows-direction planning, keyed to user's tuning, with left-hand bass-button mapping. The closest existing tools:
  - **Tap-N-Tab** (web) — manual entry only, no MIDI import.
  - **MuseScore DBA tablature plugin** — community-made, basic, doesn't plan bellows continuity.
  - Various PDF tab books — hand-engraved per song, not generative.
- "First of its kind" claim is plausible. The big notation software companies have not chased this because the audience is small *in their target markets* (Western art-music, jazz, rock). The accordion world is huge in Latin America, Eastern Europe, and the diaspora — but underserved by the dominant tools.

## 5. Three output tiers (the spec's organizing principle)

User picks a tier per song or per session. The system always computes the underlying button mapping; the rendering layer chooses what to show.

| Tier | Output | Audience | Build difficulty |
|------|--------|----------|------------------|
| **Universal** | Standard treble + bass clef notation, no tab | Players who want notation transferable across instruments. Andy's stated preference. | **Easy** — existing tools (MuseScore, VexFlow) already do this. Ship first. |
| **Harmony tab** | Treble standard + left-hand bass clef mapped to one of the 12 button presses | Players who can read treble but get stuck decoding bass-clef chord stacks into buttons. The original Andy insight. | **Medium** — requires the LLM mapping work, but only for one hand. The actual differentiator. |
| **Full tab** | Both hands as button + bellows tab, "guitar hero" style | Lowest-friction first-play, but locks the player into one instrument. Power-user / fastest on-ramp. | **Hard** — bellows-direction planning across phrases is the hardest sub-problem. Ship last. |

## 6. Pipeline (proposed, all client-side except the LLM call)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. User uploads MIDI (file picker) OR pastes URL                │
│ 2. Browser parses MIDI → note list per track                    │
│ 3. User picks:                                                  │
│    - tuning (GCF default — Andy's Panther)                      │
│    - rows (3-row default — Panther)                             │
│    - output tier (Universal / Harmony tab / Full tab)           │
│    - right-hand track, left-hand track (or "auto-split")        │
│ 4. Send compact JSON {notes, tuning, rows, tier} to Claude API  │
│ 5. Claude returns the appropriate-tier output                   │
│ 6. Browser renders via VexFlow + custom tab-strip SVG           │
│ 7. Export: print to PDF, or download MusicXML for MuseScore     │
└─────────────────────────────────────────────────────────────────┘
```

The Claude call is the only server hop. Everything else is browser-side. CSP-safe, no DB, no auth, fits DLz infra.

## 7. Tech stack hypothesis (subject to revision)

- **Frontend rendering:** VexFlow for standard staff, custom SVG for the tab strip (numbered buttons + push/pull arrows). VexFlow is well-maintained; abcjs is also acceptable. Verovio is heavyweight and probably overkill.
- **MIDI parsing:** `@tonejs/midi` — clean API, ESM, no build step required.
- **LLM:** Claude API. Skill bundles the button-map tables as part of the system prompt. **Prompt caching** essential here — the per-tuning button maps are static and large; cache them so each song call is cheap.
- **Hosting:** Cloudflare Pages (already DLz infra). Worker for the Claude call so the API key isn't exposed.
- **PDF export:** browser print-to-PDF first (zero work). Real PDF export via `pdf-lib` or `jsPDF` only if print quality is bad.

## 8. The button-map dataset (the real moat)

The product's quality is gated on having accurate button-layout data per tuning. This is **manual data-entry work**, but small in scale:

- GCF 3-row Panther (Andy's, Phase 1 target): ~31 right-hand buttons × 2 directions = 62 entries
- Plus 12 left-hand bass buttons × 2 directions = 24 entries
- **Total per tuning: ~86 entries**

For five common Panther tunings (GCF, FBbEb, EAD, ADG, plus one): a few hundred entries total. A weekend of careful data entry from manufacturer charts (Hohner, Gabbanelli) and community resources.

This dataset is the moat. Once it exists, the LLM call is a thin wrapper. Without it, hallucination risk is too high to ship. **Phase 1 = GCF only.** Other tunings added one at a time as audience demand surfaces.

## 9. Audience and reach

**Primary persona:** beginner-to-intermediate diatonic-button-accordion players, particularly self-taught conjunto / norteño / Tex-Mex players in the U.S. and diaspora. The Hohner Panther in GCF is the canonical entry-level instrument for this audience — *"the best beginner to intermediate accordion"* in Andy's phrasing. If we serve Andy, we serve the modal user.

**Spanish-language angle.** Andy's other observation: *"a ton of tutorial vids are in Spanish"* — Spanish-language tutorial dominance is a real friction point for English-dominant self-learners. Written notation outputs are language-neutral; that's a feature, not a bug. A Spanish UI mode is a low-effort stretch goal that doubles the addressable audience in the other direction (Spanish-dominant players also lack a high-quality MIDI-to-notation tool tuned to their repertoire).

**First reach** (when there's something to show): r/accordion, r/buttonaccordion, conjunto Facebook groups, YouTube tutorial-video comment sections. Andy probably has a network here.

## 10. Open questions (to resolve next session)

- **Hand assignment:** does the user mark the right-hand track manually, or do we heuristic-split by octave? (Manual + auto-suggest is probably right.)
- **Bellows planning:** one-shot LLM call, or a deterministic post-processor that fixes impossible bellows changes? Likely both — LLM proposes, validator repairs.
- **Quantization:** live-recorded MIDI (un-quantized) — do we quantize before sending to LLM, or trust the LLM to ignore noise? Pre-quantize is cheaper and more reliable.
- **Output formats:** ABC, MusicXML, browser SVG, PDF — which is the headline output per tier? PDF for the player, MusicXML for the tinkerer, ABC for the embed.
- **Validation UX:** when the LLM proposes a button that doesn't exist on the user's instrument, how do we surface that? (Highlight in red? Auto-substitute and warn?)
- **Free vs paid:** is this a free DLz tool, a paid Claude-API-passthrough, or a Substack-tier subscription? Andy's framing was free-on-DLz. Claude API costs are real but small at expected volume.
- **Spanish UI:** ship-Phase-1 or stretch goal?

## 11. Risks

- **LLM hallucinates buttons.** Mitigation: validator pass against the button-map dataset rejects non-existent buttons.
- **Physically infeasible bellows.** Mitigation: post-processor that detects rapid bellows reversals and rebudgets.
- **MIDI quality.** Mitigation: front-end quantizer; pre-flight checks ("this MIDI has 12 tracks — which is the melody?").
- **Niche audience.** Counterpoint: the audience is niche by Western-music-software standards. By Latin American / diaspora accordion standards, it's millions of players. The right comparison is "Spotify for ranchera," not "Sibelius for jazz."
- **IP creep.** As long as we're MIDI-in-only, we're a converter. The moment we add audio-in, we're potentially a derivative-work tool. Audio-in stays Phase N+ on purpose.

## 12. Phasing (proposed for next session — not committed)

Phasing follows the tier order — ship the easy tier first, prove the loop, then layer the differentiator.

| Phase | Tier | Deliverable | Estimate |
|-------|------|-------------|----------|
| 1 | — | GCF Panther button-map dataset (right + left hand) | 1 sitting |
| 2 | Universal | Browser MIDI upload → note-list display (no rendering) | 1 sitting |
| 3 | Universal | VexFlow standard-staff rendering | 1 sitting |
| 4 | Universal | PDF export + ship as v0.1 | 1 sitting |
| 5 | Harmony tab | Claude prompt: bass-clef chord → 1-of-12 left-hand button | 1 sitting |
| 6 | Harmony tab | Render harmony-tab strip below treble staff | 1 sitting |
| 7 | Full tab | Right-hand button + bellows assignment (LLM + validator) | 2 sittings |
| 8 | Full tab | Bellows-continuity post-processor | 1 sitting |
| 9 | — | Add FBbEb / EAD tunings as demand surfaces | 1 sitting per tuning |
| 10 | — | Spanish UI mode | 1 sitting |
| N | — | Audio → MIDI front-end (separate project, separate legal review) | TBD |

## 13. Out of scope for this spec

- Audio-source-separation / audio→MIDI transcription
- Chromatic button accordion (different instrument, different problem)
- Piano accordion (Stradella bass system; entirely different left-hand)
- Real-time playing assistance / app
- Anything beyond Western-tonal music (microtonal accordion traditions exist in some folk styles — out of scope)

---

*This spec is a feasibility starting point. Everything in §5–§10 is a working hypothesis. Validate, revise, or scrap in next session.*
