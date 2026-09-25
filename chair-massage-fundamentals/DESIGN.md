# Chair Massage Fundamentals — design doc

Working repo: `diamondlegendz/chair-massage-fundamentals/`. Live at diamondlegendz.com/chair-massage-fundamentals/.
Web playable, vanilla ES modules, Three.js 0.186 vendored (no CDN; CSP is `script-src 'self'`). No build step. No npm.

## The one-sentence design

A boring chair-massage training tool whose controls (W/S answering the client's calls for pressure + mouse-in-a-moving-circle)
are secretly the movement and aim controls of the low-poly GTA3 roguelike it turns into.
Frog Fractions structure: the title is honest, the first five minutes are honest, then franchise goons
show up at the park and the game becomes something else.

## Pillars

1. **The tutorial is a lie that is also true.** Everything in the massage minigame trains a skill the
   run phase needs. W/S = more/less pressure on the client's call now, forward/back later; A/D = their
   left/right now, strafe later. Mouse-in-circle = stroke tracking now, aim/look later.
   Space = "give the client what they asked for" now (it snaps the modality to the request; ruled
   2026-09-24), jump/handbrake later. E = "next client" now, enter vehicle later.
2. **Short-term by design.** A run is 3 to 8 minutes. Runs end in arrest, death, or escape. Nothing is saved
   except meta unlocks. The game admits it is a roguelike the moment the first run ends.
3. **Primitive stack, two sources.** Flat-shaded low poly, no textures, no post-processing stack, one
   directional light, one hemisphere light, fog. Anything *with a shape* (chair, vehicles, people, benches,
   hero props) is authored as a Blender 5.2 bpy script under `tools/blender/` and baked to a loader-free
   JSON mesh in `assets/` (format: `tools/blender/export_json.py`; reader: `src/assets.js`, ~25 lines,
   `BufferGeometry` + vertex colours). Anything *seed-driven or numerous* (buildings, trees, roads, paths,
   the park layout) stays procedural JS. No GLB loader is vendored. Decided 2026-09-23 after the headless
   Blender probe: 2.5 s per asset, chair 296 tris, sedan 360 tris.
4. **The Chex Quest rule.** This is a non-violent shooter in the Chex Quest sense (the 1996 Doom
   conversion where you zorch Flemoids home instead of killing them). Every weapon in the game relaxes
   its target. Goons, cops, and peds get knocked down, get up loose, and say something relieved. Nobody
   dies, nothing bleeds, no health bars on NPCs, only a "tension" bar. Vehicles dent and smoke; they do
   not explode.
5. **Mutual aid thesis, not preached.** The antagonists are a franchise massage chain's "compliance team".
   The city sides with the franchise. The player never pays to work.

## Phases of a session (state machine)

```
TITLE -> MASSAGE -> PIVOT -> RUN -> (ARREST | DEATH | ESCAPE) -> SUMMARY -> MASSAGE (with unlocks) ...
```

- **TITLE**: looks like a CEU course landing page. "Chair Massage Fundamentals. Module 1: Pressure."
- **MASSAGE**: the minigame. Client sits in a massage chair in a city park. Sequence of clients. On the
  first ever playthrough, the pivot fires after client 3 (about 2.5 minutes). Afterwards, the pivot
  fires after 1 client (the player knows).
- **PIVOT** (decided 2026-09-23): scripted about 20 seconds, mid-massage, client 3 still in the chair.
  The black van drives in from `spawns.vanEntry` along the road and onto the plaza path, stops 8 m from
  the chair. Three heavies in suits get out, one with a bat. One line each over the HUD ("Serenity Group
  Incorporated. We'd like a word about the chair." / "You're operating without a brand." / "..."). The
  ranger jogs in from the sidewalk and sides with them ("Sir, they have a permit for the plaza. You don't.").
  Straight GTA menace, no slapstick; the absurdity is that this is about a massage chair. Controls
  unlock while the ranger is mid-sentence; the course HUD tears off (panels slide away), the spa loop
  detunes and collapses, the title strip strikes "Fundamentals". The client gets up and walks off.
  Gate rulings (2026-09-23, after Phase 6): the pivot may run up to 30 s because the van's drive in is
  the tension; the goons speak as soon as it stops. The one-seed-in-five case where the van cannot reach
  the chair and the goons walk up from 28 m is left as character. The slow-motion stamp for escaping
  without the chair reads LEFT THE CHAIR in the same red, matching the certificate.
  Rulings (2026-09-23, post-v1 relay): the 14 s intro narration stays as it is; any key skips it.
  A van that loads late (after the pivot has started) stays parked where it is and the crew walks
  up from its drop point, the same beat as the van stopping short.
  **Opening beat** (ruled 2026-09-23 after the loop test showed a still player dies in 10 s): for the
  first 8 s of RUN the goons only shove and grab (10 damage, no knockdown, a "Come with us." bubble);
  bats come out after 8 s or at the first Healing Palm. **First-run prompts** (ruled 2026-09-24, Andy
  "got swarmed too quickly, didn't realize he could fight or drive"): on the run that spends
  `meta.firstRunSeen`, first goon contact brings three run-skin prompts above the player one at a time,
  4 s each or until done: "Hold left click: HEALING PALM" (or "Left click: swing the chair" while he
  carries it, ruled 2026-09-25, cleared by a swing), "E at any car: drive", "Shift: sprint. It runs
  out." One already done this run is skipped; the rest still show past the window. Watcher `tutorial`
  events with where 'run'. Lives in `run/goon-waves.js`. **The ranger hangs back**: wanted starts at 0,
  he stands by the chair for 15 s ("I'm calling this in.") and only pursues once wanted reaches 1.
  **The lines read the record** (ruled 2026-09-23 after the first plays; `src/pivot-lines.js`): the
  three goon lines and the ranger's are chosen by `meta.runs` and `meta.lastOutcome`, escalating
  polite menace. Run 1 as above. Run 2 names how the last run ended (escaped: they know where you
  went; arrested: "The county was very helpful."; overworked: "You looked tired last time."; left the
  chair: "You left the chair. We kept it warm."). Run 3: the boss (grey suit, no bat) steps out of
  the passenger door, speaks the first line and gets back in; he never chases. Run 4: the ranger's
  line drifts ("I'm sorry, Alex. My hands are tied."). Runs 5 and 6 name an unlock the player owns
  ("Nice gun." / "The cart keys. Cute."). Run 7 on: two late sets alternate (never the same set twice
  in a row; the second brings the boss back with an offer on the chair). The third line stays "..."
  so the pivot's timing is unchanged. **Skipping it is earned by watching** (re-ruled 2026-09-25, Alex:
  "make it skippable is an unlock, watch it like 10 times"): `meta.pivotsSeen` counts every pivot
  watched to the van stop, any outcome; on the tenth the hall pass arrives (the certificate and the
  next between-run client announce it: `skipPivot` leaves the escape track and becomes this counter's
  award, still listed on the title's unlock strip). With it, a course-skin line "Press any key to
  skip the drive-up" shows during the drive-up only, and any key or click cuts to the van stop
  (van at its mark, the client gone, the crew stepping out): the crew's lines and the ranger still
  play, because those change per run. Watcher `pivot` { beat: 'skip', at, to: 'vanStop' }. A skip
  still counts as a viewing.
- **RUN**: open park block. Goons hunt the player. Wanted level rises with chaos. Player can steal
  vehicles, run, fight (elbow strikes, it's The People's Elbow), and reach an ESCAPE point (a client's
  house on the far edge of the block, or the highway on-ramp) once wanted level has cooled to zero.
- **ARREST / DEATH / ESCAPE** (decided 2026-09-23): "Wasted"-style slow motion. Time scales to 0.25
  for 2 s, the camera tilts and drifts, the colour desaturates, and a stamp slams in: ARRESTED,
  OVERWORKED (health, nobody dies), or ESCAPED. Then the summary.
- **SUMMARY**: a continuing-education **certificate parody** on the beige course skin: "This certifies
  that the licensee ESCAPED / WAS ARRESTED / WAS OVERWORKED", run time, cash raised for the host cause,
  tension released count, one unlock revealed under a wax seal. "Return to the chair" button.
- **Between runs**: one returning regular with two new lines in their own voice that reference the
  last run and the new unlock, then the van arrives faster. About 40 s of massage between runs.
  Ruled 2026-09-24 (always Dana read as a rut): the regulars rotate by run number, run 2 Dana, run 3
  Walt, run 4 Marcus, then Dana again; each has an opener per last outcome (escaped, arrested,
  overworked, left the chair) and a gift line per unlock and per consolation. With "Regular client"
  owned, every third returning visit is Priya, the barista from the corner (forearms, wants
  cross-fiber), who is also the regular waiting near the chair in the run. Two segments each.

## The massage minigame (MASSAGE)

Camera: over the shoulder of the therapist, looking down at the client in the chair. Park in the background.

**Pressure is call and response (W / S)** (ruled 2026-09-24, Andy: "the pressure meter reads too
heavy"; ruling: pure QTE, no meter at all). There is no gauge, no pressure number and no hidden band.
The client speaks every 4 to 8 s (seeded from the run seed, per client personality: `calls` in
`clients.js`, the calls and the judging in `massage/meter.js`), and the answer window opens when the
line starts speaking:
- "Ow. Lighter." tap S within 1.5 s.
- "Harder. Try to hurt me." hold W for 1 s (finished within 2.5 s).
- "That's it, right there." do nothing for 2 s: no W, no S.
- "A little to the left." / "A little to the right." tap A or D once within 2 s, without changing
  the modality: during that call A/D are the answer; outside it they cycle the modality as always.

The opposite key is a wrong answer (W for lighter, S for harder, W or S while still, D for left, A for
right); running out the window is late. A right answer fills the segment's share of competency: all
of it when the modality is the one asked for and the cursor stayed on the ring since the last answer
(80% of the time counts as all of it), half for a cursor that never did, nothing on the wrong
modality. A wrong or late answer drains a
quarter share (never below the segment's floor), the client says their miss line ("Not that."), and
pushing W when they asked for less or for stillness makes them flinch. So W stays "more" and S stays
"less", which is what the run needs (pillar 1): W is forward, S is back. The ring's colour is the last
result: green for 1 s after a right answer, red after a wrong or late one, white otherwise. While a
call is open a small cue beside the ring shows the key and a bar running down with the window.
Personalities: Dana calls "lighter" most (5 to 8 s), Walt "harder" (4.5 to 7.5 s), Marcus mixes all
five fastest (4 to 6.5 s), Priya mixes all five (4.5 to 7 s). Each call and each answer is a `call`
watcher event (act `asked` with the prompt, the call and the key; act `answer` with the prompt, the
answer, correct, late and the fill). Clients take about 20 to 35 s each with right answers.

**Stroke tracking (mouse).** A circle on the HUD (over the client's back) moves in a pattern. Mouse must
stay inside it. Patterns per modality:
- Swedish: long slow ellipses.
- Cross-fiber friction: short fast back-and-forth.
- Trigger point: stationary, but the circle shrinks over 4 seconds then releases.
A / D cycle modality (except as the answer to "left / right"). Each client asks for a modality by
name; the wrong modality fills nothing.
Ruling (2026-09-24, Andy's first play: "the client could want a different one instantly and you get a
micro panic"): **Space always snaps to the requested modality**, any time in a session, no bonus and
no window. CLIENT WANTS shows a Space keycap ("SPACE to match") whenever the modality is wrong. Space
does nothing else in the course (it is the run's jump and handbrake).
**Guided first client** (ruled 2026-09-24, Andy: "took a min to figure out how to play"): on a
first-time playthrough only (`meta.firstPivotSeen` false), client 1 is a tutorial layered on the real
session, one course-skin prompt under the ring at a time, each waiting for the action: "When they say
harder, hold W" (until the first right answer; the guided client calls "harder" until they get one,
and its first segment takes two right answers so the next prompt gets its turn),
"Keep the cursor on the guide" (2 s inside), at the first
segment change "Press Space to give them what they asked for" (until the modality matches), and at
completion "Press E when they're done". Competency fills as usual underneath. A `tutorial` watcher
event marks each prompt shown and done. Between-run and later clients never show them.
Between-run clients use the same calls, and so does the run's mini-massage (`run/minimassage.js`,
ruled 2026-09-25; see The run).

**Clients.** Three park regulars: a jogger (tight calves, wants Swedish), a retiree from the bench
(upper traps, wants trigger point), a dad from the playground (forearms from pushing swings, wants
cross-fiber). Two or three lines each about their day. One line each quietly foreshadows the franchise:
"the new place at the strip mall wants ninety bucks for this", "some guys in a black van were asking
who runs the chair", "my HOA got a letter about unlicensed vendors, is that you?".

**Boredom curve.** Client 1 is easy. Client 2 calls faster. Client 3 calls fastest, all five calls,
with talky client dialogue about their day. It should feel like a real, competent, slightly tedious edutainment game.

**Money.** Each finished client pays. The dollar figure is the run's starting cash later. Half goes to
"the host cause" in a visible ledger (the 50/50 split is in the game).

## The run (RUN)

**World** (decided 2026-09-23): one city block containing a **downtown plaza**, rolled from a seed per run.
Block is 160m x 160m. Outer ring: two-lane road loop with sidewalks, parked cars along the curb. Edges and
corners: **mixed low-rise, seeded** (2 to 6 floors, brick and stucco colours, window grids as darker boxes,
a few storefronts with awnings; one building per block is always a SERENITY GROUP location with a lit sign).
Centre: the plaza, paved, with a fountain, planters, low walls and steps (sittable, jumpable), a few food
carts, benches, trees in grates (cone on cylinder), the massage chair spot near the fountain. One edge has
the ESCAPE point. Seed determines building heights and colours, plaza layout variant, planter and cart
placement, vehicle spawns, escape edge, goon van entry. **Lighting:** late afternoon, warm sun, no shadow
maps; each seed nudges sun azimuth, elevation, and fog distance so runs look a little different.
**Places to hide** (ruled 2026-09-23 with the sight lines): two dead-end **alleys** per block on two
seeded sides (never the escape edge), a 2.4 m gap between two lots from the outer sidewalk to a wall
2 m short of the perimeter, a 1.9 m dumpster 6 m in from the mouth (seen from the street; the pocket
behind it is out of sight from the mouth), a warm lamp over the mouth (ruled 2026-09-23), nav nodes
round the dumpster into the pocket. The plaza **pavilion** beside the terrace, abreast of the
chair: four posts, a roof at 3 m, and on two adjacent sides a 1 m wall topped by a slatted screen to
the roof (a 1 m wall alone cannot hide a standing head); nav nodes inside.
Colliders: buildings are AABBs; plaza walls and planters are low AABBs the player can stand on (the
physics needs a top-surface landing for low boxes, see Phase 3 brief); the fountain is a cylinder collider.
Camera must not clip into buildings: clamp the third-person camera distance to the first collider hit
along the player-to-camera segment.

**District** (experiment on `feature/district`, 2026-09-23: "copy and paste this out to a 16-block
something, just to see how that works"): the block tiled 4 x 4 (640 x 640 m). The chair's plaza block
is grid (1, 1) and keeps the origin, so the district runs mostly +X/+Z (x, z in -240..400). The other
fifteen roll a plain centre from their own seed (run seed mixed with the block index): a parking lot
with parked cars, a green with trees and benches, or a smaller paved square with planters. The block
is inside-out (ring road around the plaza, lots on the outside), so neighbours meet lot-back to
lot-back: a **link street** (the escape street's 12 m gap, 8 m road) at the middle of every interior
side joins the two ring roads. The plaza block keeps the single block's lots, alleys and parked cars
exactly: its one link street is the old escape gap (ruled 2026-09-23), so it has a single way out. Walls on the district edge only; one escape street, on an outer side of
the corner block farthest from the plaza. AI drivers route on a street graph (ring corners and side
midpoints as nodes, link streets as edges, lane 1 m right of the centreline); the pivot van still
enters from the plaza's own ring. Peds keep a per-block quota round the player (ruled 2026-09-24
after run 5, "blocks with no pedestrians"): 9 on his block, 3 on each block one away, 1 on each block
two away, 40 at most; every half second the blocks most over quota give their farthest idle ped to the
block most under it (4 moves a tick, landing 35 m or more from him, behind the camera when it can).
The old rule (30 peds, 16 pinned to the plaza's seeded spots, recycled only past 2.5 blocks) left
the plaza's 16 there for the whole run in a 4x4 district and one or two on every other block; six civilian cars drive the grid (carjack with E under 3 m/s; stuck 5 s
behind a vehicle, one backs up 3 m and turns round). The 8 s grab window starts at first contact
(a goon within 3 m), one shove per 2.2 s pack-wide. A compass strip under the RUN title shows the
chair and the exit by bearing and distance. `?blocks=1` builds the single walled block instead; parked cars are
instanced proxies that become drivable within 100 m. Every vehicle goes home, repaired, between runs.
**Landmarks** (ruled 2026-09-24): every non-plaza block has one tall landmark, picked by its seed, so a
block reads over the roofs: a water tower (tank on four legs, 22 m), a mural (a lot's side wall on a
link street painted PE green and gold, a sign box on its roof), a big tree (16 m, through the tree
instancing), a billboard (6 x 3 m on two posts, 12 m, SERENITY GROUP as alternating teal and white
blocks, no text), or a church spire (a narrow pyramid to 24 m). The centre kinds stand on the free spot
nearest the block centre, clear of the nav graph; all have colliders and go into the block's static
batch (no new draw calls). The plaza's landmark is the fountain. `src/world/landmarks.js`.

**Player**: third person, capsule body, box head, PE green shirt. WASD relative to camera yaw, mouse
controls camera yaw/pitch (pointer lock). Shift sprint (a 3 s stamina pool, a thin bar under health in
RUN; empty means walk until it has recharged 1 s; full again after 6 s off Shift). Space jump. E interact (enter/exit vehicle,
pick up chair). Left click: the **Healing Palm**. It is the only player weapon. Nobody dies from it.
Ruled 2026-09-24 ("fighting is fruitless ... a telegraphed charge attack, and he says HEALING PALM
like Falcon Punch"): **hold** left click to charge for 0.7 s. The player plants, the right arm winds
back, a ring fills under the crosshair, and once the hold is past a tap he shouts "HEALING PALM"
(the voice's `player` preset: the narrator pitched down, louder than any bubble). The charge
completing launches a 3 m lunge; the first body in the cone is **TREATED**: "TENSION RELEASED", sits
20 s on the spot, then walks loose to the van (goons) or his unit's car (cops) and stays out of the
chase for 90 s after that (`outUntil`): he does not look, is not radioed, and does not count for the
wanted level's line of sight. Treated peds sit, then wander loose (no wanted: the palm is nonviolent, ruled 2026-09-25). A bat hit or a
shove during the charge cancels it: the wind-up is the risk, and the gun's stun is what buys the time.
A **tap** (or letting go early) is the quick palm: 0.25 s wind-up, knockdown 3 s, relaxed rise, no
treatment. A treatment counts as tension released on the certificate; a quick palm does not.

**A goon's wind-up is a call** (proposed by the open-ended Opus 2026-09-25 after finding the
stunlock: a player doing what the first prompt says is OVERWORKED 7.8 s into the run with no input that
changes it; ruled by Alex the same day, all four options as recommended). When a goon winds up on the
player on foot (bat, shove, grab, pull-out), the course's key cue shows over the goon: the S keycap
with the draining window bar, every run. The window is the wind-up plus a 0.15 s early buffer (about
0.5 s). Tapping S inside it backsteps about 2 m so the strike whiffs (strike() already checks reach on
release); a clean dodge makes him stagger 1 s on top of his recover and cooldown, which is the palm's
charge window: dodge, counter, TREATED. Any other key or nothing is a miss and he connects as today.
Pillar 1 becomes literal: "Ow. Lighter." = S = back off. Lethality is unchanged; it becomes learnable.
Watcher: `dodge` { who, id, act: 'shown' | 'dodged' | 'miss' | 'late' }. Lives in goon.js / hostile.js
(the whiff and stagger), player-move.js (the backstep), hud-run.js (the mini cue reused).

**The chair swing** (Andy's suggestion, ruled 2026-09-24). Carrying the chair on foot, left click swings
it instead of the palm (the palm cannot be charged or tapped while the chair is on his back; the hint
line adds "Left click: swing the chair"). No charge: 0.15 s wind-up, 0.2 s arc, 0.15 s recover. The
folded chair comes off his back into both hands and sweeps right to left across a 180-degree arc in
front of him (where the camera looks). At the arc's midpoint everything up and in the half circle
within 2.5 m (goons, cops, peds; not through walls, not someone already down, treated, or kneeling) is
knocked down 3 s with about 2 m of knockback, a THUD, a "CHAIR!" floater, the palm's hit-stop and a
bigger shake (0.5 trauma against the palm's 0.25). A whoosh plays hit or miss. **No treatment**: a
chair knockdown (`knockCause: 'chair'`) rises straight back into what he was doing. Nobody dies.
**Durability**: the chair has 100; each swing costs 10, hit or miss. At 0 it is **bent**: still
carryable, loadable, swingable and usable, but a mini-massage on it takes twice as long (10 s of
hold instead of 5); the pickup floater says "bent chair" and the strip reads "Chair: on you (bent)".
The cart's $20 repair also straightens it when he carries it or it rides in the vehicle being repaired,
and a worn or bent chair alone is reason enough to offer the repair at full vehicle hp (ruled
2026-09-25). Durability resets on MASSAGE entry. Watcher: `swing` { hits, goons, cops, peds,
durability }, `chair` { act: 'bent' }, pickup and take events carry { durability, bent }, `repair`
carries `chairBefore`. Lives in `player-actions.js` (input, timing, the hit), `chair.js` (durability,
wear, repair, the in-hands pose), `palm.js` (`knockBody`, `palmable`, shared with the quick palm),
`interact.js`, `run/minimassage.js` (`BENT_MUL`), `audio-sfx.js` (`whoosh`). Headless:
`player.swingChair = true` for one swing.

**Massage gun** (added 2026-09-23): the only ranged weapon, and it starts as a literal massage gun. Right
click fires it. Level 0: contact range (1.5 m), percussive taps; every tap stuns the target 1.5 s (a
stagger: no movement, no attack), three taps within 3 s knock him down like the quick palm. Range upgrades extend the percussion into a visible
shockwave: level 1 = 4 m, level 2 = 8 m with a cone, level 3 = 14 m "Pro" with knockback that flips
peds and dents cars. Range levels are **meta unlocks only** (earned at run summaries, persist across runs; the gun itself is
the first unlock after run 1, so run 1 is palm-only). Battery, not ammo: 100 charge, drains per shot,
recharges only by giving a mini-massage to a ped client (the same action that cools wanted level) or
slowly while standing still near the chair. The chair is the charging dock, which is one more reason not
to leave it. **Cops** react like goons: a relaxed cop walks off pursuit for a while and says something
human; wanted level does not drop, the pressure does. Visual: a
gold and green handheld with a round head; upgrades add a longer barrel and a bigger head. Blender asset
`assets/massagegun.json`, one mesh per level or a scaled head.

**Vehicles** (decided 2026-09-23): sedan, franchise van (black), park maintenance cart, cop car, SWAT van,
all from `assets/*.json` with named wheels (`Wheel_FL/FR/RL/RR`, left is +X facing forward) and light
bars. Arcade GTA3 handling: fast accel, grippy, steering tight at low speed and wide at high, Space is a
handbrake that kicks the tail out. Van heavy and slow, cart quick and tippy, cop car fastest. **Chase
camera** while driving: settles behind the car's heading at a longer distance, mouse can look around
and it recentres when you drive. **Drivers are visible**: the player and every AI driver (cops, the
ranger's cart, SWAT, the Serenity goon at the van's wheel) sit posed at the type's `seat`, through tinted
glass; AI drivers are cosmetic rigs, never NPCs (no palm, no gun, no collisions). Vehicles dent and
smoke at 0 health, never explode. E enters and exits.
**Repairs** (ruled 2026-09-24): driving, or standing beside the vehicle he last drove, within 4 m of any
food cart with the vehicle under 100 hp, E pays $20 and puts it back to 100 hp (smoke gone, `pay`, a
"REPAIRED -$20" floater, watcher event `repair`). The $20 is his half: it comes off the massage phase's
`you` share, never the host's ledger. Under $20 the hint reads "Repair $20 (not enough cash)" and E
does what it did before (gets him out, or in).
**Peds hit by a car**: they tumble, lie for 3 s, get up holding their back (not relaxed, the opposite),
big wanted bump, and a later mini-massage on that ped is worth double. **The chair travels by car**:
E near a vehicle while carrying the chair loads it (visibly in the trunk, or on the cart's rear rack);
leaving the vehicle leaves the chair in it; a hard crash throws it out onto the road.

**Peds**: wander the nav graph on sidewalks and plaza paths. Flee when chaos happens nearby. **Mini-
massage during a run** (decided 2026-09-23): set the chair down (E while carrying, on foot), the nearest
willing ped walks over and sits, hold E for 5 s; on success
they pay, wanted drops one star, the massage gun battery refills. **The ped calls like a course client**
(ruled 2026-09-25, "same calls, faster": one mechanic across the whole game): no pressure bar. During
the hold the ped calls "Ow. Lighter." (tap S), "Harder." (hold W 0.6 s), "That's it, right there." (no
W/S) every 2 to 3 s, seeded per run seed and ped, judged by `massage/meter.js` judge() with shorter
windows (lighter 1.2 s, harder within 2 s, still 1.5 s; no left/right, the run's A/D are strafe).
Progress runs on E alone (5 s, 10 s bent); a miss adds 1 s to the hold and the ped says their miss
line (a miss on a bent chair steps progress back by one second of that longer hold); a third miss in one massage and they get up ("Forget it.", no pay, the chair stays down, the
usual `mini` cancel event with reason 'three misses'). The run HUD's mini strip shows the E hold's
progress and, while a call is open, the same key cue with a countdown bar the course uses. Between
calls the ped may say one of their regular lines. Watcher: `call` events with where 'run'. Goons and cops within 6 m interrupt it.
**Camping the chair has a risk** (ruled 2026-09-24): every success within 90 s of the previous one on
the same spot (40 m) counts toward heat, the first success being heat 1 and free. The second quick
success (heat 2) radios the goon pack to the chair (every goon up and working who is not already on him
runs to it and searches there); the third and on (heat 3) sends a cop on foot (a ranger first, else one called in out of sight) walks to the chair
and says "We told you to stop that." on arrival, and wanted goes to at least one star (`report('vending')`,
+1 once per run). Peds still queue.
A ped who was hit by a car is worth double and says so. This is the hook: doing the actual work is how
you cool heat.

**Goons** (AI decided 2026-09-23: pack pursuit with a van driver): 3 to start, spawn from the van. Two
chase directly, one flanks to cut the player's line; the van driver stays in the van and returns to the
block edge to drop 3 fresh goons every 90 s. **The van pursues** (ruled 2026-09-24 after run 5): from
the moment the player drives off in any vehicle it chases his vehicle on the street graph at van speed
(direct when close with a clear run, slowing for sharp turns), heads for the first node on his route to
the escape it can reach before him and waits there (the cut), and rams when alongside: a shove, 10 hp
off his vehicle and a wobble, never below 1 hp. Once he has been on foot 10 s it drives back and parks
broadside across the plaza's single exit street, the outbound lane blocked and the other lane open.
**Ramming the parked van** (ruled 2026-09-24): parked, its driver dozes (it keeps its post while he
drives, until woken or the next wave call). The player's vehicle (any type) hitting it above 3 m/s
shoves it 2 m along the hit, with a wobble, a thud, sparks and 5 hp off his vehicle; the third shove
wakes the driver, who drives off to `vanEntry` and parks there (`van` events `shoved`, `driven_off`).
From there the old rule applies: 10 s on foot sends it back to the exit.
**Goons versus a vehicle** (ruled 2026-09-25 after Alex's run 1 on 25.2: "I'm pretty much invincible in
my cart, goons just stand and look at it"; all four moves ruled in, built in this order):
1. **Pull-out.** A goon within reach of a vehicle the player drives that is moving under 2 m/s
   (stopped, cornering, wedged) yanks him out through the door: 0.6 s wind-up with the grab pose,
   then the player is out on the road beside the car, knocked down 3 s (`knockdown` who 'player',
   cause 'pullout'), the chair stays where it was (in the vehicle or on his back), the vehicle keeps
   rolling to a stop with no driver, `stolen` untouched. The reverse of his carjack. The goon says
   "Out." Watcher `goon` { act: 'pullout', vehicle }.
2. **Bats wreck the vehicle.** A goon with a bat beside a vehicle the player drives (any speed under
   6 m/s, within bat reach of the body) swings at the bodywork: 12 hp per hit (about eight hits to
   wreck a cart from full), a dent (the existing `dentVehicle`), sparks, a clang, the shove-off
   wobble. A wreck at 0 hp coasts down and throws the chair out (the existing hard-crash rule). Sitting
   still is fatal even when nobody pulls him out. `vehicle` { act: 'batHit', hp }.
3. **Cling.** A goon that reaches the back of a moving vehicle (2 to 12 m/s, within 1 m of the tail)
   jumps on and hangs off it (a `cling` pose on the rig, parented to the vehicle), pounding the roof:
   2 hp to the vehicle per second and the camera wobbles. A handbrake swerve (Space with the wheel
   turned, yaw rate above 1.2 rad/s for 0.4 s) or a static hit above 8 m/s throws him off: knocked
   down 3 s on the road. At most two clinging at once. `goon` { act: 'cling' | 'thrown' }.
4. **Goon cars at wave two.** From the second wave on, the van's drop comes with a sedan (Serenity
   livery: black, the van's colour) that two goons take and drive: it chases the player's vehicle the
   way the van does (pursue, cut) and rams at 8 hp, and its two goons bail out to chase on foot when
   the player is on foot within 15 m. Two goon cars at most alive. `goon` { act: 'car', n }.
**The van avoids its own people** (same ruling): goons and cops are never knocked down by the van or a
goon car; those vehicles brake for them and pass through. Ramming stays for the player's vehicle and
traffic. (Run 1 on 25.2 had five knockdowns, all the van's, three goons and two cops, and none on the
player.)
A relaxed goon
(Healing Palm or massage gun) sits down for 8 s, then rejoins. Bat swing at melee range (20 damage, knockdown).
Later waves arrive in black vans. Black suits, white shirts, no ties, one bat per van. Franchise name is
locked: SERENITY GROUP INCORPORATED ("Serenity Group" on vans, "Serenity Group Incorporated" when a goon introduces himself).
**Sight lines** (ruled 2026-09-23 after the first plays: "no real way to escape the goons"): a goon
tracks the player only while he has line of sight (head to head against static colliders; vehicles do
not block, as for cops) or is within 6 m. The pack shares one lastSeen: any goon who sees him updates
it for all and re-alerts searchers. 4 s without sight: search (walk to lastSeen on the nav graph, turn
in place 8 s, one "Where'd he go?"), then return to the van and idle there, loose, until seen again.
The 8 s grab window always sees; knocked, loose and sitting goons neither look nor re-alert. A palmed
goon is out of the chase for 12 s (down 3, up loose 1, sit 8); a car hitting him while he is loose or
sitting starts that over instead of putting him straight back on.

**Cops** (curve decided 2026-09-23, classic GTA3): wanted 1 to 5 stars. 1: the ranger on foot, campaign
hat asset on the person mesh, the same character as in the pivot. Driving units spawn one block out by
road (ruled 2026-09-24 after run 5, where level 2 units spawned 2..3 blocks out took ~98 s and never
arrived): the street node about 160 m of road from the node nearest the player, never on a ring inside
the plaza block or his own block; measured 14..23 s to within 30 m of a player on the plaza. **Units
spawn ahead** (ruled 2026-09-25 after run 1 on 25.2: two stars for 58 s and no unit ever had line of
sight of a cart): the spawn node is chosen on the player's route to the escape (the node about 160 m
of road along that route, or the farthest on it when the route is shorter), facing him, so he meets
the unit head-on instead of outrunning it; when he is on foot with no route the old rule stands. 2: parks police cart. 3: city cop cars
(light bars flashing). 4: roadblocks at two road corners. 5: everything plus the SWAT van. Rises, by
**two classes of attack** (ruled 2026-09-25, Alex: "if all our attacks are healing attacks, should
we even get in trouble for this?"): the Healing Palm (charged or quick) and the massage gun are
**NONVIOLENT** and raise nothing on a goon or a ped; the chair swing and a car hit are **DANGEROUS**:
+1 for the first goon hit that way, +2 for a ped hit that way (`pedHurt`, carnage). **Any action on a
cop is aggression**: palm, gun, chair or car on a cop is +1 every time (`copHit`; the treated cop still
walks off, the meter still rises). A stolen vehicle is +1 (+0.5 each after), a carjack +1, +1 after
60 s of continuous chaos (any wanted > 0 with hits in the last 10 s), 4 and 5 only from repeated
vehicle carnage (3+ ped hits or 3+ vehicle wrecks). The once-per-run `goonHit` and the `vending`
star are unchanged. Decays 1 star per 25 s while no cop has line of sight. Cops relax like goons
and walk off pursuit for a while; wanted does not drop from that.
Rulings (2026-09-23, post-v1 relay): a stolen car still rolling after you bail out is yours; it
raises wanted for anyone it hits, ped, goon, or cop, the same as if you were driving. A hit by an
AI-driven car (cop car, the franchise van) raises no wanted, but the street still reacts: peds nearby
flee and the chaos flash shows.

**Health**: 100. Arrest when a cop touches you at speed 0 for 1.5s or you are knocked down within reach.
Death at 0 health.

**ESCAPE**: reach the marked edge with wanted 0 and the chair in your possession (carrying it or in the
vehicle). Escape is a win; the chair is the run's real objective. The HUD says it from the moment the
pivot fires: "Don't leave the chair." Leaving the block without it is a loss (the ESCAPE state with a
"You left the chair" card and no unlock).

## Version one decisions (council sitting, 2026-09-23)

- **Wanted cap for v1 is 3 stars** (ranger, parks cart, cop cars). Levels 4 and 5 (roadblocks, SWAT
  van) stay implemented behind `WANTED_CAP = 3` in `src/run/wanted.js`; raise it later.
- **Home is the People's Elbow site**, not diamondlegendz: the game is Elbow content. Build it here,
  then move or mirror to peoples-elbow.com when the loop is polished. The certificate ends with the real
  chair's address: a line and a link to peoples-elbow.com ("The real chair is at ...").
- **Andy is co-designer after Phase 7** (audio and juice), not a blind tester; strangers come from the
  real chair. "Proud" means the full loop plays clean with audio: massage, pivot, run, slow motion,
  certificate, back to the chair, spa loop that breaks. Alex plays it himself after Phase 7, not before.
- **Certificate last line** (second sitting): a dry sentence and an address, no pitch, no button copy.
  "The real chair is at The People's Elbow, Woodstock, GA." with a plain link to peoples-elbow.com.
- **Unlock balance**: two viable late builds, gun range and the neighborhood (regulars, block party),
  tuned equal. Neither dominates.
- **Byline**: one line, on the title screen footer and the certificate footer: "Made by The People's
  Elbow, a.k.a. Alex Adamczyk, LMT." The course header can still say "Instructor: Alex Adamczyk, LMT"
  as part of the CEU skin. The certificate's licensee line is the player.
- **Audio for v1**: full procedural WebAudio score in three states. Spa pad with rain (MASSAGE), the
  detune-and-collapse at the PIVOT, a driving bass pulse (RUN), silence under the slow motion. Effects:
  engine hum per vehicle type, thud, siren, chair fold, massage gun percussion. No audio files.

## Dialogue: speech bubbles and a C64 voice (decided 2026-09-23)

Every spoken line has two halves and both are required; a subtitle strip alone does not read.

- **Speech bubbles**: a comic-style DOM bubble (rounded box, small tail pointing down) anchored over
  the speaker's head, projected from the head pivot's world position each frame like the floaters,
  clamped to the viewport with the tail pointing toward the speaker when they are off screen. One
  bubble per speaker, queued lines replace in place, bubble lifetime = speech duration + 0.8 s. Same
  beige course skin in MASSAGE; white with a black outline in RUN. The massage clients' lines move from
  the subtitle strip into bubbles. The narrator (the course voice with no body) keeps the strip.
- **Voice** (decided 2026-09-23, after finding the SAM JS port is unlicensed abandonware): **our own
  formant robot voice**, `src/voice.js`, a few hundred lines of WebAudio, no files, no dependencies.
  Design: a glottal buzz source (a sawtooth or pulse at the pitch) plus a noise source for fricatives,
  through two or three bandpass formant filters whose centre frequencies step through a small phoneme
  table (about 40 entries: vowels by F1/F2, stops as short silences plus a burst, fricatives as shaped
  noise, nasals as a low resonance). Text goes through a crude letter-to-phoneme rule set (English
  digraphs, silent e, a short exception list for the game's own words). Timing: fixed 70 to 110 ms per
  phoneme, pitch contour drops at a full stop and rises at a question mark. It should sound like a 1980s
  speech chip, not like a person; intelligibility with the subtitle bubble present is the bar, not alone.
  Three presets of one synth: narrator (mid pitch, even), goons (low pitch, slow, wider formant
  bandwidth), ranger and clients (higher pitch, faster). Peds' floaters stay text only. Who speaks:
  narrator, clients, goons, ranger, the certificate. Built in Phase 7 with the rest of the audio; the
  bubbles are built in Phase 6 with the pivot, since the pivot needs them. Bubble lifetime is driven by
  the synth's reported duration for the line. First listen (Alex, 2026-09-23): "too muddy, needs to be
  more intelligible." Direction: sharper consonants, slower rate, narrower formant bandwidth, clearer
  word gaps; robotic is fine, mushy is not.

## Roguelike meta

Persisted in localStorage under `cmf.meta.v1`:
- `runs`, `bestTime`, `bestCash`, `escapes`
- unlocks: bit set. Unlock order: massage gun (level 0), sprint stamina up (+50% pool), gun range 1, chair auto-fold
  (faster pickup), "regular client" (one guaranteed cooling client per run), gun range 2, cart keys (start
  with a cart), franchise disguise (goons ignore you for 20s once), gun range 3 "Pro", "block party"
  (peds cheer, cops slower), skippable module review (any key skips the van cutscene).
Ending changes the reward (ruled 2026-09-24: "the rewards for failing and for succeeding seem to be
the same; the roguelike gift is incremented regardless"). Escapes unlock the main list; failures unlock
something smaller; leaving the chair unlocks nothing.
- **Main track** (`unlocks`, `UNLOCKS` in `src/meta.js`, the order above): the next item on `escape` only.
- **Consolation track** (`consolations`, `CONSOLATIONS`): the next item on `arrest` or `death`, each once,
  in this order. Exhausted, a failure grants nothing and the certificate says "No unlock. Escape for the
  next one."

| Consolation | Effect | Perk flag (`ctx.perks`) | Status |
|---|---|---|---|
| `icepack` | picking up the chair heals 20 hp, once per run (a pickup at full health does not spend it) | `icePack` (bool) | live: `src/entities/player.js` (fold finish), reset in `src/run/spawner.js` |
| `coffee` | stamina refills 25% faster (6 s -> 4.8 s) | `staminaRegenMul` (1.25) | live: `src/entities/player.js` (stamina refill) |
| `parkingpass` | one gold sedan, keys in (no theft), at the inner kerb of the plaza edge nearest the chair; gone on MASSAGE | `parkingPass` (bool) | live: `src/world/cars.js` (`spawnPassCar`), `src/run/spawner.js` |
| `tipjar` | +$5 per mini-massage | `tipJar` (5, else 0) | live: `src/run/minimassage.js` (pay; the `mini` event carries `tip`) |
| `getwellcard` | jogger's opening line after a failure turns sympathetic; "Get well soon" stamp on failure certificates | `getWellCard` (bool) | live: `src/massage/clients.js`, `src/run/summary.js` |
| `loanerscrubs` | gold shirt (#ffcc00) for the player and the massage-phase therapist | `shirt` (`'gold'`, else null) | live: `src/world/people.js` (`setPersonColours`), `src/entities/player.js`, `src/massage/stage.js` |

The certificate names the track: red wax and "UNLOCKED" for a main item, a smaller grey seal and
"CONSOLATION" for a consolation. Between runs the returning regular mentions it: Dana with an escape's
`{gift}` line ("I brought a massage gun") or the consolation's own sympathy line ("I brought you an ice
pack. You looked rough."); Walt, Marcus and Priya with their own line per unlock (`massage/clients.js`).
`lastUnlock` (id) and `lastTrack` (`main` / `consolation`) record the last reward; `run.end` and
`certificate` events carry `track`. Old saves: their mixed `unlocks` array stays the main track as is,
`consolations` loads as `[]`.

## Technical contracts

Coordinate system: Three.js default, Y up, meters. Block is centered at origin. +Z is "south".
Fixed timestep 60Hz simulation, render on rAF, interpolation not required.

```
Module map after the 2026-09-24 split (98 files, every one under 300 lines, no import cycles; the
authoritative map is graphify-out/GRAPH_REPORT.md and README.md):
src/main.js, wiring.js, state.js, input.js, rng.js, version.js     boot, state hooks, loop, input
src/assets.js, physics.js, physics-grid.js                          loader-free meshes, colliders, camera march
src/world/  layout.js, street-layout.js, district-layout.js         block, street and district vocabularies
            district.js, block.js, centres.js, buildings.js,        the seeded sixteen-block city
            streets.js, roads.js, plaza.js, furniture.js, props.js,
            batch.js, nav.js, cars.js, parked.js, traffic.js,
            alley-lamps.js, landmarks.js, people.js
src/entities/ player.js, player-move.js, player-actions.js,        the player, split by concern
            chase-cam.js, vehicle*.js, seated.js, chair.js,
            interact.js, palm.js, gun.js, goon.js, goon-home.js,
            cop.js, ped.js, npc-common.js, npc-nav.js, hostile.js
src/run/    spawner.js, peds-budget.js, goon-waves.js, van-ai.js,  the run's population and pressure
            wanted.js, police.js, police-units.js, police-lights.js,
            driver.js, minimassage.js, mini-start.js, end.js,
            slowmo.js, summary.js
src/massage/ index.js, session.js, ledger.js, clients.js,           the course
            client-lines.js, guide.js, meter.js, stage.js
src/pivot.js, pivot-path.js, pivot-cast.js, pivot-lines.js, pivot-ring.js   the van scene
src/bubbles.js, hud.js, hud-run.js, hud-massage.js, hud-compass.js, title.js, ui.css   presentation
src/audio.js, audio-sfx.js, audio-wire.js, voice.js, voice-lex.js  score, effects, the robot voice
src/juice.js, particles.js, meta.js, events.js, watch.js,          feel, saves, the watcher
            run-report.js, run-diff.js, run-lines.js, run-stats.js
assets/*.json      baked Blender meshes; regenerate via tools/blender (the blender-lowpoly skill)
tools/blender/     bpy scripts + lowpoly.py + export_json.py + render_check.py
```

People from Blender are one neutral jointed `person.json` (objects named head, torso, upperArmL/R,
lowerArmL/R, upperLegL/R, lowerLegL/R, each pivoting at its joint). Code recolours by object name
(shirt, pants, skin, hair) so peds, clients, goons, cops are variants of one mesh, not separate files.

Every entity is a plain object `{ id, kind, pos: Vector3, vel: Vector3, yaw, radius, hp, mesh, ...}`.
`ctx` passed to updates contains `{ world, entities, player, input, rng, wanted, hud, audio, time }`.
No classes with inheritance trees. Modules export functions. No globals except `window.CMF` debug handle.

HUD is DOM (CSS + a 2D canvas for the meter and circle), not Three.js sprites. Press Start 2P is not
loaded (no external fonts under CSP); use a system monospace stack.

Rendering budget: 60fps on integrated graphics. Under 400 draw calls. Use `InstancedMesh` for trees,
windows, and street props.

## Playtesting with Jev (ruled 2026-09-25)

Alex: "Opus is trying to playtest, but the problem is it's too slow. Opus needs to make sure we have
good enough logs so it has a really good resolution of everything that happened, and figure out a way
to make Jev operate the game." The feasibility study (scratchpad `jev/playtest-jev.md`, Opus,
2026-09-25) found that every headless playtest so far kept the model out of the loop: calls answered
by an in-page script, goons pinned, waves forced, time slowed 27 times. An Opus decision through the
harness takes 10 to 30 s against reaction windows of 0.4 to 2.5 s, so unassisted it makes none of the
timed decisions, which are most of a session. **Jev** is TypeSafe AI's System One decision model
(early access, Sept 2026): state in, a typed choice with probabilities out in about 0.2 s, text only,
no tools, about 64k context, near-free. It cannot count, aim or plan routes.

Rulings (Alex, 2026-09-25): Jev flies, Opus reviews the replay afterwards; the sim is **paused per
decision and render-less**; Jev chooses from a **context-filtered macro menu** (code does bearings,
holds and steering); access by signup or the Vercel AI Gateway, the harness first; first milestone
"Jev completes the massage course from logs alone".

**Milestone 0, logs.** Every event carries `tick`. New: `snap` at 4 Hz (`?snap=4`, 0 off; player
pos/yaw/cam/speed/hp/stamina/vehicle/chair/durability, wanted level and heat, cash, chair and exit
distance+bearing, the 8 nearest entities as `[id, kind, dist, bearing, state, tag]`, mini and call
state, the HUD's hint/prompt/strip text, held input; in MASSAGE the client/segment/competency/
modality/ring instead), `input` on change, `call` act 'open', `mini` phase 'ready', `telegraph`
{who, id, act: batWindup | grabWindup | pulloutWindup | arrestStart}, `state.why`, `run.start` with
the full perk/meta subset. `snap` and `input` never enter the 2,000-event localStorage ring: a
separate in-memory session log (`src/session-log.js`, ~20 min cap) with `CMF.session.since(seq)` and
`CMF.session.dump()` (NDJSON), and a "Download session" button on watch.html. A human's run becomes
fully legible to Opus even if Jev never ships.

**Milestone 1, stepping.** `window.CMF.agent`: `pause(on)`, `tick`, `step(n, {stopOn})` stepping
whole ticks with one microtask yield per tick and stopping early on an interrupt (a call asked or
open, mini ready, a telegraph, player knockdown or damage, a state change, a tutorial prompt, a
leave prompt), `observe()` (the snapshot plus the last ~12 events and HUD text rendered as words,
and the valid action menu), `act(id)` (synchronous synthetic key and mouse events; a hold is keydown,
step, keyup; 30 degrees = 209 px at MOUSE_SENS). `?norender` skips camera juice, audio and draw.
`ctx.timeScale ?? 1` (today `|| 1` makes 0 run at full speed). The four gameplay `Math.random` sites
(goon.js sight timer, npc-common.js replan timer and sidestep, peds-budget.js relocation) move to
seeded streams; palm.js's camera jitter must not feed ped placement; vehicle and prop meshes are
preloaded before tick 0 of a stepped run; the default seed stays `Date.now()` but a harness always
passes `?seed=`. Proof: the same seed, meta and action list twice give byte-identical snapshot
streams.

**Milestone 2, the first Jev win.** A Node CDP harness (`tools/jev/pilot.mjs`, the same bones as the
scratchpad `lib.mjs`) runs render-less, paused, 2 decisions per sim second plus interrupts, and asks
Jev (`POST api.typesafe.ai/v1/systemone`, key from the environment, never in the repo; a Haiku or
Sonnet call site behind the same interface as the fallback) for an `action` choice among the valid
macros and a `danger` score. MASSAGE macros: answer_lighter (tap S), answer_harder (hold W 1 s),
stay_still, answer_left, answer_right, match_modality (Space), next_client (E), wait, and a
`track_ring` code reflex on or off. Pass: all three clients paid and the pivot reached with no debug
hooks, from a fresh profile, on three seeds. Every run writes `actions.json` (seed, build, meta,
[{tick, action, probs}]) and `session.ndjson`.

**Milestones 3 and 4 (later):** one mini-massage in the run on a fixed seed with goons live, then
full runs to any ending and 50 seeds overnight scored by escape rate, time and chair kept, Opus
reading the aggregate plus the three worst sessions. RUN macros are listed in the study.

## Relay protocol

- Fable writes this doc and each phase's brief, and gates each phase.
- One Opus agent per phase, sequential. It gets the doc, the brief, and the current tree. It must end
  with a runnable page and a short list of what it verified (headless browser check if available,
  otherwise a node smoke test of module imports plus a static server load).
- After each phase, a Sonnet nitpick relay: 3 to 5 passes, one file or one question each, findings
  verified before they count.
- Alex is asked multiple choice at each gate.

## Phase plan

1. Skeleton: index.html, loop, input, state machine, placeholder flat park block, player walking with
   third-person camera, HUD shell. Playable movement.
2. Massage minigame: chair, client, meter, circle, three modalities, three clients, dialogue, pay ledger.
3. Park block generator: seeded buildings, roads, park, trees, benches, escape edge, nav waypoints.
4. Vehicles: sedan, van, cart; enter/exit; arcade driving; collisions with world and entities.
5. NPCs: peds, goons, cops, wanted levels, spawner.
6. Pivot cutscene, run end conditions, summary card, meta unlocks, return loop.
7. Audio and voice wiring (the modules exist: `src/audio.js`, `src/voice.js`), full arcade juice
   (hit-stop on palm hits, impact-scaled screen shake, particle puffs: dust, sparks off cars, a green
   "relief" burst on relaxed NPCs, FOV kick on sprint and handbrake, bouncing floaters), the fake course
   catalog on the title screen (Module 1 unlocked; Modules 2 to 6 listed and locked: Deep Tissue Ethics,
   Documentation, Draping, Contraindications, Business of Touch; a CE credit hours line; an accreditation
   badge that says nothing), keyboard-and-mouse only with a polite card for phones carrying the byline and
   the real chair's address, a one-page `README.md` in the folder for Andy (run locally, the design doc,
   the Blender skill, how phases and the relay work, where tuning lives), and a perf pass. Decided
   2026-09-23. Gamepad and touch are v2.
