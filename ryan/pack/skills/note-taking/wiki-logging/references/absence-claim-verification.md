# Verifying absence before creating or claiming a wiki node

Use this reference when a person, organization, project, alias, or topic appears absent from a personal wiki.

## Why this exists

A zero-result from one retrieval interface is evidence about that query, not evidence that the node does not exist. Search coverage can differ by root, filename/content mode, case normalization, hidden-directory handling, indexing state, and tracked/untracked status.

A live failure involved a filename/content search returning zero results for a known person. The agent then wrote “no wiki node yet.” A direct repository inventory showed the existing person node immediately. The durable lesson is the verification ladder below—not a permanent claim that any particular tool is unreliable.

## Absence-claim evidence ladder

Before saying a node is absent or creating a new one:

1. **Validate the root**
   - Confirm the canonical wiki root and node directory from repository policy.
   - Do not assume the current working directory, a workspace shortcut, or generated site output is the source graph.

2. **Search filenames and contents separately**
   - Filename search: exact name, surname, likely STT spelling, and alias.
   - Content search: exact name plus role/company/relationship anchors.
   - Use case-insensitive matching and search the full canonical root.

3. **Inspect repository inventory independently**
   - Enumerate tracked and untracked Markdown paths, e.g. `git ls-files --cached --others --exclude-standard -- 'nodes/*.md'`.
   - Filter the returned inventory case-insensitively in code or inspect likely paths directly.
   - If the canonical naming convention suggests an exact path, attempt a direct read of that path.

4. **Read likely hub nodes**
   - Person/cast hub, workplace, family, project, aliases, and backlinks may resolve the identity even when the expected filename differs.

5. **Only then classify**
   - Existing node: update it.
   - Alias or renamed node: update the canonical node and alias metadata.
   - Truly absent: create the minimum verified node, or leave the identity pending if evidence is incomplete.

## Correction sweep after a false absence claim

If a duplicate or false “no node” statement was already written:

1. Link the existing canonical node everywhere the new event was recorded.
2. Remove the false absence wording from the dated log and canonical nodes.
3. Do not create a duplicate node merely to preserve the mistaken path.
4. Read back the touched blocks.
5. Run graph lint and stage only owned files.
6. Commit/push and verify the remote head when the repository workflow requires it.

## User-facing behavior

Own the error directly: name the failed inference, state the independent verification that corrected it, and report the durable surfaces fixed. Do not blame the user or hide behind the search tool.
