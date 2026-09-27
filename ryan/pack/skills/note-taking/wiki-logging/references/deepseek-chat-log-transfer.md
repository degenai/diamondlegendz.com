# Deepseek / Chat-to-log transfer lane

Use this lane when a user asks to validate delivery with a "chat pass" request such as: "pass chats", "go through this and pass chats and wiki log", or mentions **Deepseek** as a dry-run.

## Trigger pattern
- The request is explicitly about confirming the chat-to-log handoff quality.
- User is usually asking for process proof, not new business doctrine.
- Stand-up goal is: append a log entry only, with minimal durable surface changes unless the user asks for promotion.

## Workflow
1. Draft a short cache entry file (for example in `AppData/Local/hermes/cache/`) with a neutral phrase like:
   - `wiki-log-<topic>-<date>.md`
   - Include date, request, durable outcome, and any chat-only framing correction notes.
2. Append via the provided helper:
   - `python <wiki-logging-skill-dir>/scripts/append_log.py --wiki-root <wiki-root> --entry-file <entry-file>`
3. Read back the top of `_meta/log.md` and verify:
   - New section is immediately below `# Log`.
   - No unrelated existing entries were overwritten.
4. Stage only `_meta/log.md`.
5. Commit + push with a message like:
   - `wiki: <brief description>`.
6. Report concise result: commit hash, push status, and a note that unrelated workspace changes were intentionally left unstaged.

## Safety rules
- Do not promote any person/business fact from the chat-pass lane unless explicitly confirmed.
- Do not mutate unrelated nodes/reminders during this lane.
- Preserve concurrent writer state (do not use `git add -A`).

## Practical example
- Topic: `2026-08-06 (Deepseek logging test)`
- Outcome captured: phrase framing remained chat-only; cast/routing corrections were already in prior context and not reified as new durable canon.
