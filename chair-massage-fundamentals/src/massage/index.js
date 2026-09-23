// MASSAGE: the minigame loop. Intro card -> clients (meter + stroke guide + speech bubbles)
// -> payout and ledger -> E for the next client. Each client runs in segments (Swedish, then
// cross-fiber, then trigger point; two between runs): the client asks for each one out loud, the
// HUD says CLIENT WANTS over the ring, and only the requested modality fills competency.
// Keys match the run (DESIGN.md pillar 1): W/S pressure (forward/back), A/D modality (strafe),
// mouse on the guide (look), E next client (interact). Space is the run's jump; it does nothing here. The last client never gets up: the moment
// they are done, PIVOT fires with them still in the chair (the cast stays for the cutscene).
import { STATES, setState } from '../state.js';
import { roster, createDialogue, updateDialogue, say, OUCH, segmentsOf } from './clients.js';
import { createMeter, updateMeter, hintRange } from './meter.js';
import { createGuide, updateGuide, cycleModality, modality, disposeGuide, toneGuide } from './guide.js';
import * as stage from './stage.js';
import { say as bubble } from '../bubbles.js';
import { sfx } from '../juice.js';
import { setRing, gaugeState } from '../hud-massage.js';

const INTRO_TITLE = 'Module 1: Pressure and Stroke.';
const INTRO_BODY = 'W / S pressure, A / D modality, mouse on the guide, E next client. '
  + 'The ring is your pressure gauge; the client tells you which modality they want.';
const NOT_IT_AFTER = 3; // s on the wrong modality before the client says so (once per segment)

let st = null; // stage (persists: the chair stays at the spot for the run)
const S = {
  phase: 'idle', roster: [], idx: 0, client: null, meter: null, guide: null, dlg: null,
  competency: 0, ouchCd: 0, time: 0, totals: { you: 0, host: 0 }, paid: [],
  segs: [], seg: 0, wrongT: 0, notIt: 0, requests: [], forceDone: false,
};

const wanted = () => S.segs[S.seg] || null;
const segFloor = () => (S.seg * 100) / S.segs.length;

// A segment starts: the client asks for it in their bubble (a held line: chatter waits).
function startSegment(ctx, k) {
  S.seg = k; S.wrongT = 0; S.notIt = 0;
  const c = S.client;
  const text = (c.asks && c.asks[k]) || `Now ${S.segs[k].toLowerCase()}, please.`;
  S.requests.push({ client: c.id, segment: k, modality: S.segs[k], text });
  say(S.dlg, c.name, text, 3.2, true);
}

const usd = (n) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

// Client lines go in a bubble over the client's head (the narrator keeps the strip).
function showDialogue(ctx) {
  const d = S.dlg;
  if (!d.changed) return;
  d.changed = false;
  if (d.text && st.client) bubble(ctx, st.client, d.text, { skin: 'course', preset: 'client', seconds: Math.max(1, d.showUntil - d.t) });
}

function startClient(ctx, i) {
  const c = S.roster[i];
  S.idx = i; S.client = c; S.competency = 0; S.ouchCd = 0;
  S.segs = segmentsOf(c); S.forceDone = false;
  stage.seatClient(st, c.kind);
  S.meter = createMeter(c.bandWidth, ctx.rng, S.meter ? S.meter.pressure : 0); // pressure holds where left
  S.guide.baseRadius = c.ringRadius;
  S.guide.spineV = c.spineV;
  S.guide.t = 0; // fresh pattern per client (trigger point starts at full radius)
  S.guide.mesh.visible = true;
  S.dlg = createDialogue(c);
  startSegment(ctx, 0);
  ctx.hud.setClientInfo(`Client ${i + 1} of ${S.roster.length}: ${c.name}, ${c.role}`);
  ctx.hud.setCompetency(0);
  ctx.hud.setPrompt('');
  S.phase = 'session';
}

function finishClient(ctx) {
  const c = S.client;
  const half = c.pay / 2;
  S.totals.you += half; S.totals.host += half;
  S.paid.push({ id: c.id, pay: c.pay });
  setRing(null);
  ctx.massageTotals = { ...S.totals }; // becomes the run's starting cash later
  sfx(ctx, 'pay');
  say(S.dlg, c.name, c.done, 4);
  showDialogue(ctx);
  ctx.hud.setLedger([
    `${c.name} paid ${usd(c.pay)}`,
    `You ${usd(half)} / Host cause ${usd(half)}`,
    `Session total: You ${usd(S.totals.you)} / Host cause ${usd(S.totals.host)}`,
  ]);
  if (S.idx >= S.roster.length - 1) {     // the last client stays seated into the pivot
    S.guide.mesh.visible = false;
    S.phase = 'pivot';
    setState(STATES.PIVOT);
    return;
  }
  ctx.hud.setPrompt('Client complete. Press E for the next client.');
  stage.standClient(st);
  S.guide.mesh.visible = false;
  S.phase = 'paid';
}

export function enter(ctx) {
  if (!st) { st = stage.createStage(ctx); ctx.station = st.station; }
  stage.removeLeaver(st, ctx.scene);
  if (st.therapist || st.client) stage.removeCast(st, ctx.scene); // a run that never reached RUN
  stage.addCast(st, ctx.scene);
  S.roster = roster(ctx.meta);
  S.idx = 0; S.client = null; S.totals = { you: 0, host: 0 }; S.paid = []; S.meter = null; S.time = 0;
  S.competency = 0; S.segs = []; S.seg = 0; S.requests = [];
  S.guide = createGuide(ctx.scene);
  S.guide.mesh.visible = false;
  if (ctx.player && ctx.player.mesh) ctx.player.mesh.visible = false;
  const hud = ctx.hud;
  hud.showMassageHud(true);
  hud.setLedger(['No payments yet.', 'Each client pays; half goes to the host cause.']);
  hud.setCompetency(0);
  hud.setMeter(0, 0, 0);
  hud.setClientInfo(`${S.roster.length} client${S.roster.length > 1 ? 's' : ''} scheduled`);
  hud.setModality(modality(S.guide), '');
  setRing(null);
  hud.hideDialogue();
  hud.setPrompt('');
  hud.showCard(INTRO_TITLE, [INTRO_BODY, 'Press any key to begin.'], 'course');
  if (ctx.voice) ctx.voice.speak(`${INTRO_TITLE} ${INTRO_BODY}`, 'narrator', 'narrator'); // the course voice
  S.phase = 'intro';
}

export function exit(ctx, target) {
  if (S.guide) disposeGuide(S.guide, ctx.scene);
  S.guide = null;
  ctx.hud.hideCard();
  ctx.hud.hideDialogue();
  setRing(null);
  if (target === STATES.PIVOT) {        // the cast and the course HUD stay for the cutscene
    ctx.hud.setPrompt('');
    stage.pivotPose(st);
    S.phase = 'idle';
    return;
  }
  stage.removeCast(st, ctx.scene);
  ctx.hud.showMassageHud(false);
  const p = ctx.player;
  if (p && p.mesh) {
    p.mesh.visible = true;
    st.station.localToWorld(p.pos.set(0, 0, 1.3));
    p.vel.set(0, 0, 0);
    p.camYaw = stage.STATION_YAW;
    p.camInit = false;
  }
  S.phase = 'idle';
}

function updateSession(dt, ctx) {
  const input = ctx.input;
  const c = S.client;
  const zone = updateMeter(S.meter, input, dt, ctx.rng);
  if (input && input.pressed) {           // edges only: holding A or D does not spin the list
    const p = input.pressed;
    if (p.has('KeyA') || p.has('ArrowLeft')) cycleModality(S.guide, -1);
    if (p.has('KeyD') || p.has('ArrowRight')) cycleModality(S.guide, 1);
  }
  stage.poseClient(st, dt, S.time);
  const g = S.guide;
  const inside = updateGuide(g, dt, st.client.userData.back, ctx.camera,
    input ? input.mouseX : -1, input ? input.mouseY : -1, window.innerWidth, window.innerHeight);
  toneGuide(g, zone);
  stage.placeHands(st, g.u / 0.14, S.meter.pressure, g.spineV + g.v); // hands ride the ring

  const want = wanted();
  const right = modality(g) === want;
  S.wrongT = right ? 0 : S.wrongT + dt;
  if (!right && S.wrongT >= NOT_IT_AFTER && !S.notIt) {
    S.notIt = 1;
    say(S.dlg, c.name, c.notIt || "That's not it.", 2);
  }
  const fill = c.fillRate * (right ? 1 : 0);    // wrong modality: nothing
  S.ouchCd = Math.max(0, S.ouchCd - dt);
  if (zone === 'over') {                        // over-pressure still hurts, right modality or not
    S.competency -= 2 * c.fillRate * dt;
    if (S.ouchCd <= 0) {
      stage.flinch(st);
      say(S.dlg, c.name, OUCH[Math.floor(ctx.rng.next() * OUCH.length)], 1.6);
      S.ouchCd = 1.8;
    }
  } else if (zone === 'in' && inside) {
    S.competency += fill * dt;
  }
  let top = ((S.seg + 1) * 100) / S.segs.length; // a finished segment stays finished
  S.competency = Math.max(segFloor(), Math.min(top, S.competency));

  updateDialogue(S.dlg, dt);
  const [lo, hi] = hintRange(S.meter);
  ctx.hud.setMeter(S.meter.pressure, lo, hi);
  ctx.hud.setMeterState(zone);
  ctx.hud.setCompetency(S.competency);
  ctx.hud.setModality(modality(g), want);
  setRing(g.mesh.visible ? g.screen : null);
  if (S.forceDone) { S.forceDone = false; S.seg = S.segs.length - 1; S.competency = top = 100; } // debug / tests
  if (S.competency >= top - 1e-9) {
    if (S.seg + 1 < S.segs.length) startSegment(ctx, S.seg + 1);
    else { S.competency = 100; finishClient(ctx); return; }
  }
  showDialogue(ctx);
}

export function update(dt, ctx) {
  if (!st) return;
  S.time += dt;
  stage.updateCamera(st, ctx.camera, S.time);
  const input = ctx.input;

  if (S.phase === 'intro') {
    if (input && input.pressed.size > 0) {
      ctx.hud.hideCard();
      if (ctx.voice) ctx.voice.stop('narrator');   // any key skips the narration with the card
      startClient(ctx, 0);
    }
  } else if (S.phase === 'session') {
    updateSession(dt, ctx);
  } else if (S.phase === 'paid') {
    updateDialogue(S.dlg, dt);
    showDialogue(ctx);
    stage.walkOff(st, dt);
    if (input && input.ePressed) {
      if (S.idx + 1 < S.roster.length) startClient(ctx, S.idx + 1);
      else setState(STATES.PIVOT);
    }
  }
}

// ---- PIVOT / RUN hand-off (pivot.js) ----
export function castHeads() { return stage.castHeads(st); }
export function station() { return st; }

// PIVOT -> RUN: the player stands where the therapist stood; the client gets up and walks off.
export function releaseToRun(ctx, awayX, awayZ) {
  if (!st) return;
  const p = ctx.player;
  if (st.therapist && p) {
    p.yaw = stage.therapistSpot(st, p.pos);
    p.vel.set(0, 0, 0);
    p.floorInit = false;
  }
  stage.releaseCast(st, ctx.scene, awayX, awayZ);
  ctx.hud.hideDialogue();
}

export function updateLeaving(dt, ctx) { return stage.updateLeaver(st, dt, ctx.scene); }

export const tuning = { CAM_POS: stage.CAM_POS, CAM_LOOK: stage.CAM_LOOK, THERAPIST: stage.THERAPIST };

// Plain snapshot for window.CMF.massage (debug handle + headless tests).
export function debugState() {
  const m = S.meter, g = S.guide;
  return {
    phase: S.phase,
    clientIndex: S.idx,
    clientId: S.client ? S.client.id : null,
    clientCount: S.roster.length,
    requested: S.client ? wanted() : null,
    segment: S.seg,
    segments: S.segs.slice(),
    wrongT: S.wrongT,
    notItSaid: !!S.notIt,
    requests: S.requests.slice(),
    modality: g ? modality(g) : null,
    pressure: m ? m.pressure : 0,
    spot: g ? g.u / 0.14 : 0,
    band: m ? { centre: m.bandCentre, width: m.bandWidth, lo: m.bandCentre - m.bandWidth / 2, hi: m.bandCentre + m.bandWidth / 2 } : null,
    zone: m ? m.zone : null,
    inside: g ? g.inside : false,
    ring: g ? { x: g.screen.x, y: g.screen.y, r: g.screen.r, worldRadius: g.radius } : null,
    gauge: gaugeState(),
    competency: S.competency,
    totals: { ...S.totals },
    paid: S.paid.slice(),
    subtitle: S.dlg && S.dlg.text ? `${S.dlg.speaker}: ${S.dlg.text}` : '',
  };
}

// Debug / headless tests: the current client reaches 100% on the next tick.
// Skips any remaining segments: the client is paid on the next tick.
export function debugComplete() { if (S.phase === 'session') S.forceDone = true; }
