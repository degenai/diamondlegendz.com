# Client identity and deferred-update pattern

Use this when names/details are uncertain during a live update.

- In the session, capture the uncertainty exactly once in the `docket.md` under a concise item (e.g., "confirm if 2 PM client was X").
- Do not invent or force a final identity in client files.
- Defer durable client-file or spreadsheet updates until the user confirms exact identity and details.
- Add a short `log.md` admin note explaining why the item was deferred ("tonight at work," "after checkout," etc.).
- On confirmation, update the correct client record in one pass, then close the corresponding docket checklist item.
- Keep wording positive and specific: what is missing, where it will be confirmed, and what to do when confirmed.

Rationale:
- Prevents incorrect filing.
- Prevents hard commitments before source confirmation.
- Preserves continuity and makes follow-through explicit.
