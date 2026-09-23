// DOM HUD overlay: title toggle, status line, crosshair, RUN title strip. The RUN overlay (wanted,
// health, cash, floaters) lives in hud-run.js.
// The MASSAGE course skin (meter, competency, ledger, subtitles, cards) lives in hud-massage.js
// and is re-exported here so callers only ever import hud.js.
import { initMassageHud } from './hud-massage.js';
import { initRunHud } from './hud-run.js';
import { initBubbles } from './bubbles.js';

export {
  showMassageHud, setMeter, setMeterState, setCompetency, setClientInfo, setModality,
  showDialogue, hideDialogue, setPrompt, setLedger, showCard, hideCard, tearOffMassageHud, massageHudTearing,
} from './hud-massage.js';
export {
  showRunHud, setWanted, setHealth, setCash, flashChaos, floater, updateFloaters, setMini, activeFloaters,
  setBattery, setHeatLine, showStamp, hideStamp, stampText,
} from './hud-run.js';

let root = null;
let titleEl = null;
let statusEl = null;
let crosshairEl = null;
let hintEl = null;
let runTitleEl = null;
let vehicleEl = null;
let chairEl = null;

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
  runTitleEl = el('div', 'hud-runtitle', root);
  runTitleEl.append('Chair Massage ');
  el('s', '', runTitleEl).textContent = 'Fundamentals';
  runTitleEl.hidden = true;
  vehicleEl = el('div', 'hud-status hud-vehicle', root);
  vehicleEl.hidden = true;
  chairEl = el('div', 'hud-chair', root);
  chairEl.hidden = true;
  initMassageHud(root);
  initRunHud(root);
  initBubbles(root);
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
  if (hintEl.hidden !== !text) hintEl.hidden = !text;
  if (text && hintEl.textContent !== text) hintEl.textContent = text;
}

// strike: animate the line through "Fundamentals" (the pivot's hand-off to the run).
export function setRunTitle(visible, strike = false) {
  if (!runTitleEl) return;
  runTitleEl.hidden = !visible;
  runTitleEl.classList.remove('strike');
  if (visible && strike) { void runTitleEl.offsetWidth; runTitleEl.classList.add('strike'); }
}

// RUN: speed/vehicle line under the status line (empty text hides it).
export function setVehicleLine(text) {
  if (!vehicleEl) return;
  if (vehicleEl.hidden !== !text) vehicleEl.hidden = !text;
  if (text && vehicleEl.textContent !== text) vehicleEl.textContent = text;
}

// RUN: "Don't leave the chair." strip at the bottom (empty text hides it).
export function setChairStrip(text) {
  if (!chairEl) return;
  if (chairEl.hidden !== !text) chairEl.hidden = !text;
  if (text && chairEl.textContent !== text) {
    chairEl.textContent = text;
    chairEl.classList.toggle('hud-chair-warn', text === "Don't leave the chair.");
  }
}
