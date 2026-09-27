# Image-Backed Relationship Transitions — Worked Pattern

Use this reference when a screenshot becomes the entry point for durable relationship context.

## Session pattern

The screenshot showed a warm farewell to a departing workplace contact. The first-pass image read established only what was visible: recipient name, outgoing farewell text, timestamp, delivery state, and the sender's invitation to stay connected.

The user then supplied the durable context:
- the person was present, alongside another colleague, when the user first raised problems from a prior location;
- that moment marked the beginning of a workplace transition;
- throughout the following year, the person repeatedly tried to generate bookings and connect the user to chair-work opportunities;
- the person left for a named employer, while role and location remained unspecified.

## Durable synthesis

Separate the record into three layers:

1. **Visible artifact facts** — what the screenshot literally shows.
2. **Confirmed standing facts** — relationship, practical support, workplace transition, destination.
3. **Contextual comment** — why the farewell matters in light of that history.

A strong contextual comment identifies the closed loop. Example shape:

> The phrase “you were there at the start of a new chapter” is literal: the recipient was present at the threshold of the user's transition and then supported it through concrete work opportunities. The farewell returns that recognition as the recipient begins a new chapter.

This is stronger than generic “warm and heartfelt” sentiment because it explains the load-bearing history behind the words.

## File pattern

- `nodes/<Person>.md` — private person node with relationship context, departure, embedded screenshot, and `Why the farewell matters`.
- `nodes/<Second Person>.md` — concise private node when another confirmed person is part of the origin event.
- `nodes/<Destination Org>.md` — private org node; explicitly leave unknown role/location open.
- `nodes/<Shared Workplace>.md` — link the people into the transition history.
- `nodes/assets/<descriptive-date>.jpg` — archived screenshot.
- `_meta/log.md` — one diagnostic line per node/action.

## Guardrails

- A contact label or initial is not a surname.
- A named employer does not establish role, department, or location.
- Delivery marks do not prove an emotional response.
- Preserve exact user phrasing only when it carries the relationship's meaning.
- Keep private communications on private nodes.
- Fix lint findings introduced by the new material; report the legacy lint baseline separately.
