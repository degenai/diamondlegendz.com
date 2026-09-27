# Forecast-to-action provenance audits

Use this when capturing or joining predictions to later observed actions for diagnostics or learned-model acceptance. For a stored-label oracle, also use the event-referee procedure in `learned-model-acceptance-audits.md`.

## 1. Establish source semantics before building the join

- Inspect the actual protocol and shared classifier before choosing labels. A broad ALL-IN class can contain both calls and raises; require authoritative aggression evidence before admitting a jam, and preserve legitimate all-in calls as calls.
- Validate the raw event type as well as its action word. A retained last-action field in a table/result snapshot is not a new action. When normalized envelopes embed raw proof, verify its digest, event URI, sequence, time and actor against the envelope rather than trusting an aggression flag alone.
- Validate native identifier types before canonicalization. Reject absent, boolean, empty and malformed IDs; verify canonical IDs, names and seats remain one-to-one before resolving prices or actors. Converting everything with `str()` can turn missing values into plausible identifiers and collapse distinct keys.
- Resolve actor, room/session, hand, turn and authoritative event window explicitly. Reject ambiguous multi-actor updates and conflicting identities; same-hand membership is not decision provenance.
- Validate all records that can affect ordering, boundaries, streets or results, not only action packets. Use strict integer checks where booleans would otherwise compare equal to integers. Base gap/order checks on an established protocol contract, not an assumed interpretation of a sequence field.

## 2. Capture a complete decision and bound its lifetime

- Run the pinned candidate/reference paths on the same captured input and retain their final transformed probabilities, original precision, bundle identities, raw byte ranges/digests and local capture times. Do not reconstruct a supposedly logged final price from an earlier head output.
- Validate every target and probability in a multi-target batch before journaling actionable forecasts. Publish pending joins only after the complete batch succeeds; a valid first target must not survive an invalid later target as an apparently complete population. Preserve rejection evidence and make partial-batch invalidation visible to the scorer.
- Model pending joins as explicit phases: awaiting the initiating decision, then awaiting terminal responses. Invalidate contradictory room/hand/turn/population state even when it arrives through a rejected-input path. Preserve expected post-decision state changes only after observing the initiating action; consume terminal responses so later turns cannot reuse the forecast.
- Deduplicate identical events without counting another action. Treat conflicting duplicates, unsupported intervening actions and established ordering violations as incomplete evidence rather than searching ahead for a convenient response.
- Test a valid batch followed by an invalid target, rejected state transitions followed by later actions, expected post-decision transitions, repeated packets, and terminal-response consumption. Pair these negative schedules with a complete positive capture-to-score fixture.

## 3. Establish temporal support independently

- Keep local arrival/capture time separate from upstream event time. Similar-looking timestamps, replay arrival times and a caller's `shared_clock` flag do not establish comparability.
- When a verified same-origin clock exchange exists, retain raw request/response proof and monotonic send/receive bounds; account for resolution, age and substantiated drift before comparing event intervals. Require the relevant intervals to establish ordering, not merely their midpoint estimates.
- If the real bridge or clock contract cannot be exercised, finish and test the local implementation but record the specific runtime-evidence gap. Do not backdate forecasts or replay historical records as fresh prospective capture.

## 4. Preserve the declared scoring population

- Freeze target population, collection endpoint, support floors, exclusions and failure disposition before response outcomes are opened. Select the endpoint from eligible initiating decisions, not from successfully resolved outcomes; replacing a missing early response with a later hand silently extends the experiment.
- Score candidate and reference on exactly the same supported trials without fitting temperatures, thresholds, weights, priors or histories. Follow `online-learning-acceptance-audits.md` for paired losses, reliability and reproducible grouped resampling.
- Separate unreadable records from known counts: empty price maps contain zero opponents, while malformed input can make counts incomplete. Detect partial lines before content-marker filtering can hide them.
- Preserve superseded provisional results, but make the current report explicitly withheld/inconclusive when stronger checks invalidate them. A stale positive report must not remain the apparent latest result.

## 5. Close only the demonstrated boundary

Distinguish mechanism acceptance from empirical acceptance. Synthetic RED/GREEN schedules and identical-real-bundle plumbing smokes can pass while no real cohort is certifiable; do not weaken source requirements to recover positive counts. When a reviewer reports missing tests, inspect the complete suite before duplicating tests or reopening review, and distinguish a packet-coverage limitation from a source defect.
