// The counter cue (DESIGN.md "The fight tilts toward Arkham", ruling 1): the Q keycap and a bar
// draining with the wind-up, over each goon winding up on the player (entities/goon-counter.js keeps
// the cues on ctx.counter). "hold" while Q is held for the charged counter; green after a counter,
// red after he connects. Lives in the RUN overlay (.rh), so it hides with it; styles are the mini
// strip's .rh-mini-call (ui.css). (Was hud-dodge.js, the S cue.)
import * as THREE from '../vendor/three.module.js';

const POOL = 3;
const HEAD = 2.35;          // m over the goon's feet
const OK = 'rgba(38,96,44,.9)', BAD = 'rgba(120,24,16,.9)', OPEN = '';
const cues = [];
const _v = new THREE.Vector3();

export function initCounterHud(root) {
  const wrap = (root && root.querySelector('.rh')) || root;
  for (let i = 0; i < POOL; i++) {
    const n = document.createElement('div');
    n.className = 'rh-mini-call rh-counter';
    n.style.cssText = 'position:absolute;left:0;top:0;min-width:92px;pointer-events:none;z-index:3;will-change:transform';
    const k = document.createElement('kbd'); k.textContent = 'Q'; n.appendChild(k);
    const w = document.createElement('span'); w.textContent = 'counter'; n.appendChild(w);
    const bar = document.createElement('div'); bar.className = 'rh-mini-callbar';
    const fill = document.createElement('i'); bar.appendChild(fill); n.appendChild(bar);
    n.hidden = true;
    wrap.appendChild(n);
    cues.push({ n, w, fill, bg: null, word: 'counter' });
  }
}

const WORDS = { tap: 'countered', hold: 'HEALING PALM', miss: 'too late', late: 'too late' };

// Per tick after the camera moved (main.js). ctx.counter null (outside RUN) hides every cue.
export function updateCounterCues(ctx, camera) {
  const all = ctx.counter && camera ? ctx.counter.cues : [];
  const live = (c) => !c.done;   // open cues take a slot before resolved ones
  const list = all.filter(live).concat(all.filter((c) => !live(c)));
  const w = window.innerWidth, h = window.innerHeight;
  for (let i = 0; i < cues.length; i++) {
    const q = cues[i], c = list[i];
    if (!c) { if (!q.n.hidden) q.n.hidden = true; continue; }
    const e = c.e;
    _v.set(e.pos.x, e.pos.y + HEAD, e.pos.z).project(camera);
    const off = _v.z > 1 || _v.z < -1 || Math.abs(_v.x) > 1.1 || Math.abs(_v.y) > 1.1;
    if (q.n.hidden !== off) q.n.hidden = off;
    if (off) continue;
    q.n.style.transform = `translate(${((_v.x * 0.5 + 0.5) * w).toFixed(1)}px, ${((-_v.y * 0.5 + 0.5) * h).toFixed(1)}px) translate(-50%, -100%)`;
    const good = c.done === 'tap' || c.done === 'hold', bad = c.done === 'miss' || c.done === 'late';
    const bg = good ? OK : bad ? BAD : OPEN;
    if (q.bg !== bg) { q.bg = bg; q.n.style.background = bg; }
    const word = c.done ? WORDS[c.done] : c.armedAt !== null ? 'hold...' : 'counter';
    if (q.word !== word) { q.word = word; q.w.textContent = word; }
    const frac = c.done || c.struckAt !== null ? 0 : Math.max(0, Math.min(1, (c.end - ctx.time) / (c.win || 1)));
    q.fill.style.width = `${(frac * 100).toFixed(1)}%`;
  }
}
