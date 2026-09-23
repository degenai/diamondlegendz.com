// MASSAGE HUD: a continuing-education course skin. Beige panels, serif headings,
// vertical pressure gauge, competency bar, modality panel, ledger, subtitle strip.
// Also owns the generic centred card (course intro, pivot stub). Styles live in index.html.

let wrap = null;
let els = {};
let cardEl = null;
let last = {};

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
  el('div', 'cm-kicker', head, 'Chair Massage Fundamentals · Course 101-CM');
  el('h1', '', head, 'Module 1: Pressure');
  els.client = el('div', 'cm-client', head);
  const comp = el('div', 'cm-comp', head);
  el('span', 'cm-comp-label', comp, 'Competency');
  const bar = el('div', 'cm-bar', comp);
  els.compFill = el('i', '', bar);
  els.compPct = el('b', '', comp, '0%');

  const gauge = el('div', 'cm-panel cm-gauge', wrap);
  el('h2', '', gauge, 'Pressure');
  const track = el('div', 'cm-track', gauge);
  els.hint = el('div', 'cm-hintzone', track);
  els.fill = el('div', 'cm-fill', track);
  els.needle = el('div', 'cm-needle', track);
  for (let v = 0; v <= 100; v += 10) {
    const tick = el('div', v % 50 === 0 ? 'cm-tick cm-tick-major' : 'cm-tick', track);
    tick.style.bottom = `${v}%`;
    if (v % 50 === 0) el('span', '', tick, String(v));
  }
  els.pVal = el('div', 'cm-pval', gauge, '0');
  el('div', 'cm-keys', gauge, 'W / S');

  const mod = el('div', 'cm-panel cm-mod', wrap);
  el('h2', '', mod, 'Modality');
  els.modCur = el('div', 'cm-mod-cur', mod);
  els.modReq = el('div', 'cm-mod-req', mod);
  els.modNote = el('div', 'cm-mod-note', mod, 'Space: change modality');

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
  if (wrap) wrap.hidden = !visible;
  document.body.classList.toggle('massage', !!visible);
}

export function setMeter(value, hintLo, hintHi) {
  if (!wrap) return;
  const v = Math.round(value);
  if (last.meter !== v) {
    els.fill.style.height = `${v}%`;
    els.needle.style.bottom = `${v}%`;
    els.pVal.textContent = String(v);
    last.meter = v;
  }
  const lo = Math.round(hintLo), hi = Math.round(hintHi);
  if (last.hlo !== lo || last.hhi !== hi) {
    els.hint.style.bottom = `${lo}%`;
    els.hint.style.height = `${Math.max(0, hi - lo)}%`;
    last.hlo = lo; last.hhi = hi;
  }
}

export function setMeterState(zone) {
  if (wrap && last.zone !== zone) { els.fill.dataset.zone = zone; last.zone = zone; }
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
