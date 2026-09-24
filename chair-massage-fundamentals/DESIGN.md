# Chair Massage Fundamentals — design doc

Working repo: `diamondlegendz/chair-massage-fundamentals/`. Live at diamondlegendz.com/chair-massage-fundamentals/.
Web playable, vanilla ES modules, Three.js 0.186 vendored (no CDN; CSP is `script-src 'self'`). No build step. No npm.

## The one-sentence design

A boring chair-massage training tool whose controls (WASD pressure meter + mouse-in-a-moving-circle)
are secretly the movement and aim controls of the low-poly GTA3 roguelike it turns into.
Frog Fractions structure: the title is honest, the first five minutes are honest, then franchise goons
show up at the park and the game becomes something else.

## Pillars

1. **The tutorial is a lie that is also true.** Everything in the massage minigame trains a skill the
   run phase needs. WASD = pressure now, movement later. Mouse-in-circle = stroke tracking now, aim/look later.
   Space = "switch modality" now, jump/handbrake later. E = "next client" now, enter vehicle later.
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
  bats come out after 8 s or at the first Healing Palm. **The ranger hangs back**: wanted starts at 0,
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
  so the pivot's timing is unchanged. **Skipping it is an unlock** (the last one, "Module review:
  skippable. You've seen enough."): a course-skin line "Press any key to skip the module review" shows
  for the whole cutscene and any key or click jumps to the moment controls unlock (van at its stop,
  the crew on their marks, the ranger at the chair, the client already gone). No skip before it.
- **RUN**: open park block. Goons hunt the player. Wanted level rises with chaos. Player can steal
  vehicles, run, fight (elbow strikes, it's The People's Elbow), and reach an ESCAPE point (a client's
  house on the far edge of the block, or the highway on-ramp) once wanted level has cooled to zero.
- **ARREST / DEATH / ESCAPE** (decided 2026-09-23): "Wasted"-style slow motion. Time scales to 0.25
  for 2 s, the camera tilts and drifts, the colour desaturates, and a stamp slams in: ARRESTED,
  OVERWORKED (health, nobody dies), or ESCAPED. Then the summary.
- **SUMMARY**: a continuing-education **certificate parody** on the beige course skin: "This certifies
  that the licensee ESCAPED / WAS ARRESTED / WAS OVERWORKED", run time, cash raised for the host cause,
  tension released count, one unlock revealed under a wax seal. "Return to the chair" button.
- **Between runs**: one client (the jogger returns) with two new lines that reference the last run and
  the new unlock, then the van arrives faster. About 40 s of massage between runs.

## The massage minigame (MASSAGE)

Camera: over the shoulder of the therapist, looking down at the client in the chair. Park in the background.

**Pressure (WASD).** A vertical meter on the HUD. W raises pressure, S lowers it. A/D shift the working
spot left/right across the client's back (the visible therapist hands slide). Each client has a hidden
sweet-spot band that drifts slowly. In band: progress fills. Under band: nothing. Over band: client flinches,
progress drains, "Ouch" text. This is exactly a "hold direction to move at a speed" skill.

**Stroke tracking (mouse).** A circle on the HUD (over the client's back) moves in a pattern. Mouse must
stay inside it. Patterns per modality:
- Swedish: long slow ellipses.
- Cross-fiber friction: short fast back-and-forth.
- Trigger point: stationary, but the circle shrinks over 4 seconds then releases.
Space cycles modality. Each client asks for a modality by name; wrong modality gives half progress.
Ruling (2026-09-23): the ring only gates *fill*. Over-band pressure drains and flinches even when the
cursor is off the ring; you hurt them whether or not you are watching your hands.

**Clients.** Three park regulars: a jogger (tight calves, wants Swedish), a retiree from the bench
(upper traps, wants trigger point), a dad from the playground (forearms from pushing swings, wants
cross-fiber). Two or three lines each about their day. One line each quietly foreshadows the franchise:
"the new place at the strip mall wants ninety bucks for this", "some guys in a black van were asking
who runs the chair", "my HOA got a letter about unlicensed vendors, is that you?".

**Boredom curve.** Client 1 is easy. Client 2 tighter band. Client 3 both mechanics at once with talky
client dialogue about their day. It should feel like a real, competent, slightly tedious edutainment game.

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
2 m short of the perimeter, a 1.9 m dumpster near the end (the pocket behind it is out of sight from
the mouth), nav nodes down the middle. The plaza **pavilion** beside the terrace, abreast of the
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
enters from the plaza's own ring. 30 peds live within two blocks of the player and jump 1..2 blocks
ahead of him past 2.5; six civilian cars drive the grid (carjack with E under 3 m/s; stuck 5 s
behind a vehicle, one backs up 3 m and turns round). The 8 s grab window starts at first contact
(a goon within 3 m), one shove per 2.2 s pack-wide; parked cars are
instanced proxies that become drivable within 100 m. Every vehicle goes home, repaired, between runs.

**Player**: third person, capsule body, box head, PE green shirt. WASD relative to camera yaw, mouse
controls camera yaw/pitch (pointer lock). Shift sprint (a 3 s stamina pool, a thin bar under health in
RUN; empty means walk until it has recharged 1 s; full again after 6 s off Shift). Space jump. E interact (enter/exit vehicle,
pick up chair). Left click: the **Healing Palm**. A big wind-up wrestling strike (lunge, THUD, screen
shake). It is the only player weapon. A hit knocks the target down for about 3 seconds; when they get up
they are visibly relaxed (slower posture, arms loose), say a relieved line ("...oh. Oh, that's better."),
and a "TENSION RELEASED" floater pops. Goons who get up relaxed stop chasing for 8 seconds before
their boss's radio puts them back on. Nobody dies from the Healing Palm.

**Massage gun** (added 2026-09-23): the only ranged weapon, and it starts as a literal massage gun. Right
click fires it. Level 0: contact range (1.5 m), percussive taps, same relaxation effect as the Healing Palm
but faster and weaker (three taps to knock down). Range upgrades extend the percussion into a visible
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
**Peds hit by a car**: they tumble, lie for 3 s, get up holding their back (not relaxed, the opposite),
big wanted bump, and a later mini-massage on that ped is worth double. **The chair travels by car**:
E near a vehicle while carrying the chair loads it (visibly in the trunk, or on the cart's rear rack);
leaving the vehicle leaves the chair in it; a hard crash throws it out onto the road.

**Peds**: wander the nav graph on sidewalks and plaza paths. Flee when chaos happens nearby. **Mini-
massage during a run** (decided 2026-09-23): set the chair down (E while carrying, on foot), the nearest
willing ped walks over and sits, hold E for 5 s with a small pressure meter (W/S) on the HUD; on success
they pay, wanted drops one star, the massage gun battery refills. Goons and cops within 6 m interrupt it.
A ped who was hit by a car is worth double and says so. This is the hook: doing the actual work is how
you cool heat.

**Goons** (AI decided 2026-09-23: pack pursuit with a van driver): 3 to start, spawn from the van. Two
chase directly, one flanks to cut the player's line; the van driver stays in the van, tries to cut the
player off on the road, and returns to the block edge to drop 3 fresh goons every 90 s. A relaxed goon
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
hat asset on the person mesh, the same character as in the pivot. 2: parks police cart. 3: city cop cars
(light bars flashing). 4: roadblocks at two road corners. 5: everything plus the SWAT van. Rises: +1 for
the first hit goon or a stolen vehicle, +2 for hurting a ped (car or palm), +1 after 60 s of continuous
chaos (any wanted > 0 with hits in the last 10 s), 4 and 5 only from repeated vehicle carnage (3+ ped
hits or 3+ vehicle wrecks). Decays 1 star per 25 s while no cop has line of sight. Cops relax like goons
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
Each SUMMARY unlocks the next item. Massage phase between runs mentions the unlock in client dialogue.

## Technical contracts

Coordinate system: Three.js default, Y up, meters. Block is centered at origin. +Z is "south".
Fixed timestep 60Hz simulation, render on rAF, interpolation not required.

```
src/main.js        boot, state machine, game loop, owns the Scene and Renderer
src/input.js       keyboard + mouse + pointer lock; exposes read-only snapshot per tick
src/state.js       enum of states, transition function, listeners
src/hud.js         DOM overlay: meter, circle, wanted stars, cash, dialogue, cards
src/meta.js        localStorage meta, unlocks
src/rng.js         seeded PRNG (mulberry32), run seed
src/world/block.js park block generator from seed -> {meshes, nav, spawns, escapeEdge}
src/world/props.js procedural mesh factories (building, tree, bench, chair, van, sedan, cart, person)
src/entities/*.js  player, ped, goon, cop, vehicle; each exports create(...) and update(e, dt, ctx)
src/physics.js     circle-vs-circle, circle-vs-AABB, vehicle vs static; no external physics
src/massage/*.js   minigame: clients, pressure meter, stroke circle, modalities, dialogue
src/run/*.js       wanted, spawner, end conditions, summary
src/audio.js       WebAudio procedural: engine hum, hit thud, siren, chair fold; one music loop per state
src/assets.js      loadMesh(url) -> Group of named children from the JSON format; cache; preload(list)
assets/*.json      baked Blender meshes (chair, sedan, van, cart, person, ...) ; regenerate via tools/blender
tools/blender/     bpy scripts + lowpoly.py helpers + export_json.py; run headless, see the blender-lowpoly skill
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
