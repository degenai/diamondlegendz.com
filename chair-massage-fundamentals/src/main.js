// Boot, state machine wiring, fixed-step game loop. Owns Scene and Renderer.
import * as THREE from '../vendor/three.module.js';
import { STATES, setState, getState } from './state.js';
import * as input from './input.js';
import { makeRng, hashSeed, seedStreams } from './rng.js';
import { buildDistrict } from './world/district.js';
import { initParked, updateParked } from './world/parked.js';
import { preload, preloadAll } from './assets.js';
import * as meta from './meta.js';
import { createPlayer } from './entities/player.js';
import { wearPerks } from './entities/player-actions.js';
import { addEntity, updateAll } from './entities/index.js';
import * as hud from './hud.js';
import * as massage from './massage/index.js';
import { spawnVehicles } from './world/cars.js';
import { runHudText } from './entities/interact.js';
import { createWanted } from './run/wanted.js';
import * as spawner from './run/spawner.js';
import { createMini, updateMini } from './run/minimassage.js';
import { startPalm, startCharge } from './entities/palm.js';
import * as pivot from './pivot.js';
import { speechHud, updateBubbles, activeBubbles } from './bubbles.js';
import { checkEscape, leaveHold } from './run/end.js';
import { tickSlowmo, slowmoLog, NEUTRAL } from './run/slowmo.js';
import { trackStats } from './run/summary.js';
import { initAudio, audioFrame, audioInternals } from './audio-wire.js';
import { initTitle } from './title.js';
import { initEvents, setSink, setWhy } from './events.js';
import { initSession, recordEvent, recordInput, sessionTick, whyOf } from './session-log.js';
import { initJuice, juiceTick, juiceCamera, preTick, frozen, tickFrozen } from './juice.js';
import { wireStates, END } from './wiring.js';
import { createAgent } from './agent.js';

const STEP = 1 / 60;
const MAX_ACCUM = 0.25; // cap to avoid spiral of death after a stall
// Jev milestone 1: ?norender skips the camera juice, audio and draw; ?agent (implied by ?norender)
// boots paused for CMF.agent.step and preloads every mesh before tick 0 (agent.js).
const QS = new URLSearchParams(window.location.search);
const NORENDER = QS.has('norender'), AGENT = NORENDER || QS.has('agent');

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
  seedStreams(seed);                // the NPC streams (rng.js stream()): a replay repeats them
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
  const meshes = AGENT ? preloadAll() : preload(['assets/chair.json', 'assets/massagegun.json']);
  meshes.catch((err) => console.warn('[CMF] preload failed', err));

  const entities = [];
  const player = addEntity(entities, createPlayer(scene, new THREE.Vector3(0, 0, 3)));
  // Parked sedans become drivable once their meshes load; cart, van and cop car join them.
  // A stepped run waits for every mesh first: the cart, van and cop car then take their entity ids in
  // code order, not in the order their fetches happen to finish (a replay saw v2 and v3 swap).
  const vehiclesReady = (AGENT ? Promise.all([world.ready, meshes]) : world.ready).then(() => spawnVehicles(world, world.root, entities));

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
    camera, scene, seed, tick: 0,     // tick: fixed steps since boot (events, snapshots, the agent)
    meta: meta.load(),
    massageTotals: { you: 0, host: 0 },
    station: null, perks: null, runStats: null, lastSummary: null,
  };
  ctx.perks = meta.perks(ctx.meta);
  wearPerks(player, ctx.perks);     // the loaner scrubs from the first spawn
  initEvents(ctx);                  // the run watcher's event bus (watch.html)
  const session = initSession(ctx, { massageState: massage.debugState, pivotState: pivot.pivotState });
  setSink(recordEvent); setWhy(whyOf); // Jev milestone 0: every event into the session log, state.why
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

  // --- state wiring (wiring.js) ---
  wireStates(ctx, player, hudRoot, updateHint);

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
    input, setState, ctx, session,
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

  // One stepped tick (agent.js): matrices settled first, so a projection in the tick (the ring, the
  // bubbles) sees this pose whether or not a frame was drawn in between; then the shake offset out.
  function stepOnce() { scene.updateMatrixWorld(); camera.updateMatrixWorld(); preTick(ctx); tick(STEP); }
  const agent = window.CMF.agent = createAgent(ctx, { stepOnce, canvas, startPaused: AGENT, state: getState, massageState: massage.debugState,
    ready: Promise.all([meshes, vehiclesReady]).then(() => new Promise((r) => setTimeout(r, 0))).then(() => ctx.tick) });

  setState(STATES.TITLE);

  // --- loop ---
  let last = performance.now();
  let accum = 0;
  let fpsFrames = 0, fpsTime = 0, fps = 0;

  function tick(realDt) {           // one fixed step: the sim, then the session log's snapshot
    ctx.tick++;
    simTick(realDt);
    sessionTick();
  }
  function simTick(realDt) {
    const s = getState();
    if (s === STATES.RUN && frozen()) { tickFrozen(realDt); return; } // hit-stop: the sim holds, the render goes on
    const dt = realDt * (ctx.timeScale ?? 1);  // 0.25 under the run-end slow motion; 0 holds the sim
    ctx.time += dt;
    ctx.input = input.snapshot();
    recordInput(ctx.input);
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
    if (agent.paused) accum = 0;              // CMF.agent.step owns the clock
    else {
      accum = Math.min(accum + elapsed, MAX_ACCUM);
      preTick(ctx);                           // take the last shake offset out before anything moves
      while (accum >= STEP) {
        agent.beforeTick();               // a macro's key releases fall due here too, not only under step()
        tick(STEP);
        accum -= STEP;
      }
    }
    if (NORENDER) return;

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
