# Acceptance audits for online learners

Use when reviewing a model rebuild, agent integration handoff, or an online learner whose predictions affect a downstream decision engine.

## Establish artifact identity
- Compare the reconciled manifest to draft bytes, deployed commit blobs, and the evaluation copy before inspecting algorithm claims. Separate intended post-deployment edits from integration drift.
- Record hashes before and after approval metadata stamping. A stamp changes the serialized checkpoint; retain a parameter-only digest and bind the final receipt to the exact served file.
- Inspect saved store columns directly for dimensions, kind counts, information masks, and group/split intersections. A clean stored group key does not by itself prove correct physical-event identity.

## Audit the evaluator, not just its output
- Trace every use of the outer test fold. Gradient exclusion is insufficient if the same fold chooses epochs, early stopping, temperatures, thresholds, or blend hyperparameters. Use inner validation/calibration and an untouched outer test.
- Trace derived summaries too: global player histories, preprocessing, pool priors, and label models can incorporate future or held-out events even when model weights do not.
- Recompute published metrics from saved per-event predictions. Group resampling by the correlated unit, preserve paired comparisons, and perform bounded sensitivity checks without claiming they cure other leakage.
- Measure calibration on the exact transformed probability consumed downstream, including blending, floors, clipping, and its target population. Improved proper loss can coexist with worse binned reliability; a head-level calibration result does not certify a post-blend number.
- Use the gate-poisoning and event-referee procedure in `learned-model-acceptance-audits.md` to verify decision-label agreement independently; keep its positive/negative controls and unresolved-coverage accounting alongside the online audit.
- Mark original-contract failures and authorized waivers explicitly. Do not recast a relaxed threshold as passing the original gate.

## Separate learning from serving
- Trace approval metadata through every save and reload. A historical accepted flag carried into changed weights proves lineage, not current validation.
- Inject an evaluator exception and inspect what would be published, including fallback temperatures, missing evaluation fields, and approval flags. Use captured save callbacks rather than writing production checkpoints.
- Inspect every sampling branch, especially scheduled specialization sessions. Assert the source composition of each branch; ordinary-batch rehearsal is not an every-batch guarantee.
- Count dedicated sampling segments rather than total row kinds when recent and archive populations overlap. Pair disjoint-source allocation fixtures with realistic overlapping pools, and compare unaffected branches at the same initial RNG state.
- Verify the entire inference dependency chain before calling a head frozen. Zero direct loss weight leaves shared embeddings/trunks free to move under other objectives; use a frozen full inference bundle or prove every relevant dependency immutable.
- Test restart provenance when withholding serving publication. A learner-state run ID tied to the last published checkpoint can reject valid ongoing learner state after an evaluation failure, especially on the first cycle of a restarted run.
- Preserve unpublished identity mappings alongside raw weights, optimizer, EMA, and clocks when holding a serving bundle. Restoring tensors without their embedding-ID map can silently assign learned rows to different identities. Validate ancestry and map compatibility before mutating caller state, and probe state-dict loading on copies so an invalid optimizer cannot leave half-restored weights.
- Adopt a model/index/calibration bundle once per decision. Publish a new bundle reference rather than mutating the shared dictionary in place; an old pinned reference must retain its model, identity map, calibration, and eligibility through the entire decision. A second reload between annotation and recommendation can mix checkpoints even when each load is atomic.
- Publish the bundle together with the corresponding state, advice, and read identity under one synchronization boundary. Explanation endpoints must use that published snapshot rather than adopt a staged checkpoint or read in-flight bookkeeping; otherwise a coherent decision can still be displayed with another model's metadata.
- Protect shared explanation caches separately from the main decision path. Test competing panel requests and failed cache refreshes; advance cache-version keys only after their new values are successfully computed, or a failed refresh can relabel old geometry as current.
- Verify the single-adopter assumption across nested call sites and aliases, not just top-level functions. Inject staged swaps between annotation and recommendation, panel reads during computation, concurrent panel refreshes, and cold-load failure to prove bundle coherence under executable schedules.
- Respect the user's deliberate online-learning policy. Propose serving promotion or fallback separately from freezing, reverting, or constraining training.

## Reusable post-transformation reliability diagnostics

1. Read the prediction producer before scoring its saved columns. Identify exactly which blending, clipping, floors, overrides, and population branches each column includes; put excluded branches in the report. A saved mirror's final probability is not automatically the current live server's final probability.
2. Score all comparators on the same rows without refitting or silently clipping/dropping invalid inputs. Validate finite probabilities, binary outcomes, and typed group identities. Keep empty cohorts and missing subgroup metadata explicit rather than inventing membership or zero error.
3. Compute row-weighted proper loss and reliability-bin counts, predicted rates, observed rates, and signed gaps. Record binning and comparator footing, including whether both prior and blend include the same floors. Improved Brier loss and worse binned calibration can coexist; neither silently changes serving eligibility.
4. Resample whole correlated groups with replacement, retaining every member and unequal group sizes. Use identical draws for all methods and their paired differences. Record the group key, replicate count, seed, and interval definition; averaging group means changes the estimand from row-weighted risk. Construct the cluster array in preserved cohort order or a declared canonical order, not by iterating a set: the same RNG seed can select different groups when process hash randomization changes their indices. Verify determinism with a varied-group end-to-end fixture in subprocesses using different `PYTHONHASHSEED` values; equal-loss groups can hide this defect.
5. Verify optimized group-aggregate arithmetic against literal resampling of row indices on unequal-size fixtures. Independently check point estimates and paired loss/calibration intervals on the saved artifact as well as fixtures; reusing the scorer's matrix implementation is not an independent check.
6. Independently test per-bin observed-rate and signed-gap intervals against literal row resampling conditioned on nonempty draws. Report an explicit omission reason when a populated multi-group bin receives zero nonempty draws. Withhold intervals for fewer than two independent groups, including individual bins within a larger population. Expose nonempty-draw counts for conditional per-bin intervals and label percentile bootstrap results as resampling sensitivity, not guaranteed confidence. Preserve the warnings about sparse or saturated outcomes, plug-in ECE bias, and correlation remaining outside the chosen grouping.
7. Label reused selection/calibration folds as validation throughout JSON, CSV, and prose. Removing one tuning subset does not undo epoch or temperature selection on the remaining data. Treat ECE comparisons as specific to the recorded binning rather than claiming binning-invariant calibration improvement or deterioration.
8. Keep scoring pure and output paths explicit. Refuse input/output aliases, including hardlinks, and withhold reports if input hashes change during scoring. Verify exported bin counts sum to cohort counts and that reported scalar metrics and intervals agree with the independent calculation. Ship the reporter and receipts separately from any serving-threshold or promotion-policy proposal.

## Append-only evidence archive cutovers

- Separate storage-backend approval, durable backup, and live-reader migration. Keeping a hot monolith intact while proving immutable backup segments can avoid an unnecessary simultaneous cursor cutover; untracking alone supplies no durability.
- Inventory both literal archive paths and imported path symbols, full-history warm replay, duplicate-key caches, file-size invalidators, incremental offsets, open-handle tailers, and offline replay tools. Treat local lexical inventory as bounded evidence rather than proof of coverage on a second machine.
- Probe actual reader classes on disposable files before rotation: shrink, same-size replacement, partial-tail completion, missing segments, and restart. Size-only cursor checks can miss replacement; reset every derived index consistently or deliberately preserve the same history across them.
- Preserve machine/session ownership and original bytes in archive manifests. Require hash-checked restore and replay equivalence before original untracking or reader cutover; preserve conflict detection instead of blindly concatenating divergent machine histories.
- Compare existing bulk-add/sync recipes with newer storage restrictions, and check the host's documented per-file limit rather than treating repository size or local free space as the same constraint.

## Safe execution and reporting
- Keep fault-injection fixtures and audit artifacts outside live data. Extract small AST functions or statement blocks for isolated tests when importing the server or launcher has side effects.
- Inspect test scripts before running them; maintenance/check commands may repair or delete data. A dry-run evaluator may mutate cursors or resume files.
- Distinguish recorded results, independently recomputed results, source-confirmed paths, reproducible fault schedules, and observed production failures.
- Distinguish counterfactual label regret from realized profit. Prediction-loss improvement alone is not evidence of downstream financial gain.
- Preserve worker receipts on interruption, finish the missing reasoning from direct sources, and do not spend another agent run merely to recover a lost summary.
