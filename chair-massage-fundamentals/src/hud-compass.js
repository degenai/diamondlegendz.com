// RUN compass strip: a thin bar under the title strip with two markers that slide by bearing
// relative to the camera's heading: the chair (on you, in a vehicle, or on the ground) and the
// gold exit for the escape gap, each with its distance in metres underneath. Lives inside the
// RUN HUD wrap, so it is hidden in MASSAGE and PIVOT with the rest. Plain DOM, styles inline.
// While he is at the exit without the chair (end.js ctx.leave) the chair marker is the one to follow.
// Right of the strip, while a star is held: who holds it (wanted.js w.watcher, the nearest cop within
// 40 m with line of sight), "seen by ranger, 22 m"; nothing when no one does (ruled 2026-09-25).
import * as THREE from '../vendor/three.module.js';
import { chairWorldPos } from './entities/chair.js';

const WIDTH = 360;          // px
const SPAN = Math.PI;       // the strip covers 180 degrees (90 either side of straight ahead)
const CHAIR_SVG = '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 1h2v6h6v2H9v4H7V9H5v4H3z" fill="#7fe3a0"/></svg>';

let strip = null, watch = null;
const marks = {};
const _d = new THREE.Vector3();
const _c = new THREE.Vector3();

function el(tag, css, parent, html) {
  const n = document.createElement(tag);
  n.style.cssText = css;
  if (html) n.innerHTML = html;
  parent.appendChild(n);
  return n;
}

export function initCompass(parent) {
  strip = el('div', `position:absolute;top:40px;left:50%;width:${WIDTH}px;margin-left:-${WIDTH / 2}px;height:14px;`
    + 'background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.18);border-radius:2px;pointer-events:none', parent);
  strip.className = 'rh-compass';
  el('div', 'position:absolute;left:50%;top:0;bottom:0;width:1px;background:rgba(255,255,255,.55)', strip);
  for (const [k, glyph, colour] of [['chair', CHAIR_SVG, '#7fe3a0'], ['exit', 'EXIT', '#f2c230']]) {
    const m = el('div', 'position:absolute;top:0;transform:translateX(-50%);text-align:center;white-space:nowrap', strip);
    m.className = 'rh-compass-' + k;
    el('div', `height:14px;line-height:14px;font:bold 10px monospace;color:${colour}`, m, glyph);
    const dist = el('div', `margin-top:2px;font:bold 11px monospace;color:${colour};text-shadow:0 1px 2px #000,0 0 3px #000`, m);
    marks[k] = { m, dist };
  }
  watch = el('div', 'position:absolute;left:100%;top:0;margin-left:8px;height:14px;line-height:14px;white-space:nowrap;'
    + 'font:bold 11px monospace;color:#ff8a7a;text-shadow:0 1px 2px #000,0 0 3px #000', strip);
  watch.className = 'rh-compass-watch';
  watch.hidden = true;
}

const RANKS = { ranger: 'ranger', cop: 'cop', swat: 'SWAT' };
// The watcher's name: a cop by rank, a cruiser still driving in by its unit (spawner.js label).
export function watcherName(c) { return c.kind === 'cop' ? RANKS[c.rank] || 'cop' : c.label || 'police'; }

// "seen by ranger, 22 m" while a cop holds the star, else ''.
export function watchLine(ctx) {
  const w = ctx.wanted, c = w && w.level > 0 && w.seen ? w.watcher : null;
  if (!c || !c.pos) return '';
  const p = ctx.player, from = p.vehicle ? p.vehicle.pos : p.pos;
  return `seen by ${watcherName(c)}, ${Math.round(Math.hypot(c.pos.x - from.x, c.pos.z - from.z))} m`;
}

function wrap(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Place marker k for world point p seen from `from` with the camera heading `head`.
function place(k, p, from, head) {
  const M = marks[k];
  if (!p) { M.m.hidden = true; return; }
  M.m.hidden = false;
  const dx = p.x - from.x, dz = p.z - from.z;
  const near = Math.hypot(dx, dz) < 1.5;                  // on your back or in your car: centred
  const rel = near ? 0 : wrap(Math.atan2(dx, dz) - head); // + is toward the camera's left
  const x = WIDTH / 2 - Math.max(-1, Math.min(1, rel / (SPAN / 2))) * (WIDTH / 2);
  M.m.style.left = `${x.toFixed(1)}px`;
  M.m.dataset.rel = (rel * 180 / Math.PI).toFixed(1);
  M.m.style.opacity = Math.abs(rel) > SPAN / 2 ? '0.55' : '1';  // pinned at the edge: behind you
  const d = near ? -1 : Math.round(Math.hypot(dx, dz));
  if (M.d !== d) { M.d = d; M.dist.textContent = near ? 'on you' : `${d} m`; }
}

// Per RUN tick (main.js, beside the floaters).
export function updateCompass(ctx) {
  if (!strip || !ctx.camera) return;
  ctx.camera.getWorldDirection(_d);
  const head = Math.atan2(_d.x, _d.z);
  const p = ctx.player, from = p.vehicle ? p.vehicle.pos : p.pos;
  place('chair', chairWorldPos(ctx, _c), from, head);
  const esc = ctx.world.spawns && ctx.world.spawns.escape;
  place('exit', esc ? esc.centre : null, from, head);
  const wl = watchLine(ctx);
  if (watch.textContent !== wl) { watch.textContent = wl; watch.hidden = !wl; }
  // Leaving without the chair (end.js): the exit steps back and the chair marker grows and pulses.
  const focus = !!ctx.leave;
  if (strip.dataset.focus !== (focus ? 'chair' : '')) {
    strip.dataset.focus = focus ? 'chair' : '';
    marks.exit.m.style.filter = focus ? 'grayscale(1) brightness(.6)' : '';
    marks.chair.m.style.zIndex = focus ? '2' : '';
  }
  if (focus) marks.chair.m.style.transform = `translateX(-50%) scale(${(1.45 + 0.2 * Math.sin(ctx.time * 8)).toFixed(2)})`;
  else if (marks.chair.m.style.transform !== 'translateX(-50%)') marks.chair.m.style.transform = 'translateX(-50%)';
}
