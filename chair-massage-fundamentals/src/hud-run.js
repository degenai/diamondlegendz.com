// RUN HUD: wanted stars (top right, flashing while rising), thin health bar, cash, world-space
// floaters (THUD, lines, TENSION RELEASED, +$), the chaos flash and the mini-massage meter.
// Styles in index.html (.rh-*). Hidden outside RUN so the MASSAGE course skin is untouched.
import * as THREE from '../vendor/three.module.js';
import { WANTED_CAP } from './run/wanted.js';

const POOL = 28;
const LIFE = 1.2;
const SPEECH_LIFE = 2.4;
const RISE = 60;           // px over the floater's life

let wrap = null, stars = [], hpFill = null, cashEl = null, flashEl = null, miniEl = null, mini = {};
let batWrap = null, batFill = null, heatEl = null, stampEl = null;
const floaters = [];
const last = {};
const _v = new THREE.Vector3();

function el(tag, cls, parent, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  if (parent) parent.appendChild(n);
  return n;
}

export function initRunHud(root) {
  flashEl = el('div', 'rh-flash', root);
  wrap = el('div', 'rh', root);
  wrap.hidden = true;
  const box = el('div', 'rh-box', wrap);
  const row = el('div', 'rh-stars', box);
  for (let i = 0; i < WANTED_CAP; i++) stars.push(el('span', 'rh-star', row, '★'));
  const bar = el('div', 'rh-hp', box);
  hpFill = el('i', '', bar);
  batWrap = el('div', 'rh-bat', box);
  el('span', 'rh-bat-label', batWrap, 'GUN');
  batFill = el('i', '', el('div', 'rh-bat-bar', batWrap));
  batWrap.hidden = true;
  cashEl = el('div', 'rh-cash', box, '$0');
  heatEl = el('div', 'rh-heat', wrap);
  heatEl.hidden = true;
  stampEl = el('div', 'rh-stamp', root);
  stampEl.hidden = true;
  miniEl = el('div', 'rh-mini', wrap);
  miniEl.hidden = true;
  el('div', 'rh-mini-title', miniEl, 'Chair massage');
  const track = el('div', 'rh-mini-track', miniEl);
  mini.band = el('div', 'rh-mini-band', track);
  mini.needle = el('div', 'rh-mini-needle', track);
  const prog = el('div', 'rh-mini-prog', miniEl);
  mini.prog = el('i', '', prog);
  mini.note = el('div', 'rh-mini-note', miniEl, 'Hold E  |  W/S pressure');
  for (let i = 0; i < POOL; i++) {
    const n = el('div', 'rh-float', root);
    n.hidden = true;
    floaters.push({ n, t: 0, life: LIFE, x: 0, y: 0, z: 0, on: false });
  }
}

export function showRunHud(visible) {
  if (wrap) wrap.hidden = !visible;
  if (!visible) {
    for (const f of floaters) { f.on = false; f.n.hidden = true; }
    if (miniEl) miniEl.hidden = true;
  }
}

export function setWanted(level, rising) {
  if (!wrap) return;
  const key = `${level}:${rising ? 1 : 0}`;
  if (last.w === key) return;
  last.w = key;
  stars.forEach((s, i) => {
    s.classList.toggle('on', i < level);
    s.classList.toggle('rising', !!rising && i < level);
  });
}

export function setHealth(hp) {
  const v = Math.max(0, Math.min(100, Math.round(hp)));
  if (!hpFill || last.hp === v) return;
  last.hp = v;
  hpFill.style.width = `${v}%`;
  hpFill.classList.toggle('low', v < 35);
}

// Massage gun battery (0..100) next to health; null hides it (gun still locked).
export function setBattery(v) {
  if (!batWrap) return;
  const key = v === null ? 'off' : String(Math.round(v));
  if (last.bat === key) return;
  last.bat = key;
  batWrap.hidden = v === null;
  if (v !== null) { batFill.style.width = `${Math.max(0, Math.min(100, v)).toFixed(0)}%`; batFill.classList.toggle('low', v < 20); }
}

// "Lose the heat first." inside the escape zone with stars; '' hides it.
export function setHeatLine(text) {
  if (!heatEl || last.heat === text) return;
  last.heat = text;
  heatEl.hidden = !text;
  heatEl.textContent = text || '';
}

// Run-end stamp (ARRESTED / OVERWORKED / ESCAPED): red, rotated, slams in with a bounce.
export function showStamp(text, variant = 'bad') {
  if (!stampEl) return;
  stampEl.textContent = text;
  stampEl.className = `rh-stamp rh-stamp-${variant}`;
  stampEl.hidden = false;
  void stampEl.offsetWidth;
  stampEl.classList.add('go');
}
export function hideStamp() { if (stampEl) { stampEl.hidden = true; stampEl.classList.remove('go'); } }
export function stampText() { return stampEl && !stampEl.hidden ? stampEl.textContent : ''; }

export function setCash(amount) {
  const text = `$${Math.round(amount)}`;
  if (cashEl && last.cash !== text) { cashEl.textContent = text; last.cash = text; }
}

export function flashChaos() {
  if (!flashEl) return;
  flashEl.classList.remove('go');
  void flashEl.offsetWidth;          // restart the CSS animation
  flashEl.classList.add('go');
}

// Pops a floater at a world position. cls: thud | released | speech | cash | speech dim
export function floater(text, x, y, z, cls = 'speech') {
  let f = floaters.find((q) => !q.on);
  if (!f) f = floaters.reduce((a, b) => (a.t > b.t ? a : b));
  f.on = true; f.t = 0; f.x = x; f.y = y; f.z = z;
  f.life = cls.startsWith('speech') ? SPEECH_LIFE : LIFE;
  f.n.className = 'rh-float rh-' + cls.split(' ').join(' rh-');
  f.n.textContent = text;
  f.n.hidden = true;
  return f;
}

export function activeFloaters() {
  return floaters.filter((f) => f.on).map((f) => f.n.textContent);
}

// Per tick after the camera moved: project, rise, fade.
export function updateFloaters(dt, camera) {
  if (!camera) return;
  const w = window.innerWidth, h = window.innerHeight;
  for (const f of floaters) {
    if (!f.on) continue;
    f.t += dt;
    if (f.t >= f.life) { f.on = false; f.n.hidden = true; continue; }
    _v.set(f.x, f.y, f.z).project(camera);
    if (_v.z > 1 || _v.z < -1 || Math.abs(_v.x) > 1.2 || Math.abs(_v.y) > 1.2) { f.n.hidden = true; continue; }
    const k = f.t / f.life;
    const sx = (_v.x * 0.5 + 0.5) * w, sy = (-_v.y * 0.5 + 0.5) * h - k * RISE;
    f.n.hidden = false;
    f.n.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -100%)`;
    f.n.style.opacity = String(Math.min(1, (1 - k) * 2.2).toFixed(2));
  }
}

// Mini-massage meter: M = { pressure, lo, hi, progress, zone } while massaging, { ready } when a
// client is kneeling, null to hide.
export function setMini(M) {
  if (!miniEl) return;
  miniEl.hidden = !M;
  if (!M) return;
  if (M.ready) {
    mini.note.textContent = 'Client ready: hold E';
    mini.prog.style.width = '0%';
    return;
  }
  mini.note.textContent = 'Hold E  |  W/S pressure';
  mini.band.style.bottom = `${(M.lo * 100).toFixed(1)}%`;
  mini.band.style.height = `${((M.hi - M.lo) * 100).toFixed(1)}%`;
  mini.needle.style.bottom = `${(M.pressure * 100).toFixed(1)}%`;
  mini.needle.dataset.zone = M.zone;
  mini.prog.style.width = `${Math.min(100, M.progress * 100).toFixed(1)}%`;
}
