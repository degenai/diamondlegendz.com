// Phase 7 audio wiring: one AudioContext made on the first user gesture, the music state per game
// state, engines and sirens per vehicle, the wanted star and intensity, the listener at the
// camera, master volume (title slider, localStorage cmf.volume) and the M mute key with a HUD
// glyph. ctx.voice always exists: before the context runs it only reports the synth's duration
// (so bubble lifetimes never change), after that it speaks. Up to MAX_VOICES speakers at once;
// a new line from the same speaker replaces the old one, beyond that the oldest line is cut.
import { createAudio } from './audio.js';
import { createVoice, planUtterance } from './voice.js';
import { STATES, getState, onEnter } from './state.js';

const VOL_KEY = 'cmf.volume';
const MAX_VOICES = 2;
const ENGINE_EVERY = 1 / 15;   // s between engine / siren parameter updates
let A = null;                  // { ac, audio, slots, gestured }
let volume = 0.7, muted = false, glyph = null, ctxRef = null;
let engineT = 0, lastLevel = 0;
const engines = new Set(), sirens = new Set();

function isTyping(el) {
  if (!el || !el.tagName) return false;
  const t = el.tagName;
  if (t === 'TEXTAREA' || t === 'SELECT') return true;
  return t === 'INPUT' && el.type !== 'range' && el.type !== 'checkbox' && el.type !== 'button';
}
function readVolume() {
  try { const v = parseFloat(window.localStorage.getItem(VOL_KEY)); if (Number.isFinite(v)) return Math.min(1, Math.max(0, v)); } catch (_) { /* private mode */ }
  return 0.7;
}
function applyVolume() { if (A) A.audio.setVolume(muted ? 0 : volume); }
export function setVolume(v) {
  volume = Math.min(1, Math.max(0, +v || 0));
  if (muted && volume > 0) { muted = false; if (glyph) { glyph.classList.remove('muted'); glyph.textContent = '♪'; } } // touching the slider unmutes
  try { window.localStorage.setItem(VOL_KEY, String(volume)); } catch (_) { /* ignore */ }
  applyVolume();
}
export function toggleMute() {
  muted = !muted;
  applyVolume();
  if (glyph) { glyph.classList.toggle('muted', muted); glyph.textContent = muted ? '♪ muted (M)' : '♪'; }
  return muted;
}

const speakable = (text) => /[a-z0-9]/i.test(String(text || ''));

// ctx.voice: speak(text, preset, speaker) -> { duration }; stop(speaker?) stops one or all.
function makeVoice() {
  return {
    speak(text, preset = 'narrator', speaker = 'narrator') {
      if (!speakable(text)) return { duration: 0 };
      // A context made inside a gesture can still read 'suspended' for a moment (the Begin click
      // speaks the intro at once); otherwise a suspended context only reports the duration.
      const live = A && (A.ac.state === 'running' || (A.gestured && performance.now() - A.born < 1500));
      if (!live) return { duration: planUtterance(text, preset).duration };
      const now = A.ac.currentTime;
      let s = A.slots.find((q) => q.key === speaker)
        || A.slots.find((q) => q.endAt <= now)
        || A.slots.reduce((a, b) => (a.startAt <= b.startAt ? a : b));
      if (s.key !== speaker && s.endAt > now) s.v.stop();       // latest wins
      const r = s.v.speak(text, preset);
      s.key = speaker; s.startAt = now; s.endAt = now + r.duration + 0.3;
      return r;
    },
    stop(speaker) {
      if (!A) return;
      for (const s of A.slots) if (speaker === undefined || s.key === speaker) { s.v.stop(); s.endAt = 0; s.key = null; }
    },
    get presets() { return A ? A.slots[0].v.presets : null; },
  };
}

function ensureAudio(trusted) {
  if (A) {
    if (trusted && A.ac.state === 'suspended') { A.gestured = true; A.born = performance.now(); A.ac.resume().catch(() => {}); }
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  let ac;
  try { ac = new AC(); } catch (err) { console.warn('[CMF] audio unavailable', err); return; }
  const audio = createAudio(ac);
  const slots = [];
  for (let i = 0; i < MAX_VOICES; i++) slots.push({ v: createVoice(ac, { destination: audio.voiceIn }), key: null, startAt: 0, endAt: 0 });
  A = { ac, audio, slots, gestured: !!trusted, born: performance.now() };
  audio.resume().catch(() => {});
  applyVolume();
  if (ctxRef) {
    ctxRef.audio = audio; ctxRef.audioCtx = ac;
    const s = getState();
    if (s) audio.setState(s);
    lastLevel = ctxRef.wanted ? ctxRef.wanted.level : 0;
  }
}

export function initAudio(ctx, hudRoot) {
  ctxRef = ctx;
  volume = readVolume();
  ctx.voice = makeVoice();
  const gesture = (ev) => {
    if (ev.type === 'keydown' && ev.code === 'KeyM' && !isTyping(ev.target)) toggleMute();
    ensureAudio(ev.isTrusted);
  };
  window.addEventListener('pointerdown', gesture, true);
  window.addEventListener('keydown', gesture, true);
  const slider = document.getElementById('volume');
  if (slider) {
    slider.value = String(volume);
    slider.addEventListener('input', () => setVolume(slider.value));
  }
  glyph = document.createElement('div');
  glyph.className = 'hud-mute';
  glyph.textContent = '♪';
  glyph.title = 'M mutes';
  hudRoot.appendChild(glyph);
  for (const s of Object.values(STATES)) {
    onEnter(s, () => {
      if (s === STATES.RUN) { lastLevel = 0; if (A) A.audio.setIntensity(0); } // a fresh run starts calm
      if (s === STATES.MASSAGE || s === STATES.TITLE) { ctx.voice.stop(); stopLoops(); }
      if (A) A.audio.setState(s);
    });
  }
}

// Debug handle (window.CMF.audio): the context, the audio api and the voice slots.
export function audioInternals() { return A; }

function stopLoops() {
  if (!A) return;
  for (const id of engines) A.audio.sfx('engineStop', { id });
  for (const id of sirens) A.audio.sfx('siren', { id, on: false });
  engines.clear(); sirens.clear();
}

const _on = new Set(), _siren = new Set();
// Per rendered frame: the listener, engines and sirens (15 Hz), wanted stars and intensity.
export function audioFrame(ctx, dt) {
  if (!A) return;
  const audio = A.audio, cam = ctx.camera;
  audio.setListener(cam.position.x, cam.position.z);
  if (A.ac.state !== 'running') return;
  const s = getState();
  if (s === STATES.RUN) {
    const lvl = ctx.wanted.level;
    if (lvl !== lastLevel) {
      if (lvl > lastLevel) audio.sfx('star');
      audio.setIntensity(lvl / 3);
      lastLevel = lvl;
    }
  }
  engineT += dt;
  if (engineT < ENGINE_EVERY) return;
  engineT = 0;
  _on.clear(); _siren.clear();
  // Engines and sirens belong to the street: the pivot's van and the run. Under the slow motion
  // and the certificate they wind down (the player is still sitting in the car until MASSAGE).
  const list = (s === STATES.RUN || s === STATES.PIVOT) ? ctx.world.vehicles || [] : [];
  for (let i = 0; i < list.length; i++) {
    const v = list[i];
    if (v.removed) continue;
    if (v.driver && v.hp > 0) {
      const id = v.id;
      _on.add(id);
      audio.sfx('engine', { id, type: v.type, rpm: 0.1 + 0.9 * Math.min(1, Math.abs(v.speed) / v.spec.maxSpeed),
        load: v.throttle ? 0.85 : 0.25, x: v.pos.x, z: v.pos.z });
    }
    if (v.lightbar && v.lights && v.hp > 0) { // a wreck's siren dies with it
      _siren.add(v.id);
      audio.sfx('siren', { id: v.id, on: true, x: v.pos.x, z: v.pos.z });
    }
  }
  for (const id of engines) if (!_on.has(id)) audio.sfx('engineStop', { id });
  for (const id of sirens) if (!_siren.has(id)) audio.sfx('siren', { id, on: false });
  engines.clear(); for (const id of _on) engines.add(id);
  sirens.clear(); for (const id of _siren) sirens.add(id);
}
