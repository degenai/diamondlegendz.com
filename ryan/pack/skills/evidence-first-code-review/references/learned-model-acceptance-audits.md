# Learned-model acceptance audits

Use when auditing a rebuild, training handoff, predictive-system acceptance report, or an online learner. Start with artifact provenance from `review-evidence-packet-completeness.md`; this procedure checks whether the measurements support the claimed behavior.

## 1. Freeze the evidence without disturbing the learner

Read the acceptance specification, executable gates, report, and subsequent source changes together. Inspect imports and command entrypoints before executing them: an evaluation command may ingest rows first, and a health check may repair files. Prefer pure artifact inspection and isolated fixtures over rerunning a mutating harness on live data.

Capture the accepted store/checkpoint and a separately timestamped current snapshot. Record schema, dimensions, row kinds, split counts, and checkpoint metadata. Compute split membership per episode/hand/group, not merely per row: sibling rows crossing train and holdout invalidate the claimed independence even when the row counts look correct. State that zero crossings of stored keys verifies only the stored-key invariant, not the correctness of the keys themselves.

### Describe snapshot and live-process isolation precisely

- Record per-file stability separately from logical bundle coherence. Independently hash-checked checkpoint and identity-map copies do not prove they belonged to one publication transaction; verify shared identity/ancestry where available, otherwise label the reference as an as-captured specimen rather than the exact historically served bundle.
- Distinguish leaving the live process running and making no task-owned live writes from asserting unchanged live bytes. An ordinary learner may legitimately update its own files; verify preserved snapshots and their separation from those evolving paths instead of promising checkpoint immutability in the live tree.
- Discover project-owned processes by working directory as well as command line. Relative launches such as `python -m nn.train --live` contain no project-name token; an empty command-line substring search does not prove the learner stopped. Leave independently running authorized learners alone.

### Prepare a byte-preserving input projection

1. Preserve and hash complete source prefixes before selecting records. Keep original offsets, lengths and per-record digests, plus selected offsets or explicit exclusion reasons; a filtered file has a different coordinate system.
2. Reject duplicate JSON keys recursively and reject both non-finite constants and overflowing numeric tokens. In Python, use `object_pairs_hook` for duplicate detection, `parse_constant` for literals such as NaN, and a finite-checking `parse_float` for values such as `1e9999`; default `json.loads` can otherwise choose an identity silently or admit infinities.
3. Validate observations against every downstream consumer before tightening the projection. Missing advice may prevent a policy-label row while still supplying a valid behavioral transition; absence of one consumer's field is not automatically malformed source data.
4. Re-audit preserved originals after changing admission rules, retain superseded projections/receipts, and identify the active projection by hash. Distinguish blank separators, malformed records, disputed labels and unknown outcomes; do not guess replacement classes to improve coverage.

### Validate learned identity maps before expensive compute

1. Check persisted embedding maps separately from native actor/price identity validation. Require strict JSON, exact integer row values within reserved/capacity bounds, and unique row assignments for identities that the model contract treats separately. In Python, reject Boolean rows explicitly with `type(row) is int`; `isinstance(row, int)` admits Booleans. Validate identity keys against the exact source-ID contract rather than silently trimming or coercing them. Byte-identical copies can faithfully preserve an inherited collision.
2. Count each colliding identity's appearances by embedding slot and train/development partition to bound impact. Preserve the original map and checkpoint; describe the collision without guessing its historical cause.
3. Validate allocation against sparse maps as well as contiguous ones. For a monotonic allocator, use `max(occupied_rows, default=FIRST_ROW - 1) + 1` and check capacity before assignment; map length alone assumes contiguity and can reuse an occupied row. Write RED-first tests for sparse allocation, duplicate rows, Boolean/float rows, reserved/out-of-range rows, malformed keys, and corrupt in-memory save/growth. Validate before load acceptance, growth and persistence; assert rejected state leaves the saved map unchanged. Test the declared capacity fallback and non-growing evaluation lookup separately.
4. Treat post-fit renumbering as a model change: a fresh numeric row does not undo training shared by two identities. Establish a reviewed repair/initialization policy and any additional-fit authorization; reuse the verified store when raw stored IDs/features/targets remain valid.
5. Preserve the original failed verification receipt and collect the remaining independent checks without converting the overall failure to PASS. Keep candidate acceptance, comparison freezing, promotion and milestone-gated wiki completion pending when their prerequisite fails.
6. For an explicitly authorized fresh-map corrected fit, start from an empty candidate map and grow it only on seeded training batches; use non-growing lookup for development. Verify the final key set against training IDs, row bounds and injectivity, then bind the checkpoint and map together. Fresh row numbering makes a weights-only swap into a legacy map invalid.
7. Keep an as-captured comparator literal when the experiment deliberately measures improvement over that specimen. Disclose its known defects and unproven historical publication coherence; isolate read-only reproduction from candidate-map admission, training and promotion. A corrected candidate does not authorize silently repairing its baseline.

### Prove the frozen inference bundle is usable

1. Inventory dependencies through the actual inference and downstream-consumer loaders, including root-level or sibling lookup/cache assets rather than assuming everything lives in one data directory.
2. Require the expected dependency set, not merely valid hashes for whichever files a manifest happens to list. Bind model weights, calibration, identity maps, shared profiles/priors, source and required assets before the smoke.
3. Run two identical saved real bundles through the full inference-to-final-output path on a fixed historical input. Assert matching outputs, unchanged identity maps and unchanged frozen inputs; this tests integration without claiming model improvement or independent validation.
4. Keep model execution, store integrity and independent quality as separate verdicts. Bound an expensive run using comparable saved timing receipts and current capacity, and label that estimate as conditional rather than a promised completion time.

### Install a bounded experimental serving bundle coherently

1. Preserve the accepted build and prepare rollout changes in a separate copy. Bind experimental inference permission to exact checkpoint/map hashes and expose its unvalidated status separately from acceptance metadata; exercise the real decision and panel paths, not just a config parser.
2. Use an explicitly approved serving hold to retain the first-test checkpoint while the learner persists separately. Treat a game/session endpoint as a human review point unless automatic release was separately authorized and implemented. Releasing a hold must coherently transition any hash-bound experimental permission; removing only the publication hold can leave later checkpoints rejected or their pricing disabled.
3. Stop the identified supervisor before its writers during a safe game-closed/between-game window. Back up the live checkpoint, map, store, cursor, optimizer/EMA state and fallback files. Quarantine legacy live-state/snapshot/fallback artifacts before loading freshly indexed weights; supply coherent new fallbacks. Preserve raw observations and independently evolving profiles.
4. Verify the rebuilt cursor against the exact preserved live input prefix before replacing a derived store. Use an explicit install manifest that includes UI and non-code test/runtime dependencies. A Python-only source lock can omit sprites, templates or JSON fixtures: run the actual installed-tree suite and server cold-load to catch packaging gaps.
5. Pin the verified runtime interpreter in the user-facing launcher. Separate installed-file proof, isolated historical plumbing, installed cold-load verification and actual normal-launch/game runtime. Preserve failed smoke/install receipts alongside corrected results; historical smoke data stays outside live observations. Label each verifier's lifecycle assumptions: an install-time check requiring an absent learner state or an unchanged store is no longer a general health check once learning resumes. Preserve legitimate new state rather than deleting it to recover an obsolete PASS.

### Verify the first live trial before reviewing a temporary hold

1. Freeze the observation boundary using the installation timestamp and verified raw-log byte offsets. Parse only the new interval, count malformed records explicitly, and save a sanitized aggregate receipt; repeated advice reads are not distinct decisions or completed episodes.
2. Read the live status endpoint and compare its model metadata and pricing mode with logged advice across the trial. Pair those observations with current checkpoint/map hashes; a disk hash alone does not prove the running process adopted that bundle. State the available identity evidence precisely when runtime exposes only a timestamp rather than a full digest.
3. Inspect every learner-publication record in the interval. Count actual publications and hold/error reasons, distinguish added stored rows from training-partition rows, and compare evaluation metrics only by exact field and cohort. Raw versus calibrated loss and changing development cohorts can otherwise create misleading drift claims.
4. Inspect the persisted learner separately: verify finite weights/EMA, optimizer presence, injective identity rows and explicit ancestry to the served pair. Record the save timestamp as the durable boundary; later telemetry does not prove all later in-memory updates were saved.
5. Verify the reported result from an authoritative outcome event bound to the user's identity when available. Keep outcome, runtime correctness and independent performance verdicts separate; a successful session is not a statistical acceptance test.
6. Report what remains held and the selected next direction. Preserve a batching suggestion as a hypothesis until chosen, and carry any unfinished coordinated permission/publication transition into the handoff rather than describing it as already released.

## 2. Audit what each gate actually proves

Build a compact claim-to-test table: specification, executed predicate, observed result, missing coverage, and whether the result was mechanically passed or explicitly waived. Read the predicate rather than inferring its coverage from the gate name.

### Prove whether a stored column affects the objective

Use this when deciding whether a label/metadata repair changes training or only an auxiliary diagnostic.

1. Trace the column through feature preparation, tensor packing, class/sample weights, loss, sampling, evaluation/model selection and serving controls. Absence from a loss function alone does not establish isolation from every other consumer.
2. Preserve the real artifact's hash and exercise representative rows in memory. Replace only the candidate diagnostic column in a copied array with several deliberate values, including its unknown sentinel; count changed cells so the probe cannot pass vacuously. Keep these corruption fixtures outside training inputs and perform no fit.
3. Call the actual tensor/weight producers with identity-map growth disabled. Hold RNG state fixed where relevant; compare keys, shapes, dtypes and values of every claimed unaffected output, not just an aggregate loss. Verify the source artifact and identity map remain unchanged.
4. Record exactly which row kinds, calls and transformations were exercised alongside the source trace. A passing subset is evidence for that covered path, not a universal independence proof.
5. Keep auxiliary agreement/coverage verdicts visible even when objective isolation is established. Use the predeclared gate-to-operation contract to decide what may continue; do not erase disagreements, relabel unknowns or redefine a failed required gate to obtain acceptance.

For decisive agreement checks:

1. Run the actual gate on the unmodified artifact and retain its output.
2. Copy only the necessary arrays into memory; change a known semantic property while preserving shape, schema, and unrelated invariants. Swapping decision labels while preserving the episode's set of classes exposes membership checks.
3. Run the same gate on that copy and count exactly how many values changed. Classify unchanged PASS as a test blind spot, not evidence that production contains the injected corruption.
4. Before accepting a replacement oracle, pair a fully resolvable, correctly labelled positive fixture with its deliberately wrong-labelled counterpart. Assert resolved counts and disagreement counts as well as status; a parser that rejects every row can otherwise appear to fix the negative case.
5. Join independent observations by exact decision identity/time, following the event-referee procedure below. Run tests with the deployed interpreter as well as the development interpreter: `<runtime-python> -B -m unittest discover -s <isolated-tests> -p 'test_*.py' -v`.
6. Re-run the frozen artifact and corruption challenge through the real gate entrypoint. Report eligible, resolved, agreed, disagreed, and unresolved counts with reasons. Keep disagreement rate conditional on resolved rows and retain unresolved rows for adjudication; do not count unknowns as correct or silently remove them to earn PASS.

When importing the harness would trigger unrelated production initialization, isolate a pure gate with Python AST: select its `FunctionDef`, remove decorators, compile it as an `ast.Module`, and supply its explicit dependencies in a test namespace. Use this only for dependency-contained predicates and label the result as a gate-level test, not end-to-end execution.

### Build an event-level referee without duplicating the state machine

1. Inspect actual row and packet schemas before writing the adapter. Derive reference outcomes from independent observations, not another copy of the labels being tested. Reuse the established episode parser and action classifier; add provenance checks around them rather than inventing another episode reconstruction.
2. Bind each candidate row to its source record using an exact byte offset at a record boundary, timestamp, episode key, actor identity, and decision/turn start. Reject missing headers, fallback identities that cannot establish the join, key conflicts, and duplicate stored decisions; guessed joins manufacture agreement.
3. Bound observed outcomes to that decision's event window, ending at the next decision boundary. Do not borrow a later same-class action from the episode when the current action is missing.
4. Require an authoritative action event rather than a full-state snapshot carrying an old action field. Treat multi-entity updates as unresolved unless the protocol independently identifies the acting entity; another entity's blank or unclassified action does not prove it was uninvolved.
5. Deduplicate identical events, but preserve contradictory duplicates and competing actor evidence as ambiguity. Keep valid/mismatched/unresolved outcomes distinct; missing files, empty eligibility, insufficient coverage, malformed nonblank records, and truncated tails cannot produce a vacuous pass.
6. Count whitespace-only separators separately from malformed nonempty records. Record offsets, lengths, error categories, and digests when investigating broken records instead of echoing raw payloads that may contain secrets.
7. Hash frozen inputs, detect input changes during the audit, and retain per-row verdict receipts. Report how many corrupted rows the referee actually resolved and contradicted; a failed aggregate challenge does not prove every injected corruption was individually detected.

## 3. Keep model quality separate from gate validity

Verify reported counts and metrics against persisted artifacts where possible. Distinguish observed-action prediction, model-generated counterfactual targets, and realized outcomes; a better counterfactual-label score alone does not establish improved winnings or business results.

Keep validation, calibration, model selection, and final testing distinct when describing evidence. Record the resampling unit and training exclusion unit rather than calling every held-out row independent. Treat an explicit acceptance waiver as a waiver with residual risk, not as an extra mechanical PASS.

### Explain identity conditioning without overclaiming representation quality

1. Inspect the embedding declaration, saved configuration and forward-path consumer before stating dimensionality or describing a node swap. Explain the mechanism as an identity lookup supplying a learned vector to shared computation; lookup changes the input, not the network topology.
2. Distinguish the number of available identity rows, coordinates per identity vector, and situation features. Describe a learned coordinate system as distributed unless interpretability evidence supports named behavioral axes; a two-dimensional visualization is a projection, not necessarily the model's dimensional limit.
3. Separate injective addressing from useful learned distinctions. Unique rows permit separate vectors but do not guarantee different values, meaningful behavioral separation, or improved downstream performance. A corrected structural defect can coexist with worse empirical results.
4. Classify representational blind spots as hypotheses until measured. When research is deferred, retain the question and prerequisite: repeated observations per identity across relevant situations, with trustworthy held-out evidence. More dimensions supply capacity, not missing information; raw row growth alone cannot distinguish under-observation from inadequate representation. Keep this research outside a bounded integrity correction unless separately authorized.

## 4. Trace approval through live updates

Compare accepted and current metrics by exact field name, especially raw versus temperature-calibrated loss. Check whether each update re-evaluates eligibility or merely copies an approval flag from the accepted checkpoint. Trace that flag through checkpoint save, reload, and the serving predicate.

If the flag persists while metrics breach the original bar, report the facts separately: acceptance belonged to an earlier artifact; current measurements differ; serving may still consume the new weights. Do not call deliberate unrestricted training unauthorized. Training and serving are separate controls: propose a frozen serving checkpoint, fallback prior, or revalidation gate only as options for Alex to approve.

Check runtime scope explicitly. A behavior model displayed for every opponent need not influence every pricing branch; verify the exact caller before claiming the read changed the decision. Likewise, a global quality gate does not implement per-class loss protection merely because the design calls for it.

### Prove the promotion gate is wired, not merely implemented

1. Exercise the actual publication control path in an isolated fixture, not just the configuration parser or quality helper. Pair an eligible positive case with a valid configuration whose quality ceiling the candidate demonstrably violates. Assert rejection leaves the serving checkpoint and player map unchanged while learner state persists; a valid configuration is not quality eligibility.
2. Assert positive publication carries eligibility status, reference/cohort identity, and the temperatures and metrics from the evaluation used for approval in both checkpoint metadata and telemetry; a passing publication count alone misses stale approval stamps.
3. Distinguish frozen-anchor and moving-population evaluations in fixtures with different metrics or temperatures so substituting one for the other cannot pass unnoticed. Verify rejection and evaluation-exception paths before claiming fixed-reference enforcement.
4. Reject ambiguous schema types explicitly. In Python, `True == 1`; require a strict integer schema so malformed controls cannot become promotion permission.
5. Retain a verified hold mechanism as its own completed slice, but quarantine partially wired enforcement until publication-path tests pass. Partial worker success preserves useful work without weakening serving acceptance.

## 5. Deliver bounded conclusions

Report verified integration facts first, then findings with file/line, trigger, impact, smallest fix, and an executable receipt. Distinguish newly reproduced defects, already documented risks, and unresolved statistical concerns. Preserve the audit scripts and outputs separately from live training files. State which expensive refits or end-to-end checks were not rerun; never promote a structural audit into a claim of full acceptance.
