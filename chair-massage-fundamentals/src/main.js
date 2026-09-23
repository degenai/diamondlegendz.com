// Boot, state machine wiring, fixed-step game loop. Owns Scene and Renderer.
import * as THREE from '../vendor/three.module.js';
import { STATES, setState, getState, onEnter, onExit } from './state.js';
import * as input from './input.js';
import { makeRng, hashSeed } from './rng.js';
import { buildBlock } from './world/block.js';
import { makeChair } from './world/props.js';
import { createPlayer } from './entities/player.js';
import { addEntity, updateAll } from './entities/index.js';
import * as hud from './hud.js';
import * as massage from './massage/index.js';

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
  const sky = 0xbcd6e8;
  scene.background = new THREE.Color(sky);
  scene.fog = new THREE.Fog(sky, 40, 170);

  scene.add(new THREE.HemisphereLight(0xdfefff, 0x4a5a3a, 0.9));
  const sun = new THREE.DirectionalLight(0xfff2dd, 1.6);
  sun.position.set(40, 80, 25);
  sun.castShadow = false;
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 400);
  camera.position.set(0, 3, -8);
  camera.lookAt(0, 1, 0);

  const seed = hashSeed(String(Date.now()));
  const rng = makeRng(seed);
  const world = buildBlock(seed, scene);

  const chair = makeChair();
  chair.position.set(world.chairSpot.x + 1.2, 0, world.chairSpot.z);
  scene.add(chair);

  const entities = [];
  const player = addEntity(entities, createPlayer(scene, new THREE.Vector3(0, 0, 3)));

  input.initInput(canvas);
  input.onLockChangeListener((locked) => {
    hud.setCrosshair(locked);
    updateHint();
  });

  const ctx = {
    world, entities, player, input: null, rng,
    wanted: null, hud, audio: null, time: 0,
    camera, scene, seed,
  };

  function updateHint() {
    if (getState() === STATES.RUN && !input.isLocked()) {
      hud.setHint('Click to look around. WASD move, Shift sprint, Space jump, Left click elbow. Esc releases mouse.');
    } else {
      hud.setHint('');
    }
  }

  // --- state wiring ---
  onEnter(STATES.TITLE, () => { hud.showTitle(); input.releaseLock(); });
  onExit(STATES.TITLE, () => hud.hideTitle());
  onEnter(STATES.MASSAGE, () => massage.enter(ctx));
  onExit(STATES.MASSAGE, () => massage.exit(ctx));
  onEnter(STATES.RUN, () => updateHint());
  onExit(STATES.RUN, () => { input.releaseLock(); hud.setHint(''); });

  const beginBtn = document.getElementById('begin');
  if (beginBtn) {
    beginBtn.addEventListener('click', () => {
      // TODO(Phase 2): go to STATES.MASSAGE here instead of straight to RUN.
      beginBtn.blur();
      setState(STATES.RUN);
      input.requestLock();
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
    input, setState,
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
      updateAll(dt, ctx);
    } else if (s === STATES.MASSAGE) {
      massage.update(dt, ctx);
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
