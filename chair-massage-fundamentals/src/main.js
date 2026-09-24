// Boot, state machine wiring, fixed-step game loop. Owns Scene and Renderer.
import * as THREE from '../vendor/three.module.js';
import { STATES, setState, getState, onEnter, onExit } from './state.js';
import * as input from './input.js';
import { makeRng, hashSeed } from './rng.js';
import { buildDistrict } from './world/district.js';
import { initParked, updateParked } from './world/parked.js';
import { preload } from './assets.js';
import * as meta from './meta.js';
import { createPlayer } from './entities/player.js';
import { wearPerks } from './entities/player-actions.js';
import { addEntity, updateAll } from './entities/index.js';
import * as hud from './hud.js';
import * as massage from './massage/index.js';
import { spawnVehicles } from './world/cars.js';
import { ensureChair, resetChair } from './entities/chair.js';
import { runHudText, exitVehicle } from './entities/interact.js';
import { createWanted } from './run/wanted.js';
import * as spawner from './run/spawner.js';
import { createMini, updateMini } from './run/minimassage.js';
import { startPalm, startCharge, cancelCharge } from './entities/palm.js';
import { resetGun } from './entities/gun.js';
import * as pivot from './pivot.js';
import { speechHud, updateBubbles, clearBubbles, activeBubbles } from './bubbles.js';
import { checkEscape, leaveHold, resetEscapeMarker } from './run/end.js';
import { startSlowmo, tickSlowmo, clearSlowmo, slowmoLog, NEUTRAL } from './run/slowmo.js';
import { startStats, trackStats, showSummary, hideSummary } from './run/summary.js';
import { initAudio, audioFrame, audioInternals } from './audio-wire.js';
import { initTitle } from './title.js';
import { initEvents, emit } from './events.js';
import { VERSION } from './version.js';
import { initJuice, juiceTick, juiceCamera, preTick, frozen, tickFrozen, resetJuice, clearHitStop } from './juice.js';

const STEP = 1 / 60;
const MAX_ACCUM = 0.25; // cap to avoid spiral of death after a stall
const END = [STATES.ARREST, STATES.DEATH, STATES.ESCAPE];

function boot() {
  const canvas = document.getElementById('game');
  const hudRoot = document.getElementById('hud');
  hud.initHud(hudRoot);
  initTitle();                      // course catalog, phone card on touch-only devices

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch (err) {
    console.warn('[CMF] WebGL unavailable', err);
    hud.setStatus('WebGL is not available in this browser.');
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 400);
  camera.position.set(0, 3, -8);
  camera.lookAt(0, 1, 0);

  // Run seed: ?seed=<number or text> pins it (debug / sharing); otherwise the clock.
  const seedParam = new URLSearchParams(window.location.search).get('seed');
  const seed = seedParam === null ? hashSeed(String(Date.now()))
    : /^\d+$/.test(seedParam) ? Number(seedParam) >>> 0 : hashSeed(seedParam);
  const rng = makeRng(seed);
  const world = buildDistrict(seed, scene);
  world.ready = initParked(world);   // parked-car proxies; sedans near the player go live (parked.js)

  // Late-afternoon lighting, nudged per seed by the block (world.sun). No shadow maps.
  const sunInfo = world.sun;
  scene.background = new THREE.Color(sunInfo.sky);
  scene.fog = new THREE.Fog(sunInfo.sky, sunInfo.fogNear, sunInfo.fogFar);
  camera.far = sunInfo.fogFar + 2; camera.updateProjectionMatrix(); // past the fog it is all sky colour
  scene.add(new THREE.HemisphereLight(sunInfo.hemiSky, sunInfo.ground, sunInfo.hemi));
  const sun = new THREE.DirectionalLight(sunInfo.color, sunInfo.intensity);
  sun.position.copy(sunInfo.dir).multiplyScalar(120);
  sun.castShadow = false;
  scene.add(sun);

  // Baked meshes: the chair is placed by the massage module at world.chairSpot.
  preload(['assets/chair.json', 'assets/massagegun.json']).catch((err) => console.warn('[CMF] preload failed', err));

  const entities = [];
  const player = addEntity(entities, createPlayer(scene, new THREE.Vector3(0, 0, 3)));
  // Parked sedans become drivable once their meshes load; cart, van and cop car join them.
  world.ready.then(() => spawnVehicles(world, world.root, entities));

  input.initInput(canvas);
  input.onLockChangeListener((locked) => {
    hud.setCrosshair(locked);
    updateHint();
  });

  const ctx = {
    world, entities, player, input: null, rng,
    wanted: createWanted(), hud: null, audio: null, voice: null, time: 0, timeScale: 1,
    npcs: [], mini: createMini(), runCash: 0, runEnd: null,
    perf: { last: 0, max: 0, sum: 0, n: 0 },
    camera, scene, seed,
    meta: meta.load(),
    massageTotals: { you: 0, host: 0 },
    station: null, perks: null, runStats: null, lastSummary: null,
  };
  ctx.perks = meta.perks(ctx.meta);
  wearPerks(player, ctx.perks);     // the loaner scrubs from the first spawn
  initEvents(ctx);                  // the run watcher's event bus (watch.html)
  initAudio(ctx, hudRoot);          // before the state wiring: its MASSAGE hook hushes the voice first
  initJuice(ctx);
  ctx.hud = speechHud(ctx, hud);    // goons, cops and mini-massage clients talk in bubbles
  spawner.initSpawner(ctx);

  let interactHint = '';
  function updateHint() {
    if (getState() === STATES.RUN && !input.isLocked()) {
      const gun = ctx.perks.gun >= 0 ? (player.gunEquipped ? ' Right click massage gun, Q palm.' : ' Q massage gun.') : '';
      const base = player.vehicle
        ? 'Click to look around. W/S drive, A/D steer, Space handbrake, E exit. Esc releases mouse.'
        : `Click to look around. WASD move, Shift sprint, Space jump, Tap left click: quick palm. Hold left click: HEALING PALM (treats).${gun} Esc releases mouse.`;
      hud.setHint(interactHint ? `${interactHint}  |  ${base}` : base);
    } else {
      hud.setHint(getState() === STATES.RUN ? interactHint : '');
    }
  }
  function updateRunHud() {
    hud.setWanted(ctx.wanted.level, ctx.wanted.risingT > 0);
    hud.setHealth(player.hp);
    hud.setCash((ctx.massageTotals ? ctx.massageTotals.you : 0) + (ctx.runCash || 0));
    hud.setBattery(ctx.perks.gun >= 0 ? player.battery ?? 100 : null);
    const t = runHudText(player, ctx);
    hud.setVehicleLine(t.vehicle);
    hud.setChairStrip(t.chair);
    const escLine = checkEscape(ctx);
    hud.setHeatLine(escLine, leaveHold(ctx));
    interactHint = t.hint;
    updateHint();
  }

  // --- state wiring ---
  onEnter(STATES.TITLE, () => { hud.showTitle(); input.releaseLock(); });
  onExit(STATES.TITLE, () => hud.hideTitle());
  onEnter(STATES.MASSAGE, () => {
    ctx.perks = meta.perks(ctx.meta); // a consolation won last run dresses the therapist now (stage.addCast)
    // Everything the last run created goes: NPCs (pivot goons included), police, the van's trip.
    if (player.vehicle) exitVehicle(player, ctx);
    player.knockedT = 0; player.massaging = false; player.palmT = 0; player.chargeT = -1; player.lungeT = 0; player.holdPalm = false; player.hp = 100; player.foldT = 0;
    spawner.clear(ctx);
    spawner.resetVan(ctx);
    pivot.reset();
    clearBubbles(); clearSlowmo(ctx); hideSummary(); resetEscapeMarker(ctx); resetJuice(ctx);
    hud.showRunHud(false);
    ctx.mini = createMini();
    ctx.wanted.reset();
    ctx.runEnd = null; ctx.runStats = null;
  });
  onEnter(STATES.MASSAGE, () => massage.enter(ctx));
  onEnter(STATES.MASSAGE, () => resetChair(ctx)); // after enter: the station exists by now
  onEnter(STATES.MASSAGE, () => emit('massage', { roster: massage.debugState().clientCount }));
  onExit(STATES.MASSAGE, (next) => massage.exit(ctx, next));
  onEnter(STATES.PIVOT, () => pivot.start(ctx));
  // Any way out of the cutscene other than the run restores the van's steering and clears the cast.
  onExit(STATES.PIVOT, (next) => { if (next !== STATES.RUN) pivot.reset(); });
  onEnter(STATES.RUN, (prev) => {
    clearHitStop(); // no hit-stop or shake carried in from a previous state
    // The lie is only spent once the player actually reaches the run.
    if (prev === STATES.PIVOT && !ctx.meta.firstPivotSeen) {
      ctx.meta.firstPivotSeen = true;
      meta.save(ctx.meta);
    }
    ensureChair(ctx);
    ctx.mini = createMini();
    ctx.perks = meta.perks(ctx.meta);
    wearPerks(player, ctx.perks);
    ctx.timeScale = 1;
    resetGun(player);
    if (prev === STATES.PIVOT) pivot.beginRun(ctx); else hud.setRunTitle(true);
    spawner.begin(ctx, prev === STATES.PIVOT);
    startStats(ctx);
    emit('run.start', { seed: ctx.seed, build: VERSION, unlocks: [...ctx.meta.unlocks], perks: { ...ctx.perks }, cash: ctx.massageTotals ? ctx.massageTotals.you : 0, fromPivot: prev === STATES.PIVOT });
    hud.showRunHud(true); updateHint();
  });
  onExit(STATES.RUN, () => {
    input.releaseLock(); hud.setHint(''); hud.setRunTitle(false);
    hud.setVehicleLine(''); hud.setChairStrip(''); hud.setMini(null); hud.setHeatLine('');
  });
  // Run end: slow motion and a stamp (run/slowmo.js), then the certificate (run/summary.js).
  for (const s of END) {
    onEnter(s, () => {
      // Debug entry without a runEnd: an ESCAPE that nobody verified cannot know the chair came along.
      if (!ctx.runEnd) ctx.runEnd = { reason: s === STATES.ARREST ? 'arrest' : s === STATES.DEATH ? 'death' : 'left', time: ctx.time };
      player.massaging = false; player.foldT = 0; // a fold in progress must not finish under the slow motion
      // Nor a palm: the end states still tick the player with neutral input (button up), which would
      // turn a charge into a quick palm, or finish a wind-up or a lunge, under the stamp.
      cancelCharge(player, 'runend'); player.palmT = 0; player.lungeT = 0; player.holdPalm = false;
      resetEscapeMarker(ctx);
      startSlowmo(ctx, ctx.runEnd.reason);
    });
    onExit(s, () => { hud.showRunHud(false); ctx.timeScale = 1; });
  }
  onEnter(STATES.SUMMARY, () => {
    hud.hideStamp();
    showSummary(ctx, hudRoot, () => setState(STATES.MASSAGE));
  });
  onExit(STATES.SUMMARY, () => hideSummary());

  const beginBtn = document.getElementById('begin');
  if (beginBtn) {
    beginBtn.addEventListener('click', () => {
      // MASSAGE uses the absolute mouse; pointer lock waits for RUN (next canvas click).
      beginBtn.blur();
      setState(STATES.MASSAGE);
    });
  }

  function onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', onResize);

  window.CMF = {
    scene, camera, entities, player, world, renderer,
    state: { get current() { return getState(); }, STATES },
    input, setState, ctx,
    get massage() { return massage.debugState(); },
    massageTuning: massage.tuning,
    get meta() { return ctx.meta; },
    get vehicles() { return world.vehicles || []; },
    get chairState() { return world.chairState; },
    get npcs() { return ctx.npcs; }, get traffic() { return ctx.traffic; },
    get wanted() { return ctx.wanted; },
    get audio() { return audioInternals(); },
    juice: ctx.juice,
    spawner,
    pivot: { get state() { return pivot.pivotState(); } },
    bubbles: activeBubbles,
    slowmoLog,
    debug: { palm: () => startPalm(player), charge: () => startCharge(player), finishClient: massage.debugComplete },
  };

  setState(STATES.TITLE);

  // --- loop ---
  let last = performance.now();
  let accum = 0;
  let fpsFrames = 0, fpsTime = 0, fps = 0;

  function tick(realDt) {
    const s = getState();
    if (s === STATES.RUN && frozen()) { tickFrozen(realDt); return; } // hit-stop: the sim holds, the render goes on
    const dt = realDt * (ctx.timeScale || 1);  // 0.25 under the run-end slow motion
    ctx.time += dt;
    ctx.input = input.snapshot();
    if (s === STATES.RUN) {
      const t0 = performance.now();
      updateAll(dt, ctx);
      juiceTick(dt, ctx);
      const ms = performance.now() - t0;
      const P = ctx.perf;
      P.last = ms; P.max = Math.max(P.max, ms); P.sum += ms; P.n++;
      if (getState() !== STATES.RUN) return;
      spawner.update(dt, ctx);
      if (getState() !== STATES.RUN) return;
      updateMini(dt, ctx);
      trackStats(ctx);
      pivot.runTick(dt, ctx);
      hud.updateFloaters(dt, camera); hud.updateCompass(ctx);
      updateRunHud();
    } else if (s === STATES.MASSAGE) {
      massage.update(dt, ctx);
    } else if (END.includes(s)) {
      ctx.input = NEUTRAL;                     // input ignored under the slow motion
      updateAll(dt, ctx);
      juiceTick(dt, ctx);
      spawner.update(dt, ctx);
      massage.updateLeaving(dt, ctx);
      hud.updateFloaters(dt, camera);
      if (tickSlowmo(realDt, ctx)) setState(STATES.SUMMARY);
    } else if (s === STATES.PIVOT) {
      pivot.update(dt, ctx);
    }
    updateParked(ctx, dt);
    updateBubbles(dt, camera);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    let elapsed = (now - last) / 1000;
    last = now;
    if (elapsed < 0) elapsed = 0;
    accum = Math.min(accum + elapsed, MAX_ACCUM);
    preTick(ctx);                             // take the last shake offset out before anything moves
    while (accum >= STEP) {
      tick(STEP);
      accum -= STEP;
    }

    fpsFrames++;
    fpsTime += elapsed;
    if (fpsTime >= 0.5) { fps = Math.round(fpsFrames / fpsTime); fpsFrames = 0; fpsTime = 0; }
    hud.setStatus(`${getState()}  ${fps} fps`);
    juiceCamera(ctx, elapsed, getState() === STATES.RUN);
    audioFrame(ctx, elapsed);

    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
}

boot();
