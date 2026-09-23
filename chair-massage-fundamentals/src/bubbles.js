// Speech bubbles (DESIGN.md "Dialogue"): a comic DOM bubble over the speaker's head pivot,
// projected each frame like the floaters, clamped to the viewport with the tail pointing at the
// speaker when they are off screen. One bubble per speaker; a new line replaces the old in place.
// Lifetime = speech duration + 0.8 s. The duration comes from ctx.voice.speak() when Phase 7's
// voice exists, else 0.06 s per character + 1.2 (min 2 s). Skins: 'course' (beige) and 'run'.
import * as THREE from '../vendor/three.module.js';

const TAIL_GAP = 0.32;   // metres above the head pivot
const MARGIN = 10;       // px from the viewport edge
const bubbles = new Map(); // anchor Object3D -> bubble
let root = null;
const _v = new THREE.Vector3();

export function initBubbles(hudRoot) { root = hudRoot; }

export function lineSeconds(text) { return Math.max(2, 0.06 * String(text).length + 1.2); }

// speaker: an entity ({ mesh }), a person Group (userData.head) or any Object3D.
function anchorOf(speaker) {
  const obj = speaker && speaker.isObject3D ? speaker : speaker && speaker.mesh;
  if (!obj) return null;
  return (obj.userData && obj.userData.head) || obj;
}

export function say(ctx, speaker, text, opts = {}) {
  const anchor = anchorOf(speaker);
  if (!anchor || !root || !text) return null;
  let secs = opts.seconds;
  const voice = ctx && ctx.voice;
  if (voice && typeof voice.speak === 'function') {
    // voice.speak returns { duration } in seconds; never let a synth error break a line.
    try {
      const r = voice.speak(text, opts.preset || 'client');
      const d = r && typeof r === 'object' ? r.duration : r;
      if (Number.isFinite(d) && d > 0) secs = d;
    } catch (err) { console.warn('[bubbles] voice failed', err); }
  }
  if (!(secs > 0)) secs = lineSeconds(text);
  let b = bubbles.get(anchor);
  if (!b) {
    const n = document.createElement('div');
    const body = document.createElement('div');
    body.className = 'bb-text';
    const tail = document.createElement('i');
    tail.className = 'bb-tail';
    n.append(body, tail);
    root.appendChild(n);
    b = { n, body, tail, anchor, t: 0, life: 0, side: '' };
    bubbles.set(anchor, b);
  }
  b.n.className = `bb bb-${opts.skin === 'course' ? 'course' : 'run'}`;
  b.body.textContent = text;
  b.text = text;
  b.t = 0;
  b.life = secs + 0.8;
  b.n.hidden = true;
  return b;
}

function inScene(o) {
  while (o.parent) o = o.parent;
  return !!o.isScene;
}

function drop(b) {
  b.n.remove();
  bubbles.delete(b.anchor);
}

export function clearBubbles() { for (const b of [...bubbles.values()]) drop(b); }

// Debug / tests: [{ text, x, y, tipX, tipY, headX, headY, side }] in CSS px.
export function activeBubbles() {
  return [...bubbles.values()].filter((b) => !b.n.hidden).map((b) => ({
    text: b.text, x: b.x, y: b.y, tipX: b.tipX, tipY: b.tipY, headX: b.hx, headY: b.hy, side: b.side,
  }));
}

function setSide(b, side) {
  if (b.side === side) return;
  b.side = side;
  b.tail.className = `bb-tail bb-tail-${side}`;
}

// Per tick after the camera moved.
export function updateBubbles(dt, camera) {
  if (!camera || !bubbles.size) return;
  const W = window.innerWidth, H = window.innerHeight;
  for (const b of [...bubbles.values()]) {
    b.t += dt;
    if (b.t >= b.life || !inScene(b.anchor)) { drop(b); continue; }
    b.anchor.updateWorldMatrix(true, false);
    b.anchor.getWorldPosition(_v);
    _v.y += TAIL_GAP;
    _v.project(camera);
    const behind = _v.z > 1;
    let hx = (_v.x * 0.5 + 0.5) * W, hy = (-_v.y * 0.5 + 0.5) * H;
    if (behind) { hx = W - hx; hy = H + 40; } // behind the camera: mirror, pin to the bottom
    b.hx = hx; b.hy = hy;
    b.n.hidden = false;
    const bw = b.n.offsetWidth, bh = b.n.offsetHeight;
    // Preferred: bubble centred above the head, tail down to it.
    let x = hx - bw / 2, y = hy - bh - 12;
    const clamp = (val, lo, hi) => Math.max(lo, Math.min(hi, val));
    const onScreen = !behind && hx >= 0 && hx <= W && hy >= 0 && hy <= H;
    let side = 'bottom';
    if (onScreen) {
      if (y < MARGIN) { y = hy + 12; side = 'top'; }        // head near the top: hang below
      x = clamp(x, MARGIN, W - bw - MARGIN);
      y = clamp(y, MARGIN, H - bh - MARGIN);
    } else {
      x = clamp(x, MARGIN, W - bw - MARGIN);
      y = clamp(y, MARGIN, H - bh - MARGIN);
      const cx = x + bw / 2, cy = y + bh / 2, dx = hx - cx, dy = hy - cy;
      side = Math.abs(dx) / bw > Math.abs(dy) / bh ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'bottom' : 'top');
    }
    setSide(b, side);
    // Tail tip: along the chosen edge, as close to the speaker as the edge allows.
    let tipX, tipY;
    if (side === 'bottom' || side === 'top') {
      tipX = clamp(hx, x + 14, x + bw - 14); tipY = side === 'bottom' ? y + bh + 10 : y - 10;
      b.tail.style.left = `${(tipX - x).toFixed(1)}px`; b.tail.style.top = '';
    } else {
      tipY = clamp(hy, y + 12, y + bh - 12); tipX = side === 'right' ? x + bw + 10 : x - 10;
      b.tail.style.top = `${(tipY - y).toFixed(1)}px`; b.tail.style.left = '';
    }
    b.x = x; b.y = y; b.tipX = tipX; b.tipY = tipY;
    b.n.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    const fade = Math.min(1, (b.life - b.t) / 0.3, b.t / 0.12);
    b.n.style.opacity = fade.toFixed(2);
  }
}

// ctx.hud with floater() routed: an NPC's plain 'speech' floater (npc-common say()) becomes a
// bubble when the speaker is a goon, a cop or a mini-massage client; peds and effects stay floaters.
export function speechHud(ctx, hud) {
  const plain = hud.floater;
  const preset = (e) => (e.kind === 'goon' ? 'goon' : e.kind === 'cop' ? 'ranger'
    : (e === (ctx.mini && ctx.mini.client) || e.state === 'toChair' || e.state === 'leave') ? 'client' : null);
  return Object.assign({}, hud, {
    floater(text, x, y, z, cls = 'speech') {
      if (typeof cls === 'string' && cls.startsWith('speech')) {
        const e = ctx.npcs.find((n) => n.pos.x === x && n.pos.z === z && Math.abs(n.pos.y + 2.1 - y) < 1e-6);
        const kind = e && preset(e);
        if (kind) return say(ctx, e, text, { skin: 'run', preset: kind });
      }
      return plain(text, x, y, z, cls);
    },
  });
}
