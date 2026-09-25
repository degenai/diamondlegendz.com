# Chair Massage Fundamentals

A dull chair-massage training course that turns into a low-poly GTA3-style roguelike. You learn
pressure (the client calls "harder" or "lighter", you answer on W and S) and stroke tracking
(the mouse) on three park regulars, then a franchise's
"compliance team" pulls up in a black van, and those same controls now move, aim, and drive you
around a city block while you try to leave with the chair. Nobody gets hurt: every weapon relaxes
its target (the Chex Quest rule), and doing the actual massage work is how you cool your wanted level.

## Run it locally

No build step and no npm. From the `diamondlegendz` folder (the parent of this one):

```
python -m http.server 8000
```

Then open <http://localhost:8000/chair-massage-fundamentals/>. You need a keyboard and a mouse.
Phones get a polite card instead of the game.

The course: the client calls out and you answer. "Harder": hold W. "Lighter": tap S. "Right there":
hands off W and S. "A little to the left / right": tap A or D. Otherwise A / D modality, **Space
matches the client** (snaps to the modality they asked for), mouse on the guide, E next client.
On a first playthrough the first client walks you through it, one prompt at a time.

- `?seed=12345` (or any text, like `?seed=andy`) pins the run's city block: building heights,
  plaza layout, parked cars, the van's entry, the escape edge. Without it, every load rolls a new block.
- Progress (runs, unlocks) lives in `localStorage` under `cmf.meta.v1`. Clear it to see the
  first-run version again. Volume lives under `cmf.volume`. **M** mutes.
- Escapes unlock the main list (massage gun first); arrests and deaths unlock a smaller consolation
  (ice pack first, six in all); leaving the chair unlocks nothing. The certificate says which track.
- The build stamp (`src/version.js`, shown in the title footer and next to the fps) is
  `YYYY-MM-DD.N` plus the short hash of HEAD. The pilot runs `node tools/bump-version.mjs` before
  each merge; it rewrites the file from today's date and `git rev-parse --short HEAD`.

## Where things are

- **The design doc:** [`DESIGN.md`](DESIGN.md). Pillars, the state machine, every ruling Alex made,
  and the phase plan. If code and doc disagree, the doc wins and the code gets fixed.
- **Code:** `src/`, plain ES modules, Three.js vendored in `vendor/` (no CDN).
  `src/main.js` boots and runs the fixed 60 Hz loop; `src/wiring.js` holds each state's enter and exit hooks. Each state has its own module: `massage/`,
  `pivot.js`, `run/`, and entities in `entities/`.
- **3D assets:** anything with a shape (chair, cars, people, the bat, the massage gun) is a Blender
  5.2 Python script in `tools/blender/make_*.py`. It gets baked headless to a small JSON mesh in
  `assets/`, which `src/assets.js` loads. To regenerate one:

  ```
  blender -b --factory-startup --python-exit-code 1 --python tools/blender/make_chair.py -- --json assets/chair.json --render sheet.png
  ```

  The `blender-lowpoly` skill (Claude Code) is the recipe for writing a new one. It covers
  flat-shaded bmesh, vertex colours, named parts, and a render-to-check sheet.
  `tools/blender/RESEARCH.md` has the gotchas. Buildings, trees, and roads are procedural JS in
  `src/world/`, not Blender.
- **Test pages:** `assets-test/audition.html` plays every sound, music state, and voice preset on
  buttons. `assets-test/viewer.html` shows the meshes.

## How it was built (phases and the relay)

The game was built in seven phases, listed at the end of `DESIGN.md`. Each phase went through a
relay (see "Relay protocol" in [`DESIGN.md`](DESIGN.md#relay-protocol)): Fable writes the brief
and gates the phase, one Opus agent builds it and verifies it (headless browser when available, otherwise a module smoke test), then a few
Sonnet "nitpick" passes each check one small thing. Alex answers multiple-choice questions at
every gate. Phase 7 (audio, voice, juice, this README) is the last build before people play it.
From here, Andy is a co-designer.

## Tuning: where the numbers live

| What | File |
|---|---|
| Car handling (speed, grip, steering, mass, damage) | `src/entities/vehicle-types.js` |
| Wanted level: v1 cap, decay time, chaos rules | `src/run/wanted.js` (`WANTED_CAP`, `DECAY`, `CHAOS_*`) |
| Police response per star, the ranger's 15 s hang-back | `src/run/police.js` (tiers); `src/run/police-units.js` (`CRUISE`, `BAIL`, `HANG`) |
| Goons: speed, bat and shove reach, cooldowns, sit time, the 8 s opening grab window | `src/entities/goon.js` (`RUN`, `BAT_*`, `SHOVE_*`, `SIT_TIME`, `GRAB_*`) |
| Cops on foot | `src/entities/cop.js` (`SPEED`, `WALK_OFF`) |
| Goon waves and caps | `src/run/goon-waves.js` (`WAVE`, `GOON_CAP`) |
| Massage clients: pay, ring size, call cadence and mix (`calls`), lines | `src/massage/clients.js` (`CLIENTS`); between-run regulars in `src/massage/client-lines.js`; the calls, their keys and windows in `src/massage/meter.js` |
| Mini-massage during a run | `src/run/minimassage.js` (`HOLD`, `HALF_BAND`, radii) |
| Healing Palm and the massage gun | `src/entities/palm.js`, `src/entities/gun.js` |
| Unlock order: main track (escapes), consolation track (arrests, deaths) | `src/meta.js` (`UNLOCKS`, `CONSOLATIONS`) |
| Audio balance: music, effects, voice bus levels | `src/audio.js` (`MUSIC_LEVEL`, `SFX_LEVEL`, `VOICE_LEVEL`) |
| Voices: pitch and rate per preset, how many can talk at once | `src/voice.js` (`PRESETS`), `src/audio-wire.js` (`MAX_VOICES`) |
| Juice: hit-stop, shake, FOV kick | `src/juice.js`; particle looks in `src/particles.js` |

## The run watcher

Like the poker companion: the game emits events, a watcher alongside shows them, and a run report
comes out. Click **Open watcher** in the title footer (or open `watch.html` next to `index.html`) to
get a second tab on the same origin; it works on the live GitHub Pages site with no server. The game
posts every event on a `BroadcastChannel('cmf')` and keeps the newest 2,000 in `localStorage` under
`cmf.events.v1`, so a watch tab opened late (or reloaded) replays what it missed. The watch page
shows a live feed, a card for the current run (duration, a strip of the wanted stars over time,
palm and gun hits, where the chair is, cash, state), a table of finished runs, and under the
selected run a plain-text report from `src/run-report.js`: an m:ss timeline ("0:14 wanted 1 (stole
a sedan)", "1:02 chair loaded in the cart"), a one-line verdict computed from the numbers, a "vs run
N" line against the run before it, and a line against the best escape so far. Rules only, no model:
"Copy last run" copies the report and the run's events as JSON, ready to paste to a model for a
richer read. "Download run log (JSON)" saves all runs or the selected one; "Clear log" empties the
buffer. The hooks are one-liners at the call sites; the bus is `src/events.js`.
Every voice line is logged as it starts speaking (`line`, from `src/bubbles.js`): the feed's
**Lines** filter shows only those, each report ends with "Lines heard" (one row per distinct line
and how often it played that run), and the **Repeats** card under the finished runs lists the lines
heard in three or more runs, most repeated first.

Every event is `{ t, wall, run, type, data }`: `t` is game time in seconds (`ctx.time`), `wall` is
`Date.now()`, `run` is `meta.runs + 1` taken on entering MASSAGE and RUN (the massage, pivot, run
and certificate share it). Types and their `data`:

| type | data |
|---|---|
| `state` | `from`, `to` (every `setState`) |
| `massage` | `roster` (clients this session) |
| `pivot` | `beat`: `vanStop` / `line` / `unlock` / `skip`; `at` (pivot seconds), or `speaker`, `text` for a line |
| `run.start` | `seed`, `build` (`VERSION`), `unlocks`, `perks`, `cash` (from the massage), `fromPivot` |
| `wanted` | `level`, `prev`, `heat`, `cause` (`stealVehicle`, `carjack`, `goonHit`, `pedHurt`, `vehicleWreck`, `propertyHit`, `chaos`, `decay`, `massage`, `drop`) |
| `palm` | `target` (npc kind hit) |
| `gun` | `target` (npc kind knocked down), `battery` |
| `vehicle` | `act`: `enter` / `carjack` / `exit`; `type` (vehicle label), `stolen` |
| `chair` | `act`: `pickup` / `take` / `load` / `throw` / `setdown`; `where`: `ground` / `player` / `vehicle`; `vehicle`; `throw` |
| `mini` | `phase`: `start` / `success` / `cancel`; `pay`, `sore`, or `during`, `reason` for a cancel |
| `damage` | `source` (`bat`, `shove`, `grab`, or the vehicle label), `amount`, `hp` after |
| `knockdown` | `who` (`player` or npc kind), `cause`, `by` (vehicle label), `mine` (you were driving) |
| `run.end` | `reason` (`escape` / `arrest` / `death` / `left`), `time` (run seconds), `cash`, `runCash`, `host`, `tension`, `unlock`, `track` (`main` / `consolation` / null) |
| `certificate` | `outcome`, `unlock` (name), `track`, `runs`, `escapes` |
| `line` | `speaker` (`narrator` / `client` / `goon` / `cop` / `ranger` / `player` / `boss`), `name` (client name, goon id, or null), `text`, `preset` (voice), `state` (game state) |
| `tutorial` | `step` (`a` to `d`), `act` (`shown` / `done` / `skipped`), `text`, `client` (the guided first client) |

## The debug handle

Open the browser console. `window.CMF` exposes the running game:

- `CMF.state.current`; `CMF.setState('RUN')` during the massage skips straight to a run; `CMF.ctx` holds everything.
- `CMF.player`, `CMF.npcs`, `CMF.vehicles`, `CMF.wanted` (try `CMF.wanted.report('goonHit')`).
- `CMF.debug.finishClient()` completes the current massage client. `CMF.debug.palm()` throws a Healing Palm.
- `CMF.meta` shows saved progress. `CMF.audio` exposes the AudioContext and the voices. `CMF.juice` exposes hit-stop, shake, and particles.
- `CMF.renderer.info.render.calls` gives the draw calls last frame (the budget is 400).
- In the watch tab, `window.__watch` holds the events, the run groups and the last copy/download.

Made by The People's Elbow, a.k.a. Alex Adamczyk, LMT.
