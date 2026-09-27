# Business-meeting software backlog capture

Use this reference when a partner, collaborator, venue, or practice meeting produces software work alongside ordinary business decisions.

## Evidence classification

Classify every statement before writing:

| Class | Meaning | Durable treatment |
|---|---|---|
| Current shipped state | The user confirms a feature or operating condition is live | Update the canonical project/person node and replace stale current-state language |
| Requested bounded work | A concrete audit, patch, migration, or verification was requested | Add a named backlog lane with owner, scope, and acceptance criteria |
| Discovery hypothesis | A possible architecture, provider, or integration direction | Keep under discovery; record the decision inputs rather than a settled design |
| Interface/access to verify | API, export, webhook, CMS, credential, or account access is unknown | Put under `Still to verify`; make verification the first executable step |

## Private operations-node template

```markdown
---
visibility: private
aliases: [Shared software backlog]
tags: [project, software, business]
---

# <Project> software operations

## Source status

### Confirmed
- <current state supplied by the user>
- <request or collaboration commitment>

### Still to verify
- <integration/data surface>
- <implementation access or provider capability>

## Active backlog

### <Lane 1: conversion or state correction>
- <observable acceptance criterion>
- <regression and deployment verification>

### <Lane 2: bounded external audit>
- <public-surface scope>
- <ranked deliverable>
- <implementation owner>

### <Lane 3: system discovery>
- <authoritative source data>
- <rules, ledger, suppression, audit history>
- <provider/channel comparison>

## Governance

- Each business retains its own records, consent state, branding, accounts, and export rights.
- Shared code, infrastructure, channels, costs, and operating authority have named owners.
- A bounded audit or advisory contribution is distinct from recurring implementation and maintenance.

## See also
[[Owning project]], [[Relevant collaborator]], [[Related system]]
```

## Promotion matrix

| Surface | What belongs there |
|---|---|
| Private operations node | Full backlog, source status, unknowns, acceptance criteria, governance |
| Canonical project node | Current live state and durable integration/ownership facts |
| Person/collaborator node | The collaboration request, capability recognition, and responsibility split |
| `nodes/reminders.md` | Short executable next actions |
| MCU docket | Prioritized forward work and current blocker state |
| MCU log | What changed in the meeting and how the ball moved |
| `_meta/log.md` | Newest-first `CREATED`/`UPDATED` promotion receipt |
| Public node | Publishable operating truth only |

## Acceptance-criteria patterns

### Conversion-state correction

A feature changing from fallback to live should close the old blocker and create the remaining work explicitly:

- customer-facing copy matches the live capability;
- canonical link or route is verified;
- displayed prices or service terms are checked against the authoritative system;
- one complete client-side flow passes on mobile and desktop;
- tests, schema, redirects, and production deployment are verified where relevant.

### Bounded external audit

Keep the contribution bounded and CMS-agnostic until implementation access is known:

- technical/indexation and structured-data review;
- local entity and trust signals;
- service/search-intent coverage;
- mobile and conversion friction;
- competitor-gap evidence;
- ranked findings with impact, effort, confidence, and a five-item executive priority list;
- explicit implementation owner.

### Notification or relationship-system discovery

Start from authoritative data and deterministic contact rules:

- verify schedule/client import, API, webhook, export, and reporting surfaces;
- define timing rules and offer/contact history;
- track outcomes, suppression, opt-outs, and send audit history;
- preserve distinct datasets, booking links, branding, and consent state per business;
- compare voice forwarding with programmable SMS/email capabilities as separate channel roles;
- keep providers replaceable behind channel adapters.

## Verification and receipt

1. Read back each touched block, including the following section in shared logs.
2. Run wikilint and clear findings introduced by the new node before staging.
3. Stage exact wiki paths; preserve concurrent Obsidian/workspace changes.
4. Commit and push the wiki.
5. Rebuild Alexpedia from synchronized `HEAD == origin/main` and deploy.
6. Verify the generated article contains the intended backlog and the unauthenticated live route remains auth-gated.
7. Give a compact receipt naming the operations node, operating surfaces, commit, deployment state, and only relevant lint results.
