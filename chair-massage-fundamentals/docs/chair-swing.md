# The chair swing (ruled 2026-09-24)

Andy's suggestion, ruled by Alex: carrying the chair, left click swings it. To be folded into
DESIGN.md beside the Healing Palm.

**The swing.** Carrying the chair on foot, left click swings it (no charge): 0.15 s wind-up, 0.2 s
arc, 0.15 s recover, 0.5 s in all. The folded chair comes off his back into both hands and sweeps
right to left across a 180-degree arc in front of him (where the camera looks), then goes back on
his back. At the arc's midpoint everything up and in the half circle in front within 2.5 m (goons,
cops, peds; not through walls, not someone already down, treated, or kneeling) is knocked down for
3 s with about 2 m of knockback, a THUD, a "CHAIR!" floater, the palm's hit-stop and a bigger screen
shake (0.5 trauma against the palm's 0.25). A whoosh plays on every swing, hit or miss. **No
treatment**: a chair knockdown (`knockCause: 'chair'`) rises straight back into what he was doing,
no relief, no tension released. Nobody dies (Chex Quest).

**Wanted.** A swing that catches a cop is wanted +1 every time (new report kind `chairCop`), not the
once-per-run `goonHit`. Goons caught report `goonHit` and peds `pedHurt`, as the palm does. Each
connecting swing is a chaos event (`chair`) at the arc.

**The palm while carrying.** The Healing Palm cannot be charged or tapped while the chair is on his
back: left click is the swing. The hint line adds "Left click: swing the chair" (after the E action
when there is one). Set the chair down (or load it) and the palm is back.

**Durability.** The chair has 100; each swing costs 10, hit or miss. At 0 it is **BENT**: still
carryable, loadable, swingable, and set down for mini-massages, but a mini-massage on it takes twice
as long (10 s of in-band hold instead of 5). Picking up a bent chair shows the floater "bent chair";
the chair strip reads "Chair: on you (bent)". A cart repair ($20, the existing repair action) also
straightens the chair back to 100 if he carries it or it rides in the vehicle being repaired; a
bent (or worn) chair in his vehicle is reason enough to offer the repair even at 100 vehicle hp.
Durability persists through the run and resets on MASSAGE entry (`resetChair`).

**Watcher events.** `swing` { hits, goons, cops, peds, durability } per swing (durability after);
`chair` { act: 'bent', durability: 0 } when it bends; `chair` pickup/take events carry
{ durability, bent }; `repair` carries `chairBefore` (null when the chair was not repaired).

**Where it lives.** `src/entities/player-actions.js` (input, timing, the hit), `src/entities/chair.js`
(durability, wear, repair, the in-hands pose), `src/entities/palm.js` (`knockBody`, `palmable`, shared
with the quick palm), `src/entities/interact.js` (hint, chair strip, repair), `src/run/minimassage.js`
(`BENT_MUL`), `src/run/wanted.js` (`chairCop`), `src/audio-sfx.js` (`whoosh`). Headless: set
`player.swingChair = true` for one swing.
