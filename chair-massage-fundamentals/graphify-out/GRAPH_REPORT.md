# Graph Report - src  (2026-09-24)

## Corpus Check
- 81 files · ~89,428 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1018 nodes · 2835 edges · 42 communities (38 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.8)
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

## God Nodes (most connected - your core abstractions)
1. `emit()` - 57 edges
2. `boot()` - 52 edges
3. `toXZ()` - 26 edges
4. `floorHeightAt()` - 25 edges
5. `loadMesh()` - 24 edges
6. `sfx()` - 24 edges
7. `buildBlockPart()` - 22 edges
8. `addBox()` - 20 edges
9. `spawnPerson()` - 20 edges
10. `updatePlayer()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `createStage()` --calls--> `loadMesh()`  [EXTRACTED]
  massage/stage.js → assets.js
- `pivotLines()` --calls--> `pack()`  [INFERRED]
  pivot-lines.js → entities/goon.js
- `segmentHit()` --calls--> `skip()`  [INFERRED]
  physics.js → pivot.js
- `buildBlockPart()` --calls--> `W`  [INFERRED]
  world/block.js → watch.js
- `ensureChair()` --calls--> `loadMesh()`  [EXTRACTED]
  entities/chair.js → assets.js

## Import Cycles
- 4-file cycle: `entities/goon.js -> entities/palm.js -> entities/interact.js -> run/minimassage.js -> entities/goon.js`

## Communities (42 total, 4 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (97): build(), buildNode(), cache, loadMesh(), material(), preload(), template(), copHostile() (+89 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (78): getUp(), LINES, onPalm(), onVehicleHit(), SPEED, updateCop(), walkAway(), alertPack() (+70 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (65): gaugeState(), setRing(), CLIENTS, createDialogue(), GET_WELL, MODALITIES, OUCH, RETURN (+57 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (56): initBubbles(), chairWorldPos(), _c, _d, el(), initCompass(), marks, place() (+48 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (54): clearBubbles(), createCop(), createNpc(), _a, beginRun(), _a, _b, BOSS_SUIT (+46 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (46): _blend, blendLook(), clampHit(), _desired, _look, _one, _pivot, updateChaseCamera() (+38 more)

### Community 6 - "Community 6"
Cohesion: 0.15
Nodes (36): $(), bestEscapeNote(), CAUSE, chairStory(), clock(), diffRuns(), END_STATE, ENDING (+28 more)

### Community 7 - "Community 7"
Cohesion: 0.09
Nodes (27): BANK, hashRng(), addS(), ANTI, DICT, DIGITS, DIGRAPHS, DUR (+19 more)

### Community 8 - "Community 8"
Cohesion: 0.06
Nodes (32): ARM_REST, coloursFor(), DOWN, _e, ELBOW, HAIRS, HIP_JOINT, KNEE (+24 more)

### Community 9 - "Community 9"
Cohesion: 0.17
Nodes (30): BACK_MOUNT, chairState(), ensureChair(), findChair(), loadChair(), mount(), pickUpChair(), resetChair() (+22 more)

### Community 10 - "Community 10"
Cohesion: 0.12
Nodes (28): poseGun(), palmVehicles(), applyShake(), cancelCharge(), CONE_COS, startCharge(), updateHealth(), updatePalm() (+20 more)

### Community 11 - "Community 11"
Cohesion: 0.08
Nodes (16): buttons, buttonsBuf, clickedEdge, GAME_KEYS, held, isEditable(), keysBuf, lockListeners (+8 more)

### Community 12 - "Community 12"
Cohesion: 0.09
Nodes (21): CAM_LOOK, CAM_POS, createStage(), _l, pivotPose(), _q, _r, releaseCast() (+13 more)

### Community 13 - "Community 13"
Cohesion: 0.17
Nodes (19): audioInternals(), updateAll(), startPalm(), juiceCamera(), preTick(), resetJuice(), boot(), END (+11 more)

### Community 14 - "Community 14"
Cohesion: 0.17
Nodes (19): addCollider(), bounds(), build(), gridOf(), insert(), query(), removeCollider(), span() (+11 more)

### Community 15 - "Community 15"
Cohesion: 0.16
Nodes (19): burst(), clearHitStop(), crashFx(), _from, frozen(), hitStop(), initJuice(), juiceTick() (+11 more)

### Community 16 - "Community 16"
Cohesion: 0.26
Nodes (19): addBox(), addCyl(), addGeo(), addRing(), addSlab(), flat(), UNIT_BOX(), buildCentre() (+11 more)

### Community 17 - "Community 17"
Cohesion: 0.16
Nodes (15): createAudio(), applyVolume(), audioFrame(), engines, ensureAudio(), initAudio(), makeVoice(), _on (+7 more)

### Community 18 - "Community 18"
Cohesion: 0.19
Nodes (18): activeBubbles(), anchorOf(), bubbles, busy(), drop(), enqueue(), eta(), inScene() (+10 more)

### Community 19 - "Community 19"
Cohesion: 0.18
Nodes (18): AWNINGS, buildAlley(), buildBuildings(), _c, GLASS, _m, _p, PALETTE (+10 more)

### Community 20 - "Community 20"
Cohesion: 0.18
Nodes (16): CONE_COS, ensureMesh(), LOOK, RANGE, resetGun(), setLook(), shockwave(), tap() (+8 more)

### Community 21 - "Community 21"
Cohesion: 0.19
Nodes (15): createBatch(), CENTRES, blockSeed(), buildBackdrop(), buildDistrict(), linkSpurs(), mergeNav(), planSun() (+7 more)

### Community 22 - "Community 22"
Cohesion: 0.25
Nodes (13): hashSeed(), makeRng(), W, buildBlockPart(), escapeMarker(), offsetCollider(), plazaLink(), shuffle() (+5 more)

### Community 23 - "Community 23"
Cohesion: 0.28
Nodes (12): hostile(), callClient(), cancel(), heatOnSpot(), kneel(), _l, _r, release() (+4 more)

### Community 24 - "Community 24"
Cohesion: 0.28
Nodes (12): bodyCache, CAR_COLOURS, carCollider(), cartSpot(), clearPassCar(), copSpot(), footprintFree(), passSpot() (+4 more)

### Community 25 - "Community 25"
Cohesion: 0.32
Nodes (12): box(), cyl(), geo(), geoCache, groupFromParts(), makeBench(), makeChair(), makeFoodCart() (+4 more)

### Community 26 - "Community 26"
Cohesion: 0.20
Nodes (6): BASS, instances, PENTA, createSfx(), TYPE_PITCH, SLOW

### Community 27 - "Community 27"
Cohesion: 0.22
Nodes (10): addGlow(), alleyLamps(), _e, _g, _m, mesh(), _p, _q (+2 more)

### Community 28 - "Community 28"
Cohesion: 0.20
Nodes (10): batchMaterial(), buildBatch(), _c, _e, flatCache, _m, _p, _q (+2 more)

### Community 29 - "Community 29"
Cohesion: 0.31
Nodes (7): landHit(), treat(), emit(), initEvents(), load(), runsSoFar(), ram()

### Community 30 - "Community 30"
Cohesion: 0.33
Nodes (9): AWNINGS, buildFurniture(), footprint(), LEAF, shuffle(), treeMeshes(), benchParts(), cartParts() (+1 more)

### Community 31 - "Community 31"
Cohesion: 0.25
Nodes (9): createPlayer(), wearPerks(), addCast(), pivot(), placeholder(), setPersonColours(), shirtFor(), skin() (+1 more)

### Community 32 - "Community 32"
Cohesion: 0.33
Nodes (8): clock(), el(), hideSummary(), OUTCOME, showSummary(), startStats(), trackStats(), usd()

### Community 33 - "Community 33"
Cohesion: 0.50
Nodes (7): cutGaps(), EDGES, gapAt(), SIDE, sideBox(), buildStreets(), sideSlab()

### Community 34 - "Community 34"
Cohesion: 0.39
Nodes (7): checkEscape(), hasChair(), inZone(), pulse(), RED, resetEscapeMarker(), STATE_FOR

### Community 35 - "Community 35"
Cohesion: 0.46
Nodes (6): add(), createWanted(), note(), report(), setLevel(), updateWanted()

### Community 36 - "Community 36"
Cohesion: 0.32
Nodes (7): enterFns, exitFns, listFor(), onEnter(), onExit(), queue, STATES

### Community 37 - "Community 37"
Cohesion: 0.40
Nodes (6): placeHands(), poseTherapist(), aimAt(), poseKneeling(), poseReaching(), reach()

## Knowledge Gaps
- **228 isolated node(s):** `cache`, `TYPE_PITCH`, `engines`, `sirens`, `_on` (+223 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `emit()` connect `Community 29` to `Community 0`, `Community 1`, `Community 32`, `Community 35`, `Community 4`, `Community 5`, `Community 36`, `Community 2`, `Community 9`, `Community 10`, `Community 13`, `Community 20`, `Community 23`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Why does `toXZ()` connect `Community 19` to `Community 0`, `Community 33`, `Community 16`, `Community 21`, `Community 22`, `Community 24`, `Community 27`, `Community 30`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `floorHeightAt()` connect `Community 9` to `Community 0`, `Community 4`, `Community 5`, `Community 10`, `Community 14`, `Community 23`, `Community 24`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `cache`, `TYPE_PITCH`, `engines` to the rest of the system?**
  _228 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05413507317933345 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.060678962844159315 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05333333333333334 - nodes in this community are weakly interconnected._