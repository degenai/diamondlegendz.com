# Wiki-fed council roleplay

Use when Alex asks for a council/RPC-style dialogue that should be grounded in the personal wiki.

## Shape

1. Orient to Alex's wiki first:
   - `C:\Users\alexa\.claude\CLAUDE.md`
   - `C:\Users\alexa\.claude\wiki\_meta\log.md` recent tail only
   - `C:\Users\alexa\.claude\wiki\_meta\tags.md`
2. Read a small set of high-signal nodes rather than trying to exhaust the graph.
   - Default anchors: `Alex.md`, `ai-philosophy.md`, `meta.md`, `formed-by-doing.md`, `the-long-game.md`.
   - Add task-specific nodes: e.g. `robinhood-lab.md`, `peoples-elbow.md`, `Elbow Room.md`, `Convention of Tension Prevention.md`.
3. Extract concrete phrases/images from the pages. Prefer quoted user frames and weird specifics over generic synthesis.
4. Write the council as dialogue, not a report. Each voice should react to the wiki evidence and to each other.
5. For Telegram voice requests, compose the full text first, generate TTS from that same text, send audio via `send_message`, then final with the same text.

## Voice constraints

- Do not fake exact adoption percentiles; use directional language like "far right tail" or "not median."
- For celebrity/public-person personas, write a stylized parody/role, but TTS should use the configured Hermes voice. Do not claim the audio is a cloned/imitation voice.
- Keep the council grounded in wiki details: "secondary-crystal," "formed by doing," "empire of blood not paper," "sinner-shield," "witness-machine," "tiny blast radius," etc.

## Claude-P sidecar pattern

When Alex asks for a Claude-P runner to add a voice:

1. Create a self-contained evidence packet with the relevant wiki excerpts and style constraints.
2. Invoke `claude -p` in no-tool mode with a strict JSON contract, preferably cheap/fast model first.
3. Run it in the background with notify-on-complete if the main response should go out now.
4. Treat the sidecar as an additional council voice, not as a replacement for Hermes' answer.

## Free-reign Opus sidecar pattern

When Alex explicitly asks to give Opus “free reign” of the wiki, use a larger read-only sidecar instead of a tiny evidence packet:

1. Still orient Hermes first enough to know the task shape and avoid stale paths.
2. Write a prompt file that tells Opus to start from `CLAUDE.md`, `_meta/log.md` tail, `_meta/tags.md`, then roam the wiki read-only.
3. Allow only read/search tools: `--allowedTools "Read,Glob,Grep"`. Do **not** allow edit tools; the sidecar recommends wiki updates but does not modify files.
4. Use a higher-but-bounded budget/turn envelope, e.g. `--model opus --max-turns 12 --max-budget-usd 1.50`, and save JSON output to a temp file for audit/extraction.
5. Ask for a clear structure when the user wants deep reflection:
   - `Opus sidecar: what you need to hear`
   - `What should be wiki-logged from this session`
   - `The council continues`
6. Require concrete wiki-log recommendations rather than letting the sidecar edit: which pages/nodes to update, what concept deserves a node, and what should stay contained.
7. Report the sidecar status/cost briefly, then read the result as Hermes TTS if the turn was voice-triggered or the user requested speech.

Useful stance for this class: the sidecar may push back hard, but it should keep real-world body/client/business work primary and explicitly warn against confusing the council/wiki narration with doing the work.
