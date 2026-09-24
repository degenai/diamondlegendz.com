# Graph Report - src  (2026-09-24)

## Corpus Check
- 98 files · ~98,930 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1095 nodes · 3173 edges · 44 communities (40 shown, 4 thin omitted)
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
1. `emit()` - 69 edges
2. `boot()` - 38 edges
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
- `pivotLines()` --calls--> `pack()`  [INFERRED]
  pivot-lines.js → entities/hostile.js
- `ensureChair()` --calls--> `loadMesh()`  [EXTRACTED]
  entities/chair.js → assets.js
- `createCop()` --calls--> `loadMesh()`  [EXTRACTED]
  entities/cop.js → assets.js
- `createGoon()` --calls--> `loadMesh()`  [EXTRACTED]
  entities/goon.js → assets.js

## Import Cycles
- None detected.

## Communities (44 total, 4 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (95): BACK_MOUNT, chairState(), chairWorldPos(), ensureChair(), findChair(), loadChair(), mount(), pickUpChair() (+87 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (88): preload(), disposeCop(), addEntity(), removeEntity(), disposePed(), clearDriverRig(), ai(), BEND_AT (+80 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (71): gaugeState(), setCoach(), setRing(), DANA, giftLine(), MARCUS, PRIYA, PRIYA_LINES (+63 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (65): clearBubbles(), createCop(), createGoon(), disposeGoon(), createNpc(), CONSOLATIONS, DEFAULTS, gunLevel() (+57 more)

### Community 4 - "Community 4"
Cohesion: 0.05
Nodes (55): initBubbles(), _c, _d, el(), initCompass(), marks, place(), updateCompass() (+47 more)

### Community 5 - "Community 5"
Cohesion: 0.13
Nodes (45): $(), bestEscapeNote(), chairStory(), diffRuns(), endWord(), lineKey(), linesHeard(), linesSection() (+37 more)

### Community 6 - "Community 6"
Cohesion: 0.06
Nodes (36): ARM_REST, coloursFor(), DOWN, _e, ELBOW, HAIRS, HIP_JOINT, KNEE (+28 more)

### Community 7 - "Community 7"
Cohesion: 0.09
Nodes (27): BANK, hashRng(), addS(), ANTI, DICT, DIGITS, DIGRAPHS, DUR (+19 more)

### Community 8 - "Community 8"
Cohesion: 0.10
Nodes (19): BASS, createAudio(), instances, PENTA, createSfx(), TYPE_PITCH, SLOW, applyVolume() (+11 more)

### Community 9 - "Community 9"
Cohesion: 0.10
Nodes (22): addCast(), CAM_LOOK, CAM_POS, _l, pivotPose(), _q, _r, releaseCast() (+14 more)

### Community 10 - "Community 10"
Cohesion: 0.16
Nodes (24): makeRng(), buildBatch(), createBatch(), buildBlockPart(), escapeMarker(), offsetCollider(), plazaLink(), shuffle() (+16 more)

### Community 11 - "Community 11"
Cohesion: 0.12
Nodes (23): heard(), _back, clearSlowmo(), NEUTRAL, slowmoLog(), STAMPS, startSlowmo(), TILT (+15 more)

### Community 12 - "Community 12"
Cohesion: 0.08
Nodes (16): buttons, buttonsBuf, clickedEdge, GAME_KEYS, held, isEditable(), keysBuf, lockListeners (+8 more)

### Community 13 - "Community 13"
Cohesion: 0.15
Nodes (23): audioFrame(), audioInternals(), speechHud(), updateAll(), startCharge(), startPalm(), wearPerks(), createPlayer() (+15 more)

### Community 14 - "Community 14"
Cohesion: 0.11
Nodes (24): addCyl(), addGeo(), addRing(), batchMaterial(), _c, _e, flat(), flatCache (+16 more)

### Community 15 - "Community 15"
Cohesion: 0.15
Nodes (21): FEEL, pushVehicles(), seek(), separate(), stepBody(), wrap(), _a, around() (+13 more)

### Community 16 - "Community 16"
Cohesion: 0.25
Nodes (18): addBox(), addSlab(), buildCentre(), buildGreen(), buildParking(), buildSquare(), aabb(), addSpur() (+10 more)

### Community 17 - "Community 17"
Cohesion: 0.23
Nodes (18): chase(), getUp(), grabbing(), goHome(), _home, vanHome(), lost(), onPalm() (+10 more)

### Community 18 - "Community 18"
Cohesion: 0.19
Nodes (18): activeBubbles(), anchorOf(), bubbles, busy(), drop(), enqueue(), eta(), inScene() (+10 more)

### Community 19 - "Community 19"
Cohesion: 0.17
Nodes (18): blendLook(), applyShake(), updateHealth(), gunTick(), palmInput(), poseArms(), _camColliders, _camDesired (+10 more)

### Community 20 - "Community 20"
Cohesion: 0.16
Nodes (18): AWNINGS, bollards(), buildAlley(), buildBuildings(), _c, GLASS, _m, _p (+10 more)

### Community 21 - "Community 21"
Cohesion: 0.27
Nodes (17): navInfo(), createPed(), addPed(), blockPoints(), BUSY, key(), movable(), note() (+9 more)

### Community 22 - "Community 22"
Cohesion: 0.23
Nodes (15): alertPack(), copHostile(), hostile(), PERCEIVE, callClient(), cancel(), heatOnSpot(), kneel() (+7 more)

### Community 23 - "Community 23"
Cohesion: 0.21
Nodes (13): burst(), clearHitStop(), _from, juiceTick(), resetJuice(), _to, burst(), clearParticles() (+5 more)

### Community 24 - "Community 24"
Cohesion: 0.18
Nodes (13): _cand, circleVsAabb(), cylHit(), pushCircle(), pushOf(), _qa, _qb, _qc (+5 more)

### Community 25 - "Community 25"
Cohesion: 0.27
Nodes (14): bodyCache, CAR_COLOURS, carCollider(), cartSpot(), clearPassCar(), copSpot(), footprintFree(), passSpot() (+6 more)

### Community 26 - "Community 26"
Cohesion: 0.19
Nodes (13): placeVehicle(), recolourBody(), goLive(), goProxy(), _m, _p, pristine(), _q (+5 more)

### Community 27 - "Community 27"
Cohesion: 0.24
Nodes (12): build(), buildNode(), cache, loadMesh(), material(), template(), driverKind(), poseSeated() (+4 more)

### Community 28 - "Community 28"
Cohesion: 0.32
Nodes (12): box(), cyl(), geo(), geoCache, groupFromParts(), makeBench(), makeChair(), makeFoodCart() (+4 more)

### Community 29 - "Community 29"
Cohesion: 0.21
Nodes (11): getUp(), LINES, onPalm(), onVehicleHit(), OUTFIT, SPEED, updateCop(), walkAway() (+3 more)

### Community 30 - "Community 30"
Cohesion: 0.35
Nodes (9): cull(), poseRig(), nearestNav(), awayFrom(), getUp(), onPalm(), pickNext(), updatePed() (+1 more)

### Community 31 - "Community 31"
Cohesion: 0.31
Nodes (10): checkEscape(), endRun(), hasChair(), inZone(), leaveOff(), pulse(), RED, resetEscapeMarker() (+2 more)

### Community 32 - "Community 32"
Cohesion: 0.22
Nodes (10): addGlow(), alleyLamps(), _e, _g, _m, mesh(), _p, _q (+2 more)

### Community 33 - "Community 33"
Cohesion: 0.24
Nodes (8): _blend, clampHit(), _desired, _look, _one, _pivot, updateChaseCamera(), wrapAngle()

### Community 34 - "Community 34"
Cohesion: 0.33
Nodes (9): AWNINGS, buildFurniture(), footprint(), LEAF, shuffle(), treeMeshes(), benchParts(), cartParts() (+1 more)

### Community 35 - "Community 35"
Cohesion: 0.47
Nodes (7): EDGES, SIDE, sideBox(), cutGaps(), gapAt(), buildStreets(), sideSlab()

### Community 36 - "Community 36"
Cohesion: 0.33
Nodes (8): _fwd, moveOnFoot(), _right, tickStamina(), _wish, wrapAngle(), setStamina(), supportHeight()

### Community 37 - "Community 37"
Cohesion: 0.53
Nodes (8): addCollider(), bounds(), build(), gridOf(), insert(), query(), removeCollider(), span()

### Community 38 - "Community 38"
Cohesion: 0.50
Nodes (6): lineOfSight(), add(), note(), report(), setLevel(), updateWanted()

### Community 39 - "Community 39"
Cohesion: 0.40
Nodes (6): placeHands(), seatClient(), aimAt(), poseKneeling(), poseReaching(), reach()

## Knowledge Gaps
- **235 isolated node(s):** `cache`, `TYPE_PITCH`, `engines`, `sirens`, `_on` (+230 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `emit()` connect `Community 0` to `Community 1`, `Community 2`, `Community 3`, `Community 38`, `Community 11`, `Community 13`, `Community 17`, `Community 18`, `Community 19`, `Community 21`, `Community 22`, `Community 29`, `Community 31`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Why does `toXZ()` connect `Community 25` to `Community 32`, `Community 1`, `Community 34`, `Community 35`, `Community 10`, `Community 14`, `Community 16`, `Community 20`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Why does `sfx()` connect `Community 0` to `Community 1`, `Community 2`, `Community 11`, `Community 17`, `Community 22`, `Community 23`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `cache`, `TYPE_PITCH`, `engines` to the rest of the system?**
  _235 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05347871235721703 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.0626674912389198 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.055651176133103844 - nodes in this community are weakly interconnected._