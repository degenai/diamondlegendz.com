# Graph Report - src  (2026-09-24)

## Corpus Check
- 96 files · ~98,732 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1092 nodes · 3159 edges · 44 communities (39 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]

## God Nodes (most connected - your core abstractions)
1. `emit()` - 70 edges
2. `boot()` - 54 edges
3. `toXZ()` - 29 edges
4. `sfx()` - 28 edges
5. `floorHeightAt()` - 25 edges
6. `loadMesh()` - 24 edges
7. `buildBlockPart()` - 24 edges
8. `addBox()` - 23 edges
9. `spawnPerson()` - 20 edges
10. `updateSession()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `buildBlockPart()` --calls--> `W`  [INFERRED]
  world/block.js → watch.js
- `createStage()` --calls--> `loadMesh()`  [EXTRACTED]
  massage/stage.js → assets.js
- `pivotLines()` --calls--> `pack()`  [INFERRED]
  pivot-lines.js → entities/hostile.js
- `ensureChair()` --calls--> `loadMesh()`  [EXTRACTED]
  entities/chair.js → assets.js
- `createCop()` --calls--> `loadMesh()`  [EXTRACTED]
  entities/cop.js → assets.js

## Import Cycles
- None detected.

## Communities (44 total, 5 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (89): BACK_MOUNT, chairState(), chairWorldPos(), ensureChair(), findChair(), loadChair(), mount(), pickUpChair() (+81 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (90): disposeCop(), addEntity(), removeEntity(), lineOfSight(), clearDriverRig(), ai(), BEND_AT, brake() (+82 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (72): gaugeState(), setCoach(), setRing(), CLIENTS, createDialogue(), DANA, giftLine(), MARCUS (+64 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (55): initBubbles(), _c, _d, el(), initCompass(), marks, place(), updateCompass() (+47 more)

### Community 4 - "Community 4"
Cohesion: 0.13
Nodes (45): $(), bestEscapeNote(), chairStory(), diffRuns(), endWord(), lineKey(), linesHeard(), linesSection() (+37 more)

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (38): build(), buildNode(), cache, loadMesh(), material(), template(), addCollider(), bounds() (+30 more)

### Community 6 - "Community 6"
Cohesion: 0.06
Nodes (36): ARM_REST, coloursFor(), DOWN, _e, ELBOW, HAIRS, HIP_JOINT, KNEE (+28 more)

### Community 7 - "Community 7"
Cohesion: 0.11
Nodes (31): preload(), audioFrame(), audioInternals(), speechHud(), resetGun(), updateAll(), startPalm(), wearPerks() (+23 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (28): makeVoice(), BANK, hashRng(), addS(), ANTI, DICT, DIGITS, DIGRAPHS (+20 more)

### Community 9 - "Community 9"
Cohesion: 0.14
Nodes (26): CONSOLATIONS, DEFAULTS, gunLevel(), has(), load(), perks(), recordRun(), save() (+18 more)

### Community 10 - "Community 10"
Cohesion: 0.15
Nodes (27): addCyl(), addGeo(), buildBlockPart(), escapeMarker(), offsetCollider(), shuffle(), bollards(), buildAlley() (+19 more)

### Community 11 - "Community 11"
Cohesion: 0.16
Nodes (25): clearBubbles(), disposeGoon(), _a, arrive(), beginRun(), dropBoss(), hideSkip(), pivotCamera() (+17 more)

### Community 12 - "Community 12"
Cohesion: 0.10
Nodes (22): disposePed(), addCast(), CAM_LOOK, CAM_POS, createStage(), _l, _q, _r (+14 more)

### Community 13 - "Community 13"
Cohesion: 0.08
Nodes (16): buttons, buttonsBuf, clickedEdge, GAME_KEYS, held, isEditable(), keysBuf, lockListeners (+8 more)

### Community 14 - "Community 14"
Cohesion: 0.18
Nodes (23): animate(), approach(), _c, _circ, _circA, collideNpc(), collidePlayer(), collideStatic() (+15 more)

### Community 15 - "Community 15"
Cohesion: 0.17
Nodes (21): getUp(), LINES, onPalm(), onVehicleHit(), SPEED, updateCop(), walkAway(), onPalm() (+13 more)

### Community 16 - "Community 16"
Cohesion: 0.15
Nodes (21): FEEL, pushVehicles(), seek(), separate(), stepBody(), wrap(), _a, around() (+13 more)

### Community 17 - "Community 17"
Cohesion: 0.15
Nodes (19): AWNINGS, _c, GLASS, _m, _p, PALETTE, planAlleys(), planLots() (+11 more)

### Community 18 - "Community 18"
Cohesion: 0.13
Nodes (17): applyVolume(), engines, ensureAudio(), initAudio(), _on, readVolume(), setVolume(), _siren (+9 more)

### Community 19 - "Community 19"
Cohesion: 0.25
Nodes (18): addBox(), addSlab(), buildCentre(), buildGreen(), buildParking(), buildSquare(), aabb(), addSpur() (+10 more)

### Community 20 - "Community 20"
Cohesion: 0.19
Nodes (17): makeRng(), batchMaterial(), buildBatch(), plazaLink(), CENTRES, blockSeed(), buildBackdrop(), buildDistrict() (+9 more)

### Community 21 - "Community 21"
Cohesion: 0.19
Nodes (18): activeBubbles(), anchorOf(), bubbles, busy(), drop(), enqueue(), eta(), inScene() (+10 more)

### Community 22 - "Community 22"
Cohesion: 0.25
Nodes (16): chase(), getUp(), grabbing(), goHome(), _home, vanHome(), lost(), perceive() (+8 more)

### Community 23 - "Community 23"
Cohesion: 0.18
Nodes (16): blendLook(), poseGun(), applyShake(), updateHealth(), poseArms(), _camColliders, _camDesired, cameraColliders() (+8 more)

### Community 24 - "Community 24"
Cohesion: 0.29
Nodes (16): navInfo(), createPed(), addPed(), blockPoints(), BUSY, key(), movable(), note() (+8 more)

### Community 25 - "Community 25"
Cohesion: 0.20
Nodes (15): burst(), _from, initJuice(), juiceCamera(), juiceTick(), preTick(), resetJuice(), _to (+7 more)

### Community 26 - "Community 26"
Cohesion: 0.17
Nodes (15): _cand, circleVsAabb(), cylHit(), overlapsFootprint(), pushCircle(), pushOf(), _qa, _qb (+7 more)

### Community 27 - "Community 27"
Cohesion: 0.21
Nodes (13): createCop(), createGoon(), createNpc(), _a, _b, BOSS_SUIT, _m, _q (+5 more)

### Community 28 - "Community 28"
Cohesion: 0.32
Nodes (12): box(), cyl(), geo(), geoCache, groupFromParts(), makeBench(), makeChair(), makeFoodCart() (+4 more)

### Community 29 - "Community 29"
Cohesion: 0.20
Nodes (7): BASS, createAudio(), instances, PENTA, createSfx(), TYPE_PITCH, SLOW

### Community 30 - "Community 30"
Cohesion: 0.21
Nodes (11): addGlow(), alleyLamps(), _e, _g, _m, mesh(), _p, _q (+3 more)

### Community 31 - "Community 31"
Cohesion: 0.20
Nodes (11): addRing(), _c, _e, flat(), flatCache, _m, _p, _q (+3 more)

### Community 32 - "Community 32"
Cohesion: 0.31
Nodes (10): checkEscape(), endRun(), hasChair(), inZone(), leaveOff(), pulse(), RED, resetEscapeMarker() (+2 more)

### Community 33 - "Community 33"
Cohesion: 0.24
Nodes (8): _blend, clampHit(), _desired, _look, _one, _pivot, updateChaseCamera(), wrapAngle()

### Community 34 - "Community 34"
Cohesion: 0.31
Nodes (9): OUTFIT, driverKind(), poseSeated(), seatRig(), spawnDriver(), syncDriverRig(), pivotPose(), standClient() (+1 more)

### Community 35 - "Community 35"
Cohesion: 0.33
Nodes (9): AWNINGS, buildFurniture(), footprint(), LEAF, shuffle(), treeMeshes(), benchParts(), cartParts() (+1 more)

### Community 36 - "Community 36"
Cohesion: 0.43
Nodes (7): heard(), clock(), el(), hideSummary(), OUTCOME, showSummary(), usd()

### Community 37 - "Community 37"
Cohesion: 0.36
Nodes (7): _fwd, moveOnFoot(), _right, tickStamina(), _wish, wrapAngle(), setStamina()

### Community 38 - "Community 38"
Cohesion: 0.40
Nodes (6): placeHands(), poseTherapist(), aimAt(), poseKneeling(), poseReaching(), reach()

## Knowledge Gaps
- **237 isolated node(s):** `cache`, `TYPE_PITCH`, `engines`, `sirens`, `_on` (+232 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `emit()` connect `Community 0` to `Community 32`, `Community 1`, `Community 2`, `Community 36`, `Community 7`, `Community 11`, `Community 14`, `Community 15`, `Community 18`, `Community 21`, `Community 22`, `Community 23`, `Community 24`?**
  _High betweenness centrality (0.086) - this node is a cross-community bridge._
- **Why does `toXZ()` connect `Community 10` to `Community 1`, `Community 35`, `Community 5`, `Community 17`, `Community 19`, `Community 20`, `Community 30`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `sfx()` connect `Community 0` to `Community 1`, `Community 2`, `Community 7`, `Community 14`, `Community 22`, `Community 25`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **What connects `cache`, `TYPE_PITCH`, `engines` to the rest of the system?**
  _237 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05591147350029121 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06178217821782178 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.055364314400458976 - nodes in this community are weakly interconnected._