// MASSAGE HUD: a continuing-education course skin. Beige panels, serif headings,
// competency bar, modality panel, ledger, subtitle strip. Pressure has no panel: the stroke ring
// is the gauge (owner ruling 2026-09-23). An SVG arc on the projected ring fills clockwise from the
// bottom with pressure 0..100, the hinted sweet band is a lighter arc on the same ellipse, red over
// the band, green in it; the number sits small beside it and CLIENT WANTS sits over it.
// Also owns the generic centred card (course intro, pivot stub). Styles live in index.html.

let wrap = null;
let els = {};
let cardEl = null;
let last = {};
let tearTimer = 0;
const SVGNS = 'http://www.w3.org/2000/svg';
// The gauge ellipse sits a fixed gap outside the ring mesh's outer edge. A fixed pixel gap (not a
// fixed ratio) keeps it clear of the ring now that rings are 27 to 40 px (third play, 2026-09-23).
const GAUGE_GAP = 9;      // px
const STROKE = { track: 8, band: 12, fill: 6 }; // px; a little heavier than the CSS for the small rings
const OFF_RING = 0.5;     // gauge opacity while the cursor is off the ring (the mesh dims too)
const G = { value: 0, lo: 0, hi: 0, zone: 'under', ring: null, scale: 1 };

function svg(tag, cls, parent) {
  const n = document.createElementNS(SVGNS, tag);
  if (cls) n.setAttribute('class', cls);
  parent.appendChild(n);
  return n;
}

function el(tag, className, parent, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text) n.textContent = text;
  if (parent) parent.appendChild(n);
  return n;
}

function setText(key, node, text) {
  if (last[key] !== text) { node.textContent = text; last[key] = text; }
}

export function initMassageHud(root) {
  wrap = el('div', 'cm-hud', root);
  wrap.hidden = true;

  const head = el('div', 'cm-panel cm-head', wrap);
  el('div', 'cm-kicker', head, 'Chair Massage Fundamentals · Course 101-CM · Instructor: Alex Adamczyk, LMT');
  el('h1', '', head, 'Module 1: Pressure');
  els.client = el('div', 'cm-client', head);
  const comp = el('div', 'cm-comp', head);
  el('span', 'cm-comp-label', comp, 'Competency');
  const bar = el('div', 'cm-bar', comp);
  els.compFill = el('i', '', bar);
  els.compPct = el('b', '', comp, '0%');

  els.ringSvg = svg('svg', 'cm-ring', wrap);
  els.ringTrack = svg('path', 'cm-ring-track', els.ringSvg);
  els.ringBand = svg('path', 'cm-ring-band', els.ringSvg);
  els.ringFill = svg('path', 'cm-ring-fill', els.ringSvg);
  els.ringTrack.style.strokeWidth = `${STROKE.track}px`;
  els.ringBand.style.strokeWidth = `${STROKE.band}px`;
  els.ringFill.style.strokeWidth = `${STROKE.fill}px`;
  els.ringSvg.style.display = 'none';
  els.pVal = el('div', 'cm-ring-val', wrap, '0');
  els.pVal.hidden = true;
  els.wants = el('div', 'cm-wants', wrap);
  els.wants.hidden = true;

  const mod = el('div', 'cm-panel cm-mod', wrap);
  el('h2', '', mod, 'Modality');
  els.modCur = el('div', 'cm-mod-cur', mod);
  els.modReq = el('div', 'cm-mod-req', mod);
  els.modNote = el('div', 'cm-mod-note', mod, 'A / D: change modality');

  const ledger = el('div', 'cm-panel cm-ledger', wrap);
  el('h2', '', ledger, 'Ledger');
  els.ledger = el('div', 'cm-ledger-body', ledger, 'No payments yet.');

  els.prompt = el('div', 'cm-prompt', wrap);
  els.prompt.hidden = true;
  els.sub = el('div', 'cm-sub', wrap);
  els.subWho = el('b', '', els.sub);
  els.subText = el('span', '', els.sub);
  els.sub.hidden = true;

  cardEl = el('div', 'cm-card', root);
  cardEl.hidden = true;
  els.cardInner = el('div', 'cm-card-inner', cardEl);
}

export function showMassageHud(visible) {
  if (tearTimer) { clearTimeout(tearTimer); tearTimer = 0; }
  if (wrap) { wrap.hidden = !visible; wrap.classList.remove('cm-tear'); }
  document.body.classList.toggle('massage', !!visible);
}

// PIVOT -> RUN: the course panels slide off the screen over 0.6 s, then the skin is gone.
export function tearOffMassageHud() {
  if (!wrap || wrap.hidden) return;
  els.sub.hidden = true;
  wrap.classList.add('cm-tear');
  document.body.classList.remove('massage');
  tearTimer = setTimeout(() => { tearTimer = 0; showMassageHud(false); }, 600);
}
export function massageHudTearing() { return !!wrap && wrap.classList.contains('cm-tear'); }

export function setMeter(value, hintLo, hintHi) {
  G.value = Math.max(0, Math.min(100, value));
  G.lo = Math.max(0, Math.min(100, hintLo)); G.hi = Math.max(G.lo, Math.min(100, hintHi));
  if (!wrap) return;
  const v = Math.round(G.value);
  if (last.meter !== v) { els.pVal.textContent = String(v); last.meter = v; }
}

export function setMeterState(zone) {
  G.zone = zone;
  if (wrap && last.zone !== zone) { els.ringSvg.dataset.zone = zone; els.pVal.dataset.zone = zone; last.zone = zone; }
}

// Arc on the projected ring from pressure fraction f0 to f1 (0 = bottom, clockwise on screen).
// r: { x, y, ax, ay, bx, by } where a/b are the ring's in-plane axes in px (b points up the spine).
function arc(r, f0, f1) {
  if (f1 - f0 <= 1e-4) return '';
  const k = G.scale, dir = r.ax * r.by - r.ay * r.bx > 0 ? 1 : -1; // screen y is down
  const n = Math.max(2, Math.ceil((f1 - f0) * 72));
  let d = '';
  for (let i = 0; i <= n; i++) {
    const f = f0 + ((f1 - f0) * i) / n;
    const phi = -Math.PI / 2 + dir * f * Math.PI * 2;
    const c = Math.cos(phi) * k, s = Math.sin(phi) * k;
    d += `${i ? 'L' : 'M'}${(r.x + r.ax * c + r.bx * s).toFixed(1)} ${(r.y + r.ay * c + r.by * s).toFixed(1)}`;
  }
  return d;
}

// Called every session tick with the guide's projected ring (null hides the gauge).
export function setRing(r) {
  G.ring = r ? { x: r.x, y: r.y, ax: r.ax, ay: r.ay, bx: r.bx, by: r.by, inside: r.inside !== false } : null;
  if (!wrap) return;
  const on = !!r && Number.isFinite(r.x) && Math.hypot(r.ax, r.ay) > 1;
  els.ringSvg.style.display = on ? '' : 'none';
  els.pVal.hidden = !on;
  if (!on) { els.wants.hidden = true; return; }
  const rpx = (Math.hypot(r.ax, r.ay) + Math.hypot(r.bx, r.by)) / 2;
  G.scale = 1 + GAUGE_GAP / Math.max(1, rpx);
  const op = G.ring.inside ? '1' : String(OFF_RING);
  if (last.ringOp !== op) { // on the paths, not the svg: the tear-off's opacity rule stays in charge
    for (const n of [els.ringTrack, els.ringBand, els.ringFill]) n.style.opacity = op;
    last.ringOp = op;
  }
  els.ringTrack.setAttribute('d', arc(r, 0, 0.9999));
  els.ringBand.setAttribute('d', arc(r, G.lo / 100, G.hi / 100));
  els.ringFill.setAttribute('d', arc(r, 0, G.value / 100));
  const rx = Math.hypot(r.ax, r.bx) * G.scale, ry = Math.hypot(r.ay, r.by) * G.scale;
  els.pVal.style.transform = `translate(${Math.round(r.x + rx + 10)}px, ${Math.round(r.y - 9)}px)`;
  els.wants.style.transform = `translate(${Math.round(r.x)}px, ${Math.round(r.y - ry - 14)}px) translate(-50%, -100%)`;
  els.wants.hidden = !last.wantsText;
}

// Debug / tests: what the gauge is drawing right now.
export function gaugeState() {
  return {
    value: G.value, lo: G.lo, hi: G.hi, zone: G.zone, ring: G.ring, scale: G.scale, opacity: els.ringFill ? els.ringFill.style.opacity || '1' : '', visible: !!els.ringSvg && els.ringSvg.style.display !== 'none',
    fillPath: els.ringFill ? els.ringFill.getAttribute('d') || '' : '',
    wants: els.wants && !els.wants.hidden ? els.wants.textContent : '', wantsPulse: !!els.wants && els.wants.classList.contains('cm-pulse'),
  };
}

export function setCompetency(pct) {
  if (!wrap) return;
  const v = Math.max(0, Math.min(100, Math.floor(pct)));
  if (last.comp !== v) { els.compFill.style.width = `${v}%`; els.compPct.textContent = `${v}%`; last.comp = v; }
}

export function setClientInfo(text) { if (wrap) setText('client', els.client, text); }

export function setModality(current, requested) {
  if (!wrap) return;
  setText('modCur', els.modCur, current);
  setText('modReq', els.modReq, requested ? `Client requested: ${requested}` : '');
  const ok = !requested || current === requested;
  els.modCur.classList.toggle('cm-wrong', !ok);
  last.wantsText = requested ? `CLIENT WANTS: ${requested.toUpperCase()}` : '';
  setText('wants', els.wants, last.wantsText);
  els.wants.classList.toggle('cm-pulse', !ok);
  if (!requested) els.wants.hidden = true;
}

export function showDialogue(speaker, text) {
  if (!wrap) return;
  els.sub.hidden = !text;
  setText('who', els.subWho, speaker ? `${speaker}: ` : '');
  setText('say', els.subText, text || '');
}
export function hideDialogue() { showDialogue('', ''); }

export function setPrompt(text) {
  if (!wrap) return;
  els.prompt.hidden = !text;
  setText('prompt', els.prompt, text || '');
}

// rows: array of strings; first row is emphasised.
export function setLedger(rows) {
  if (!wrap) return;
  const key = rows.join('|');
  if (last.ledger === key) return;
  last.ledger = key;
  els.ledger.textContent = '';
  rows.forEach((r, i) => el('div', i === 0 ? 'cm-ledger-top' : 'cm-ledger-row', els.ledger, r));
}

// variant: 'course' (beige, centred) or 'black' (full-screen black).
export function showCard(title, lines = [], variant = 'course') {
  if (!cardEl) return;
  cardEl.className = `cm-card cm-card-${variant}`;
  els.cardInner.textContent = '';
  el('h2', '', els.cardInner, title);
  for (const l of lines) el('p', '', els.cardInner, l);
  cardEl.hidden = false;
}
export function hideCard() { if (cardEl) cardEl.hidden = true; }
