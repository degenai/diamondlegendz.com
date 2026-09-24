# Chair Massage Fundamentals

A dull chair-massage training course that turns into a low-poly GTA3-style roguelike. You learn
pressure (W/S) and stroke tracking (the mouse) on three park regulars, then a franchise's
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

- `?seed=12345` (or any text, like `?seed=andy`) pins the run's city block: building heights,
  plaza layout, parked cars, the van's entry, the escape edge. Without it, every load rolls a new block.
- Progress (runs, unlocks) lives in `localStorage` under `cmf.meta.v1`. Clear it to see the
  first-run version again. Volume lives under `cmf.volume`. **M** mutes.
- The build stamp (`src/version.js`, shown in the title footer and next to the fps) is
  `YYYY-MM-DD.N` plus the short hash of HEAD. The pilot runs `node tools/bump-version.mjs` before
  each merge; it rewrites the file from today's date and `git rev-parse --short HEAD`.

## Where things are

- **The design doc:** [`DESIGN.md`](DESIGN.md). Pillars, the state machine, every ruling Alex made,
  and the phase plan. If code and doc disagree, the doc wins and the code gets fixed.
- **Code:** `src/`, plain ES modules, Three.js vendored in `vendor/` (no CDN).
  `src/main.js` boots and runs the fixed 60 Hz loop. Each state has its own module: `massage/`,
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
| Police response per star, the ranger's 15 s hang-back | `src/run/police.js` (`CRUISE`, `BAIL`, `HANG`) |
| Goons: speed, bat and shove reach, cooldowns, sit time, the 8 s opening grab window | `src/entities/goon.js` (`RUN`, `BAT_*`, `SHOVE_*`, `SIT_TIME`, `GRAB_*`) |
| Cops on foot | `src/entities/cop.js` (`SPEED`, `WALK_OFF`) |
| Goon waves and caps | `src/run/spawner.js` (`WAVE`, `GOON_CAP`) |
| Massage clients: pay, sweet-spot band, ring size, fill rate, lines | `src/massage/clients.js` (`CLIENTS`); meter feel in `src/massage/meter.js` |
| Mini-massage during a run | `src/run/minimassage.js` (`HOLD`, `HALF_BAND`, radii) |
| Healing Palm and the massage gun | `src/entities/palm.js`, `src/entities/gun.js` |
| Unlock order | `src/meta.js` (`UNLOCKS`) |
| Audio balance: music, effects, voice bus levels | `src/audio.js` (`MUSIC_LEVEL`, `SFX_LEVEL`, `VOICE_LEVEL`) |
| Voices: pitch and rate per preset, how many can talk at once | `src/voice.js` (`PRESETS`), `src/audio-wire.js` (`MAX_VOICES`) |
| Juice: hit-stop, shake, FOV kick | `src/juice.js`; particle looks in `src/particles.js` |

## The debug handle

Open the browser console. `window.CMF` exposes the running game:

- `CMF.state.current`; `CMF.setState('RUN')` during the massage skips straight to a run; `CMF.ctx` holds everything.
- `CMF.player`, `CMF.npcs`, `CMF.vehicles`, `CMF.wanted` (try `CMF.wanted.report('goonHit')`).
- `CMF.debug.finishClient()` completes the current massage client. `CMF.debug.palm()` throws a Healing Palm.
- `CMF.meta` shows saved progress. `CMF.audio` exposes the AudioContext and the voices. `CMF.juice` exposes hit-stop, shake, and particles.
- `CMF.renderer.info.render.calls` gives the draw calls last frame (the budget is 400).

Made by The People's Elbow, a.k.a. Alex Adamczyk, LMT.
