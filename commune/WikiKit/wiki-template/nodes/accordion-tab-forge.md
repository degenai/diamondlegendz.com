---
visibility: public
aliases: [accordion-tab, accordion-forge]
tags: [project, music, ai-tool]
seeded-from: alexpedia, 2026-07-16, sanitized
---

# accordion-tab-forge

A [[diamondlegendz|Diamond Legendz]] project, kicked off May 2026: **feed in MIDI (or audio), get out playable charts for the diatonic button accordion.** [[Andy]]'s pitch.

## Origin
[[Andy]] texted [[Alex]] after a stalled search for accordion sheet music for *Gallo de Pelea* — the AI tools kept kicking him to YouTube tutorials (mostly Spanish-language, a real barrier for English-dominant self-learners). The conversation turned from "AI can't do this" to "a MIDI-to-tablature pipeline could — and the differentiator is mapping bass-clef harmony to *which left-hand button to press*." {Andy} spotted the actual ergonomic gap.

## Three output tiers
| Tier | Output | Why |
|------|--------|-----|
| **Universal** | Standard treble + bass notation | Works across instruments, no lock-in. Highest learning curve, highest long-term reward. |
| **Harmony tab** | Treble standard + left-hand button mapping | Closes the bass-clef-to-12-button gap. The original insight, and the sweet spot. |
| **Full tab** | Both hands as button + bellows | "Guitar hero notation." Fastest on-ramp; locks you to one instrument. |

The player picks the friction level; the system always knows the underlying button mapping.

## Reference instrument
[[Andy]]'s **Hohner Panther in GCF** — the 3-row Tex-Mex / norteño workhorse and the most common Panther sold. 31 treble buttons, 12 bass, bisonoric (each button plays a different pitch on push versus pull). The button map is the actual moat; the LLM is a thin wrapper over it, doing the constraint-satisfaction of button + bellows assignment.

## The accidental killer feature — a duet
Source-separating a recording into stems gives a clean vocal line alongside the instrumental. Transcribe each, re-instrument the vocals as flute, and you get a **two-part practice arrangement**: [[Andy]] plays the accordion line, [[Alex]] plays the melody on flute. First target: *La Chona* — {Andy}'s "Twinkle Twinkle." The output isn't just for the soloist; it's for ensemble practice.

## See also
[[Andy]] · [[Alex]] · [[diamondlegendz|Diamond Legendz]]
