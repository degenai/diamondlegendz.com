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
3. **Primitive stack.** Procedural geometry only (boxes, cylinders, capsules, cones). No GLB loaders,
   no textures, no post-processing stack. Flat-shaded `MeshLambertMaterial`, one directional light, one hemisphere light, fog.
   A few TEST props may be tried later if the procedural look wants help; not in scope until Phase 7.
4. **Mutual aid thesis, not preached.** The antagonists are a franchise massage chain's "compliance team".
   The city sides with the franchise. The player never pays to work.

## Phases of a session (state machine)

```
TITLE -> MASSAGE -> PIVOT -> RUN -> (ARREST | DEATH | ESCAPE) -> SUMMARY -> MASSAGE (with unlocks) ...
```

- **TITLE**: looks like a CEU course landing page. "Chair Massage Fundamentals. Module 1: Pressure."
- **MASSAGE**: the minigame. Client sits in a massage chair in a city park. Sequence of clients. On the
  first ever playthrough, the pivot fires after client 3 (about 2.5 minutes). Afterwards, the pivot
  fires after 1 client (the player knows).
- **PIVOT**: scripted 20 seconds. A black van pulls onto the park path. Three heavies in suits get out,
  one carrying a bat. Straight GTA menace, no slapstick; the absurdity is that they are here about a
  massage chair. Dialogue over HUD. Ranger arrives, sides with the heavies. Controls unlock
  mid-cutscene (the player can walk away while the ranger is still talking). Music changes. Title card:
  "Chair Massage Fundamentals" with "Fundamentals" struck through.
- **RUN**: open park block. Goons hunt the player. Wanted level rises with chaos. Player can steal
  vehicles, run, fight (elbow strikes, it's The People's Elbow), and reach an ESCAPE point (a client's
  house on the far edge of the block, or the highway on-ramp) once wanted level has cooled to zero.
- **ARREST / DEATH / ESCAPE**: end of run. Freeze frame, stat card.
- **SUMMARY**: run stats, unlock reveal, "Return to the chair" button.

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

**World**: one city block containing a park, rolled from a seed per run. Block is 160m x 160m. Outer
ring: two-lane road loop with sidewalks. Corners and edges: low-poly buildings (2 to 6 floors, boxes with
window grids as darker boxes). Center: the park, with paths, a pond, benches, trees (cone on cylinder),
the massage chair spot. One edge has the ESCAPE point. Seed determines building heights, tree placement,
path layout, vehicle spawns, escape edge, goon van entry.

**Player**: third person, capsule body, box head, PE green shirt. WASD relative to camera yaw, mouse
controls camera yaw/pitch (pointer lock). Shift sprint. Space jump. E interact (enter/exit vehicle,
pick up chair). Left click: the **Healing Palm**. A big wind-up wrestling strike (lunge, THUD, screen
shake). It is the only player weapon. A hit knocks the target down for about 3 seconds; when they get up
they are visibly relaxed (slower posture, arms loose), say a relieved line ("...oh. Oh, that's better."),
and a "TENSION RELEASED" floater pops. Goons who get up relaxed stop chasing for 8 seconds before
their boss's radio puts them back on. Nobody dies from the Healing Palm.

**Vehicles**: 3 types minimum: sedan, franchise van, park maintenance golf cart. Arcade physics:
forward speed with accel/brake, steering scaled by speed, drift on Space (handbrake). Box body on
4 cylinder wheels. Vehicles damage on collision; at 0 health they smoke and stop. Player can be hit by
vehicles (knockdown, health loss).

**Peds**: wander waypoints on sidewalks and park paths. Flee when chaos happens nearby. Some are
"clients": if the player stops near them with the chair, a 10-second mini-massage happens and pays
money and lowers wanted level by one star (the hook: doing the actual work is how you cool heat).

**Goons**: 3 to start, spawn from the van. Chase on foot, bat swing at melee range (20 damage, knockdown).
Later waves arrive in black vans. Black suits, white shirts, no ties, one bat per van. Franchise name is
locked: SERENITY GROUP INCORPORATED ("Serenity Group" on vans, "Serenity Group Incorporated" when a goon introduces himself).

**Cops**: wanted 1 to 5 stars. 1: ranger on foot. 2: parks police cart. 3: city cop cars. 4: roadblocks.
5: everything plus SWAT van. Wanted rises from: hitting goons (small), hitting peds (big), stealing
vehicles (medium), vehicle collisions with property (small). Wanted decays when out of sight.

**Health**: 100. Arrest when a cop touches you at speed 0 for 1.5s or you are knocked down within reach.
Death at 0 health.

**ESCAPE**: reach the marked edge with wanted 0 and the chair in your possession (carrying it or in the
vehicle). Escape is a win; the chair is the run's real objective. The HUD says it from the moment the
pivot fires: "Don't leave the chair." Leaving the block without it is a loss (the ESCAPE state with a
"You left the chair" card and no unlock).

## Roguelike meta

Persisted in localStorage under `cmf.meta.v1`:
- `runs`, `bestTime`, `bestCash`, `escapes`
- unlocks: bit set. Unlock order: sprint stamina up, chair auto-fold (faster pickup), "regular client"
  (one guaranteed cooling client per run), cart keys (start with a cart), franchise disguise (goons ignore
  you for 20s once), "block party" (peds cheer, cops slower).
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
```

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
7. Audio, title screen, juice, TEST props, perf pass.
