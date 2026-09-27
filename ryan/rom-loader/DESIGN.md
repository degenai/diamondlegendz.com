# ROM Loader: design (v0, 2026-09-27)

For Ryan. His PlayStation 2 library lives on an external hard drive and he runs local emulators; the games are
eating the laptop's storage. He wants a Steam-like library where a game on the drive can be "installed" to
the laptop (a copy) and "uninstalled" (a delete of the local copy), and launched with the right emulator.
He likes other emulators too, so the app is agnostic: an emulator is an emulator, a ROM is a ROM, this is a
multi-loader. Rulings by Alex, 2026-09-26/27: an Electron app; Alex's side builds a working v0 first and
hands it over, then Ryan's own agent (Hermes on DeepSeek, with the starter pack at diamondlegendz.com/ryan)
extends it; art is a separate job later, sourced from the libretro-thumbnails repository by system and
title, so v0 records a manifest and shows placeholders.

## The one-sentence design

A local Electron app that scans a drive and a local folder for ROMs by system, shows them as a Steam-style
grid with an installed/on-drive state, copies and deletes on request with a progress bar, and launches each
game with the emulator configured for its system.

## Concepts

- **System**: a console. Has a name, a list of file extensions, an emulator command (path plus argument
  template, `{rom}` substituted), and folder names it is found under. v0 ships defaults for PS2 (.iso, .bin,
  .chd, .cso; PCSX2), PS1 (.bin/.cue, .chd; DuckStation), GameCube/Wii (.iso, .rvz, .gcz; Dolphin), N64
  (.n64, .z64, .v64), SNES (.sfc, .smc), Genesis (.md, .bin), GBA (.gba), NDS (.nds), Dreamcast (.gdi, .chd,
  .cdi). Emulator paths are blank until Ryan sets them; the app never guesses an executable.
- **Library roots**: the external drive root (source) and the local folder (installed). Each root is scanned
  for `<root>/<system folder>/<files>`; a file whose extension matches a system is a game. Multi-file games
  (.cue + .bin, .m3u sets) are grouped by the primary file.
- **Game**: system, title (derived from the file name, cleaned of tags in brackets and parentheses but kept
  for display), primary file, all files, size, a content hash (xxhash or sha1 of the first 1 MB + size, fast),
  state: `drive` | `installed` | `both`, and art placeholder.
- **Install**: copy the game's files from the drive root to the same relative path under the local root,
  with a progress bar (bytes), verify size, then mark installed. **Uninstall**: delete the local copy only,
  never the drive copy. Never move; never delete on the drive. If the drive is unplugged, drive-only games
  show as unavailable, installed ones still play.
- **Play**: spawn the system's emulator with the local file (or the drive file, if not installed and the
  user says play-from-drive). The app stays open; a "last played" stamp is recorded.
- **Manifest**: `library.json` in the app's data folder with every game seen (system, title, clean title,
  hash, size, paths, state, last played) and `art/` with `<hash>.png` when the art job has run. The art job
  is out of scope: v0 writes the manifest and shows a placeholder tile with the title and system badge.

## Screens

1. **Library**: a grid of tiles (art or placeholder), filters by system and state, a search box, sort by
   title / size / last played. A tile shows title, system badge, size, and a state chip. Click opens the game
   panel.
2. **Game panel**: title, system, files, size, state, buttons: Install / Uninstall / Play / Open folder.
   Progress bar during a copy. Errors in plain words ("not enough space: needs 4.2 GB, 1.1 GB free").
3. **Settings**: the two roots (folder pickers), per-system emulator path and argument template, "play from
   drive" toggle, a rescan button, a "free space" readout for both roots.

## Non-goals for v0

Art fetching, save-state management, controller config, cloud anything, per-game emulator overrides,
Linux/Mac packaging (Windows first; the code stays portable).

## Technical contracts

- Electron, current LTS, plain HTML/CSS/JS renderer, no framework, contextIsolation on, a small preload
  bridge (`window.api`) with: getConfig/setConfig, scan, install(id), uninstall(id), play(id), openFolder(id),
  onProgress. All file work in the main process, streamed copies (`fs.createReadStream` piping) with byte
  progress events; deletes go through `shell.trashItem` where available.
- Config and manifest under `app.getPath('userData')`. Config is JSON, human-editable, with the defaults
  above written on first run.
- Scanning is async, tolerant of a missing drive (root absent = games marked unavailable, not dropped from
  the manifest), and idempotent.
- Tests: a Node test file that builds a fake drive and local root in a temp folder with dummy files, runs
  scan / install / uninstall / rescan, and checks the manifest and the files. No emulator is launched in
  tests; `play` is tested by asserting the spawn arguments.
- Repo layout: `package.json`, `main.js`, `preload.js`, `renderer/` (index.html, app.js, styles.css),
  `lib/` (scan.js, copy.js, config.js, systems.js, manifest.js), `test/`, `README.md` with "how to run" in
  five lines. `npm start` runs it; `npm test` runs the tests; no build step.

## Phases

1. lib + tests: systems, config, scan, manifest, copy with progress, uninstall. Green tests, no UI.
2. The Electron shell: main, preload, the library grid and the game panel wired to lib; install/uninstall
   with the progress bar; play via spawn; settings screen with folder pickers.
3. Polish: search/sort/filters, free-space readouts, unavailable-drive state, the placeholder tiles that look
   like a shelf, a README for Ryan.

## Handoff

The v0 ships as a zip of the source (no node_modules) at diamondlegendz.com/ryan/rom-loader/ with the README.
Ryan's agent takes it from there with the EVA pattern: DESIGN.md is the canon, this file's rulings are dated,
and the first open question for him is the emulator paths and which systems he actually owns.
