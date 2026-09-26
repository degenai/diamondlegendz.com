// window.CMF.agent (DESIGN.md "Playtesting with Jev", milestone 1; docs/playtest-jev.md 4a): a model
// plays the game paused, one decision at a time. pause(on) stops the rAF clock; step(n, {stopOn})
// runs whole fixed ticks (the same tick() the loop runs) and stops early on an interrupt; observe()
// is the situation in words plus the valid actions; act(id) presses synthetic keys and mouse events
// synchronously (input.js takes them as a player's) and returns the ticks the macro needs, the
// releases being scheduled on the tick clock (a hold is keydown, step, keyup).
// Between ticks the step yields one task (a MessageChannel message), not one microtask: the cached
// loadMesh().then() spawns are two or three microtasks deep, and a task boundary drains them all, so
// a spawn always lands after the tick that asked for it whatever the batch size.
// ?agent (or ?norender) boots paused: nothing ticks before the harness steps, so tick 0 is the same
// every time. Never a debug hook: only what a player's hands could do, plus a faked pointer lock
// (headless Chrome refuses the real one) and the ring-tracking reflex (a mouse that follows the ring).
import { onEvent } from './events.js';
import { short } from './run-report.js';
import { buildSnap } from './session-log.js';
import { observeText, menuFor } from './agent-text.js';
import { createRunHands, INTERRUPTIBLE } from './agent-run.js';

const MOUSE_SENS = 0.0025;   // rad per px (player.js, chase-cam.js): 30 degrees = 209 px
const WAIT = 30;             // ticks: 2 decisions per sim second
const END = ['ARREST', 'DEATH', 'ESCAPE', 'SUMMARY'];

// What wakes the model up (docs/playtest-jev.md 4a).
export function INTERRUPTS(type, d) {
  switch (type) {
    case 'call': return d.act === 'asked' || d.act === 'open';
    case 'mini': return d.phase === 'ready' || d.phase === 'success' || d.phase === 'cancel';
    case 'telegraph': case 'state': return true;
    case 'knockdown': return d.who === 'player';
    case 'damage': return true;                    // only the player takes `damage`
    case 'tutorial': return d.act === 'shown';
    case 'leave': return d.phase === 'prompt';
    case 'goon': return d.act === 'cling' || d.act === 'pullout';     // milestone 3: a goon on his car
    case 'chair': return d.act === 'throw';
    case 'wanted': return d.level !== d.prev;
    default: return false;
  }
}

export function createAgent(ctx, hooks) {
  const A = { paused: !!hooks.startPaused, track: false, clickHeld: false, stepping: false, due: [], holds: [], recent: [], log: [] };
  onEvent((type, data) => {
    if (type === 'peds') return;
    A.recent.push(`${type}: ${short({ type, data })}`);
    if (A.recent.length > 40) A.recent.splice(0, 20);
  });

  const mc = new MessageChannel(), waiting = [];
  mc.port1.onmessage = () => { const r = waiting.shift(); if (r) r(); };
  const nextTask = () => new Promise((r) => { waiting.push(r); mc.port2.postMessage(0); });

  // ---- synthetic input ----
  const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code.replace(/^Key/, '').toLowerCase(), bubbles: true }));
  const button = (b, down) => window.dispatchEvent(new MouseEvent(down ? 'mousedown' : 'mouseup', { button: b, bubbles: true }));
  const look = (px) => { lock(); window.dispatchEvent(new MouseEvent('mousemove', { movementX: Math.round(px), movementY: 0, clientX: 0, clientY: 0, bubbles: true })); };
  function lock() {
    if (document.pointerLockElement === hooks.canvas) return;
    Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => hooks.canvas });
    document.dispatchEvent(new Event('pointerlockchange'));
  }
  const later = (k, fn) => A.due.push({ at: ctx.tick + k, fn });
  function hold(codes, k) { for (const c of codes) key(c, true); later(k, () => { for (const c of codes) key(c, false); }); return k; }
  const tap = (code) => hold([code], 2);
  function click(b, k) { lock(); button(b, true); later(k, () => button(b, false)); return k; }
  const hands = createRunHands(ctx, { key, look });
  const turnTo = (b) => { if (b === null || b === undefined) return 1; look((b * Math.PI / 180) / MOUSE_SENS); return 1; };

  function nearestOf(s, pred) { const n = (s.near || []).find(pred); return n ? n[3] : null; }
  function aim(s) {
    const g = (s.near || []).filter((n) => (n[1] === 'goon' || n[1] === 'boss') && n[2] <= 4 && n[4] !== 'down' && n[4] !== 'sit' && n[4] !== 'treated');
    g.sort((a, b) => (b[5].includes('stagger') - a[5].includes('stagger')) || a[2] - b[2]);
    if (g.length) turnTo(g[0][3]);
  }
  const windowLeft = (c) => (c && c.open ? Math.max(1, Math.ceil((c.window - c.t) * 60) + 2) : WAIT);

  // id -> () => ticks the macro needs. Only the ids menuFor offers right now are accepted.
  function macro(id, s) {
    const c = s.call, M = s.mini || {};
    switch (id) {
      case 'click_begin': { const b = document.getElementById('begin'); if (b) b.click(); return 1; }
      case 'skip_intro': return tap('KeyK');
      case 'answer_lighter': case 'mini_answer_lighter': return tap('KeyS');
      case 'counter': return tap('KeyQ');
      case 'counter_hold': return hold(['KeyQ'], Math.ceil(Math.max(0, ...(s.counter || []).map((d) => d.left)) * 60) + 20);   // through his strike, then let go
      case 'answer_harder': return hold(['KeyW'], 66);
      case 'mini_answer_harder': return hold(['KeyW'], 42);
      case 'stay_still': return windowLeft(c);
      case 'mini_answer_still': return windowLeft(M.call);
      case 'answer_left': return tap('KeyA');
      case 'answer_right': return tap('KeyD');
      case 'match_modality': return tap('Space');
      case 'next_client': case 'interact_E': case 'exit_vehicle': case 'set_chair_down':
      case 'enter_car': case 'carjack': case 'repair_vehicle': return tap('KeyE');
      case 'load_chair': case 'pick_up_chair': tap('KeyE'); return 32;   // the fold: 0.5 s standing still
      case 'track_ring_on': A.track = true; return 1;
      case 'track_ring_off': A.track = false; return 1;
      case 'wait': return WAIT;
      case 'walk_fwd_1s': return hold(['KeyW'], 60);
      case 'sprint_fwd_2s': return hold(['KeyW', 'ShiftLeft'], 120);
      case 'back_off_1s': return hold(['KeyS'], 60);
      case 'strafe_left_1s': return hold(['KeyA'], 60);
      case 'strafe_right_1s': return hold(['KeyD'], 60);
      case 'turn_left_30': return turnTo(-30);
      case 'turn_right_30': return turnTo(30);
      case 'turn_around': return turnTo(180);
      case 'face_exit': return turnTo(s.tgt && s.tgt.exit ? s.tgt.exit[1] : null);
      case 'face_chair': return turnTo(s.tgt && s.tgt.chair ? s.tgt.chair[1] : null);
      case 'face_nearest_goon': return turnTo(nearestOf(s, (n) => n[1] === 'goon'));
      case 'face_nearest_car': return turnTo(nearestOf(s, (n) => n[1].startsWith('car:')));
      // The palm and the swing aim first (code does bearings): at the nearest goon within 4 m, a
      // staggered one before the rest; nobody that close and they go where the camera looks.
      case 'palm_tap': case 'swing_chair': aim(s); return click(0, 3);
      case 'palm_charge': aim(s); return click(0, 48);
      case 'jump': return tap('Space');
      case 'hold_E_massage': key('KeyE', true); A.holds.push({ code: 'KeyE', until: ctx.tick + 1500, started: false }); return 60;
      case 'keep_massaging': return 90;
      case 'let_go': for (const h of A.holds.splice(0)) key(h.code, false); return 1;
      case 'drive_fwd_2s': return hold(['KeyW'], 120);
      case 'drive_fwd_left_1s': return hold(['KeyW', 'KeyA'], 60);
      case 'drive_fwd_right_1s': return hold(['KeyW', 'KeyD'], 60);
      case 'brake_reverse_1s': return hold(['KeyS'], 60);
      case 'swerve_left': return hold(['KeyW', 'KeyA', 'Space'], 36);
      case 'swerve_right': return hold(['KeyW', 'KeyD', 'Space'], 36);
      default: { const t = hands.macro(id, s); return t === undefined ? -1 : t; }
    }
  }

  // Before each stepped tick: releases that are due, the E hold of a mini-massage (let go when it
  // ends), and the ring reflex (the absolute mouse onto the ring's last projected centre).
  // Releases due by now. Also run before a new macro presses anything: a macro's release falls on
  // the tick the next decision is made, and drained after the new press it let go of the new one
  // (two palm_charge in a row became a charge and a quick palm; open-1, 2026-09-25).
  function drainDue() {
    if (!A.due.length) return;
    const now = A.due.filter((d) => d.at <= ctx.tick);
    if (now.length) { A.due = A.due.filter((d) => d.at > ctx.tick); for (const d of now) d.fn(); }
  }
  function beforeTick() {
    drainDue();
    hands.tick();
    for (let i = A.holds.length - 1; i >= 0; i--) {
      const h = A.holds[i], ph = ctx.mini && ctx.mini.phase;
      if (ph === 'massage') h.started = true;
      if (ctx.tick >= h.until || (h.started && ph !== 'massage') || (!h.started && ctx.tick >= h.until - 1440 && ph !== 'massage')) { key(h.code, false); A.holds.splice(i, 1); }
    }
    const m = A.track && hooks.state() === 'MASSAGE' ? hooks.massageState() : null;
    if (m && m.ring && Number.isFinite(m.ring.x)) window.dispatchEvent(new MouseEvent('mousemove', { clientX: Math.round(m.ring.x), clientY: Math.round(m.ring.y), bubbles: true }));
    // Trigger point is a held click (massage/hold.js): the reflex holds the left button while the
    // modality is trigger point and lets go otherwise, and always outside the course (a button
    // still down at the pivot would charge a palm in the run).
    const hold = !!(m && m.phase === 'session' && m.modality === 'Trigger point');
    if (hold !== A.clickHeld) { A.clickHeld = hold; button(0, hold); }
  }

  // One path for act and replay. In the RUN a new decision ends the last one: the reflex stops and
  // every scheduled release fires now (an interrupted 1 s walk lets go of W), except the E hold of a
  // mini-massage, which only let_go or the massage's end releases.
  function run(id, s) {
    drainDue();
    if (s.st === 'RUN') { hands.stop(); for (const d of A.due.splice(0)) d.fn(); }
    const ticks = macro(id, s);
    A.log.push({ tick: ctx.tick, id });
    return { ok: ticks >= 0, id, ticks: Math.max(0, ticks), interruptible: s.st === 'RUN' && INTERRUPTIBLE.has(id) };
  }

  const agent = {
    get paused() { return A.paused; },
    pause(on = true) { A.paused = !!on; return A.paused; },
    // The unpaused frame loop (main.js) drains a macro's due releases too, so a hold started by act()
    // never outlives its ticks when nobody calls step() again (nitpick 2026-09-25).
    beforeTick,
    releaseAll() { hands.stop(); for (const d of A.due.splice(0)) d.fn(); for (const h of A.holds.splice(0)) key(h.code, false); if (A.clickHeld) { A.clickHeld = false; button(0, false); } },
    get tick() { return ctx.tick; },
    get track() { return A.track; },
    // What the hands still hold: scheduled releases, E holds, the running reflex (diagnostics).
    get pending() { return { due: A.due.map((d) => d.at), holds: A.holds.map((h) => ({ ...h })), reflex: hands.reflex, now: ctx.tick }; },
    ready: hooks.ready,
    log: A.log,
    // n whole ticks, or fewer on an interrupt. stopOn: a (type, data) => bool, or null for none.
    async step(n = 1, { stopOn } = {}) {
      if (A.stepping) throw new Error('CMF.agent.step: a step is already running');
      A.stepping = true; A.paused = true;
      const stop = stopOn === undefined ? INTERRUPTS : stopOn;
      let hit = null, i = 0;
      const off = onEvent((type, data) => { if (!hit && stop && stop(type, data)) hit = { type, data, tick: ctx.tick }; });
      try {
        for (; i < n && !hit; i++) { beforeTick(); hooks.stepOnce(); await nextTask(); }
      } finally { off(); A.stepping = false; }
      return { tick: ctx.tick, ran: i, interrupt: hit };
    },
    observe() {
      const s = buildSnap(), st = s.st;
      const options = menuFor(s, A);
      return { text: observeText(s, A.recent.slice(-12), A), options, state: s, tick: ctx.tick, done: END.includes(st) };
    },
    act(id) {
      const s = buildSnap(), menu = menuFor(s, A);
      if (!(id in menu)) return { ok: false, id, error: `not a valid action now (${s.st})`, options: Object.keys(menu) };
      return run(id, s);
    },
    // Replay: the same act without the menu check (a recorded action list may be replayed blind).
    replay(id) { return run(id, buildSnap()); },
  };
  return agent;
}
