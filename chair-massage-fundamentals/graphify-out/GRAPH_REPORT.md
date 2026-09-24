# Graph Report - src  (2026-09-23)

## Corpus Check
- 78 files · ~78,252 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 935 nodes · 2496 edges · 28 communities (23 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_District and block generation|District and block generation]]
- [[_COMMUNITY_Spawning, traffic, police units|Spawning, traffic, police units]]
- [[_COMMUNITY_Vehicles, chair, interaction|Vehicles, chair, interaction]]
- [[_COMMUNITY_NPC behaviour and wanted|NPC behaviour and wanted]]
- [[_COMMUNITY_Pivot cutscene and lines|Pivot cutscene and lines]]
- [[_COMMUNITY_HUD and compass|HUD and compass]]
- [[_COMMUNITY_Massage minigame|Massage minigame]]
- [[_COMMUNITY_Assets, physics, parked cars|Assets, physics, parked cars]]
- [[_COMMUNITY_Player, chase camera, gun|Player, chase camera, gun]]
- [[_COMMUNITY_Voice synthesizer|Voice synthesizer]]
- [[_COMMUNITY_People rig|People rig]]
- [[_COMMUNITY_Boot and state wiring|Boot and state wiring]]
- [[_COMMUNITY_Input|Input]]
- [[_COMMUNITY_Audio wiring|Audio wiring]]
- [[_COMMUNITY_Props and furniture|Props and furniture]]
- [[_COMMUNITY_Massage stage|Massage stage]]
- [[_COMMUNITY_Bubble queue|Bubble queue]]
- [[_COMMUNITY_Juice and particles|Juice and particles]]
- [[_COMMUNITY_Procedural score|Procedural score]]
- [[_COMMUNITY_Run end and escape|Run end and escape]]
- [[_COMMUNITY_Stage cast|Stage cast]]
- [[_COMMUNITY_Kneel and reach poses|Kneel and reach poses]]
- [[_COMMUNITY_Certificate|Certificate]]
- [[_COMMUNITY_Title and version|Title and version]]
- [[_COMMUNITY_player create|player create]]
- [[_COMMUNITY_player update|player update]]
- [[_COMMUNITY_vehicle create|vehicle create]]
- [[_COMMUNITY_vehicle update|vehicle update]]

## God Nodes (most connected - your core abstractions)
1. `boot()` - 48 edges
2. `floorHeightAt()` - 24 edges
3. `loadMesh()` - 23 edges
4. `toXZ()` - 23 edges
5. `sfx()` - 21 edges
6. `buildBlockPart()` - 21 edges
7. `addBox()` - 20 edges
8. `spawnPerson()` - 20 edges
9. `seek()` - 18 edges
10. `addEntity()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `createStage()` --calls--> `loadMesh()`  [EXTRACTED]
  massage/stage.js → assets.js
- `pivotLines()` --calls--> `pack()`  [INFERRED]
  pivot-lines.js → entities/goon.js
- `segmentHit()` --calls--> `skip()`  [INFERRED]
  physics.js → pivot.js
- `followPoly()` --calls--> `driveAt()`  [INFERRED]
  pivot-path.js → run/driver.js
- `ensureChair()` --calls--> `loadMesh()`  [EXTRACTED]
  entities/chair.js → assets.js

## Import Cycles
- 4-file cycle: `entities/goon.js -> entities/palm.js -> entities/interact.js -> run/minimassage.js -> entities/goon.js`

## Communities (28 total, 5 thin omitted)

### Community 0 - "District and block generation"
Cohesion: 0.06
Nodes (91): hashSeed(), makeRng(), addGlow(), alleyLamps(), _e, _g, _m, mesh() (+83 more)

### Community 1 - "Spawning, traffic, police units"
Cohesion: 0.06
Nodes (79): copHostile(), disposeCop(), createGoon(), disposeGoon(), addEntity(), removeEntity(), createPed(), disposePed() (+71 more)

### Community 2 - "Vehicles, chair, interaction"
Cohesion: 0.07
Nodes (68): BACK_MOUNT, chairState(), chairWorldPos(), findChair(), loadChair(), mount(), pickUpChair(), throwChair() (+60 more)

### Community 3 - "NPC behaviour and wanted"
Cohesion: 0.07
Nodes (66): getUp(), LINES, onPalm(), onVehicleHit(), SPEED, updateCop(), walkAway(), chase() (+58 more)

### Community 4 - "Pivot cutscene and lines"
Cohesion: 0.06
Nodes (65): clearBubbles(), createCop(), createNpc(), DEFAULTS, gunLevel(), has(), perks(), recordRun() (+57 more)

### Community 5 - "HUD and compass"
Cohesion: 0.05
Nodes (55): initBubbles(), _c, _d, el(), initCompass(), marks, place(), updateCompass() (+47 more)

### Community 6 - "Massage minigame"
Cohesion: 0.07
Nodes (54): gaugeState(), setRing(), CLIENTS, createDialogue(), MODALITIES, OUCH, RETURN, roster() (+46 more)

### Community 7 - "Assets, physics, parked cars"
Cohesion: 0.07
Nodes (49): build(), buildNode(), cache, loadMesh(), material(), template(), _cand, circleVsAabb() (+41 more)

### Community 8 - "Player, chase camera, gun"
Cohesion: 0.06
Nodes (49): _blend, blendLook(), clampHit(), _desired, _look, _one, _pivot, updateChaseCamera() (+41 more)

### Community 9 - "Voice synthesizer"
Cohesion: 0.09
Nodes (28): makeVoice(), BANK, hashRng(), addS(), ANTI, DICT, DIGITS, DIGRAPHS (+20 more)

### Community 10 - "People rig"
Cohesion: 0.07
Nodes (31): ARM_REST, coloursFor(), DOWN, _e, ELBOW, HAIRS, HIP_JOINT, KNEE (+23 more)

### Community 11 - "Boot and state wiring"
Cohesion: 0.13
Nodes (26): preload(), audioInternals(), speechHud(), ensureChair(), resetChair(), resetGun(), updateAll(), startPalm() (+18 more)

### Community 12 - "Input"
Cohesion: 0.08
Nodes (16): buttons, buttonsBuf, clickedEdge, GAME_KEYS, held, isEditable(), keysBuf, lockListeners (+8 more)

### Community 13 - "Audio wiring"
Cohesion: 0.12
Nodes (20): applyVolume(), audioFrame(), engines, ensureAudio(), initAudio(), _on, readVolume(), setVolume() (+12 more)

### Community 14 - "Props and furniture"
Cohesion: 0.17
Nodes (22): addCast(), AWNINGS, buildFurniture(), footprint(), LEAF, shuffle(), treeMeshes(), benchParts() (+14 more)

### Community 15 - "Massage stage"
Cohesion: 0.10
Nodes (17): CAM_LOOK, CAM_POS, createStage(), _l, pivotPose(), _q, _r, releaseCast() (+9 more)

### Community 16 - "Bubble queue"
Cohesion: 0.20
Nodes (17): activeBubbles(), anchorOf(), bubbles, busy(), drop(), enqueue(), eta(), inScene() (+9 more)

### Community 17 - "Juice and particles"
Cohesion: 0.21
Nodes (14): _from, initJuice(), juiceCamera(), juiceTick(), preTick(), resetJuice(), _to, burst() (+6 more)

### Community 18 - "Procedural score"
Cohesion: 0.20
Nodes (7): BASS, createAudio(), instances, PENTA, createSfx(), TYPE_PITCH, SLOW

### Community 19 - "Run end and escape"
Cohesion: 0.36
Nodes (8): checkEscape(), endRun(), hasChair(), inZone(), pulse(), RED, resetEscapeMarker(), STATE_FOR

### Community 20 - "Stage cast"
Cohesion: 0.25
Nodes (8): removeCast(), removeClient(), seatClient(), walkOff(), pivot(), placeholder(), skin(), spawnPerson()

### Community 21 - "Kneel and reach poses"
Cohesion: 0.33
Nodes (7): placeHands(), kneel(), poseTherapist(), aimAt(), poseKneeling(), poseReaching(), reach()

### Community 22 - "Certificate"
Cohesion: 0.48
Nodes (6): clock(), el(), hideSummary(), OUTCOME, showSummary(), usd()

## Knowledge Gaps
- **219 isolated node(s):** `cache`, `TYPE_PITCH`, `engines`, `sirens`, `_on` (+214 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `toXZ()` connect `District and block generation` to `Spawning, traffic, police units`, `Props and furniture`, `Assets, physics, parked cars`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `floorHeightAt()` connect `Vehicles, chair, interaction` to `Player, chase camera, gun`, `Spawning, traffic, police units`, `Pivot cutscene and lines`, `Assets, physics, parked cars`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `loadMesh()` connect `Assets, physics, parked cars` to `Spawning, traffic, police units`, `Vehicles, chair, interaction`, `NPC behaviour and wanted`, `Pivot cutscene and lines`, `Player, chase camera, gun`, `Boot and state wiring`, `Massage stage`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `cache`, `TYPE_PITCH`, `engines` to the rest of the system?**
  _219 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `District and block generation` be split into smaller, more focused modules?**
  _Cohesion score 0.05691985532076908 - nodes in this community are weakly interconnected._
- **Should `Spawning, traffic, police units` be split into smaller, more focused modules?**
  _Cohesion score 0.06426332288401254 - nodes in this community are weakly interconnected._
- **Should `Vehicles, chair, interaction` be split into smaller, more focused modules?**
  _Cohesion score 0.07017543859649122 - nodes in this community are weakly interconnected._