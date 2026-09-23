// DOM HUD overlay. Phase 1: title toggle, status line, crosshair.
// Meter / circle / wanted / cash / dialogue / cards are named stubs for later phases.

let root = null;
let titleEl = null;
let statusEl = null;
let crosshairEl = null;
let hintEl = null;

function el(tag, className, parent) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (parent) parent.appendChild(n);
  return n;
}

export function initHud(hudRoot) {
  root = hudRoot;
  titleEl = document.getElementById('title');
  statusEl = el('div', 'hud-status', root);
  crosshairEl = el('div', 'hud-crosshair', root);
  crosshairEl.hidden = true;
  hintEl = el('div', 'hud-hint', root);
  hintEl.hidden = true;
  return root;
}

export function showTitle() { if (titleEl) titleEl.hidden = false; }
export function hideTitle() { if (titleEl) titleEl.hidden = true; }

export function setStatus(text) {
  if (statusEl && statusEl.textContent !== text) statusEl.textContent = text;
}

export function setCrosshair(visible) {
  if (crosshairEl) crosshairEl.hidden = !visible;
}

export function setHint(text) {
  if (!hintEl) return;
  hintEl.hidden = !text;
  if (text && hintEl.textContent !== text) hintEl.textContent = text;
}

// --- Later-phase placeholders (names per DESIGN.md HUD list) ---
export function showMeter(_visible) {}
export function setMeter(_value, _bandLo, _bandHi) {}
export function showCircle(_visible) {}
export function setCircle(_x, _y, _r, _inside) {}
export function setWanted(_stars) {}
export function setCash(_amount) {}
export function showDialogue(_speaker, _text) {}
export function hideDialogue() {}
export function showCard(_title, _lines) {}
export function hideCard() {}
