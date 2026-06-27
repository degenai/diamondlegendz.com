# Facets Workshop Notes

## Current intent

Facets is a small anime.js laboratory for Diamond Legendz. The rule is one idea per file at Layer 0, then promoted combinations at Layer 1 once a primitive can be cleanly plugged into another primitive's slot.

The gallery view stays. It is useful because multiple loops side by side reveal shared flavor, rhythm, and drift. Single-stage links still exist for focused inspection.

## Layer 0 cleanup now prepared

The lab now has 27 ready Layer 0 primitives and no known placeholder cards in the manifest.

Filled or modernized in this pass:

- `spring-physics`, modernized from deprecated `createSpring` to `spring`
- `waapi-basic`, uses `waapi.animate`
- `splittext-basic`, uses `splitText`, `animate`, and `stagger`
- `scope-basic`, uses `createScope` with media query matches and revert cleanup
- `utils-set`, shows instant transform writes
- `relative-values`, shows additive value syntax
- `function-values`, shows per-target function values
- `timer-basic`, adds `createTimer` as a clock primitive
- `animatable-basic`, adds pointer-following `createAnimatable`
- `utils-math`, adds mapping, snapping, clamping, and interpolation utilities

## Layer 1 examples now prepared

These are first-pass composition sketches, not final art direction.

| Example | Parents | Point |
|---|---|---|
| `spring-drag` | `draggable-basic` + `spring-physics` | Drag release with spring behavior |
| `scroll-draw` | `svg-draw` + `scroll-scrub` | Scroll position controls SVG drawing |
| `scroll-path` | `svg-motionpath` + `scroll-scrub` | Scroll position controls path travel |
| `stagger-draw` | `svg-draw` + `stagger-line` | Multiple SVG paths draw in sequence |
| `drag-timeline` | `draggable-basic` + `timeline-sequence` | Drag handle scrubs a paused timeline |

## Gallery changes

- Added manifest-driven rendering from `facets/manifest.json`
- Added `facets/build-manifest.mjs` so metadata comes from facet comments
- Added API and tier filter chips
- Added family sections so the wall is still readable
- Preserved iframe gallery view and `open stage` links
- Added a small anime.js entrance animation to the gallery cards

## Review path with Alex

1. Start with the gallery on `all`, scan for shared flavor.
2. Click `tier 0`, confirm the primitive vocabulary feels complete enough.
3. Click `tier 1`, review the first five combinations as workshop sketches.
4. Open any interesting card with `open stage` for focused inspection.
5. Decide which Layer 1 examples deserve polish versus which only prove the API combination.

## Questions for the next pass

1. Should Layer 1 stay purely technical, or can it start borrowing Diamond Legendz motifs, for example gem cuts, lairs, wrestling belts, and collection UI?
2. Do we want a `study` mode that explains code beside the iframe, while keeping the current gallery as the default wall view?
3. Should every promoted Layer 1 example require exactly two named parents, or can some be three-primitive recipes?
4. Should the first art-direction pass normalize color and rhythm, or keep each primitive dry and minimal until Layer 2?
5. Should this branch become a PR before deeper Layer 2 design work?
