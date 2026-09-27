# AI Chat Export Ingest — Layer-One Reference Pattern

Session-derived pattern for handling ChatGPT / Claude exports in AlexPedia.

## Core distinction

Exports are **raw source material**, not finished graph nodes.

- A platform export is a fossil ZIP for most users.
- For Alex, it is ore: raw conversation substrate that can be compiled into the graph.
- Do not create one giant node per export or dump every chat into `nodes/`.

## Recommended shape

Use a boring source/archive area (exact path can vary; confirm before creating):

```text
sources/
  ai-chat-exports/
    chatgpt/
      YYYY-MM-export/
        raw.zip
        manifest.json
        conversations/
    claude/
      YYYY-MM-export/
        raw.zip
        manifest.json
        conversations/
```

Optional pointer node only:

```text
nodes/ai-chat-exports.md
```

The pointer node should map:
- where raw exports live
- request/download date
- provider/account/workspace scope
- hash of raw ZIP
- normalization status
- digest passes run
- wiki nodes updated from the export

## Pipeline

1. **Preserve raw export untouched**
   - Save ZIP as downloaded.
   - Compute hash.
   - Do not edit the raw archive.

2. **Normalize separately**
   - Extract conversations to markdown/jsonl or another boring format.
   - Keep provider metadata when available: title, create/update time, model/account/source file.
   - Treat attachments/files/memories/custom GPT settings as separate artifact classes if present.

3. **Triage by theme**
   - Hermes/config/tools
   - AI philosophy / artifacting / secondary crystal
   - People's Elbow / Elbow Room / clinical
   - BBL / card graph
   - Robinhood Lab
   - Sarah/Alex / personal wiki / council/RPC
   - discard / ephemeral

4. **Extract durable claims only**
   - User preferences
   - standing project decisions
   - reusable workflows
   - named concepts/frames
   - important corrections
   - source-backed facts

5. **Update existing nodes sparingly**
   - Prefer updating `Alex.md`, `ai-philosophy.md`, `projects.md`, `peoples-elbow.md`, `robinhood-lab.md`, `RPC.md`, etc. over creating new nodes.
   - Create a new node only when the concept recurs or becomes load-bearing.

6. **Log diagnostically**
   - Example: `INGEST ai-chat-exports — staged ChatGPT/Claude archives; digested X high-signal threads into Y nodes`.

## Anti-patterns

- Treating the export as already-processed knowledge.
- Creating graph nodes for every conversation title.
- Flattening provider export into a giant markdown blob.
- Losing provider metadata or timestamps during normalization.
- Letting platform memory dumps override curated wiki truth without review.

## Philosophy

Data export = evacuation: “you may download a record of what happened here.”

Sovereign artifacting = architecture: “what happened here already lives somewhere you control.”

This ingest protocol turns evacuation artifacts into source material for architecture.