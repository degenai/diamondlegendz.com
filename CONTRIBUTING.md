# Contributing to diamondlegendz

## Commit messages

This repo is heading toward a live changelog — every commit will eventually feed a public "Dev Ring" on the site. Commit messages are user-facing news items, not just git log entries. Write them like Steam patch notes.

### Format

```
<Subject line: user-facing outcome, plain language>

<Body: PR copy. As long as it needs to be to comprehensively explain what
changed for the visitor. Speak to them, not about the code.>

<Dry technical details: function names, file paths, big-O, CVE refs all
welcome here. Bullets or prose, dealer's choice.>
```

The blank line between body and technical detail is the whole contract.

### Example — good

```
Sell tracker lets you close a position

You can now mark any held item as sold and it moves to a new Closed
Positions table. The site tracks realized profit and loss alongside the
unrealized P/L on what you still hold, with a lifetime total at the top
so you can see how you're actually doing across your whole sealed
history. Accidentally logged a sale? Hit "unsell" and it comes back.

Added status field ("held" | "sold") to the holdings schema (v2) with
automatic migration from v1. Sell branch: sell_date, sell_price,
sell_venue (enum), sell_fees, sell_notes.
```

### Example — bad

```
feat: add sell tracking to portfolio.js

added status field + sell_* fields + closed positions table
```

### Rules

- Subject is a user outcome. No function names, file paths, or abbreviations in the subject.
- Body addresses visitors in second person where natural.
- Body length is whatever it takes to comprehensively cover the change.
- Technical detail lives after the blank line.
- Security/compliance commits get a user-facing lead ("Hardened login against a known browser attack") with the attack class or CVE in the tail.
- Even tidy-up commits that change nothing visible get a body that honestly says so: *"Behind-the-scenes cleanup — no user-visible changes."* That's still better feed material than silence or dev jargon.

### Optional tonal prefix

A conventional-commit prefix (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`, `style:`, `perf:`, `build:`, `ci:`, `revert:`) is **allowed** as a tonal hint. The changelog renders it as a colored badge next to the subject so readers can skim by flavor. Write the subject as a user outcome *after* the colon — the prefix never replaces it.

Accepted:

```
feat: Sell tracker lets you close a position
fix: Portfolio totals no longer double-count gifted items
chore: Behind-the-scenes cleanup — no user-visible changes
Sell tracker lets you close a position   # no prefix — also fine
```

Rejected (prefix is the whole subject):

```
feat: add sell tracking
fix: bug
```

Badge palette, for reference:

| prefix     | vibe                | badge color     |
|------------|---------------------|-----------------|
| `feat`     | new capability      | green           |
| `fix`      | bug fix             | orange          |
| `chore`    | housekeeping        | gray            |
| `refactor` | internal restructure| purple          |
| `docs`     | text / prose change | yellow          |
| `test`     | quality work        | cyan            |
| `style`    | cosmetic            | hot pink        |
| `perf`     | speed               | red             |
| `build`    | packaging / deps    | tan             |
| `ci`       | automation          | sky blue        |
| `revert`   | undo                | white on black  |

### Enforcement

A commit-msg hook at `.githooks/commit-msg` warns on deviations (conventional-commit prefix, missing separator, too-short message, jargon in subject). Warnings only — the commit still goes through. Author discipline is the real contract; the hook is a nudge, not a gatekeeper.

One-time setup to activate the hook:

```sh
git config core.hooksPath .githooks
```

Full background on why this style exists lives in the `d1-changelog` page of the alexpedia wiki.
