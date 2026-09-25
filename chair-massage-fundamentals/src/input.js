// Keyboard + mouse + pointer lock. snapshot() returns a frozen per-tick view
// and clears per-tick deltas (mouse movement, pressed/released edges).
import { getState, STATES } from './state.js';

const held = new Set();       // KeyboardEvent.code values currently down
let pressedEdge = new Set();  // went down since last snapshot
let releasedEdge = new Set();
const buttons = new Set();    // mouse buttons currently down (0 left, 1 middle, 2 right)
let clickedEdge = new Set();
let dx = 0, dy = 0;           // pointer-lock movement accumulated since last snapshot
let mouseX = 0, mouseY = 0;   // absolute client position
let locked = false;
let canvasEl = null;
const lockListeners = [];

const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight',
  'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

function isEditable(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true;
}

function onKeyDown(ev) {
  // Prevent page scroll and button re-activation (a focused #begin button
  // would otherwise swallow Space/Enter) unless the user is typing in a field.
  if (GAME_KEYS.has(ev.code) && !isEditable(ev.target)) {
    ev.preventDefault();
    if (ev.target && ev.target !== document.body && typeof ev.target.blur === 'function') ev.target.blur();
  }
  if (!held.has(ev.code)) pressedEdge.add(ev.code);
  held.add(ev.code);
}
function onKeyUp(ev) {
  held.delete(ev.code);
  releasedEdge.add(ev.code);
}
function onBlur() {
  held.clear(); buttons.clear();
  pressedEdge = new Set(); releasedEdge = new Set(); clickedEdge = new Set();
  dx = dy = 0;
}

function onMouseMove(ev) {
  mouseX = ev.clientX;
  // A button released outside the window never sends mouseup: resync from the event's button mask
  // (nitpick 2026-09-25: the trigger point's hold read as held forever).
  if (ev.buttons !== undefined && !(ev.buttons & 1)) buttons.delete(0);
  mouseY = ev.clientY;
  if (locked) { dx += ev.movementX || 0; dy += ev.movementY || 0; }
}
function onMouseDown(ev) {
  buttons.add(ev.button);
  clickedEdge.add(ev.button);
}
function onMouseUp(ev) { buttons.delete(ev.button); }

function onCanvasClick() {
  if (getState() === STATES.RUN && !locked) requestLock();
}

function onLockChange() {
  locked = document.pointerLockElement === canvasEl && canvasEl !== null;
  dx = dy = 0;
  for (const fn of lockListeners) fn(locked);
}

export function requestLock() {
  if (!canvasEl || !canvasEl.requestPointerLock) return;
  try {
    const p = canvasEl.requestPointerLock();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (_) { /* denied (e.g. headless or not user-initiated) */ }
}

export function releaseLock() {
  if (document.pointerLockElement) document.exitPointerLock();
}

export function isLocked() { return locked; }
export function onLockChangeListener(fn) { lockListeners.push(fn); }

export function initInput(canvas) {
  canvasEl = canvas;
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('click', onCanvasClick);
  canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
  document.addEventListener('pointerlockchange', onLockChange);
  document.addEventListener('pointerlockerror', () => { locked = false; });
  // Escape releases lock natively in browsers; nothing else to do here.
}

// Per-tick Sets are recycled (Phase 7 perf pass): a snapshot is only read during its own tick, so
// the edge sets double-buffer and keys / mouseButtons are refilled in place.
const keysBuf = new Set(), buttonsBuf = new Set();
const spare = { pressed: new Set(), released: new Set(), clicked: new Set() };
function refill(dst, src) { dst.clear(); for (const k of src) dst.add(k); return dst; }

export function snapshot() {
  const keys = refill(keysBuf, held);
  const snap = Object.freeze({
    keys,
    pressed: pressedEdge,
    released: releasedEdge,
    forward: held.has('KeyW') || held.has('ArrowUp'),
    back: held.has('KeyS') || held.has('ArrowDown'),
    left: held.has('KeyA') || held.has('ArrowLeft'),
    right: held.has('KeyD') || held.has('ArrowRight'),
    shift: held.has('ShiftLeft') || held.has('ShiftRight'),
    space: held.has('Space'),
    spacePressed: pressedEdge.has('Space'),
    e: held.has('KeyE'),
    ePressed: pressedEdge.has('KeyE'),
    mouseButtons: refill(buttonsBuf, buttons),
    mouseLeft: buttons.has(0),
    mouseRight: buttons.has(2),
    clicked: clickedEdge,
    leftClicked: clickedEdge.has(0),
    dx, dy,
    mouseX, mouseY,
    locked,
  });
  const p = spare.pressed, r = spare.released, c = spare.clicked;
  spare.pressed = pressedEdge; spare.released = releasedEdge; spare.clicked = clickedEdge;
  pressedEdge = p; releasedEdge = r; clickedEdge = c;
  p.clear(); r.clear(); c.clear();
  dx = dy = 0;
  return snap;
}
