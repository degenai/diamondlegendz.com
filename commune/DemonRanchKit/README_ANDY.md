DEMON RANCH — COMPUTE COMMUNE TRAVEL KIT (for Andy)
=====================================================
v3, "the meteorology era" (2026-07-16). Financial Demonology's portable lab.
No secrets, no accounts, no tokens, no personal finances — pure research code
plus price panels. The public state of the project lives at
thisisez.com/demon-rumble.html (read that first — it's the whole story so far).

--------------------------------------------------------------------
START HERE (entry docs, in order)
--------------------------------------------------------------------
  1. thisisez.com/demon-rumble.html   the public state of the campaign
  2. CLAUDE_BRIEF.md                  full project context for a Claude session
                                      (⚠️ a v3 brief lands on this branch before merge)
  3. RESEARCH_DOCKET.md               the science board — every open thread
                                      (commune edition: science only, no personal finance)
  4. DATA_MANIFEST.md                 what heavy data is missing and where it goes

--------------------------------------------------------------------
SETUP (one time)
--------------------------------------------------------------------
  1. Install Python 3.9+ (python.org — check "Add to PATH").
  2. Install the dependencies:

       pip install numpy pandas scipy statsmodels yfinance requests etf-scraper

     (The Atlas engine itself only needs numpy. pandas/scipy/statsmodels are for
      the cointegration, kayfabe, commodity and roster sidecars. yfinance/requests/
      etf-scraper are only for the data-fetch scripts.)

  3. Keep the folder layout intact.

--------------------------------------------------------------------
DEMON_RANCH_ROOT — how the scripts find their data
--------------------------------------------------------------------
Every ported script resolves its data root like this:

    ROOT = Path(os.environ.get("DEMON_RANCH_ROOT", <the kit root>))

So out of the box, ROOT is the kit itself and everything resolves inside the kit.
If you have a fuller "Demon Ranch" tree (e.g. Alex hands you one on a USB), point
at it instead and nothing needs copying:

    macOS/Linux:   export DEMON_RANCH_ROOT=/path/to/DemonRanch
    Windows (PS):  $env:DEMON_RANCH_ROOT = "D:\DemonRanch"

Leave it unset to use the kit. See DATA_MANIFEST.md for which heavy files are absent
and where to drop them if you go the copy-into-the-kit route.

--------------------------------------------------------------------
FREE API KEYS — self-provision, never commit
--------------------------------------------------------------------
The data-fetch scripts read free-tier keys from your home directory, one key per file,
plain text, no quotes:

    ~/.tiingo_key      Tiingo        sign up: https://www.tiingo.com  (free, ~2 min)
    ~/.av_key          Alpha Vantage sign up: https://www.alphavantage.co/support/#api-key
    ~/.fmp_key         FMP           sign up: https://site.financialmodelingprep.com/developer/docs

Create one like:  printf 'YOURKEY' > ~/.tiingo_key
These files stay OUT of git — no key ever belongs in the repo. (The roster
`fetch_holdings.py` needs NO key: it pulls public issuer product-data APIs via
`etf-scraper`/`requests`. Keys are only for the Hall-of-the-Dead price pulls —
see `sidecars/hall-of-the-dead-20260715/SCOUT.md` + `REPORT.md`.)

--------------------------------------------------------------------
CONSUME, DON'T RE-FETCH
--------------------------------------------------------------------
The roster and Hall sidecars ship their DERIVED products (normalized holdings,
overlap matrices, clean price series manifests) but NOT the raw pulls (see
DATA_MANIFEST.md — roster `raw/` is 25 MB, Hall `prices/` is 14 MB). Read the
derived files; only re-fetch if you are deliberately rebuilding from source. The
raw issuer pulls and the Tiingo price library are survivorship-sensitive and
rate-limited — treat the shipped derivatives as the source of truth.

--------------------------------------------------------------------
RUN A SHARD (the commune's whole trick)
--------------------------------------------------------------------
  From the kit root:

    python sidecars/demon-atlas-20260709/atlas.py --procs 6 --worlds 250 \
      --engine v2 --exec chunked --bps 10 \
      --outfile atlas_v31_andy.jsonl --shard 2/3

  That computes YOUR third of the multiverse (deterministic hash split — Alex's
  machine runs 1/3, yours runs 2/3, etc.; no coordination needed). Results land in
  sidecars/demon-atlas-20260709/atlas_v31_andy.jsonl — send that file back; vaults
  merge by concatenation. Resume-safe: re-running skips finished cells.

  NOTE: engine_v2.py is now the full 1204-line engine (was a stale 288-line stub in
  earlier kits). It imports cleanly from the kit tree and agrees with the canonical
  stdlib reference (`src/demon_ranch/backtest_duos.py`) — bit-for-bit on the v4 panel.

--------------------------------------------------------------------
WHAT'S IN HERE
--------------------------------------------------------------------
  sidecars/demon-atlas-20260709/       the Atlas: simulator, engines (v2 = 1204 lines), gates, compiler
  sidecars/coterie-trials-20260711/    fleet-vs-committee experiment
  sidecars/coin-kelly-20260712/        the coin laboratory (theorem + laws)
  sidecars/cointegration-20260715/     the cointegration persistence test (the pivot)
  sidecars/kayfabe-20260715/           title-change + kayfabe-detection instruments, the Rumble
  sidecars/commodity-roundrobin-20260715/  commodity round-robin census
  sidecars/roster-overlap-20260715/    ETF holdings overlap stat (roster-overlap instrument)
  sidecars/hall-of-the-dead-20260715/  corpse library of corporate deaths (manifests + reports)
  src/demon_ranch/backtest_duos.py     the canonical reference engine (now imports cleanly —
                                       avatar.py + doctrine.py deps included)
  data/derived/*.csv                   the 97-symbol total-return panel (2020–2026)
  RESEARCH_DOCKET.md                   the science board
  DATA_MANIFEST.md                     heavy artifacts shipped by Drive/USB, not git

--------------------------------------------------------------------
FOR CLAUDE (max-account session)
--------------------------------------------------------------------
  Open CLAUDE_BRIEF.md and paste/attach it into a Claude Code session on this folder.
  ⚠️ The committed CLAUDE_BRIEF.md is STALE — a v3 brief lands on this branch before
  merge. Do not onboard a session from the stale file.

"An injury to one is an injury to all" applies to idle CPU cores too. - A&F
