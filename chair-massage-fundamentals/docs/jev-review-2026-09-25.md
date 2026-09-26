# Jev review, 2026-09-25 (build 2026-09-25.9)

Milestone 5 of "Playtesting with Jev": what the pilot's runs say about the game. This is the Opus half
of the ruled division of labour: the pilot flies, Opus reads the replay.

## The caveat first: no Jev runs to an ending, only the scripted baseline

The AI Gateway throttled Jev all evening. Probes: 1 in 10 answered. In the pilot, over 10 minutes:
2 decisions, which is 0.2 a minute against the 5 a minute the brief set as the floor. So every run
below was flown by `tools/jev/oracle-run.mjs`, a scripted policy: counter every wind-up, get the
chair into a car, drive to the exit at 0 stars, and set the chair down for a client when it has
stars. It is not a player. It never gets bored, it never cheats, and it only knows one plan.

What the evidence is:
- the 10-seed batch, seeds 1001 to 1010 (`tools/jev/out/batch-2026-09-25.md`, flown twice with
  identical tables);
- three interactive seeds, 101, 202 and 303 (`tools/jev/out/m4/`, each with a
  `node tools/jev/review.mjs` read of its three worst decisions).

Jev itself made 8 run decisions across two attempts on seed 101. Each time it picked the chair up and
chose `run_to_exit` on foot, with plan `flee_on_foot`, the treated-looking goon g18 as the threat, and
danger 2.0 to 2.2 of 3. By tick 6792 it was carrying the chair out of the plaza at walking pace (a
carried chair caps him at about 4 m/s) with the pack behind him. That is one opinion, not a sample.

Read everything below as "what the rules do to a competent, single-minded player", not "what players
do".

## What the runs show (13 runs: 10 in the batch, 3 interactive)

- **Endings.** Escaped 4, arrested 6, no ending inside the 400 s cap 3, died 0. The median time is
  184 s in the batch.
- **Every arrest is the same arrest.** All 6 are "cop held a touch 1.5 s while he stood still"; none
  is "knocked down next to a cop". The standstill comes from what the chair demands: stopping at a
  car door, at the rack or trunk to take the chair out, or at a set-down spot. Examples: seed 202
  tick 12698 (standing between the cart and the sedan holding the chair, the ranger at 1 m, stamina
  0%); seed 303 tick 26098 (at the cart's rack, with a staggered goon and a ranger both at 1 m).
- **The first star lands 2.6 s into the run in 9 of 13 runs, and it is always `stealVehicle`.** The
  pilot takes the parked cart the pivot left beside the chair. Of 22 star gains across all runs:
  stealVehicle 13, vehicleWreck 3, goonHit 3, pedHurt 2, copHit 1.
  Two of the goonHits came from the cart creeping off at 1.5 m/s and nudging a goon who was sitting
  1.3 m from the door after being treated (seed 303 tick 7083; seed 101 tick 6671).
- **Once there is a star, it does not fall.** A cop has line of sight in 28% to 99% of snapshots,
  median about 82%. Line of sight counts out to 90 m, so the parks ranger on foot at 1 star keeps
  the level pinned from beyond the 40 m the HUD's threat list shows.
  Seed 1006 spent 700 decisions carrying the chair at 1 star with no threat within 40 m and
  "a cop can see you".
- **The exit is where the stars bite.** Two arrests came 12 to 18 m from the exit zone, at 2 and 3
  stars, under "Lose the heat first". Seed 101 tick 29284: exit 20 m behind, four cops at 1 m, the
  chair in the cart.
- **The counter works.** Q-counter outcomes: 31 held (treated) and 8 missed, of 39 resolved. The
  turn-taking pack never landed a hit that knocked the pilot down: the one knockdown in 13 runs was a
  pull-out. The Arkham rework did what it was for.
- **What it never uses:** the mini-massage (1 set-down in 13 runs, cancelled "chair moved", 0
  successes), the chair swing, carjacking, repairs, the jump, and the gun (locked on a fresh
  profile).
- **Police navigation:** 15 `offroad` excursions against 14 spawns, 3 `stuck`, 7 back on the road.
  The cop cars find him on the plaza now.

## What a human would find unfair

1. **Taking the obvious getaway car is a crime before the chase has started.** The cart sits beside
   the chair when the controls unlock. Taking it is +1 star, and the exit only opens at 0 stars.
2. **A star you cannot see.** The cop pinning your wanted level can be 40 to 90 m away, off every
   list and marker. The HUD says nothing about who sees you. The pilot's words now name him (w.cop),
   and a human's HUD could too.
3. **Stopping is death, but the chair makes you stop.** Every chair action (take, load, set down,
   get in) is a standstill beside a car or on the plaza. The only arrest the pilot ever suffered was
   the 1.5 s standstill touch.

## Three proposed changes

### 1. The first car is not a theft
Proposal: the parks cart parked at the chair when the run starts is "the ranger's cart, keys in".
Taking it is +1 star only if the ranger saw it (he is 4 m away on every seed, so usually he did),
and it never costs a star at 0 stars with nobody watching.

Rejected alternates:
- a) Drop `stealVehicle` for parked cars entirely. Rejected: it removes the GTA3 tax on car-hopping
  that the curve was built on.
- b) Move the cart out of the plaza. Rejected: the pivot stages it there, and the escape plan the
  pilot found (chair in the trunk, drive) is the one the design wants.

Questions for the owner:
1. The start cart: A) keep the +1 as it is (the first star is the price of the fast plan);
   B) +1 only when a cop has line of sight (recommended); C) free the first time, +1 after.
2. Does "the ranger's cart" read in the fiction? A) yes, his hat and a parks decal on it;
   B) no, it stays an anonymous parks cart.

### 2. Line of sight has a leash
Proposal: a star decays while no cop *within 40 m* has line of sight (was 90 m). The ranger on foot
at 1 star stops pinning the level from across a block. The HUD's star row shows the decay clock
filling, so the player can see the star is falling.

Rejected alternates:
- a) Decay on a timer whatever cops see. Rejected: hiding (the alleys, the pavilion) stops meaning
  anything.
- b) Keep 90 m and show the watching cop on the compass. Rejected as the whole fix: fairer, but the
  level still never falls in a chase. Worth doing as well (see question 2).

Questions for the owner:
1. Line-of-sight range for decay: A) 90 m as now; B) 40 m (recommended); C) 60 m.
2. Show who is watching: A) a small eye on the compass at the watching cop's bearing (recommended);
   B) nothing: finding the watcher is the game; C) only at the exit, under "Lose the heat first".
3. Should the ranger on foot count at all at 1 star? A) yes; B) only within 20 m.

### 3. The chair's standstills are not arrest windows
Proposal: the arrest touch pauses while the player is mid-fold, mid-load, mid-take or getting into
a car (the 0.5 s actions the chair forces). "Knocked down next to a cop" stays instant.

Rejected alternates:
- a) Lengthen the arrest touch to 2.5 s everywhere. Rejected: it weakens the cops in every
  situation, not just the unfair one.
- b) Let E work on the move (no fold standstill). Rejected: the fold's commitment is the chair's
  weight, a ruled part of carrying it.

Questions for the owner:
1. During a chair action the arrest meter: A) pauses (recommended); B) keeps filling (as now);
   C) fills at half speed.
2. At the exit with stars: A) as now, "Lose the heat first"; B) the zone accepts 1 star with the
   chair (the ranger will not follow off the district); C) the zone accepts any level but the
   ending card says "wanted".

## Next, when the gateway opens

Run the same 10 seeds with Jev, then the overnight 50 (README "Playtesting"). Compare on escape rate
and on the first-star and arrest-cause tables above. Jev's own opening (flee on foot with the chair)
is a different plan from the baseline's (the car plan), so the tables will say more about the game
than this one does. Per the owner's rule (DESIGN.md, e3f666b), any LLM in the pilot seat other than
Jev must be one session per run with rolling self-compaction. The current `claude` / `openai` call
sites are stateless and count as harness proof only.
