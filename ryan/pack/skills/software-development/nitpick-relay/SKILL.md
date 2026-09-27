---
name: nitpick-relay
description: "Sequential cheap-model nitpick passes, one tiny scope each."
version: 0.1.0
author: Alex Adamczyk + Claude (Fable 5.1)
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    category: software-development
    tags: [code-review, verification, delegation, cheap-models, granularity, adversarial]
    related_skills: [requesting-code-review, evidence-first-code-review, cross-system-adversarial-audit, claude-code-lane]
---

# Nitpick Relay

## Purpose

Use inexpensive capable models on tasks whose relevant evidence fits inside a small, explicit scope:
one file, one question, one verified answer, one at a time. Narrow scoping can make these workers useful
without establishing a universal capability ceiling equal to a frontier model. The pilot's harder job is
cutting scopes so the important boundaries are covered, then reviewing cross-scope interactions itself
or with a broader-capability reviewer. Judge the arrangement by verified findings, repair quality, and
cost per useful result.

## When to use

Alex says "spam nitpicky sonnets", "nitpick relay", "run the relay", or asks for N small review agents in
sequence. Also right after a burst of edits to a live system, before trusting it.

## The loop

1. **Cut a scope.** One file, one function, or one claim. Name the exact question ("can `my_turn` be true
   after the hero already acted?"), not the area ("review memreader").
2. **Dispatch one reviewer on the requested funding route, read-only.** For Claude subscription/credit requests, load `claude-code-lane` and use `claude_consult.py` through the logged-in Claude Code CLI with an explicit model, bounded turns and a schema. Verify Max auth and the returned canonical model; this lane uses the subscription. Generic `delegate_task` follows its configured provider and may select a separately metered API model rather than the session model. Use that route only when its provider/funding matches the task, one child at a time (the EVA rule: the relay uses 1). Keep failed starts outside the completed-pass count; an HTTP 401 does not distinguish an invalid credential, account block or empty balance. Never let reviewers edit; for live targets, explicitly forbid restarts.
3. **Demand falsifiable output.** file:line, a concrete failure scenario (inputs -> wrong output), a one-line
   fix, severity, max 5-8 findings ranked, then one line on what was checked and found clean. Require it to
   verify each finding by re-reading the path or running a safe snippet, and to drop what it cannot confirm.
4. **Adjudicate between passes within the authorized mode.** The designated pilot confirms each finding
   against the code or a safe reproduction and records its disposition. In an authorized repair relay,
   the pilot applies and tests accepted fixes before the next pass and checkpoints them as authorized.
   In a read-only review, preserve findings and proposed remedies without editing or committing source.
   When Alex owns execution through an existing CLI, that CLI is the pilot; the gateway remains an observer.
   Give later reviewers settled contracts, the current artifact, and resolved IDs without forcing them
   to adopt an earlier reviewer's theory.
5. **Count.** Alex asks for a number ("50"). Track passes and findings; say when a pass returns clean.
6. **Escalate seams.** Anything cross-file (a format change breaking another reader, a seed convention twelve
   files away, an endpoint exposed by a bind change) goes to one broader pass on a bigger model (the
   `claude-code-lane` consult, or Comic Book Guy for the closing find). A granular pass will not see it.

## Prompt skeleton

```
Nitpick pass K of N, read-only (do not modify files; <live-system warning>). Repo: <path>.
Target: <one file / function / claim>. Question: <the exact question>.
Already fixed, do not re-report: <list>.
Look for: <3-6 concrete failure classes for this scope>.
Report only what you can point to with file:line and a failure scenario; verify each by
<re-reading the path / running a snippet that is safe here>. Max <5-8> findings, ranked.
One line each: severity, file:line, scenario, fix. Then one line on what was clean.
```

## Diverse-model relay with selective overlap

- Rotate capable model families across sequential small scopes; when using a lower-cost reviewer pool, prefer a diverse pool over repeating one model by habit. Alex's proposed three-model pool is a workflow option, not a fixed quorum or permission to change global routing.
- Give each worker independent responsibility for its bounded investigation. A second model need not bless every finding; the pilot's reproducible verification is the acceptance gate. Agreement alone is not proof.
- Treat repeated attacks on the same surface as overlapping coverage even when each pass chooses a different failure mode or sees the latest repaired artifact. Ordinary engineering passes need not duplicate an identical frozen assignment.
- Reserve deliberate blind overlap for occasional calibration, consequential or uncertain findings, critical cross-scope boundaries, and a bounded closing review. Do not turn every small task into a multi-model committee.
- Separate improvement from comparison: changing source between passes is appropriate in an authorized repair relay, but those unequal tasks do not support a controlled head-to-head score. Use the matched-pair procedure below only when comparison or independent confirmation is actually wanted.
- Preserve fresh reasoning by sharing verified contracts and dispositions rather than making prior speculative conclusions the next worker's starting premise. Different model names are a diversity hypothesis; measure complementarity using verified unique findings rather than assuming independent errors.

## Blind matched-model pairs

When Alex asks to diff reviewers, keep the paired task prompt and source evidence byte-identical and record their SHA-256 hashes before either invocation. Freeze canonical source outside the live tree; include original file:line references and the same scope/stop conditions. Withhold the first review and the parent's adjudication from the second model. Run sequentially and leave source unchanged until both outputs are sealed. For a closed-packet comparison, give both reviewers no tools and have the parent execute proposed reproductions; label static proof separately from executed evidence. Treat provider/system-prompt differences as a comparison limit rather than claiming a controlled benchmark.

Compare shared verified findings, unique verified findings, unsupported suggestions, and runtime/usage receipts. Keep failed starts outside the completed-pass count. Do not compare raw finding volume as quality or invent a recall denominator. Deliver a final executive report after all requested passes and parent adjudications; interim updates can be restricted to blockers. Read-only lint authorization produces reports and isolated reproductions, not commits, deployment, live-source edits, or global routing changes.

## Evidence closure for matched reviews

Bind harness constants to production definitions before using a stub-based reproduction to reject a finding; AST-extract and assert the actual action vocabulary or row-slot layout rather than treating test constants as producer evidence.

Pair every zero-incidence claim with its eligibility denominator and missing-field count over the exact captured byte window. A transition-shape census establishes precondition incidence, not corrupted or missing stored rows.

Give mutation canaries a positive control that must fail when a consumed function changes. Record whether real helpers are extracted or replaced by lambdas; green routing tests do not establish the implementation of mocked safety gates.

Separate defect detection from remedy quality. A reviewer may correctly find a lost update yet propose a non-atomic check-then-replace, or correctly observe stale authorization yet recommend weakening fail-closed adoption. Adjudicate and reject unsafe remedies independently of the underlying observation.

Preserve raw model output when recovering malformed JSON. Record a minimal delimiter-only repair separately, validate the repaired shape, and keep semantic adjudication independent; a transport failure or no-verdict run stays outside the completed-pass count.

## Browser-backed relay checks

For live-site reviews and controlled browser reproductions, use `references/browser-relay-reproduction.md`. It covers immutable source/live identity, intercepted form traffic, BFCache launch settings, response-body timeout controls, SRI canaries, and artifact recovery.

## Rules of thumb

- For a second read-only relay, bind findings to the unchanged source and the proposed contract separately. Deduplicate rediscovered defects, distinguish genuine acceptance gaps from optional architecture, and count verified new roots rather than raw allegations; no edits means no repair-convergence claim.
- Evaluate a suggested sanitizer fallback with nested disallowed wrappers and the real component fragments before promoting it to the primary path. Sanitizing a wrapper does not prove its reparented descendants were traversed.
- Exercise asynchronous cache work through the registered event handler with deferred promises and a completion control. A returned response plus pending work establishes missing lifetime ownership; it does not establish a browser termination rate or observed data loss.
- Sequential when scopes touch the same file; parallel only on disjoint files.
- Cheap passes verify better than they conceptualize: ask for the reproduction, never for the design.
- A clean pass is a result. Record it. Three clean passes on a region means move on.
- A finding is not fixed until the fix is verified the same way it was found.
- Scopes that need a running system must say exactly what is safe to run.

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

Named by Alex 2026-09-11 while poker-companion was in play: "spam 50 nit picky sonnet agents as we work, one
at a time, in sequence, your choice on their scope but the smaller the better." Same-day evidence: three
Sonnet slices found a nickname-with-a-space bug, two missing packages, a training cursor that would freeze a
second install, and an unread-stack dollar amount, all verified; the Opus pass and Comic Book Guy found the
cross-file ones (a file-format change breaking two readers, a per-process hash seed, a LAN bind exposing POST
routes). Wiki: `nodes/nitpick-relay.md`, `nodes/RPC.md` (the council as adversarial review panel).
