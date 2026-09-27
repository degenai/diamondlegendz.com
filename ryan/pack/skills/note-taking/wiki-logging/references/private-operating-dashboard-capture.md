# Private operating dashboard capture

Use this pattern when Alex asks to turn private business math or a personal operating plan into a chart, docket item, and possible future dashboard.

## Separate the three layers

1. **Artifact:** build the interactive monitor under `C:\Users\alexa\Desktop\My Cinematic Universe\dashboards\` as self-contained HTML; create a phone-width PNG for Telegram.
2. **Docket:** record the forward-looking integration task in the MCU docket. Mark a local prototype complete and leave hosting/data wiring open.
3. **Wiki:** create or update a `visibility: private` canonical node containing the settled goal, assumptions, formulas, current model, artifact paths, and next data layer. Give it an inbound wikilink from the relevant business/project node.

A possible public or sandbox destination is a candidate until Alex explicitly chooses placement and visibility. Preserve that uncertainty in the docket; keep the canonical planning node private.

## Make the math inspectable

Expose each assumption separately instead of hiding it in a blended average:

- annual gross target
- working weeks
- collected price per session length
- weekly session count by length
- paid/completed versus merely booked sessions
- tips policy
- packages/promotions
- hands-on hours
- gross-before-expenses/taxes status

Show both the mathematical floor and a buffered operating pace. Label per-appointment yield separately from per-table-hour yield.

## Gross-to-household bridges for service businesses

When the operating target is stated as `$X per year`, establish which layer `$X` belongs to before presenting it as success:

1. **Gross collections:** money received for completed/charged work.
2. **Cash deal economics:** venue shares, commissions, partner payments, and other outflows.
3. **Modeled taxable business profit:** gross less costs that are actually deductible under the entity's tax treatment.
4. **Known tax layers:** self-employment/payroll tax estimates that can be calculated from settled inputs.
5. **Household take-home:** only after the complete federal/state return, filing profile, other wages, deductions, and credits are modeled.

Do not collapse these layers into a single “net” number. Use explicit labels such as **gross**, **net business profit**, **estimated self-employment tax**, and **after SE tax only**.

### Encode deals as functions, not prose

Convert venue terms into inspectable formulas:

- free venue: `venue cost = 0`
- percentage share: `share rate × location collections`
- percentage share with a monthly cap: `min(share rate × monthly location collections, monthly cap)`
- unresolved venue: a visibly unresolved input, not a claim that the cost is zero

Monthly caps should be evaluated month by month when actual data exists. An annualized formula such as `min(share rate × annual collections, 12 × monthly cap)` is only an even-flow planning approximation; say so in the interface.

Expose **location-specific collections** separately from total collections. A 50/50 venue deal does not imply that 50% of the whole business target occurs at that venue.

### Keep cash cost and tax classification separate

A payment can be a real cash outflow without automatically reducing an individual's Schedule C profit. Rent, commissions, contractor payments, guaranteed payments, partnership allocations, and distributions can land differently. Until the entity and documentation are settled:

- show the cash bridge;
- label deductibility as a planning assumption;
- state which tax-base formula depends on that assumption;
- leave the classification as complete-return/preparer work.

A 1099 is an information-reporting form, not a separate tax. For a simple sole-proprietor planning estimate, IRS Topic 554's baseline self-employment-tax formula is:

`modeled net self-employment earnings × 92.35% × 15.3%`

The 15.3% combines Social Security and Medicare. Verify current official federal/state rules at task time; do not persist a state rate or annual wage base as an evergreen rule. Federal and state income-tax liability depends on the complete return, so leave it outside the take-home claim until the required household inputs are available.

### Scenario design

Always show at least:

- a free-venue/lower-cash-cost bound;
- the capped-share case at full utilization;
- the buffered operating plan;
- an unresolved/custom-cost case for unknown deals.

For each row, show gross, deal cost, modeled profit, known tax estimate, and the exact boundary of what remains excluded. The point is decision visibility, not tax-software cosplay.

## Monitor-surface design

This is a **Monitor** surface: KPI strip, explicit controls, one revenue/mix chart, scenario table, and model contract. Avoid a marketing hero, decorative fake metrics, or public-site conversion copy. Use the relevant project's real palette when available.

## Verification ladder

1. Parse the HTML and run `node --check` on the extracted inline script.
2. Serve locally and open it in a real browser.
3. Exercise every preset/control and read back the resulting values; do not trust a click acknowledgment alone.
4. Inspect browser console errors.
5. Audit desktop layout visually.
6. Capture a true mobile viewport. On Windows, a headless browser `--window-size` screenshot may be distorted by DPI/minimum-window behavior. Prefer Chrome DevTools Protocol `Emulation.setDeviceMetricsOverride` with a 390 CSS-pixel viewport, capture beyond the viewport, and verify `document.documentElement.scrollWidth == 390`.
7. Distinguish intentional horizontal scrolling inside a wide table from page-level overflow.
8. Deliver both the phone PNG and interactive HTML.

## Shared-state hygiene

Before the wiki commit, run `git status --short`. Stage only the canonical node, inbound-link node, and `_meta/log.md`. Preserve live Obsidian changes such as `.obsidian/workspace.json` unstaged. Run wikilint, fix only introduced issues, verify the cached diff, push, and confirm `HEAD...origin/main` is synchronized.
