// The session log (DESIGN.md "Playtesting with Jev", milestone 0): an in-memory NDJSON-able list of
// every event (events.js hands each one over), a `snap` of the whole situation every SNAP ticks
// (?snap=N in Hz, default 4, 0 off) and an `input` entry whenever the held keys or buttons change
// (mouse movement coalesced to 10 a second). Never written to localStorage: the 2,000-event ring in
// events.js stays events only. Capped at about 20 minutes of ticks. A harness pulls increments with
// CMF.session.since(seq); the watcher gets the latest snapshot once a second on SESSION_CHANNEL and
// saves the whole log with "Download session" (it asks for CMF.session.dump() over the channel).
// The snapshot schema is docs/playtest-jev.md section 2d. Bearings are degrees relative to where the
// camera looks (+ = right), from the player's camera yaw, never the camera pose (the palm's shake
// jitters that with Math.random): a replay on the same seed and inputs gives the same bytes.
import { getState } from './state.js';
import { SESSION_CHANNEL } from './events.js';
import { chairState, chairWorldPos } from './entities/chair.js';
import { hostile, copHostile } from './entities/hostile.js';
import { playerCash, interaction, JACK_SPEED } from './entities/interact.js';
import { openCounters } from './entities/goon-counter.js';

const CAP_TICKS = 20 * 60 * 60;   // 20 min at 60 ticks/s
const MOUSE_EVERY = 6;            // ticks between coalesced mouse entries (10/s)
const NEAR_R = 40, NEAR_N = 8;
const r1 = (x) => Math.round(x * 10) / 10, r2 = (x) => Math.round(x * 100) / 100;
const deg = (a) => Math.round(wrap(a) * 180 / Math.PI);
function wrap(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }

let ctx = null, hooks = {}, chan = null;
let log = [], seq = 0, every = 15, lastHurt = null;
const IN = { keys: '', btn: '', dx: 0, dy: 0, mx: null, my: null, lastMouse: -1e9 };

export function initSession(c, h = {}) {
  ctx = c; hooks = h;
  const q = new URLSearchParams(window.location.search).get('snap');
  const hz = q === null ? 4 : Number(q);
  every = hz > 0 && Number.isFinite(hz) ? Math.max(1, Math.round(60 / hz)) : 0;
  try {
    chan = new BroadcastChannel(SESSION_CHANNEL);
    chan.onmessage = (m) => { if (m.data && m.data.want === 'dump') chan.postMessage({ dump: dump(), n: log.length }); };
  } catch (_) { chan = null; }
  return api;
}

// Every entry gets a sequence number; old ticks go in chunks (one splice per ~10 s, not per push).
export function record(entry) {
  entry.seq = ++seq;
  log.push(entry);
  const tick = entry.tick || 0;
  if (log.length > 1000 && tick - log[0].tick > CAP_TICKS + 600) {
    let i = 0;
    while (i < log.length && tick - log[i].tick > CAP_TICKS) i++;
    log.splice(0, i);
  }
}

// events.js sink: the event as the ring keeps it, plus its sequence number.
export function recordEvent(ev) { if (ev.type === 'damage') lastHurt = ev.data && ev.data.source; record({ tick: ev.tick, t: ev.t, run: ev.run, wall: ev.wall, type: ev.type, data: ev.data }); }

// Per tick, right after input.snapshot(): an entry when keys or buttons change; mouse at most 10/s.
export function recordInput(inp) {
  if (!inp) return;
  const keys = [...inp.keys].sort().join(','), btn = [...inp.mouseButtons].sort().join(',');
  IN.dx += inp.dx || 0; IN.dy += inp.dy || 0;
  const moved = IN.dx !== 0 || IN.dy !== 0 || inp.mouseX !== IN.mx || inp.mouseY !== IN.my;
  const changed = keys !== IN.keys || btn !== IN.btn;
  if (!changed && !(moved && ctx.tick - IN.lastMouse >= MOUSE_EVERY)) return;
  const e = { tick: ctx.tick, type: 'input', keys, btn };
  if (moved) { e.dx = IN.dx; e.dy = IN.dy; e.mx = inp.mouseX; e.my = inp.mouseY; IN.lastMouse = ctx.tick; }
  IN.keys = keys; IN.btn = btn; IN.dx = 0; IN.dy = 0; IN.mx = inp.mouseX; IN.my = inp.mouseY;
  record(e);
}

// Per tick, after the sim: a snapshot every `every` ticks; the watcher's copy once a second.
export function sessionTick() {
  if (!every || ctx.tick % every) return;
  const s = buildSnap();
  record(s);
  if (chan && ctx.tick % 60 < every) { try { chan.postMessage(s); } catch (_) { /* ignore */ } }
}

export function since(n = 0) {
  let lo = 0, hi = log.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (log[m].seq <= n) lo = m + 1; else hi = m; }
  return log.slice(lo);
}
export function dump(from = 0) { return since(from).map((e) => JSON.stringify(e)).join('\n') + '\n'; }
export const api = { since, dump, get seq() { return seq; }, get size() { return log.length; }, get every() { return every; }, snap: () => buildSnap() };

// ---- the snapshot ----

// Where the camera looks, as a heading (atan2(x, z) of the view direction), from the sim's yaw.
export function heading(p) {
  const cy = p.vehicle ? (p.chaseYaw ?? p.vehicle.yaw + Math.PI) + (p.orbitYaw || 0) : p.camYaw;
  return cy + Math.PI;
}
// Relative bearing of (x, z) from (fx, fz) for heading h: degrees, + = right.
export function bearing(h, fx, fz, x, z) { return deg(h - Math.atan2(x - fx, z - fz)); }

const txt = (sel) => { const n = document.querySelector(sel); return n && !n.hidden ? n.textContent : ''; };
export function hudText(st) {
  if (st === 'MASSAGE' || st === 'PIVOT') {
    return { prompt: txt('.cm-prompt'), coach: txt('.cm-coach'), sub: txt('.cm-sub'), card: txt('.cm-card'), cue: txt('.cm-call'), wants: txt('.cm-wants') };
  }
  if (st === 'TITLE') return { title: txt('#title') ? 'title screen' : '' };
  return { hint: txt('.hud-hint'), onb: txt('.rh-onboard'), veh: txt('.hud-vehicle'), strip: txt('.hud-chair'), heat: txt('.rh-heat'), stamp: txt('.rh-stamp'), mini: txt('.rh-mini-call') };
}

function heldText(inp) {
  if (!inp) return '';
  const k = [...inp.keys].sort();
  for (const b of [...inp.mouseButtons].sort()) k.push(`M${b}`);
  return k.join('+');
}

function kindOf(e) {
  if (e.kind === 'goon') return e.boss ? 'boss' : 'goon';
  if (e.kind === 'cop') return e.rank === 'ranger' ? 'ranger' : 'cop';
  return e.kind;
}
function tagOf(e) {
  if (e.kind === 'goon') return [e.state === 'windup' ? e.vmove || (e.grab ? 'grab' : e.bat ? 'bat' : 'shove') : e.bat ? 'bat' : '', e.cling ? 'cling' : '', e.stunT > 0 && !(e.knockedT > 0) ? 'stagger' : ''].filter(Boolean).join(',');
  if (e.kind === 'ped') return [e.regular ? 'regular' : '', e.sore ? 'sore' : '', e.paid ? 'paid' : '', e.knockedT > 0 ? 'down' : ''].filter(Boolean).join(',');
  if (e.kind === 'cop') return e.knockedT > 0 ? 'down' : e.standDown ? 'standdown' : '';
  return '';
}

function nearList(p, h, fx, fz) {
  const out = [];
  const R2 = NEAR_R * NEAR_R;
  for (const e of ctx.npcs || []) {
    const d2 = (e.pos.x - fx) ** 2 + (e.pos.z - fz) ** 2;
    if (d2 > R2) continue;
    const threat = e.kind === 'goon' ? hostile(e) : e.kind === 'cop' ? copHostile(e) : false;
    out.push([threat ? 0 : 1, d2, [`${kindOf(e)[0]}${e.id}`, kindOf(e), r1(Math.sqrt(d2)), bearing(h, fx, fz, e.pos.x, e.pos.z), e.knockedT > 0 ? 'down' : e.state || '', tagOf(e)]]);
  }
  for (const v of (ctx.world && ctx.world.vehicles) || []) {
    if (v.removed || v.driver === p) continue;
    const d2 = (v.pos.x - fx) ** 2 + (v.pos.z - fz) ** 2;
    if (d2 > R2) continue;
    const who = v.driver ? (v.driver.kind === 'goon' ? 'goons' : v.driver.kind === 'cop' ? 'cops' : 'driven') : 'parked';
    const tag = [v.franchise ? 'van' : '', v.parked === false ? 'keys' : '', v.stolen ? 'stolen' : '', `hp${Math.round(v.hp ?? 100)}`].filter(Boolean).join(',');
    out.push([who === 'goons' || who === 'cops' ? 0 : 1, d2, [`v${v.id}`, `car:${v.type}`, r1(Math.sqrt(d2)), bearing(h, fx, fz, v.pos.x, v.pos.z), who, tag]]);
  }
  out.sort((a, b) => a[0] - b[0] || a[1] - b[1] || (a[2][0] < b[2][0] ? -1 : 1));
  return out.slice(0, NEAR_N).map((r) => r[2]);
}

// The nearest vehicle he could take on foot, any distance: [id, type, dist, bearing, 'enter' | 'carjack'].
function nearestTakeable(p, h, fx, fz) {
  if (p.vehicle) return null;
  let best = null, bd = Infinity;
  for (const v of (ctx.world && ctx.world.vehicles) || []) {
    if (v.removed) continue;
    const how = !v.driver ? 'enter' : v.civilian && Math.abs(v.speed) < JACK_SPEED ? 'carjack' : null;
    if (!how) continue;
    const d2 = (v.pos.x - fx) ** 2 + (v.pos.z - fz) ** 2;
    if (d2 < bd) { bd = d2; best = [`v${v.id}`, v.type, r1(Math.sqrt(d2)), bearing(h, fx, fz, v.pos.x, v.pos.z), how, Math.round(v.hp ?? 100)]; }
  }
  return best;
}

function callOf(c) { return c ? { name: c.name, key: c.key || 'none', open: !!c.open, t: r2(c.t || 0), window: c.window } : null; }

export function buildSnap() {
  const st = getState(), s = { tick: ctx.tick, type: 'snap', t: r2(ctx.time), st, ts: ctx.timeScale ?? 1 };
  const inp = ctx.input;
  if (st === 'MASSAGE' || st === 'PIVOT') {
    const m = hooks.massageState ? hooks.massageState() : null;
    if (m) {
      s.m = { phase: m.phase, idx: m.clientIndex, n: m.clientCount, client: m.clientId, seg: m.segment, segs: m.segments.length, live: m.segmentLive,
        comp: r1(m.competency), mod: m.modality, want: m.requested, inside: !!m.inside, ring: m.ring ? [Math.round(m.ring.x), Math.round(m.ring.y), Math.round(m.ring.r || 0)] : null,
        next: m.nextCallIn === null ? null : r1(m.nextCallIn), paid: m.paid.length };
      s.call = callOf(m.call);
    }
    if (st === 'PIVOT' && hooks.pivotState) { const P = hooks.pivotState(); s.pv = P ? { phase: P.phase, t: r1(P.t || 0) } : null; }
  } else if (st !== 'TITLE' && ctx.player) {
    const p = ctx.player, v = p.vehicle, at = v ? v.pos : p.pos, h = heading(p);
    const cs = chairState(ctx.world), cw = chairWorldPos(ctx), esc = ctx.world.spawns && ctx.world.spawns.escape;
    const vel = v ? v.vel : p.vel;
    s.p = { x: r1(at.x), z: r1(at.z), y: r1(at.y), yaw: deg(v ? v.yaw : p.yaw), cam: deg(h), pitch: Math.round((p.camPitch || 0) * 180 / Math.PI),
      spd: r1(Math.hypot(vel.x, vel.z)), hp: Math.round(p.hp), sta: p.staminaMax ? r2(p.stamina / p.staminaMax) : 1,
      veh: v ? v.type : null, vhp: v ? Math.round(v.hp ?? 100) : null, kn: r1(Math.max(0, p.knockedT || 0)), chg: p.chargeT >= 0 ? r2(p.chargeT) : 0,
      chair: cs.where, dur: Math.round(cs.durability), bat: ctx.perks && ctx.perks.gun >= 0 ? Math.round(p.battery ?? 100) : null,
      gun: !!p.gunEquipped, lock: !!(inp && inp.locked), mass: !!p.massaging,
      it: interaction(p, ctx).act, cin: cs.where === 'vehicle' && cs.vehicle ? `v${cs.vehicle.id}` : null, vid: v ? `v${v.id}` : null };
    const w = ctx.wanted;
    // seen: a cop has line of sight (the level cannot fall); decay: seconds of the 25 s countdown gone.
    s.w = { lv: w.level, heat: r2(w.heat), rise: w.risingT > 0, arrestT: r2((ctx.police && ctx.police.arrestT) || 0), seen: !!w.seen, decay: r1(w.decayT || 0) };
    s.cash = r2(playerCash(ctx));
    const tgt = (q) => { if (!q) return null; const d = Math.hypot(q.x - at.x, q.z - at.z); return d < 1.5 ? [0, null] : [Math.round(d), bearing(h, at.x, at.z, q.x, q.z)]; };
    s.tgt = { chair: tgt(cw), exit: tgt(esc && esc.centre) };
    s.near = nearList(p, h, at.x, at.z);
    s.car = nearestTakeable(p, h, at.x, at.z);
    const dg = openCounters(ctx); if (dg.length) s.counter = dg;   // goon wind-ups open on him (the Q counter)
    const M = ctx.mini;
    s.mini = M ? { ph: M.phase, prog: r2(M.progress || 0), miss: M.misses || 0, call: callOf(M.caller && M.caller.call),
      who: M.client ? `p${M.client.id}` : null, cd: M.client ? r1(Math.hypot(M.client.pos.x - M.pos.x, M.client.pos.z - M.pos.z)) : null, t: r1(M.t || 0) } : null;
  }
  s.hud = hudText(st);
  s.in = heldText(inp);
  return s;
}

// state.why (events.js provider): what caused the transition, in words.
export function whyOf(from, to) {
  const m = hooks.massageState ? hooks.massageState() : null;
  const R = ctx && ctx.runEnd;
  switch (to) {
    case 'TITLE': return 'boot';
    case 'MASSAGE': return from === 'TITLE' ? 'begin clicked' : from === 'SUMMARY' ? 'certificate closed: next run' : `from ${from}`;
    case 'PIVOT': return m ? `client ${m.clientIndex + 1} of ${m.clientCount} paid` : 'course done';
    case 'RUN': return from === 'PIVOT' ? 'pivot over: controls unlocked' : `from ${from}`;
    case 'ARREST': {
      const P = ctx.police || {};
      if ((P.arrestT || 0) >= 1.5) return `arrest: cop ${P.arrestBy ?? '?'} held a touch ${r1(P.arrestT)} s while he stood still`;
      return 'arrest: knocked down with a cop within 2 m';
    }
    case 'DEATH': return `death: hp 0 (last hit: ${lastHurt || 'unknown'})`;
    case 'ESCAPE': return R && R.reason === 'left' ? 'left without the chair: held E at the exit' : 'escape: reached the exit with the chair';
    case 'SUMMARY': return `slow motion over (${R ? R.reason : '?'})`;
    default: return '';
  }
}
