// Boot, state machine wiring, fixed-step game loop. Owns Scene and Renderer.
import * as THREE from '../vendor/three.module.js';
import { STATES, setState, getState, onEnter, onExit } from './state.js';
import * as input from './input.js';
import { makeRng, hashSeed } from './rng.js';
import { buildBlock } from './world/block.js';
import { preload } from './assets.js';
import * as meta from './meta.js';
import { createPlayer } from './entities/player.js';
import { addEntity, updateAll } from './entities/index.js';
import * as hud from './hud.js';
import * as massage from './massage/index.js';
import { spawnVehicles } from './world/cars.js';
import { ensureChair, resetChair } from './entities/chair.js';
import { runHudText, exitVehicle } from './entities/interact.js';
import { createWanted } from './run/wanted.js';
import * as spawner from './run/spawner.js';
import { createMini, updateMini } from './run/minimassage.js';
import { startPalm } from './entities/palm.js';

const STEP = 1 / 60;
const MAX_ACCUM = 0.25; // cap to avoid spiral of death after a stall

function isMobile() {
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const fine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  return coarse && !fine;
}

function boot() {
  const canvas = document.getElementById('game');
  const hudRoot = document.getElementById('hud');
  hud.initHud(hudRoot);

  if (isMobile()) {
    const note = document.getElementById('mobile-note');
    if (note) note.hidden = false;
  }

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
  const world = buildBlock(seed, scene);

  // Late-afternoon lighting, nudged per seed by the block (world.sun). No shadow maps.
  const sunInfo = world.sun;
  scene.background = new THREE.Color(sunInfo.sky);
  scene.fog = new THREE.Fog(sunInfo.sky, sunInfo.fogNear, sunInfo.fogFar);
  scene.add(new THREE.HemisphereLight(sunInfo.hemiSky, sunInfo.ground, sunInfo.hemi));
  const sun = new THREE.DirectionalLight(sunInfo.color, sunInfo.intensity);
  sun.position.copy(sunInfo.dir).multiplyScalar(120);
  sun.castShadow = false;
  scene.add(sun);

  // Baked meshes: the chair is placed by the massage module at world.chairSpot.
  preload(['assets/chair.json']).catch((err) => console.warn('[CMF] preload failed', err));

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
    wanted: createWanted(), hud, audio: null, time: 0,
    npcs: [], mini: createMini(), runCash: 0, runEnd: null,
    perf: { last: 0, max: 0, sum: 0, n: 0 },
    camera, scene, seed,
    meta: meta.load(),
    massageTotals: { you: 0, host: 0 },
    station: null,
  };
  let pivotT = 0;
  let endT = 0;
  spawner.initSpawner(ctx);

  let interactHint = '';
  function updateHint() {
    if (getState() === STATES.RUN && !input.isLocked()) {
      const base = player.vehicle
        ? 'Click to look around. W/S drive, A/D steer, Space handbrake, E exit. Esc releases mouse.'
        : 'Click to look around. WASD move, Shift sprint, Space jump, Left click Healing Palm. Esc releases mouse.';
      hud.setHint(interactHint ? `${interactHint}  |  ${base}` : base);
    } else {
      hud.setHint(getState() === STATES.RUN ? interactHint : '');
    }
  }
  function updateRunHud() {
    hud.setWanted(ctx.wanted.level, ctx.wanted.risingT > 0);
    hud.setHealth(player.hp);
    hud.setCash((ctx.massageTotals ? ctx.massageTotals.you : 0) + (ctx.runCash || 0));
    const t = runHudText(player, ctx);
    hud.setVehicleLine(t.vehicle);
    hud.setChairStrip(t.chair);
    interactHint = t.hint;
    updateHint();
  }

  // --- state wiring ---
  onEnter(STATES.TITLE, () => { hud.showTitle(); input.releaseLock(); });
  onExit(STATES.TITLE, () => hud.hideTitle());
  onEnter(STATES.MASSAGE, () => {
    if (player.vehicle) exitVehicle(player, ctx);
    player.knockedT = 0; player.massaging = false; player.palmT = 0; player.hp = 100;
    spawner.clear(ctx);
    hud.showRunHud(false);
    ctx.mini = createMini();
    ctx.wanted.reset();
  });
  onEnter(STATES.MASSAGE, () => massage.enter(ctx));
  onEnter(STATES.MASSAGE, () => resetChair(ctx)); // after enter: the station exists by now
  onExit(STATES.MASSAGE, () => massage.exit(ctx));
  onEnter(STATES.PIVOT, () => {
    // Phase 6 replaces this stub with the scripted van cutscene.
    pivotT = 0;
    hud.showCard('SERENITY GROUP INCORPORATED would like a word.', [], 'black');
  });
  onExit(STATES.PIVOT, () => hud.hideCard());
  onEnter(STATES.RUN, (prev) => {
    // The lie is only spent once the player actually reaches the run.
    if (prev === STATES.PIVOT && !ctx.meta.firstPivotSeen) {
      ctx.meta.firstPivotSeen = true;
      meta.save(ctx.meta);
    }
    ensureChair(ctx);
    ctx.mini = createMini();
    spawner.begin(ctx);
    hud.setRunTitle(true); hud.showRunHud(true); updateHint();
  });
  onExit(STATES.RUN, () => {
    input.releaseLock(); hud.setHint(''); hud.setRunTitle(false);
    hud.setVehicleLine(''); hud.setChairStrip(''); hud.setMini(null);
  });
  // Placeholder end cards; Phase 6 replaces them with the run summary.
  const endCard = (title, line) => () => {
    endT = 0;
    player.massaging = false;
    hud.showCard(title, [line], 'black');
  };
  onEnter(STATES.ARREST, endCard('ARRESTED', 'The city sides with the franchise.'));
  onEnter(STATES.DEATH, endCard('OVERWORKED', 'Nobody pays you to take a bat for a chair.'));
  for (const s of [STATES.ARREST, STATES.DEATH]) onExit(s, () => { hud.hideCard(); hud.showRunHud(false); });

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
    get npcs() { return ctx.npcs; },
    get wanted() { return ctx.wanted; },
    spawner,
    debug: { palm: () => startPalm(player) },
  };

  setState(STATES.TITLE);

  // --- loop ---
  let last = performance.now();
  let accum = 0;
  let fpsFrames = 0, fpsTime = 0, fps = 0;

  function tick(dt) {
    ctx.time += dt;
    ctx.input = input.snapshot();
    const s = getState();
    if (s === STATES.RUN) {
      const t0 = performance.now();
      updateAll(dt, ctx);
      const ms = performance.now() - t0;
      const P = ctx.perf;
      P.last = ms; P.max = Math.max(P.max, ms); P.sum += ms; P.n++;
      if (getState() !== STATES.RUN) return;
      spawner.update(dt, ctx);
      if (getState() !== STATES.RUN) return;
      updateMini(dt, ctx);
      hud.updateFloaters(dt, camera);
      updateRunHud();
    } else if (s === STATES.MASSAGE) {
      massage.update(dt, ctx);
    } else if (s === STATES.ARREST || s === STATES.DEATH) {
      endT += dt;
      hud.updateFloaters(dt, camera);
      if (endT >= 3) setState(STATES.MASSAGE);
    } else if (s === STATES.PIVOT) {
      pivotT += dt;
      if (pivotT >= 3) setState(STATES.RUN);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    let elapsed = (now - last) / 1000;
    last = now;
    if (elapsed < 0) elapsed = 0;
    accum = Math.min(accum + elapsed, MAX_ACCUM);
    while (accum >= STEP) {
      tick(STEP);
      accum -= STEP;
    }

    fpsFrames++;
    fpsTime += elapsed;
    if (fpsTime >= 0.5) { fps = Math.round(fpsFrames / fpsTime); fpsFrames = 0; fpsTime = 0; }
    hud.setStatus(`${getState()}  ${fps} fps`);

    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
}

boot();
