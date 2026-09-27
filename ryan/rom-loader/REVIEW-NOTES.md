# ROM Loader v0: review notes for Ryan's agent (2026-09-27)

A read-only review pass (a cheap model, one narrow question: can this app ever damage the drive copy, delete
the wrong files, or leave the library inconsistent?) found six things worth fixing before real use. Nothing here
was built on Alex's side; they are handed over as work for your agent. Ranked, with file and line as of the v0 zip.

1. HIGH, `lib/scan.js:104-109` and `lib/manifest.js:55-57`. A drive root that exists but reads as empty (a
   mount-point folder with the drive unplugged) is treated as online, and the merge then drops every not-installed
   game from `library.json`, losing last-played history. DESIGN.md promises the opposite ("root absent = games
   marked unavailable, not dropped"). Fix: treat an empty top-level listing (or a failed statfs on the root) as a
   possible disconnect and keep the previous state, the way a truly absent root already does.
2. MEDIUM-HIGH, `lib/scan.js:117`, `lib/manifest.js:30-57`, `lib/library.js:106`. Game identity is the primary
   file's path, so renaming a file on the drive mints a new game; an installed copy of the old name becomes a
   phantom "laptop only" record that refuses to uninstall, and installing the new name makes a second local copy.
   Fix: key games on the content hash the scanner already computes, or reconcile same-hash entries on merge.
3. MEDIUM, `lib/library.js:130-141`. `play()` swallows spawn errors and stamps `lastPlayed` before the emulator
   even starts; an emulator path that is a folder passes the existence check and fails silently. Fix: require
   `isFile()`, stamp last-played from the spawn's success event, and surface the error to the panel.
4. MEDIUM, `lib/copy.js:42-58`, `lib/scan.js:22`. A crash or an unplug mid-copy leaves a `.part` file in the local
   folder forever; the scanner ignores `.part` names, so nothing ever cleans it. Fix: sweep stray `*.part` files
   under the local root at startup or on rescan.
5. LOW-MEDIUM, `lib/library.js:82-83`. "Already installed" is decided by byte length alone; a same-size corrupted
   local file is never re-copied. The scanner's hash could be a cheap sanity check.
6. LOW, `lib/library.js:86-87`. Install checks that the drive is online but not that the local root is; an
   unmounted local drive letter throws a raw ENOENT instead of the friendly "not connected" message.

Checked and found clean: the uninstall path guard (resolved, case-insensitive, sibling-prefix safe, junctions
skipped), the free-space check measures the local root's own volume, and play's arguments are an argv array with
no shell, so spaces and quotes in paths pass through safely.

Suggested first job for your agent: run it like the EVA pattern with this file as the brief; it should ask you
whether identity by hash is worth the rescan cost before it touches anything.
