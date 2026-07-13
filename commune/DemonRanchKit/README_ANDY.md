DEMON RANCH — COMPUTE COMMUNE TRAVEL KIT (for Andy)
=====================================================
2026-07-13. Financial Demonology's portable lab. No secrets, no accounts,
no tokens — pure research code + one price panel. Everything here also
runs the public pages at thisisez.com/demon-codex.html (read that first,
play the two minigames — that's the whole theory in 10 minutes).

SETUP (one time)
  1. Install Python 3.9+ (python.org, check "Add to PATH")
  2. pip install numpy
  3. Unzip this anywhere, keep the folder layout intact.

RUN A SHARD (the commune's whole trick)
  From the kit root:
    python sidecars/demon-atlas-20260709/atlas.py --procs 6 --worlds 250 ^
      --engine v2 --exec chunked --bps 10 ^
      --outfile atlas_v31_andy.jsonl --shard 2/3
  That computes YOUR third of the multiverse (deterministic hash split —
  Alex's machine runs 1/3, yours runs 2/3, etc. No coordination needed).
  Results land in sidecars/demon-atlas-20260709/atlas_v31_andy.jsonl —
  send that file back; vaults merge by concatenation. Resume-safe:
  re-running skips finished cells.

FOR CLAUDE (Friday's max-account session)
  Open CLAUDE_BRIEF.md and paste/attach it into a Claude Code session on
  this folder. It has full project context and the current question queue.

WHAT'S IN HERE
  sidecars/demon-atlas-20260709/  the Atlas: simulator, engines, gates, compiler
  sidecars/coterie-trials-*/      fleet-vs-committee experiment
  sidecars/coin-kelly-*/          the coin laboratory (theorem + laws)
  src/demon_ranch/backtest_duos.py  the canonical reference engine
  data/derived/*.csv              the 97-symbol total-return panel (2020-2026)
  RESEARCH_DOCKET.md              all 35 open threads

"An injury to one is an injury to all" applies to idle CPU cores too. - A&F
