# Making Jev play Chair Massage Fundamentals: logs, a harness, determinism

Research and design only. I edited nothing in the repo, started no servers, launched no Chrome and did not run the game. File:line references are to `diamondlegendz/chair-massage-fundamentals/` as of 2026-09-25.

---

## 1. What Jev is

**It exists and it is almost certainly what the owner means.** Jev is a "System One model" from **TypeSafe AI** (San Francisco, founded 2024, led by ex-OpenAI Diogo Almeida). It went into limited early access in mid-September 2026 with a $40M seed round led by DCVC. It came out about ten days ago, after the pilot's training cutoff.

| Question | Answer | Source |
|---|---|---|
| Vendor, date | TypeSafe AI. Early access on 15 Sep 2026 (Wikipedia). The fetched vendor blog page carries 25 Sep. Simon Willison wrote it up on 21 Sep, and Bloomberg ran a story on 25 Sep. | [Wikipedia](https://en.wikipedia.org/wiki/Jev_(AI_model)), [TypeSafe blog](https://typesafe.ai/blog/introducing-system-one-models-and-jev), [Willison](https://simonwillison.net/2026/Sep/21/jev/), [Bloomberg](https://www.bloomberg.com/news/articles/2026-09-25/jev-an-ai-model-that-can-t-chat-takes-on-bigger-rivals) |
| What it is | It is **not a chat LLM** and it generates no text. It takes a "state" (a string, JSON or an array) plus typed questions, and in one parallel, non-autoregressive pass it returns **typed answers with probabilities and a confidence score**. It has three primitives: **Choice** (pick one of up to 255 options, with the full distribution), **Score** (2 to 10 levels) and **Noul** (yes/no probability). | [flaviocopes deep dive](https://flaviocopes.com/jev/), [docs](https://docs.typesafe.ai/), [MindStudio](https://www.mindstudio.ai/blog/jev-system-one-model-launch) |
| What "deterministic" means for it | It is **consistent, not bit-identical.** TypeSafe's own consistency cookbook reports a mean per-question probability SD of **0.0102** across 15 repeats, lower than every LLM they tested, including Haiku 4.5 at temperature 0. One question in that run still flipped across 0.5 (0.43 to 0.53). The "can't hallucinate" claim means the output is constrained to your schema: it cannot return an option you didn't offer. There is no seed parameter. Pin the model version (`jev-1.13.x`) because behaviour changes between versions. | [consistency cookbook](https://docs.typesafe.ai/cookbooks/consistency_noul_cookbook), [flaviocopes](https://flaviocopes.com/jev/) |
| Access | HTTP API `POST https://api.typesafe.ai/v1/systemone` with `Authorization: Bearer`, model `jev-latest`. There are Python and **JavaScript** SDKs. **No local weights.** It is also reachable through the Vercel AI Gateway. **Early access only:** on 24 Sep flaviocopes reported that new signups were paused. | [API ref](https://docs.typesafe.ai/api.md), [llms.txt](https://docs.typesafe.ai/llms.txt), [flaviocopes](https://flaviocopes.com/jev/) |
| Speed | 70 to 500 ms end to end, most around 100 ms (vendor claim). An independent RuneScape harness measured a **0.22 s median** over 13,402 live polls. | [TypeSafe blog](https://typesafe.ai/blog/introducing-system-one-models-and-jev), [jevscape](https://github.com/Skyvern-AI/jevscape) |
| Cost | **$0.042 per million input tokens. Output is free.** jevscape spent $2.22 on 3 hours of play at about 3,950 input tokens per poll. | same |
| Context | About 64k tokens for state plus questions, about 32k for a single question. Rate limits are about 1,200 requests/min and 250k tokens/s (dynamic). | [flaviocopes](https://flaviocopes.com/jev/) |
| Inputs | **Text only** (strings and JSON). "No images, audio or video yet." | same |
| Tool calling | **None.** It calls no tools and writes no text. The "tool" is your Choice list, and your code executes whatever it picks. | [VentureBeat / search summary](https://venturebeat.com/security/companies-are-putting-jev-in-charge-of-ai-agent-decisions-and-prompt-injection-can-influence-the-verdict) |
| Known weaknesses (vendor's own "jaggedness" page for 1.13) | "Not a calculator." It **cannot count, compare numbers, or judge whether two values are near each other.** It reads dates as text. It struggles with indirection and double negatives. It is overly literal. **Accuracy falls as unrelated state grows** ("context rot"). | [jev-1.13 jaggedness](https://docs.typesafe.ai/model-jaggedness/jev-1.13.md) |

**People already use it to play games,** and all of them do it the same way:
- [typesafe-mario](https://github.com/fhshaik/typesafe-mario): Super Mario Bros from object-centric JSON parsed out of RAM, with 7 actions and one decision every 8 emulator steps. Each request asks a Choice (action), a Noul (jump?) and a Score (danger).
- [jevscape](https://github.com/Skyvern-AI/jevscape): RuneScape with about 50 bounded macro actions and a "tick mode" controller. It gained 2.1x the total XP of Claude Opus through consistency.
- [browser-use jev-ultrafast](https://github.com/browser-use/jev-ultrafast): a browser agent that sends an indexed DOM table and gets back one Choice of operation plus target.

**What this means for us:** Jev fits the job of picking one action from a menu 400 times a run, fast and cheap. It does not fit reasoning about geometry. The harness has to turn numbers into words ("goon, 4 m, ahead-left, winding up a bat"). Code has to own pathing, aiming and timing, the same way the catalog owns the game knowledge in jevscape. If the owner meant something else by "Jev", the closest alternatives are Claude Haiku 4.5, which is small and fast but only near-deterministic at temperature 0, and seeded or greedy decoding on local open-weight models.

---

## 2. The log audit

### 2a. The event bus today (`src/events.js`)

Each event looks like `{ t: ctx.time rounded to 0.01, wall: Date.now(), run, type, data }`. It is posted on `BroadcastChannel('cmf')` and pushed into a **2,000-event ring** that is written back **in full** to `localStorage['cmf.events.v1']` 250 ms after each burst (`events.js:7-8, 24-27, 51-61`). In-page taps come through `onEvent(fn)`.

Measured on the one downloaded log (`Downloads/cmf-run-log.json`, 24 Sep, before the `call` and `line` events existed): 468 events, **about 171 bytes each**, and **30 to 224 events per run** of 95 to 376 s. Today's build adds `call` and `line` traffic, so expect roughly 150 to 400 events per session.

### 2b. Event types and fields (every `emit(` call site)

| type | fields | emitted at |
|---|---|---|
| `state` | from, to | state.js:47 |
| `massage` | roster | wiring.js:46 |
| `run.start` | seed, build, unlocks[], perks{}, cash, fromPivot | wiring.js:71 |
| `run.end` | reason, time, cash, runCash, host, tension, unlock, track | run/summary.js:54 |
| `certificate` | outcome, unlock, track, runs, escapes | run/summary.js:107 |
| `tutorial` | step, act (shown/done/skipped), text, client / where:'run' | massage/session.js:46,53; run/goon-waves.js:115 |
| `call` | act:'asked' (prompt, call, key, window, client, [where:'run']); act:'answer' (call, prompt, key, answer, correct, late, after, fill, at, client, [misses]) | massage/session.js:171,204; run/minimassage.js:149,170 |
| `line` | speaker, name, text, preset, state | bubbles.js:53 |
| `pivot` | beat (vanStop / seen / line / unlock / skip), at, speaker, text, n, to | pivot.js:118,122,152,203; pivot-skip.js:38 |
| `chair` | act (bent / take / pickup / load / throw / setdown), where, vehicle, durability, bent, throw | entities/chair.js:36,112,126,152; run/mini-start.js:24 |
| `mini` | phase (start / cancel / success), sore, during, reason, pay, tip | run/mini-start.js:47; run/minimassage.js:57,194 |
| `vending` | act (arrive / alert / report / dispatch), rank, after, heat, goons, called | entities/cop.js:88; run/minimassage.js:221,224; run/police.js:197 |
| `wanted` | level, prev, heat, cause | run/wanted.js:37 |
| `police` | act:'spawn', unit, node, ahead, route, onFoot | run/police.js:130 |
| `treat` | target, kind, wave, rank, phase (walk/back) | entities/palm.js:110; goon.js:106,109; cop.js:64,66 |
| `palm` | phase (charge / cancel / shout / lunge), cause, at, target, charged | entities/palm.js:49,56,67,73,123,131 |
| `swing` | hits, goons, cops, peds, durability | entities/player-actions.js:122 |
| `gun` | target, stun / battery | entities/gun.js:125,134 |
| `perk` | id:'icepack', hp, from | entities/player-actions.js:141 |
| `damage` | source, amount, hp | entities/palm.js:217 |
| `knockdown` | who, cause, by, mine | hostile.js:50; goon-vehicle.js:89; vehicle-collide.js:179,221 |
| `vehicle` | act (enter/carjack/steal… / exit / batHit), type, stolen, hp | interact.js:139,232; goon-vehicle.js:105 |
| `repair` | vehicle, hpBefore, cost, cash, driving, chairBefore | interact.js:93 |
| `goon` | act (pullout / cling / thrown / ram / car / board / bail / yield), vehicle, n, swerve, car, hp, wave, crew, alive, who, speed | goon-vehicle.js:93,125,171; run/goon-car.js:48,110,131,157; run/van-yield.js:45 |
| `van` | act (ram / cut / pursue / return / park / shoved / driven_off / yield), hp, vehicle, n, node, x, z, after, at, speed, who | run/van-ai.js:39,40,86,94,203,229,232,268; van-yield.js:45 |
| `leave` | phase (prompt / start / done / off), vehicle, held, why | run/end.js:58,63,66,83 |
| `peds` | block, arrived, moved, have | run/peds-budget.js:207 |

### 2c. What a model playing from the logs cannot see

The log records **outcomes** (someone got treated, knocked down, rammed, wanted went up). It does not record **situations**: where things are, what is about to happen, what the player pressed. You can reconstruct a story from it afterwards. You cannot decide the next move from it.

1. **No spatial state at all.** There is no player position, yaw, camera yaw, speed, hp between hits, stamina, or palm charge. There is nothing on goons, cops, peds or vehicles: no position, distance, bearing or AI state (`chase / windup / search / sit / loose / out / cling / aboard`).
2. **No telegraphs.** A bat wind-up, the 0.6 s pull-out wind-up, the grab window, a cop's arrest timer (`P.arrestT`, run/police.js:222) and a goon closing in all have no event. You only hear about them afterwards through `damage` or `knockdown`.
3. **No input log.** Nothing records which keys, buttons or mouse deltas were applied on which tick. That leaves no replay and no "the model pressed S, why was it scored late?".
4. **No HUD text.** The hint line (`interactHint` plus the base controls, main.js:302-313), the massage prompt (`setPrompt`), the coach line, the onboarding prompt text (`onboardText()`), the heat/escape line (`checkEscape` returns "Lose the heat first.", end.js:52), the compass (chair and exit by bearing and distance), the vehicle line, the chair strip, and the stamp are all DOM-only.
5. **Transitions carry no reason.** `state {from, to}` doesn't say why. ARREST doesn't say who arrested or how. MASSAGE→PIVOT doesn't say "client 3 paid". The ESCAPE reason is only in `run.end.reason`.
6. **The call window opening is not logged.** `call asked` fires when the line is queued. The window opens when the voice line starts (`openCall` in the `say` onStart callback, massage/session.js:173-175). The gap between those two is exactly the latency a player gets judged on.
7. **Massage internals** are invisible between answers: competency, current versus requested modality, whether the cursor is inside the ring, ring position, and the client paid / "Press E" phase. They are available through `CMF.massage` (massage/index.js:140-165) but never logged.
8. **Mini-massage `ready`** (a ped kneeling at the chair, waiting for E) has no event. Only `start` and later phases do.
9. **No tick index.** `t` is rounded to 0.01 s and slow motion scales it, so an event can't be tied to a tick for replay.
10. **Meta isn't captured.** `run.start` has unlocks and perks but not `meta.runs`, `pivotsSeen`, `firstRunSeen`, `firstPivotSeen` or `lastOutcome`, all of which change the game (guided client, pivot lines, skip, first-run prompts).

### 2d. Proposed `snap` event (a spec, not an edit)

Emitted every `SNAP_EVERY` ticks. The default is 15 ticks, which is **4 Hz** (`?snap=4`; 0 turns it off). Every snapshot also goes out on an interrupt (see 3a). The keys are short, the numbers are rounded, and entities are tuples so the JSON stays small. A separate `observe()` renders the same data as words for the model.

```json
{"type":"snap","tick":10234,"t":170.57,"st":"RUN","ts":1,
 "p":{"x":12.3,"z":-40.1,"y":0,"yaw":95,"cam":90,"pitch":-8,"spd":4.1,"hp":78,"sta":0.62,
      "veh":null,"kn":0,"chg":0,"chair":"back","dur":80,"bat":null,"gun":false,"lock":true},
 "w":{"lv":1,"heat":1.4,"rise":false,"arrestT":0},
 "cash":42,
 "tgt":{"chair":[0,null],"exit":[212,40],"esc":"Lose the heat first."},
 "near":[["g3","goon",7.2,-35,"windup","bat"],["c1","cop",18.0,120,"out",""],
         ["v7","car:sedan",4.1,80,"parked","keys"],["p12","ped",3.0,10,"wander","sore"]],
 "mini":{"ph":"idle"},
 "call":null,
 "hud":{"hint":"E: take the sedan","prompt":"","onb":"","veh":"","strip":"Chair: on you","stamp":""},
 "in":"W+Shift"}
```

- `near`: the 8 closest non-trivial entities within 40 m, as `[id, kind, dist m, bearing° relative to camera yaw (-180..180, + = right), ai state, tag]`, sorted by threat and then distance.
- `tgt`: distance and relative bearing to the chair and the exit, the same numbers the compass already computes.
- In MASSAGE, replace `p` / `near` with `m`: `{client, seg, comp, mod, want, inside, ring:[x,y,r], phase}` from `CMF.massage`. `call` becomes `{name, key, open, t, window}`.
- Size: about **500 to 800 bytes**.

**`input` event, on change.** Emit when the held keys or buttons change, or when accumulated mouse delta is non-zero. Coalesce mouse moves to at most 10 per second.
```json
{"type":"input","tick":10233,"keys":"KeyW,ShiftLeft","btn":"","dx":-209,"dy":0}
```
A human player produces about 2 to 10 of these per second. An agent produces about one per action.

**Smaller event additions:**
- `state` gets `why` (for example `arrest: cop c1 touch 1.5 s`, `pivot: client 3 paid`).
- `call` gets `act:'open'`.
- `mini` gets `phase:'ready'`.
- `telegraph {who, id, act: 'batWindup'|'grabWindup'|'pulloutWindup'|'arrestStart'}`.
- `run.start` gets the full meta subset listed in gap 10.
- Every event gets `tick`.

### 2e. Storage

A session is about 2.5 min of course plus 3 to 8 min of run, so call it 10 minutes. At 4 Hz that is **2,400 snapshots × about 650 B ≈ 1.6 MB**. That would push every real event out of the 2,000-event ring in under ten minutes. It would also make the 250 ms `localStorage` rewrite stringify and store about 1.6 MB four times a second, which is a frame-time hit and brushes against the roughly 5 MB origin quota.

**Proposal:**
- **Keep `cmf.events.v1` as it is**, for events only (no `snap`, no `input`). Add `tick` to each event.
- **Add a separate in-memory session log**, `src/session-log.js`: an array of `snap` + `input` + event entries, each with a sequence number, capped at about 20 minutes (4,800 snapshots, about 3 MB). It is never written to localStorage.
  - `CMF.session.since(seq)` lets a harness pull increments over CDP.
  - `CMF.session.dump()` returns NDJSON, and a "Download session" button in watch.html saves it.
  - The watcher receives snapshots over BroadcastChannel at 1 Hz, so a live minimap is possible later.
- The downloaded session file (NDJSON, about 2 to 3 MB per session, gzip-friendly) is the artifact Opus reads *after* a run. That is where the "really good resolution of everything that happened" comes from. The model playing the game only ever sees a small window of it.

---

## 3. The latency problem: why every Opus playtest so far had to be scripted

Every harness in the scratchpad avoids putting a model in the decision loop. Nobody chose that out of laziness. The game's reaction windows are shorter than one model round trip.

**What the harnesses do instead** (gooncar/, cartthreat/, vancops/, minicalls/, classes/):
- **Mini-massage calls:** answered by an **in-page auto-answerer** running on `requestAnimationFrame` (`minicalls/answer.mjs`). It reads `CMF.ctx.mini.caller.call` and dispatches key events within the same frame. No model is involved.
- **The course:** skipped with `CMF.debug.finishClient()` (gooncar.mjs:87, mini.mjs:22).
- **Threats neutralised by pinning:**
  - `__H.away()` teleports every goon to (150, 150) and sets it to `sit` with `stateT = 999`.
  - `copsAway()` stands the cops down.
  - A rAF loop pins wanted to 0 (gooncar.mjs:99), and another pins hp to 100 (gooncar.mjs:174).
  - `freeze(e)` replaces an entity's update function.
  - Waves are forced (`A.waveT = 90`).
  - Vehicles are entered and exited by importing `enterVehicle` / `exitVehicle` directly, not with E.
- **Reactions pre-scripted as blind key sequences:**
  - The cling swerve is `W + A + Space` sent together, then a poll until the clingers are gone (goonveh.mjs:136-142).
  - The pull-out test parks the cart and lets it happen.
- **Slowed time to observe anything:** `timeScale` is set to 0.02, 0.03, 0.05, 0.1 and 0.2 across the scripts (5, 7, 6, 3 and 6 occurrences) for screenshots and mid-call reads.

**The numbers:**

| | time | where it comes from |
|---|---|---|
| Headless frame (swiftshader, 1280×720) | **125 to 166 ms** at the owner's 6 to 8 fps. The PERF logs in p7/ show 16 to 26 fps in lighter scenes. | lib.mjs launch flags; p7 PERF lines |
| Sim ticks per headless frame | 7 to 10. Input lands between batches, so input granularity is one frame. | main.js:217-224 |
| CDP `Runtime.evaluate` round trip | **Estimated** at a few ms when idle, but it queues behind the frame task on the renderer main thread, so about 60 to 170 ms under load. `simWait` resolves on rAF, so any "wait then look" costs at least one frame. *Not measured: this job was read-only.* | lib.mjs:35-40 |
| Opus driving through Claude Code (think → tool call → CDP → result) | **About 10 to 30 s per decision** (estimate) | |
| Sonnet 5, direct API, short prompt | about 1.5 to 4 s (estimate) | |
| Haiku 4.5, direct API | about 0.5 to 1.5 s (estimate) | |
| Jev | 0.07 to 0.5 s, 0.22 s median measured by jevscape | §1 |

**Against the game's windows** (DESIGN.md):
- Course calls: "lighter" 1.5 s, "harder" finished within 2.5 s, "still" 2 s, left/right 2 s.
- Run calls: lighter 1.2 s, harder within 2 s, still 1.5 s.
- Palm charge: a 0.7 s hold, cancelled by a shove. The pack shoves every 2.2 s.
- Cling throw-off: yaw rate above 1.2 rad/s held for **0.4 s**.
- Pull-out: any stop under 2 m/s with a goon at the door, then a 0.6 s wind-up.
- Opening beat: the 8 s grab window.

**How much a model could do unassisted, in real time.** A loop that isn't paused needs observe latency + model latency + act latency to fit inside the window, which also opens only when the voice line starts.
- **Opus through Claude Code: about 0% of timed decisions.** That covers every call, every palm and every swerve. Even the untimed decisions go wrong, because a held key stays held while the model thinks: "hold W for 1 s" becomes "hold W for 15 s".
  - In a typical session, about 60 to 75% of decisions are timed. By my count that is 15 to 20 course calls, 2 to 3 calls per mini-massage, and every fight or driving reaction.
  - The remaining 25 to 40% are strategic with seconds of slack: where to go, which car, when to set the chair down, when to leave. Only those are even theoretically reachable, and in practice they degrade because of key overshoot.
- **Sonnet:** misses nearly all 1.2 to 2 s windows and catches some 2.5 s ones.
- **Haiku:** catches perhaps half the calls. Palms and swerves are hopeless.
- **Jev plus CDP (about 0.3 to 0.6 s):** fits the call windows in real time. It is marginal on 0.4 to 0.7 s reactions, unless a reaction is a *macro the harness times* ("swerve left" = hold Space+A for 0.6 s), which is how it should work anyway.

**What this means for the design:**
1. **The sim has to stop while the model thinks.** Nothing else makes the result independent of the model's latency. That needs a real pause, and there isn't one today:
   - `ctx.timeScale = 0` does **not** pause. `main.js:186` reads `realDt * (ctx.timeScale || 1)`, and 0 is falsy, so the sim runs at full speed.
   - A tiny `timeScale` (0.02) changes `dt`, so the physics integrates differently than it would at 1/60. A slowed run is **not the same run**.
   - Pausing has to mean **not ticking**, and stepping has to mean **whole `STEP` ticks**.
2. **Once the sim is paused, rendering is dead weight.** The only reason the harness is stuck at 6 to 8 fps is swiftshader drawing frames nobody looks at. The sim itself costs about **0.6 to 1.3 ms per tick** in `updateAll` (p7 PERF: "avg 0.61 ms … avg 1.32 ms, max 29.4 ms"), so a 3-minute run is 10,800 ticks, or roughly 10 to 30 s of CPU without rendering.
3. **Determinism turns a slow run into a durable artifact.**
   - Seed + meta + the per-tick input log gives the whole run as a script.
   - Opus can replay any stretch afterwards **at leisure with rendering on**: screenshot tick 8,412 from three angles, or slow it down without changing it, since replay steps whole ticks.
   - Opus can bisect a regression across builds on the same seed and action list, or branch from tick N to try an alternative.
   - Jev's own "determinism" is only *consistency*. Re-asking Jev will not reliably reproduce a run, so the harness must **log Jev's choices** and replay those, not re-query.

---

## 4. How a model operates the game

### 4a. In-page agent API (`window.CMF.agent`). Build this first; every driver uses it.

The code shape below only proposes changes to `main.js`. `tick()` is already a closure inside `boot()`, so the handle is added next to `window.CMF`.

```js
// main.js (proposed)
let paused = false, tickNo = 0;
const noRender = new URLSearchParams(location.search).has('norender');

function frame(now) {
  requestAnimationFrame(frame);
  let elapsed = Math.max(0, (now - last) / 1000); last = now;
  if (paused) { accum = 0; }                       // stepping owns the clock
  else {
    accum = Math.min(accum + elapsed, MAX_ACCUM);
    preTick(ctx);
    while (accum >= STEP) { tick(STEP); tickNo++; accum -= STEP; }
  }
  if (noRender) return;                            // no camera juice, audio or draw
  hud.setStatus(`${getState()}  ${fps} fps`); juiceCamera(ctx, elapsed, getState() === STATES.RUN);
  audioFrame(ctx, elapsed); renderer.render(scene, camera);
}
// also: ctx.timeScale ?? 1 instead of || 1 (main.js:186)

window.CMF.agent = {
  pause(on = true) { paused = on; },
  get tick() { return tickNo; },
  // n whole ticks; stops early on an interrupting event. One microtask yield per tick so the
  // loadMesh().then() spawns (police units, goon cars, traffic) land after the tick that asked,
  // whatever the batch size.
  async step(n, { stopOn = INTERRUPTS } = {}) {
    let hit = null; const off = onEvent((type, d) => { if (stopOn(type, d)) hit = { type, d }; });
    try { for (let i = 0; i < n && !hit; i++) { preTick(ctx); tick(STEP); tickNo++; await Promise.resolve(); } }
    finally { off(); }
    return { ticks: tickNo, interrupt: hit };
  },
  observe() { return buildObservation(ctx) },     // snapshot + last ~12 events + HUD text, as words
  act(a) { return applyAction(a) },               // synchronous synthetic events; see vocabulary
};
```

**Input is synthetic but deterministic.** `act()` calls `window.dispatchEvent(new KeyboardEvent('keydown', {code}))` and `MouseEvent('mousemove', {movementX})` **synchronously between steps**. input.js handles them immediately, and the next `tick()` sees them through `input.snapshot()`, so no input.js change is needed.
- Pointer lock has to be faked, as `__H.lock()` already does (gooncar/lib pattern), because headless Chrome denies `requestPointerLock`.
- Look angle converts at `MOUSE_SENS = 0.0025 rad/px` (player.js:28, chase-cam.js:19), so **30° = 209 px**.
- A "hold" is keydown, `step(k)`, keyup. A tap is keydown, `step(1)`, keyup.

**Interrupts** (`INTERRUPTS`) end a step early:
- a `call` asked or open
- `mini` ready
- a `telegraph`
- `knockdown` or `damage` to the player
- a `state` change
- a `tutorial` prompt shown
- a `leave` prompt

The model is always asked *at* the moment that matters, not up to 0.5 s after it.

**Action vocabulary.** These are the Choice criteria sent to Jev. Only the options valid in the current context are listed each time (5 to 20 of them):

| context | actions (the harness executes, then times) |
|---|---|
| MASSAGE, during a call | `answer_lighter` (tap S), `answer_harder` (hold W 1.0 s), `stay_still` (no W/S for the window), `answer_left` (tap A), `answer_right` (tap D) |
| MASSAGE, otherwise | `match_modality` (Space), `next_client` (E), `wait_0.5s`, `track_ring_on/off` (a code reflex that follows the ring; tracking a moving circle at 2 decisions/s is infeasible, and skipping it halves the fill, per DESIGN "half for a cursor that never did") |
| RUN, on foot | `walk_fwd_1s`, `sprint_fwd_2s`, `back_off_1s`, `strafe_left_1s`, `strafe_right_1s`, `turn_left_30`, `turn_right_30`, `turn_around`, `face_nearest_goon`, `face_chair`, `face_exit`, `face_nearest_car`, `palm_tap`, `palm_charge` (hold click 0.8 s), `swing_chair`, `jump`, `interact_E`, `set_chair_down`, `hold_E_massage` (hold until the mini ends or an interrupt), `mini_answer_lighter/harder/still`, `wait_0.5s` |
| RUN, driving | `drive_fwd_2s`, `drive_fwd_left_1s`, `drive_fwd_right_1s`, `brake_reverse_1s`, `swerve_left` (W+A+Space 0.6 s), `swerve_right`, `face_exit_steer` (code steers toward the exit bearing for 2 s), `exit_vehicle` |
| any | `skip_intro` (any key), `click_begin` |

The `face_*` and `*_steer` macros exist because Jev can't do bearings. Code turns "the exit is 40° right" into mouse pixels or steering.

### 4b. The Node harness (CDP, the same bones as lib.mjs)

```js
// jev-pilot.mjs (sketch)
import { open } from './lib.mjs';                       // launch flags + &norender&seed=
import { TypeSafeClient } from 'typesafe';              // JS SDK (docs.typesafe.ai/sdk/javascript); raw fetch works too
const T = await open(`${seed}&norender&snap=4`, 9701);
const jev = new TypeSafeClient({ apiKey: process.env.TYPESAFE_API_KEY });
await T.ev(`__H.lock(); CMF.agent.pause(true); 1`);
const log = [];                                          // the replay script
for (;;) {
  const obs = await T.J(`CMF.agent.observe()`);          // { text, options:{id:desc}, state, done }
  if (obs.done) break;
  const r = await jev.systemone({                        // shape per docs.typesafe.ai/api.md
    model: 'jev-1.13',                                   // pinned
    state: obs.text,                                     // ~800-1,500 tokens, words not numbers
    questions: {
      action: { type: 'choice', instructions: 'Which action best keeps the chair and gets toward a clean escape right now?', criteria: obs.options },
      danger: { type: 'score',  instructions: 'How close is the player to being knocked down, arrested or losing the chair?', criteria: ['safe','watch','danger','now'] },
    },
  });
  const a = r.answers.action.choice;
  log.push({ tick: obs.tick, a, p: r.answers.action.probabilities, conf: r.answers.action.confidence });
  await T.ev(`CMF.agent.act(${JSON.stringify(a)})`);    // the macro schedules its keydowns/keyups
  await T.ev(`CMF.agent.step(30)`);                      // 0.5 s sim, or less on an interrupt
}
writeFileSync(`jev-${seed}.actions.json`, JSON.stringify({ seed, build, meta, log }));
writeFileSync(`jev-${seed}.session.ndjson`, await T.ev(`CMF.session.dump()`));
```

- Cadence: 30 ticks (2 decisions per sim second) plus the interrupts.
- A multi-tick macro such as "hold W 1 s" runs inside `act()` + `step()`. `act()` returns the tick count the macro needs, and the harness steps that many ticks.
- The observation text follows the Mario / jevscape pattern: a short situation paragraph, the eight nearest things as words, the HUD lines, and the last dozen events rendered through the watcher's `short()` formatter (watch.js:18-).

Example:

> RUN. On foot, carrying the chair (80%). HP 78, stamina 62%. Wanted 1 star, falling.
> Exit: 212 m, 40° right. Chair: on you.
> Near: goon g3 7 m ahead-left winding up a bat; cop 18 m behind resting; sedan 4 m right, keys in.
> HUD: "E: take the sedan". Heat line: "Lose the heat first."
> Just now: damage -10 from goon; wanted 0->1 (copHit).

### 4c. Determinism audit

The fixed 60 Hz step, the seeded world and seeded AI streams make a replayable run *possible*. The following stand in the way today.

**Gameplay-affecting unseeded `Math.random`, which breaks replay:**
- `src/entities/goon.js:59`: `e.sightT = Math.random() * SIGHT_EVERY`. This is the phase of each goon's line-of-sight check, so it decides when a goon sees the player.
- `src/entities/npc-common.js:55`: the replan timer `REPLAN * (0.8 + Math.random() * 0.4)` (NPC pathing).
- `src/entities/npc-common.js:98`: the stuck sidestep direction.
- `src/run/peds-budget.js:149`: `ctx.pedRng = { next: Math.random, … }`. The ped quota relocation decides which ped moves where, which decides who comes to a mini-massage. (Its neighbour `ped.js` uses a seeded `e.rng`.)

**Cosmetic, or near-cosmetic but leaking:**
- `src/entities/npc-common.js:23`: `walkPhase` (only the body bob).
- `src/entities/palm.js:227-229`: `applyShake` jitters `camera.position` with `Math.random`. The camera lerps from its previous position (player.js:183), so the jitter persists into camera state. `camera.position` and direction feed `vehicle.js:172` / `npc-common.js:266` (culling, visual only) and `peds-budget.js:172` (ped placement "behind the camera": gameplay, small).
- `src/juice.js:126`: shake phase from `performance.now()` (removed by `preTick` before each tick: safe).
- `src/particles.js:28-48`, `audio.js`, `audio-sfx.js`, `voice.js:95,246`: visual and audio only.

**Wall-clock reads:**
- `src/main.js:60`: the default seed is `Date.now()`. Fix: always pass `?seed=`.
- `src/main.js:179/222-229`: the rAF accumulator. The number of ticks per frame, and therefore **which tick a CDP key event lands on**, depends on wall time. Fix: stepping mode.
- `src/main.js:190-193`: perf timing only.
- `src/events.js:55` (`wall`), `events.js:59` / `hud-massage.js:109` (setTimeout): no effect on the sim.
- `src/audio-wire.js:52,73,83`: audio gating only.

**Async spawns:**
- `loadMesh()` returns a cached promise (`assets.js:60-66`). The `.then` spawns therefore land at the microtask checkpoint **after the whole rAF tick batch**, so how many ticks a spawn is late depends on frame pacing. The affected spawns: police units (police.js:131,164), goon cars (goon-car.js:95), traffic (traffic.js:73), the vehicle set at boot (main.js:276 / cars.js), plus bat, gun and ranger meshes.
- Fixes: yield one microtask per step (above), **and preload every vehicle and prop mesh before tick 0 of the replay**. An uncached first fetch mid-run resolves on network time.

**Other state:**
- **Meta from localStorage** changes the run: guided client, pivot lines, pivot skip, perks, first-run prompts. A replay needs a clean profile or the recorded meta injected before boot.
- `src/entities/interact.js:171`: `makeRng(seed ^ floor(ctx.time*1000))`. This is deterministic given the time. It's fine.
- `timeScale` other than 1 and 0.25 (the slow motion itself is deterministic): changes `dt`. Replays must never use it. Use step or pause instead.

With the three `Math.random` gameplay sites moved onto seeded streams (`makeRng(seed ^ entityId)`), plus stepping mode and preloading, **seed + meta + `[{tick, action}]` should reproduce a run exactly.** Verify that with a replay-twice-and-diff-the-snapshots test.

### 4d. Speed and cost per session

The assumptions: a 3-minute run at 2 decisions/s is 360 calls, plus about 40 event-driven calls in the course, so **about 400 calls per session**. That is about 1,500 input tokens per call (jevscape used 3,950) and about 40 output tokens per call for the LLMs.

| driver | model time per session | sim + CDP | $ per session (list price) | note |
|---|---|---|---|---|
| **Jev** | 400 × 0.1 to 0.5 s ≈ **40 to 200 s** | about 15 to 40 s render-less | **≈ $0.03** (0.6 M tok × $0.042/M; output free) | early access key needed |
| Haiku 4.5 | 400 × about 1 s ≈ 7 min | same | ≈ $0.70 ($1 / $5 per M) | caching the fixed system prompt trims it |
| Sonnet 5 | 400 × about 2 to 4 s ≈ 15 to 25 min | same | ≈ $1.40 ($2 / $10), more with thinking | |
| Opus 5.5 via API | 400 × about 4 to 10 s ≈ 30 to 60 min | same | ≈ $2.80 ($4 / $20) | |
| Opus via Claude Code / `claude -p` | 400 × about 10 to 30 s ≈ **1 to 3 h** | | Max-plan quota | what's been happening; the CLI boot alone costs seconds per call |
| Today's scripted harness (no model) | n/a | ≥ 1× real time at 6 to 8 fps, plus a frame per CDP poll | n/a | cannot make decisions |

**Where the time goes:**
- **Render-less stepping versus the current harness:** the sim runs about 5 to 15× faster than real time with drawing off, versus locked at 1× real time with swiftshader on. Pausing removes model latency from the result entirely, so the only thing that remains is wall-clock patience.
- **Jev's advantage** is that a full session costs pennies and a couple of minutes. That makes **50 seeds overnight** realistic: about 2 hours and under $2.
- Latency and cost figures for Claude models are my estimates. Prices come from the current Anthropic price list (Haiku 4.5 $1/$5, Sonnet 5 $2/$10, Opus 5.5 $4/$20 per M).

**Is there a render-less mode today?** No. The loop only advances inside `requestAnimationFrame`, and `renderer.render` runs every frame (main.js:216-242). What it would take is the pause flag, the `?norender` early return and the `CMF.agent.step` loop above: about 40 lines in main.js, and no module changes. A fully Node-side sim (no Chrome) is **not worth it**: the HUD is DOM, the scene graph is Three, and the game uses localStorage, BroadcastChannel and WebAudio, so it would need jsdom plus shims for a speed-up that headless Chrome without rendering already gives.

---

## 5. Recommendation

**Architecture:**
- Use the **in-page agent API** (`pause` / `step` / `observe` / `act` + the session log) driven by a **Node CDP harness**, **paused per decision, render-less**, with **Jev as the pilot**, choosing from a context-filtered macro menu.
- Every run writes `actions.json` (seed, build, meta, `[{tick, action, probs}]`) and `session.ndjson` (events + 4 Hz snapshots + input).
- **Opus doesn't pilot.** It reads the session file afterwards, writes the verdict, and replays interesting ticks with rendering on for screenshots. That is the division of labour the latency numbers force: Jev for the 400 fast choices, Opus for the one slow judgment.

**Build order (smallest first):**
1. **Milestone 0, logs:**
   - Add `tick` to events.
   - Add the `snap` and `input` events and the `call open`, `mini ready`, `telegraph` and `state.why` additions.
   - Add `session-log.js` with `since` / `dump` and the watcher download button.
   - Worth doing even if Jev never ships: a human's run becomes fully legible to Opus.
2. **Milestone 1, stepping:**
   - Add pause, `step(n)` with interrupts, `?norender`, and the `?? 1` fix.
   - Move the four gameplay `Math.random` sites onto seeded streams and preload meshes.
   - Test: run a scripted input list twice from the same seed and meta, and check the snapshot streams are byte-identical.
3. **Milestone 2, the first Jev win: "Jev completes the massage course from logs alone."**
   - Three clients, calls answered from the observation text, Space to match modality, E for the next client, ring tracking left off.
   - Pass: all clients paid and the pivot reached with no debug hooks.
   - This is small, closed-vocabulary and event-driven, which is exactly the job Jev is built for.
4. **Milestone 3:** one mini-massage in the run on a fixed seed, with goons *not* pinned: set the chair down, a ped kneels, hold E, answer the calls.
5. **Milestone 4:** a full run to any ending. Then score across seeds by escape rate, time and chair kept. This is what a playtest is: 50 seeds overnight, then Opus reads the aggregate plus the three worst sessions.

**Honest limits:**
- Jev can't aim, plan routes or count. Anything like that is a code macro, so a "Jev run" measures *our macros plus Jev's choices*, not a human's hands.
- Continuous skills (ring tracking, weaving through traffic at speed) are out of reach at 2 Hz. Either give the pilot a reflex or accept that it can't do them.
- Access is gated: early access, with signups paused as of 24 Sep. The Vercel AI Gateway is the fallback route.
- If no key arrives, the same harness runs Haiku 4.5 unchanged apart from the call site, at about 20× the cost and about 5× the time.

---

## 6. Questions for the owner

1. **Is this the Jev you mean?** A) TypeSafe AI's Jev, the "System One" decision model from mid-September. B) Something else (tell me the name or link). And for access: A) you have an early-access key. B) we need to get on the list (signups were paused on 24 Sep). C) go through the Vercel AI Gateway.
2. **Who flies?** A) Jev only. B) Jev, plus Haiku on the same seeds as a baseline. C) Jev flies, and Opus reviews the session file and replays the moments afterwards (recommended).
3. **Real time or paused?** A) Paused per decision, render-less: fast, repeatable, latency doesn't matter (recommended). B) Real time, so the pilot faces the same windows a human does. C) Paused for development, with a real-time run as a final exam.
4. **How much does code do for the pilot?** A) Raw keys only (W, S, look 30°): purest, and it will be bad at driving and aiming. B) Macros like "face the exit", "enter the nearest car", "swerve left", with Jev choosing (recommended, the jevscape pattern). C) Macros for the run, raw keys for the massage course.
5. **First milestone?** A) Logs and stepping only, so your own runs get full-resolution logs first. B) Jev finishes the massage course from logs alone (recommended). C) Jev plays straight into a full run.
