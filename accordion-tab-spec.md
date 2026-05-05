# Accordion-Tab Forge — Engineering Spec (v0, feasibility)

**Working title:** placeholder — final name TBD next session.
**Status:** feasibility research, CLI experiments running, page placeholder stages building.
**Origin:** Andy convo, 2026-05-04, accordion sheet music for *Gallo de Pelea* (commonly transcribed in Mi/E, conjunto-norteño tradition). Google AI Mode kicked the request to YouTube tutorials, no usable sheet music returned.
**Reference instrument:** Hohner Panther in **GCF** (Andy's, confirmed 2026-05-04). 3 rows, 31 treble buttons, 12 bass buttons. The conjunto / norteño workhorse. Panther GCF is also called "Sol" in Mexican accordion parlance — G/Sol is the dominant outer row.
**Genre scope:** narrow on purpose — **norteño · cumbia · conjunto · Tex-Mex · vallenato**. Diatonic-button-accordion-led repertoire from the Mexican / Latin-American tradition. Not a generic MIDI-to-tab tool. Every tuning decision (basic-pitch params, source-separation model choice, button-map, quantization grid) optimizes for this repertoire. Out of scope: rock-with-accordion (System of a Down etc.), zydeco, Cajun, Polish / Italian / Eastern European folk polka, generic Western pop. Staying narrow IS the value proposition.
**Architecture model:** **pedal chain.** Each pipeline stage is a swappable pedal; chain order is the build sequence; individual pedals get tuned, swapped, or A/B-tested without touching the rest. Stages 3.5 (MIDI quantize) and 3.7 (UVR secondary pass) are *optional pedals* — turn on/off per song.

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

## 3. Audio in IS in scope — basic-pitch precedent

Original spec (early 2026-05-04) treated audio-in as Phase-N+ with separate legal review. The thinking was: audio→MIDI looks like a derivative-work generator, MIDI→sheet music is just format conversion, so we'd start with MIDI-only and revisit audio later.

Then Spotify's [**basic-pitch**](https://basicpitch.spotify.com) surfaced (2022, open-source: [github.com/spotify/basic-pitch-ts](https://github.com/spotify/basic-pitch-ts)). It's a free audio-to-MIDI transcriber that runs entirely in the browser via TensorFlow.js — audio never leaves the user's machine. Same legal posture as MuseScore: user supplies the source, tool transforms. Spotify (a major label-adjacent company) shipped it openly without legal blowback. **The "audio→MIDI is risky" framing was wrong.**

Real-world MIDI hunt experience confirmed why audio-in matters: Karaoplay's *La Chona* MIDI had an audible flat note, MuseScore charged Pro for export, free archives are sparse for niche repertoire. Asking users to find a clean MIDI is asking them to do work that doesn't scale. Audio is what they actually have — YouTube tutorials, Spotify-Premium downloads, their own recordings.

**Revised posture (still defensible):**
- **Audio in:** user-supplied; we run basic-pitch client-side. Same legal model as a DAW that imports audio. User is responsible for source legality; tool is a utility.
- **MIDI in:** also accepted, for users who already have clean MIDI from MuseScore / a DAW / a karaoke vendor.
- **YouTube ripping:** *not on our domain.* That's the actual legal hot zone (YouTube ToS). We link out to [Cobalt](https://cobalt.tools) (open-source, public, takes the risk) or document `yt-dlp` for power users. The audio file then comes back into our tool client-side.

Public-domain repertoire (pre-1925 traditional norteño, conjunto, vallenato) is large. So is the universe of user-recorded practice tapes and licensed downloads. The audio-in front door dramatically widens the source funnel.

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

## 4.5. Tab is measureless on purpose — locked decision

Listener finding 2026-05-05 while auditioning the Forge alpha. Question raised: *"musicians ever say fuck it to measures?"* Yes — guitar tab, accordion tab, blues / folk lead-sheet traditions all routinely drop measures and time signatures, presenting the music as a sequence of presses with phrase breaks for orientation. Pickup notes / anacrusis require no special handling because there's no downbeat for them to fall before.

This is also what makes tab *forgiving of messy transcription*. basic-pitch's per-onset jitter and demucs's stem bleed introduce timing imperfections that look bad on a measured staff but are invisible in tab — the tab reader cares about button order, not which 16th-of-which-beat. Our pipeline (basic-pitch → quantize → tab) plays well into this: even when the transcription is rough, the tab output reads cleanly because it doesn't claim measure-perfection.

**Locked behavior:**
- **Tab tiers (Harmony, Full):** measureless. Phrase break every 16 notes for visual orientation. No time signature, no barlines, no anacrusis logic.
- **Universal tier (standard staff):** measured. 4/4 default, barlines per measure, anacrusis bar handling for pickups.

This pulls the project further toward "tab-first" framing for product purposes. The Universal tier exists for users who want notation that transfers to other instruments; tab tiers exist for accordion players who want to play the song.

## 5. Three output tiers (the spec's organizing principle)

User picks a tier per song or per session. The system always computes the underlying button mapping; the rendering layer chooses what to show.

| Tier | Output | Audience | Build difficulty |
|------|--------|----------|------------------|
| **Universal** | Standard treble + bass clef notation, no tab | Players who want notation transferable across instruments. Andy's stated preference. | **Easy** — existing tools (MuseScore, VexFlow) already do this. Ship first. |
| **Harmony tab** | Treble standard + left-hand bass clef mapped to one of the 12 button presses | Players who can read treble but get stuck decoding bass-clef chord stacks into buttons. The original Andy insight. | **Medium** — requires the LLM mapping work, but only for one hand. The actual differentiator. |
| **Full tab** | Both hands as button + bellows tab, "guitar hero" style | Lowest-friction first-play, but locks the player into one instrument. Power-user / fastest on-ramp. | **Hard** — bellows-direction planning across phrases is the hardest sub-problem. Ship last. |

## 6. Pipeline — pedal chain

```
[Source audio]
  → [Stage 2: Normalize → 22kHz mono WAV]
  → [Stage 3: Source-sep htdemucs → "other" stem]               audio → audio
  ── (optional) → [Stage 3.5: UVR Mel-Band Roformer cleanup]    audio → audio
  → [Stage 4: Transcribe basic-pitch → raw MIDI]                audio → MIDI
  ── (optional) → [Stage 4.5: Quantize to detected beat grid]   MIDI → MIDI
  → [Stage 5: Configure (tuning + tier + hand assignment)]
  → [Stage 6: Map (LLM + button-map dataset)]
  → [Stage 7: Render (VexFlow staff + tab strip SVG)]
  → [Stage 8: Export (PDF / MusicXML / ABC)]
```

Decimal labels carry the domain: 3.5 is in the audio domain (htdemucs and basic-pitch sandwich it), 4.5 is in the MIDI domain (basic-pitch produces it, configure consumes it). Both are optional pedals — toggle per song. Default ON for norteño / cumbia where they help; default OFF for clean studio recordings where they may hurt.

### Stage 3.5: UVR Mel-Band Roformer cleanup pass (optional, audio-domain)

Community two-stage trick: feed the `htdemucs` "other" stem into a UVR Mel-Band Roformer instrumental model. Reportedly preserves reed/wind timbres better than htdemucs alone. Licensing audit required (many UVR weights are CC-BY-NC, not commercial). Off-by-default until quality bump is verified for our repertoire.

**Don't over-clean (2026-05-04 listener finding):** the htdemucs "other" stem includes bajo sexto + rhythm guitar alongside accordion, and that's *useful*. A solo player practicing along to the chart needs harmonic context — they're not going to play the accordion melody against silence. The MIDI captures the rhythm-string parts as a backing scaffold, the player adapts and takes the voice they're filling. Goal of separation is "minus vocals + drums" (so the player can hear themselves over the practice track), NOT "isolate accordion lead in pristine isolation." Tune Stage 3.5 with the same restraint.

**Architecture note:** Mel-Band Roformer V2 hit a known bug in `audio-separator` 0.18 (`IndexError` in `spec_utils.normalize`, stem-name mismatch on Inst V2 output). Falling back to MDX-Net Kim Inst (ONNX, ~10× faster than Mel-Band Roformer on CPU, no V2 bug). CLI-tested 2026-05-04 against EZ Band La Chona htdemucs stem: Kim Inst pass produced 651-note basic-pitch output (vs 645 from htdemucs alone), 536-note quantize-32nds output (vs 528 htdemucs-only). Note count comparable; the difference is *which* notes get detected — residual vocal artifacts removed, real accordion notes preserved.

### Stage 4.5: MIDI quantize (our own pedal, MIDI-domain)

Not in any other audio-to-MIDI tool surveyed. basic-pitch outputs sample-accurate timings — every onset has a few-ms jitter, so identical phrases get transcribed slightly differently each repeat. The audible result is "drift" — the listener hears the same melodic figure rendered as different notes/durations across reps.

Fix: detect tempo + beat grid from the source audio (`librosa.beat.beat_track`), then snap every MIDI note's onset and offset to the nearest sub-beat tick. Drop notes shorter than ~80ms (transcription noise). Merge same-pitch notes within a 30ms gap.

Works because cumbia and norteño have stable tempo and clean onsets — beat tracking is reliable on this repertoire. Wouldn't work on rubato art-music or tempo-changing material, which is fine — those aren't in scope.

CLI-tested 2026-05-04 across multiple grid resolutions on the EZ Band La Chona reference. htdemucs stem (medium basic-pitch params): 645 → 527 (subdiv=4) / 532 (subdiv=8, real 16ths since librosa grabbed half-tempo) / 528 (subdiv=16, real 32nds). htdemucs_ft stem: 692 → 563 / 391 / 571 / 571. Note count plateaus past 16ths because the 80ms drop-short floor caps how short a note can be regardless of grid resolution.

**Listener finding (2026-05-04):** 32nd grid sounds more natural than 16th. The tab strip itself is largely rhythmless (button-press order matters more than exact timing), but 32nd quantization preserves the order of pickup notes / anacrusis / fast runs that 16th grid loses by snapping them onto the wrong beat. Per-tier defaults:
- **Tab tiers (Harmony / Full):** `subdiv=16` (real 32nds) default — preserves pickup-note order.
- **Universal tier (standard staff):** `subdiv=8` (real 16ths) default for cleaner staff readability; `subdiv=16` available as advanced option for ornament-heavy material.

Per-rhythmic-feel defaults still apply on top: cumbia and norteño polka are duple-grid (above), vals/waltz is triplet feel (subdiv=3 or 6 instead of 4 / 8 / 16).

The Claude call is the only server hop. Everything else is browser-side, including basic-pitch inference. CSP-safe, no DB, no auth, fits DLz infra.

### YouTube ingestion sub-flow (off-tool)

Two recommended paths, both link-outs not embeds:

| Path | For | How |
|------|-----|-----|
| **Cobalt** | Casual users, one-click rips | https://cobalt.tools — paste YouTube URL, get MP3, drop into our tool |
| **yt-dlp** | Power users, batch, archival | `yt-dlp -x --audio-format mp3 <url>` — the modern youtube-dl fork, Python or binary install, handles 1000+ sites |

**Why not host YouTube ripping ourselves:** YouTube's ToS forbids it; Google DMCAs the big ripper sites regularly (yt1s, ytmp3 keep getting nuked); Cloudflare bans yt-dlp on Workers. Cobalt + yt-dlp let other people own that legal risk while our tool stays clean.

## 7. Tech stack hypothesis (subject to revision)

- **Frontend rendering:** VexFlow for standard staff, custom SVG for the tab strip (numbered buttons + push/pull arrows). VexFlow is well-maintained; abcjs is also acceptable. Verovio is heavyweight and probably overkill.
- **MIDI parsing:** `@tonejs/midi` — clean API, ESM, no build step required.
- **LLM:** Provider-agnostic by design. **Default: DeepSeek** (V3 / Coder) for cost — auto-prompt-caching, ~10x cheaper than Claude for structured constraint-mapping at parity quality. **Premium fallback: Claude** (Sonnet / Haiku) when DeepSeek validation fails or for higher-stakes Full-tab bellows planning. Worker switches providers on retry. The button-map dataset is static per tuning and goes in the cached prefix — both providers cache, DeepSeek automatically, Anthropic via `cache_control`.
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

Phasing follows the tier order — ship the easy tier first, prove the loop, then layer the differentiator. Audio-in is now in-scope from Phase 2 thanks to basic-pitch.

| Phase | Tier | Deliverable | Estimate |
|-------|------|-------------|----------|
| 1 | — | GCF Panther button-map dataset (right + left hand) | 1 sitting |
| 2 | Ingestion | Browser drop-zone: accept .mp3 / .wav (basic-pitch in TF.js) AND .mid (@tonejs/midi). Display extracted note list. | 2 sittings |
| 3 | — | Document the YouTube → MP3 path: Cobalt link button on the page; yt-dlp instructions snippet for power users. No ripping on our domain. | 1 sitting |
| 4 | Universal | VexFlow standard-staff rendering of the note list | 1 sitting |
| 5 | Universal | PDF export, ship as v0.1 | 1 sitting |
| 6 | Harmony tab | Claude prompt: bass-clef chord → 1-of-12 left-hand button | 1 sitting |
| 7 | Harmony tab | Render harmony-tab strip below treble staff | 1 sitting |
| 8 | Full tab | Right-hand button + bellows assignment (LLM + validator) | 2 sittings |
| 9 | Full tab | Bellows-continuity post-processor | 1 sitting |
| 10 | — | Add FBbEb / EAD tunings as demand surfaces | 1 sitting per tuning |
| 11 | — | Spanish UI mode | 1 sitting |

### First-test material (Phase 1 acceptance)

Andy's foundational learning song is **La Chona** — *"my Twinkle Twinkle Little Star"* — Los Tucanes de Tijuana original, but Andy specifically prefers the **EZ Band** cover for our reference test. That's the audio file to run end-to-end through the Phase-2 pipeline once it's standing up: EZ Band La Chona (audio) → basic-pitch (MIDI) → Universal-tier render (standard staff). If the staff output reads as recognizably "La Chona" to Andy, Phase 2 is acceptance-tested.

## 13. Out of scope for this spec

- ~~Audio→MIDI transcription~~ — **moved into scope** Phase 2 via basic-pitch.
- ~~Source separation~~ — **moved into scope** Phase 2 via Demucs (htdemucs / htdemucs_ft).
- YouTube ripping on our domain (link out to Cobalt or yt-dlp instead).
- Genres outside norteño / cumbia / conjunto / Tex-Mex / vallenato — see §1 Genre Scope. Not optimizing for rock-with-accordion, zydeco, Cajun, Polish / Italian / Eastern European folk polka, generic Western pop, or anywhere accordion isn't the lead instrument.
- Chromatic button accordion (different instrument, different problem).
- Piano accordion (Stradella bass system; entirely different left-hand).
- Real-time playing assistance / app.
- Microtonal accordion traditions outside Western tonal music.

---

*This spec is a feasibility starting point. Everything in §5–§10 is a working hypothesis. Validate, revise, or scrap in next session.*
