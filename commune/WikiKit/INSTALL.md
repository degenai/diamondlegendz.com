# WikiKit — Install

A personal knowledge wiki, architecturally identical to Alex's alexpedia, seeded with sanitized starter nodes and extended with your captain's-log ritual. Four steps.

## 1. Copy the template somewhere you own
Copy the `wiki-template/` folder to wherever you want your wiki to live. The suggested home is `~/.claude/wiki/` (that's where Alex keeps his, so Claude Code finds it the same way):

```sh
cp -r wiki-template ~/.claude/wiki
cd ~/.claude/wiki
```

Rename it, move it, whatever — the scripts locate the wiki relative to themselves, so nothing is hard-coded to a path.

## 2. Make it a private git repo
This is your backup and your history. Keep it **private** — it will hold personal notes.

```sh
git init
git add .
git commit -m "Install WikiKit"
```

Later, add a private remote (GitHub, wherever) and `git add . && git commit && git push` after edits to back up. That's the whole ritual.

## 3. Paste the CLAUDE.md section into your global config
Open `CLAUDE_MD_SNIPPET.md` (next to this file) and paste its contents into your global `~/.claude/CLAUDE.md`. Edit the one path line if you put the wiki somewhere other than `~/.claude/wiki/`. This is what teaches your Claude how the wiki works — the wikilink convention, the append-only log, the no-index rule, the lint suite, and the captain's-log protocol.

## 4. Verify the lint suite runs
From the wiki's `scripts/` directory:

```sh
cd ~/.claude/wiki/scripts
python -m lint.suite
```

You should see `Wiki is clean.` (Python 3.9+; no third-party packages required.) If you want Obsidian's graph view on top, just open the wiki folder as an Obsidian vault — wikilinks resolve natively.

## Done
You have a working wiki with eight seed nodes, a family stub set, a diagnostic log, and the captain's-log narrative layer. Start talking to Claude about your world; it writes the nodes. When a session winds down, say **"captain's log"** and narrate. See `wiki-template/nodes/meta.md` for the design philosophy and `wiki-template/_meta/captains-log/README.md` for the log protocol.
