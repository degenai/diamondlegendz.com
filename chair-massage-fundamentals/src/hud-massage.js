// MASSAGE HUD: a continuing-education course skin. Beige panels, serif headings,
// competency bar, modality panel, ledger, subtitle strip. There is no pressure gauge any more (owner
// ruling 2026-09-24, Andy: "the pressure meter reads too heavy"): the client calls out and the player
// answers (massage/meter.js). While a call is open a small cue sits beside the ring: the key and a
// bar that runs down with the window. The ring mesh itself turns green or red with the last answer
// (guide.js). CLIENT WANTS sits over the ring (with a Space keycap, "SPACE to match", whenever the
// modality is wrong). The guided first client's prompts (setCoach) sit under the ring.
// Also owns the generic centred card (course intro, pivot stub). Styles live in index.html.

let wrap = null;
let els = {};
let cardEl = null;
let last = {};
let tearTimer = 0;
const GAP = 9;            // px between the ring's outer edge and the labels around it
const G = { ring: null, call: null, flash: null };
// What the cue says per call (the key, then the word). "Right there" has no key: hands off W and S.
const CUE = {
  lighter: ['S', 'lighter'], harder: ['W', 'hold: harder'], still: ['', 'hold still: no W / S'],
  left: ['A', 'to the left'], right: ['D', 'to the right'],
};

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

  // The call cue (styled inline: index.html's CSS still carries the old gauge's rules, unused).
  els.call = el('div', 'cm-call', wrap);
  Object.assign(els.call.style, {
    position: 'absolute', left: '0', top: '0', whiteSpace: 'nowrap', background: 'rgba(35,30,20,.78)',
    border: '1px solid var(--cm-rule)', padding: '4px 10px 6px', font: '16px var(--cm-serif)', color: '#fdf8ea',
  });
  els.callKey = el('span', 'cm-wants-key', els.call);
  els.callKey.style.marginLeft = '0';
  els.callKbd = el('kbd', '', els.callKey, 'S');
  els.callWord = el('span', '', els.call, '');
  const track = el('div', '', els.call);
  Object.assign(track.style, { height: '4px', marginTop: '4px', background: 'rgba(253,248,234,.25)' });
  els.callBar = el('i', '', track);
  Object.assign(els.callBar.style, { display: 'block', height: '100%', width: '100%', background: '#ffd27a' });
  els.call.hidden = true;
  els.wants = el('div', 'cm-wants', wrap);
  els.wantsText = el('span', '', els.wants);
  els.wantsKey = el('span', 'cm-wants-key', els.wants);
  el('kbd', '', els.wantsKey, 'SPACE');
  els.wantsKey.appendChild(document.createTextNode(' to match'));
  els.wantsKey.hidden = true;
  els.wants.hidden = true;
  els.coach = el('div', 'cm-coach', wrap);
  els.coach.hidden = true;

  const mod = el('div', 'cm-panel cm-mod', wrap);
  el('h2', '', mod, 'Modality');
  els.modCur = el('div', 'cm-mod-cur', mod);
  els.modReq = el('div', 'cm-mod-req', mod);
  els.modNote = el('div', 'cm-mod-note', mod, 'A / D: change modality · Space: match the client');

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
  els.call.hidden = true;
  wrap.classList.add('cm-tear');
  document.body.classList.remove('massage');
  tearTimer = setTimeout(() => { tearTimer = 0; showMassageHud(false); }, 600);
}
export function massageHudTearing() { return !!wrap && wrap.classList.contains('cm-tear'); }

// The open call (null hides the cue): { name, frac } where frac is the window left, 1 -> 0.
export function setCall(c) {
  G.call = c ? { name: c.name, frac: Math.max(0, Math.min(1, c.frac)) } : null;
  if (!wrap) return;
  els.call.hidden = !c || !G.ring;
  if (!c) return;
  const [k, word] = CUE[c.name] || ['', c.name];
  els.callKey.hidden = !k;
  setText('callKbd', els.callKbd, k);
  setText('callWord', els.callWord, word);
  els.callBar.style.width = `${(G.call.frac * 100).toFixed(1)}%`;
}

// The ring's colour for the tests ('ok', 'bad' or null); guide.js paints the mesh itself.
export function setRingFlash(f) { G.flash = f || null; }

// Called every session tick with the guide's projected ring (null hides the labels around it).
export function setRing(r) {
  G.ring = r ? { x: r.x, y: r.y, ax: r.ax, ay: r.ay, bx: r.bx, by: r.by, inside: r.inside !== false } : null;
  if (!wrap) return;
  const on = !!r && Number.isFinite(r.x) && Math.hypot(r.ax, r.ay) > 1;
  if (!on) { els.wants.hidden = true; els.call.hidden = true; return; }
  const rpx = (Math.hypot(r.ax, r.ay) + Math.hypot(r.bx, r.by)) / 2;
  const k = 1 + GAP / Math.max(1, rpx);
  const rx = Math.hypot(r.ax, r.bx) * k, ry = Math.hypot(r.ay, r.by) * k;
  els.call.style.transform = `translate(${Math.round(r.x + rx + 8)}px, ${Math.round(r.y)}px) translate(0, -50%)`;
  els.call.hidden = !G.call;
  els.wants.style.transform = `translate(${Math.round(r.x)}px, ${Math.round(r.y - ry - 14)}px) translate(-50%, -100%)`;
  els.wants.hidden = !last.wantsText;
  // The coach prompt hangs under the ring (and stays where the ring was once the ring is gone).
  els.coach.style.transform = `translate(${Math.round(r.x)}px, ${Math.round(r.y + ry + 18)}px) translate(-50%, 0)`;
}

// The guided first client's prompt ('' hides it).
export function setCoach(text) {
  if (!wrap) return;
  els.coach.hidden = !text;
  setText('coach', els.coach, text || '');
}

// Debug / tests: what the HUD around the ring shows right now. `arc` and `number` are the old
// pressure gauge's arc and number: both must stay false.
export function gaugeState() {
  return {
    ring: G.ring, flash: G.flash, call: G.call,
    arc: !!wrap && !!wrap.querySelector('svg, .cm-ring-val'), number: !!wrap && !!wrap.querySelector('.cm-ring-val'),
    cue: els.call && !els.call.hidden ? els.call.textContent : '',
    wants: els.wants && !els.wants.hidden ? last.wantsText || '' : '', wantsPulse: !!els.wants && els.wants.classList.contains('cm-pulse'),
    wantsSpace: !!els.wantsKey && !els.wants.hidden && !els.wantsKey.hidden,
    coach: els.coach && !els.coach.hidden ? els.coach.textContent : '',
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
  setText('wants', els.wantsText, last.wantsText);
  els.wants.classList.toggle('cm-pulse', !ok);
  els.wantsKey.hidden = ok;                 // "SPACE to match" only while they do not match
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
