// Speech bubbles (DESIGN.md "Dialogue"): a comic DOM bubble over the speaker's head pivot,
// projected each frame like the floaters, clamped to the viewport with the tail pointing at the
// speaker when they are off screen. One bubble per speaker, and a per-speaker queue (third play,
// 2026-09-23: people interrupted themselves): a new line waits until the current one has been
// spoken (its duration + 0.2 s), then replaces it in place. At most 3 lines wait; past that the
// oldest aside, then the oldest banter is dropped, never a request. Requests (opts.kind 'request')
// go ahead of queued banter. The voice is called, and opts.onStart(secs) fires, when a line
// actually starts. Lifetime of the last line = speech duration + 0.8 s. The duration comes from
// ctx.voice.speak() (Phase 7: the synth's own duration, spoken or not), else opts.seconds, else
// 0.06 s per character + 1.2 (min 2 s). Skins: 'course' (beige) and 'run'.
// Every line that starts speaking is logged for the watcher as a `line` event (owner ruling
// 2026-09-24: line diversity). Lines spoken without a bubble (the narrator) log through heard().
import * as THREE from '../vendor/three.module.js';
import { emit } from './events.js';
import { getState } from './state.js';

const TAIL_GAP = 0.32;   // metres above the head pivot
const MARGIN = 10;       // px from the viewport edge
const GAP = 0.2;         // s between one spoken line and the next from the same speaker
const QUEUE_CAP = 3;     // lines waiting per speaker
const LINGER = 0.8;      // s the last line stays up after it has been spoken
const bubbles = new Map(); // anchor Object3D -> bubble
let root = null;
const _v = new THREE.Vector3();

export function initBubbles(hudRoot) { root = hudRoot; }

export function lineSeconds(text) { return Math.max(2, 0.06 * String(text).length + 1.2); }

// Who is talking, for the line log: opts.speaker / opts.name win; else the entity says (the boss,
// a goon, a cop or the ranger, a ped is a mini-massage client, ctx.player is the player); else the
// voice preset (a pivot line spoken from the van is 'goon').
function whoIs(ctx, speaker, opts) {
  const e = speaker && !speaker.isObject3D ? speaker : null;
  let kind = opts.speaker || null;
  if (!kind && e) {
    if (ctx && e === ctx.player) kind = 'player';
    else if (e.boss) kind = 'boss';
    else if (e.kind === 'goon') kind = 'goon';
    else if (e.kind === 'cop') kind = e.rank === 'ranger' ? 'ranger' : 'cop';
    else if (e.kind === 'ped') kind = 'client';
  }
  if (!kind) kind = opts.preset || 'narrator';
  let name = opts.name ?? null;
  if (name === null && e) name = e.name || (e.kind === 'goon' && !e.boss && e.id != null ? e.id : null);
  return { kind, name };
}

// A line was heard: one `line` event. Called when a bubble line starts, and by lines with no bubble.
export function heard(text, speaker = 'narrator', name = null, preset = 'narrator') {
  let state = null;
  try { state = getState(); } catch (_) { /* before boot */ }
  emit('line', { speaker, name, text, preset, state });
}

// speaker: an entity ({ mesh }), a person Group (userData.head) or any Object3D.
function anchorOf(speaker) {
  const obj = speaker && speaker.isObject3D ? speaker : speaker && speaker.mesh;
  if (!obj) return null;
  return (obj.userData && obj.userData.head) || obj;
}

const busy = (b) => !!b && (b.t < b.speak + GAP || b.q.length > 0);

// Queue a line behind the current one. Requests go after the last queued request, ahead of banter.
function enqueue(b, line) {
  if (line.kind === 'aside' && b.q.some((l) => l.kind === 'aside')) return false; // one pending ouch is plenty
  if (line.kind === 'request') {
    let i = 0;
    while (i < b.q.length && b.q[i].kind === 'request') i++;
    b.q.splice(i, 0, line);
  } else b.q.push(line);
  while (b.q.length > QUEUE_CAP) {
    let k = b.q.findIndex((l) => l.kind === 'aside');
    if (k < 0) k = b.q.findIndex((l) => l.kind !== 'request');
    if (k < 0) break;                     // only requests left: they all wait
    const [gone] = b.q.splice(k, 1);
    if (gone === line) return false;
  }
  return b.q.includes(line);
}

// Estimated seconds until a queued line has been spoken (for callers that pace a script).
function eta(b, line) {
  let t = Math.max(0, b.speak + GAP - b.t);
  for (const l of b.q) {
    const d = l.opts.seconds > 0 ? l.opts.seconds : lineSeconds(l.text);
    if (l === line) return t + d;
    t += d + GAP;
  }
  return t;
}

function makeBubble(anchor) {
  const n = document.createElement('div');
  const body = document.createElement('div');
  body.className = 'bb-text';
  const tail = document.createElement('i');
  tail.className = 'bb-tail';
  n.append(body, tail);
  root.appendChild(n);
  const b = { n, body, tail, anchor, t: 0, life: 0, speak: 0, side: '', q: [] };
  bubbles.set(anchor, b);
  return b;
}

// The line starts now: voice first (its duration wins), then the bubble text and lifetime.
function start(b, line) {
  const { ctx, text, opts } = line;
  let secs = opts.seconds;
  const voice = ctx && ctx.voice;
  if (voice && typeof voice.speak === 'function') {
    // voice.speak returns { duration } in seconds; never let a synth error break a line.
    try {
      const r = voice.speak(text, opts.preset || 'client', b.anchor); // one voice per speaker
      const d = r && typeof r === 'object' ? r.duration : r;
      if (Number.isFinite(d) && d > 0) secs = d;
    } catch (err) { console.warn('[bubbles] voice failed', err); }
  }
  if (!(secs > 0)) secs = lineSeconds(text);
  heard(text, line.who.kind, line.who.name, opts.preset || 'client');
  b.n.className = `bb bb-${opts.skin === 'course' ? 'course' : 'run'}`;
  b.body.textContent = text;
  b.text = text;
  b.kind = line.kind;
  b.bw = 0; b.bh = 0; b.tf = ''; b.op = ''; // re-measure once for the new text
  b.t = 0;
  b.speak = secs;
  b.life = secs + LINGER;
  b.n.hidden = true;
  if (typeof opts.onStart === 'function') {
    try { opts.onStart(secs); } catch (err) { console.error('[bubbles] onStart failed', err); }
  }
  return b;
}

// Returns the bubble when the line starts at once; a queued line returns a stand-in whose `life`
// is the estimated wait plus speech plus linger (so a script pacing on b.life - 0.8 still works),
// and null when the line was dropped.
export function say(ctx, speaker, text, opts = {}) {
  const anchor = anchorOf(speaker);
  if (!anchor || !root || !text) return null;
  const line = { ctx, text, opts, kind: opts.kind || 'banter', who: whoIs(ctx, speaker, opts) };
  let b = bubbles.get(anchor);
  if (busy(b)) {
    if (!enqueue(b, line)) return null;
    return { queued: true, text, life: eta(b, line) + LINGER };
  }
  if (!b) b = makeBubble(anchor);
  return start(b, line);
}

// The line this speaker is saying right now ('' between lines), and what is waiting.
export function speaking(speaker) {
  const b = bubbles.get(anchorOf(speaker));
  return b && b.t < b.speak ? b.text : '';
}
export function queued(speaker) {
  const b = bubbles.get(anchorOf(speaker));
  return b ? b.q.map((l) => l.text) : [];
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
    t: b.t, speak: b.speak, kind: b.kind, queue: b.q.map((l) => l.text),
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
  for (const b of bubbles.values()) {   // deleting the current entry mid-iteration is safe for a Map
    b.t += dt;
    if (!inScene(b.anchor)) { drop(b); continue; }   // the speaker left: their queue goes too
    if (b.q.length && b.t >= b.speak + GAP) start(b, b.q.shift());
    if (b.t >= b.life) { drop(b); continue; }
    b.anchor.updateWorldMatrix(true, false);
    b.anchor.getWorldPosition(_v);
    _v.y += TAIL_GAP;
    _v.project(camera);
    const behind = _v.z > 1;
    let hx = (_v.x * 0.5 + 0.5) * W, hy = (-_v.y * 0.5 + 0.5) * H;
    if (behind) { hx = W - hx; hy = H + 40; } // behind the camera: mirror, pin to the bottom
    b.hx = hx; b.hy = hy;
    if (b.n.hidden) b.n.hidden = false;
    // Size only changes with the text: measuring every tick forced a layout per bubble per tick.
    if (!b.bw) { b.bw = b.n.offsetWidth; b.bh = b.n.offsetHeight; }
    const bw = b.bw, bh = b.bh;
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
      const tl = `${(tipX - x).toFixed(1)}px`;
      if (b.tl !== tl) { b.tl = tl; b.tail.style.left = tl; b.tail.style.top = ''; }
    } else {
      tipY = clamp(hy, y + 12, y + bh - 12); tipX = side === 'right' ? x + bw + 10 : x - 10;
      const tl = `t${(tipY - y).toFixed(1)}`;
      if (b.tl !== tl) { b.tl = tl; b.tail.style.top = `${(tipY - y).toFixed(1)}px`; b.tail.style.left = ''; }
    }
    b.x = x; b.y = y; b.tipX = tipX; b.tipY = tipY;
    const tf = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    if (b.tf !== tf) { b.tf = tf; b.n.style.transform = tf; }
    const op = Math.min(1, (b.life - b.t) / 0.3, b.t / 0.12).toFixed(2);
    if (b.op !== op) { b.op = op; b.n.style.opacity = op; }
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
