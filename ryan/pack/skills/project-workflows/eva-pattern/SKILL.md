---
name: eva-pattern
description: "One piloted context, disposable agents, a big-to-small build relay, and questions to Alex at every gate."
version: 0.1.0
author: Alex Adamczyk + Claude (Opus 5.5)
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    category: project-workflows
    tags: [orchestration, delegation, relay, sync-rate, phases, verification]
    related_skills: [nitpick-relay, adversarial-nitpick-loop, plan, claude-code-lane]
---

# EVA Pattern

## Purpose

One continuously piloted context (the EVA) carries the intent and the judgment for a build. The pilot
never delegates the design. It spawns short-lived agents for exactly two jobs:

- **Parallelization:** only cheap read-only passes on disjoint files. Opus builders are sequential, always (2026-09-24).
- **Context preservation:** offload reading and searching so the pilot's context stays clean and load-bearing.

The agents are disposable; the pilot is continuous. A synced unit, not a swarm.

Builds run as a **big-to-small relay**:

1. The strongest model (the pilot) writes the design doc and each phase brief, and gates every phase.
2. A capable mid model builds one phase at a time, inside hard file boundaries.
3. Cheap models run the `nitpick-relay` on the phase: one file, one falsifiable question per pass,
   verified before it counts.
4. Fixes are verified the same way their findings were found.
5. A phase is committed only after its relay.

## When to use

Alex says "EVA pattern", "EVA with weapons", "run it like the game build", "you design, Opus builds",
or hands over a multi-phase build (a game, a site, a tool) that is too big for one agent turn.
Also use it for any delegated work of more than two steps where Alex's intent must survive the handoffs.

## The sync-rate rule

Alex, 2026-09-23: "When we're in the EVA pattern, proactively ask me questions, even if it slows you
down. What's primarily important is our sync rate."

In practice:

- **At every phase gate and at every design fork**, ask three or four multiple-choice questions.
  Put the recommended option first and mark it as recommended. Multiple choice beats open questions:
  Alex answers by voice, fast.
- **Questions go out before the next agent launches, not after.** Launching a builder and then asking
  bakes an unasked answer into the work.
- **Never trade a question away for throughput.** The agents are the fast part. The pilot's job is to
  keep Alex and the build in sync, and a skipped question is a desync.
- **"No preference" means proceed on the recommendation, and say so** ("going with A, the recommendation").
- A fork found mid-phase by a builder or a nitpick pass goes back to Alex as a question too. The pilot
  does not settle it silently.
- Keep questions to real forks: taste, scope, priority, naming, what gets cut. Facts the pilot can
  look up are not questions.

## Procedure

### (a) Design doc first

Write `DESIGN.md` in the project before any build agent runs. It holds:

- **Pillars:** three to six rules every decision is checked against.
- **A state or module map:** the states, screens, or modules and how they connect.
- **Technical contracts:** file layout, module interfaces, data formats, dependencies, security headers,
  anything two phases must agree on.
- **A relay protocol section:** who designs, who builds, who nitpicks, when Alex is asked.
- **A numbered phase plan:** each phase small enough for one builder session, each ending runnable.

### (b) Per phase: the brief

The pilot writes each brief. Every brief has:

- **Goal** in one paragraph, pointing at the design doc sections it implements.
- **Hard file boundaries:** the exact files the builder may create or edit. Everything else is read-only.
- **Verification section ending in evidence:** numbers (triangle counts, frame times, test counts),
  headless-browser screenshots, passing test names, or a static-server load plus module-import smoke
  test. "It works" is not evidence.
- **A report cap:** e.g. under 250 words: files changed, what was verified with the evidence, open questions.
- The builder asks nothing of Alex directly. Its open questions come back in the report, and the pilot
  turns them into multiple-choice questions at the gate.

### (c) Per phase: relay, fix, commit

1. The pilot reads the builder's report and checks the evidence itself (re-run the smoke test, open the screenshot).
2. Run the relay: load `nitpick-relay` and follow it. Three to five passes per phase, one file or one
   question each, read-only, findings verified by the pilot before they count. Do not restate its loop here.
3. Fix accepted findings; verify each fix the way its finding was found (same reproduction, same check).
4. Record rejected claims and why in the phase notes; they calibrate the next relay.
5. Gate: ask Alex the sync-rate questions for the next phase.
6. Commit with a narrative-first message: what the phase does for the player or user first, then the
   relay tally (passes, fixes, rejections), then the file list.

### (d) One Opus builder at a time; parallel only for cheap passes on disjoint files

Builders (Opus) run strictly one at a time, even when their file sets are disjoint. Ruled by Alex
2026-09-24 after three parallel Opus builders on disjoint files pegged his machine: "it should have been
sequential. remember this." Disjoint files stop merge conflicts; they do not stop three headless Chromes,
three Node loops and three model contexts fighting for the same CPU and disk. Queue the batch and run it
back to back. Sonnet nitpick passes on disjoint files may still run in parallel; passes on the same file
run in sequence. Never two agents on the same work, never two writers on one file.

### (e) Side jobs run in parallel

Assets, research, copy drafts, and other side jobs may run alongside the build when they touch no build
files (e.g. an asset agent writes only under `assets/` and its tool scripts). The pilot integrates their
output at a gate.

### (f) Decisions go into the design doc immediately

Every answer Alex gives and every call the pilot makes is written into `DESIGN.md` the moment it is
made, dated, under the section it affects. The design doc is the pilot's persistent memory and the
next builder's source of truth. A decision that lives only in chat is lost at the next context reset.

## Model routing in Hermes

Pick by role, not by habit. Current routing, read from `config.yaml` on 2026-09-23 (re-read it before
naming models; the live config is canon and it changes):

- **Pilot (strongest, continuous):** the Hermes session on `model.default` (`gpt-5.6-sol`, provider
  `openai-codex`). When Alex pilots from Claude Code, Claude Code (Fable or Opus) is the pilot and
  Hermes observes. The frontier option from inside Hermes is `claude-code-lane` via `claude -p`
  (Fable manual tier, or `claude-opus-5` deep tier): use it when available for the design doc draft and
  the phase-gate reviews, then the pilot owns and edits the result. A one-shot `claude -p` call is not a
  pilot by itself; the continuous seat is.
- **Builder (capable mid, one phase, write lane):** `claude-code-lane` write lane with
  `--model claude-opus-5`, `--allowedTools` limited to the file work (include `Edit`), bounded turns;
  or a fresh `hermes chat --query="..." --model openai/gpt-5.6-sol`. One builder at a time.
- **Nitpick tier (cheap, read-only, one question):** `claude-code-lane` `wiki` tier (Sonnet) or `quick`
  tier (Haiku) for compact evidence packets; or `delegate_task`, which runs on `delegation.model`
  (`deepseek/deepseek-v4.1-flash` on `nous`; max 3 concurrent children, spawn depth 1). The session
  fallback chain is `z-ai/glm-5.3-flash`, `gpt-5.6-luna`, then free Nous models; never let a builder
  land on a fallback without telling Alex.
- **Limit consumption:** `claude -p` draws on the Max subscription's session limits; `delegate_task`
  draws on the Nous allotment. Frontier fan-outs burn limits fastest, which is why the relay runs
  big-to-small and sequential. Keep the frontier for design and gates.

## Anti-patterns

- **Agent spam with no centre:** many long-running workflows fired at once, no pilot holding intent.
- **Autopilot merges:** committing builder output the pilot has not read and verified.
- **A builder with no file boundary:** it will refactor what it was not asked to touch.
- **A relay pass asked for design:** cheap passes verify; ask for the reproduction, never the redesign.
- **A phase committed before its relay:** the relay is the acceptance gate, not a follow-up.
- **Moving fast to avoid asking:** launching the next agent before asking Alex is the sync-rate failure.
- **Overlap:** parallel agents on shared files, or two agents given the same job "for coverage".
- **Decisions left in chat** instead of the design doc.

## Worked example: Chair Massage Fundamentals (2026-09-22/23)

A web game on diamondlegendz. Fable, piloting in Claude Code, wrote `DESIGN.md` with pillars, a session
state machine, technical contracts, a relay protocol, and a seven-phase plan (skeleton, minigame, block
generator, vehicles, NPCs and wanted levels, pivot and meta loop, audio and polish). One Opus agent built
each phase in sequence, ending with a runnable page and a verification list. Each phase got a four-pass
Sonnet nitpick relay; typical yield was two to four real fixes and one or two rejected claims per phase.
Phases 1 to 4 shipped by 2026-09-23. An Opus asset batch (low-poly props via the `blender-lowpoly` skill)
ran in parallel because it touched only asset files, and a Sonnet building one asset from the skill alone
found a real bug in the helper library (stale world matrices). Alex answered multiple-choice questions at
every gate; the sync-rate rule was set mid-build. Wiki: `nodes/Chair Massage Fundamentals.md`.

## Process hygiene (2026-09-23)
- **No console pop-ups (2026-09-25).** A static server or any long-running helper started from a tool shell with `python` opens a console window on Alex's screen every time (he saw one every few minutes during a test loop). Start it with `pythonw -m http.server ...` (no console), keep one server up for the whole session instead of one per script, and still kill it by its recorded PID.

Agents record the PID of every server or process they start and stop only those PIDs. Never kill by
image name (`taskkill /IM python.exe`, `pkill python`): on 2026-09-23 a builder did and took down Alex's
unrelated poker-companion panel. Put this line in every brief that starts a server: "record the PID;
kill only that PID."

Headless Chrome for verification: create its profile with `mkdtemp` inside the session scratchpad (never
`%TEMP%`), and delete that folder when the script exits (`finally`, and on SIGINT). On 2026-09-23 a night
of test runs left 314 profiles (about 21 GB) in Temp and filled the disk to zero, breaking git mid-merge.
Every brief that starts headless Chrome says: "profile under the scratchpad, removed on exit."
Headless Chrome is not silent: pass `--mute-audio` on every launch, or the game's audio plays through the owner's speakers during test runs (noticed 2026-09-23 once the game had a voice).
`node --check file.js` returns 0 on a syntax error here (Node 25, ESM in a .js file). The real check is `node --input-type=module --check < file.js` (exit 1 on error), or copy to .mjs first. Found 2026-09-24.

## Provenance

Alex named the EVA pattern on 2026-06-14 as the opposite of "ADD agent spam". The big-to-small relay was
set on 2026-09-22 for game builds, after Fable fan-outs had burned session limits. The sync-rate rule was
added on 2026-09-23. Wiki: `nodes/ai-philosophy.md` (the EVA pattern, "Sync rate over speed"),
`nodes/nitpick-relay.md`.
