# Safe targeted editing and concurrent writers

## Failure mode

Short `old_string` values can be dangerous with fuzzy replacement. Matching only a heading prefix or the opening words of a sentence may replace the entire physical line, silently deleting the suffix. Repairing with another prefix match can cascade into the next checklist item.

## Safe pattern

- Prefer V4A patches with complete lines and explicit surrounding context.
- In replace mode, include the complete target line plus a stable neighboring line in both `old_string` and `new_string`.
- After every insertion, inspect the diff for changes outside the intended lines.
- Read back the whole section, not only the inserted lines.

## Partial bulk-patch recovery

A multi-file or multi-hunk patch can return a success result even when only part of the requested change landed. Treat the returned unified diff as the applied truth, not the requested patch body.

1. Compare the returned diff with every intended hunk.
2. If a hunk is missing or a section was clipped, stop before patching adjacent files.
3. Reread the full damaged block from disk.
4. Repair one file and one enclosing section at a time using the exact current text.
5. Read the repaired block back before resuming the broader propagation pass.

## Concurrent append-only logs

A log tail may gain entries from another agent between read and write. Before appending:

1. Reread the current tail.
2. Anchor against the exact current final entry or a stable heading.
3. After patching, read the inserted entry and the following entry to prove concurrent content survived.
4. Never rewrite the full file from a stale partial read.

## Verification ladder

1. Unified diff: intended lines only.
2. Block readback: headings and neighboring prose intact.
3. `git diff --check`: no whitespace errors.
4. Wikilint: no new graph issues.
5. Stage only intended wiki files; local temporal workspace files may use a separate persistence model.
