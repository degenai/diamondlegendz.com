// SUMMARY: the continuing-education certificate parody on the beige course skin. Run time, cash
// raised for the host cause (half the run's cash plus the massage phase's host share), tension
// released (palm and gun hits plus mini-massages), and the one unlock under a wax seal: red wax and
// UNLOCKED for an escape's main-track item, a smaller grey seal and CONSOLATION for an arrest's or
// death's consolation item (meta.js). With the get-well card, failures carry a "Get well soon" stamp.
import * as meta from '../meta.js';
import { emit } from '../events.js';

const OUTCOME = { escape: 'ESCAPED', arrest: 'WAS ARRESTED', death: 'WAS OVERWORKED', left: 'LEFT THE CHAIR' };
export const BYLINE = "Made by The People's Elbow, a.k.a. Alex Adamczyk, LMT.";
export const LAST_LINE = "The real chair is at The People's Elbow, Woodstock, GA.";
const LINK = 'https://peoples-elbow.com';

let wrap = null;
let licensee = 'Licensee';

function el(tag, cls, parent, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  if (parent) parent.appendChild(n);
  return n;
}

const usd = (n) => `$${(Math.round(n * 100) / 100).toFixed(Number.isInteger(n) ? 0 : 2)}`;
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// RUN entry: fresh counters.
export function startStats(ctx) {
  ctx.runStats = { start: ctx.time, tension: 0, palmSeen: ctx.player.lastPalm || null, miniSeen: 0 };
}

// Per RUN tick: count landed palms (palm.js leaves p.lastPalm) and mini-massages.
export function trackStats(ctx) {
  const R = ctx.runStats, p = ctx.player;
  if (!R) return;
  if (p.lastPalm && p.lastPalm !== R.palmSeen) { R.palmSeen = p.lastPalm; if (p.lastPalm.hit) R.tension++; }
  const done = ctx.mini ? ctx.mini.done : 0;
  if (done > R.miniSeen) { R.tension += done - R.miniSeen; R.miniSeen = done; }
}

// SUMMARY entry: book the run in the meta, then show the certificate.
export function showSummary(ctx, root, onReturn) {
  const reason = (ctx.runEnd && ctx.runEnd.reason) || 'arrest';
  const R = ctx.runStats || { start: ctx.time, tension: 0 };
  const endT = ctx.runEnd ? ctx.runEnd.time : ctx.time;
  const seconds = Math.max(0, endT - R.start);
  const host = (ctx.runCash || 0) / 2 + (ctx.massageTotals ? ctx.massageTotals.host : 0);
  const unlock = meta.recordRun(ctx.meta, reason, seconds, (ctx.runCash || 0) + (ctx.massageTotals ? ctx.massageTotals.you : 0));
  const track = unlock ? unlock.track : null;
  const failed = reason === 'arrest' || reason === 'death';
  ctx.lastSummary = { reason, seconds, host, tension: R.tension, unlock: unlock ? unlock.id : null, track };
  emit('run.end', { reason, time: Math.round(seconds * 10) / 10, cash: (ctx.runCash || 0) + (ctx.massageTotals ? ctx.massageTotals.you : 0), runCash: ctx.runCash || 0, host, tension: R.tension, unlock: unlock ? unlock.id : null, track });

  hideSummary();
  wrap = el('div', 'cert-wrap', root);
  const c = el('div', 'cert', wrap);
  el('div', 'cert-kicker', c, 'Continuing Education Portal · Course 101-CM · 0.5 CE hours');
  el('h1', '', c, 'CERTIFICATE OF COMPLETION');
  el('p', 'cert-line', c, 'This certifies that the licensee');
  const name = el('input', 'cert-name', c);
  name.type = 'text'; name.maxLength = 40; name.value = licensee; name.setAttribute('aria-label', 'Licensee name');
  name.addEventListener('input', () => { licensee = name.value || 'Licensee'; });
  el('div', `cert-outcome cert-${reason}`, c, OUTCOME[reason] || OUTCOME.arrest);
  // The course voice reads the outcome once, as the certificate appears.
  if (ctx.voice) ctx.voice.speak(`This certifies that the licensee ${(OUTCOME[reason] || OUTCOME.arrest).toLowerCase()}.`, 'narrator', 'narrator');
  el('p', 'cert-line', c, 'Chair Massage Fundamentals, Module 1: Pressure');
  const stats = el('div', 'cert-stats', c);
  for (const [k, v] of [['Run time', clock(seconds)], ['Cash raised for the host cause', usd(host)], ['Tension released', String(R.tension)]]) {
    const row = el('div', 'cert-row', stats);
    el('span', '', row, k); el('b', '', row, v);
  }
  const u = el('div', 'cert-unlock', c);
  const seal = el('div', 'cert-seal', u, 'E');
  seal.setAttribute('aria-hidden', 'true');
  const ut = el('div', 'cert-unlock-text', u);
  if (unlock) {
    if (track === 'consolation') {
      // Smaller seal, grey wax (inline: ui.css belongs to the course skin and knows one seal).
      u.classList.add('cert-consolation');
      Object.assign(seal.style, { width: '44px', height: '44px', fontSize: '20px', color: '#4a4a4a',
        background: 'radial-gradient(circle at 35% 30%, #c4c4c4, #8a8a8a 60%, #5c5c5c)', textShadow: '1px 1px 0 rgba(255,255,255,.45)' });
    }
    el('div', 'cert-unlock-kicker', ut, track === 'consolation' ? 'Consolation' : 'Unlocked');
    el('div', 'cert-unlock-name', ut, unlock.name);
    el('div', 'cert-unlock-desc', ut, unlock.desc);
  } else {
    u.classList.add('cert-none');
    el('div', 'cert-unlock-name', ut, reason === 'left' ? 'No unlock. You left the chair.' : failed ? meta.NO_CONSOLATION : 'Nothing left to unlock.');
  }
  if (failed && meta.has(ctx.meta, 'getwellcard')) {
    const gw = el('div', 'cert-getwell', c, 'Get well soon');
    Object.assign(gw.style, { display: 'inline-block', margin: '2px 0 6px', padding: '2px 8px', border: '2px solid #3d5a73',
      color: '#3d5a73', font: 'bold 12px var(--cm-serif)', letterSpacing: '.08em', textTransform: 'uppercase', transform: 'rotate(-4deg)', opacity: '.8' });
  }
  const btn = el('button', 'cert-btn', c, 'Return to the chair');
  btn.type = 'button';
  btn.addEventListener('click', () => { btn.blur(); onReturn(); });
  const m = ctx.meta;
  el('div', 'cert-meta', c, `Runs ${m.runs} · Escapes ${m.escapes}${m.bestTime ? ` · Best escape ${clock(m.bestTime)}` : ''}`);
  el('div', 'cert-foot', c, BYLINE);
  const a = el('a', 'cert-last', c, LAST_LINE);
  a.href = LINK; a.target = '_blank'; a.rel = 'noopener';
  emit('certificate', { outcome: OUTCOME[reason] || OUTCOME.arrest, unlock: unlock ? unlock.name : null, track, runs: m.runs, escapes: m.escapes });
  return ctx.lastSummary;
}

export function hideSummary() {
  if (wrap) wrap.remove();
  wrap = null;
}
