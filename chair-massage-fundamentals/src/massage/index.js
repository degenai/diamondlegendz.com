// MASSAGE: the minigame loop. Intro card -> clients (meter + stroke guide + speech bubbles)
// -> payout and ledger -> E for the next client. Each client runs in segments (Swedish, then
// cross-fiber, then trigger point; two between runs): the client asks for each one out loud, the
// HUD says CLIENT WANTS over the ring, and only the requested modality fills competency.
// Keys match the run (DESIGN.md pillar 1): W/S pressure (forward/back), A/D modality (strafe),
// mouse on the guide (look), E next client (interact), Space (the run's jump and handbrake) snaps
// the modality to the one the client wants (owner ruling 2026-09-24, Andy's first play: cycling
// under a fresh request was a micro panic). Space does nothing else here. The last client never
// gets up: the moment they are done, PIVOT fires with them still in the chair (the cast stays).
// First playthrough only, client 1 is guided: four course prompts by the ring (COACH below).
import { STATES, setState } from '../state.js';
import { roster, createDialogue, updateDialogue, say, started, OUCH, segmentsOf } from './clients.js';
import { createMeter, updateMeter, hintRange } from './meter.js';
import { createGuide, updateGuide, cycleModality, setModality, modality, disposeGuide, toneGuide, resetPattern } from './guide.js';
import * as stage from './stage.js';
import { say as bubble, heard } from '../bubbles.js';
import { emit } from '../events.js';
import { sfx } from '../juice.js';
import { setRing, gaugeState, setCoach } from '../hud-massage.js';

const INTRO_TITLE = 'Module 1: Pressure and Stroke.';
const INTRO_BODY = 'W / S pressure, A / D modality, Space to match the client, mouse on the guide, E next client. '
  + 'The ring is your pressure gauge; the client tells you which modality they want.';
const NOT_IT_AFTER = 3; // s on the wrong modality before the client says so (once per segment)
const HAND_SPOT = 0.86; // hands follow the ring across the back but stop short of the torso's edge

// The guided first client (owner ruling 2026-09-24, Andy: "took a min to figure out how to play").
// Layered on the real session: one prompt at a time, each waits for the action, and nothing here
// gates the fill, so the client still finishes in about the usual time. Steps a and b come at once,
// c waits for the first segment change, d for the client being done. A step the session outruns
// (a debug finish, a segment filled before the prompt was obeyed) is closed as skipped.
const COACH = [
  { step: 'a', text: 'Hold W until the ring turns green.', hold: 1 },   // zone 'in' for 1 s straight
  { step: 'b', text: 'Keep the cursor on the guide.', hold: 2 },        // 2 s inside the ring in all
  { step: 'c', text: 'Press Space to give them what they asked for.' }, // until the modality matches
  { step: 'd', text: "Press E when they're done." },                    // until E
];

let st = null; // stage (persists: the chair stays at the spot for the run)
const S = {
  phase: 'idle', roster: [], idx: 0, client: null, meter: null, guide: null, dlg: null,
  competency: 0, ouchCd: 0, time: 0, totals: { you: 0, host: 0 }, paid: [],
  segs: [], seg: 0, live: false, pending: -1, wrongT: 0, notIt: 0, requests: [], forceDone: false,
  coach: { on: false, step: -1, next: 0, held: 0, log: [] },
};

function coachShow(ctx, k) {
  const C = S.coach, p = COACH[k];
  C.step = k; C.next = k + 1; C.held = 0;
  setCoach(p.text);
  C.log.push({ step: p.step, act: 'shown', at: S.time });
  emit('tutorial', { step: p.step, act: 'shown', text: p.text, client: S.client ? S.client.id : null });
}
function coachDone(ctx, skipped = false) {
  const C = S.coach, p = COACH[C.step];
  if (!p) return;
  setCoach('');
  C.log.push({ step: p.step, act: skipped ? 'skipped' : 'done', at: S.time });
  emit('tutorial', { step: p.step, act: skipped ? 'skipped' : 'done', text: p.text, client: S.client ? S.client.id : null });
  C.step = -1;
}
// Close the open step and show every step before k as skipped, then show k.
function coachTo(ctx, k) {
  const C = S.coach;
  if (C.step >= k) return;
  if (C.step >= 0) coachDone(ctx, true);
  while (C.next < k) { coachShow(ctx, C.next); coachDone(ctx, true); }
  coachShow(ctx, k);
}

// Per session tick while the guided client is on.
function coachTick(ctx, dt, zone, inside) {
  const C = S.coach;
  if (!C.on) return;
  if (C.next <= 2 && S.seg >= 1 && S.live) coachTo(ctx, 2);  // the first segment change came
  if (C.step === 0) {
    C.held = zone === 'in' ? C.held + dt : 0;
    if (C.held >= COACH[0].hold) { coachDone(ctx); coachShow(ctx, 1); }
  } else if (C.step === 1) {
    if (inside) C.held += dt;
    if (C.held >= COACH[1].hold) coachDone(ctx);
  } else if (C.step === 2) {
    if (modality(S.guide) === wanted()) coachDone(ctx);
  }
}

// What the client wants: only once the segment's request line has started speaking (S.live).
// Until then the previous segment's rule stands (its competency is already capped, so nothing fills).
const wanted = () => (S.live ? S.segs[S.seg] || null : S.seg > 0 ? S.segs[S.seg - 1] : null);
const segFloor = () => (S.seg * 100) / S.segs.length;

// A segment is asked for: the request line jumps the client's bubble queue (ahead of chatter), and
// the segment goes live, CLIENT WANTS and the zero-progress rule with it, when the line starts.
function startSegment(ctx, k) {
  const c = S.client;
  const text = (c.asks && c.asks[k]) || `Now ${S.segs[k].toLowerCase()}, please.`;
  const req = { client: c.id, segment: k, modality: S.segs[k], text, queuedAt: S.time, startedAt: null };
  S.requests.push(req);
  S.pending = k;
  const client = c;
  say(S.dlg, c.name, text, 3.2, 'request', () => {
    if (S.client !== client || S.pending !== k) return;
    S.seg = k; S.live = true; S.pending = -1; S.wrongT = 0; S.notIt = 0;
    req.startedAt = S.time;
    if (S.guide) ctx.hud.setModality(modality(S.guide), wanted()); // the HUD switches with the voice, same frame
  });
}

const usd = (n) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

// Client lines go in a bubble over the client's head (the narrator keeps the strip). The bubble
// queue decides when each one starts; with no bubble to speak in, a line counts as started at once.
function showDialogue(ctx) {
  const d = S.dlg;
  while (d.out.length) {
    const line = d.out.shift();
    const onStart = (secs) => started(d, line, secs);
    const r = st.client ? bubble(ctx, st.client, line.text,
      { skin: 'course', preset: 'client', seconds: line.dur, kind: line.kind, onStart, speaker: 'client', name: line.speaker }) : null;
    if (!r && line.kind === 'request') onStart(line.dur); // never strand a segment
  }
}

function startClient(ctx, i) {
  const c = S.roster[i];
  S.idx = i; S.client = c; S.competency = 0; S.ouchCd = 0;
  S.segs = segmentsOf(c); S.forceDone = false; S.seg = 0; S.live = false; S.pending = -1;
  stage.seatClient(st, c.kind);
  S.meter = createMeter(c.bandWidth, ctx.rng, S.meter ? S.meter.pressure : 0); // pressure holds where left
  S.guide.baseRadius = c.ringRadius;
  S.guide.speed = c.travelSpeed || 1;
  S.guide.spineV = c.spineV;
  resetPattern(S.guide); // fresh pattern per client (trigger point starts at full radius)
  S.guide.mesh.visible = true;
  S.dlg = createDialogue(c);
  const C = S.coach;
  C.on = i === 0 && !!ctx.meta && ctx.meta.firstPivotSeen === false; // first playthrough, client 1 only
  C.step = -1; C.next = 0; C.held = 0; C.log = [];
  setCoach('');
  if (C.on) coachShow(ctx, 0);
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
  S.pending = -1;
  say(S.dlg, c.name, c.done, 4, 'request'); // the thank-you is never dropped
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
  if (S.coach.on) coachTo(ctx, 3);
  ctx.hud.setPrompt('Client complete. Press E for the next client.');
  stage.standClient(st);
  S.guide.mesh.visible = false;
  S.phase = 'paid';
}

export function enter(ctx) {
  if (!st) { st = stage.createStage(ctx); ctx.station = st.station; }
  stage.removeLeaver(st, ctx.scene);
  if (st.therapist || st.client) stage.removeCast(st, ctx.scene); // a run that never reached RUN
  stage.addCast(st, ctx.scene, ctx.perks && ctx.perks.shirt);
  S.roster = roster(ctx.meta);
  S.idx = 0; S.client = null; S.totals = { you: 0, host: 0 }; S.paid = []; S.meter = null; S.time = 0;
  S.competency = 0; S.segs = []; S.seg = 0; S.live = false; S.pending = -1; S.requests = [];
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
  heard(`${INTRO_TITLE} ${INTRO_BODY}`);                     // the watcher's line log
  S.coach.on = false; S.coach.step = -1;
  setCoach('');
  S.phase = 'intro';
}

export function exit(ctx, target) {
  if (S.guide) disposeGuide(S.guide, ctx.scene);
  S.guide = null;
  ctx.hud.hideCard();
  ctx.hud.hideDialogue();
  setRing(null);
  S.coach.on = false; S.coach.step = -1;
  setCoach('');
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
  // Space: straight to what CLIENT WANTS says, any time in the session. No bonus, no window.
  if (input && input.spacePressed && wanted()) setModality(S.guide, wanted());
  stage.poseClient(st, dt, S.time);
  const g = S.guide;
  const inside = updateGuide(g, dt, st.client.userData.back, ctx.camera,
    input ? input.mouseX : -1, input ? input.mouseY : -1, window.innerWidth, window.innerHeight);
  toneGuide(g, zone);
  stage.placeHands(st, handSpot(g), S.meter.pressure, g.spineV + g.v); // hands ride the ring

  const want = wanted();
  const right = modality(g) === want;
  S.wrongT = right || !S.live ? 0 : S.wrongT + dt; // no "not it" while the ask is still waiting
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
      say(S.dlg, c.name, OUCH[Math.floor(ctx.rng.next() * OUCH.length)], 1.6, 'aside');
      S.ouchCd = 1.8;
    }
  } else if (zone === 'in' && inside && S.live) { // off the ring: the fill stops at once, no grace
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
  coachTick(ctx, dt, zone, inside);
  if (S.forceDone) { S.forceDone = false; S.seg = S.segs.length - 1; S.live = true; S.pending = -1; S.competency = top = 100; } // debug / tests
  if (S.pending < 0 && S.live && S.competency >= top - 1e-9) {
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
      if (S.coach.on && S.coach.step === 3) { coachDone(ctx); S.coach.on = false; }
      if (S.idx + 1 < S.roster.length) startClient(ctx, S.idx + 1);
      else setState(STATES.PIVOT);
    }
  }
}

// The hands' working spot for stage.placeHands (spot * 0.14 m = hand centre across the back).
function handSpot(g) { return Math.max(-HAND_SPOT, Math.min(HAND_SPOT, g.u / 0.14)); }

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
    segmentLive: S.live,
    pendingSegment: S.pending,
    segments: S.segs.slice(),
    wrongT: S.wrongT,
    notItSaid: !!S.notIt,
    requests: S.requests.slice(),
    modality: g ? modality(g) : null,
    pressure: m ? m.pressure : 0,
    spot: g ? handSpot(g) : 0,
    band: m ? { centre: m.bandCentre, width: m.bandWidth, lo: m.bandCentre - m.bandWidth / 2, hi: m.bandCentre + m.bandWidth / 2 } : null,
    zone: m ? m.zone : null,
    inside: g ? g.inside : false,
    ring: g ? { x: g.screen.x, y: g.screen.y, r: g.screen.r, worldRadius: g.radius, u: g.u, v: g.v, speed: g.speed } : null,
    gauge: gaugeState(),
    coach: { on: S.coach.on, step: S.coach.step >= 0 ? COACH[S.coach.step].step : null, text: S.coach.step >= 0 ? COACH[S.coach.step].text : '', log: S.coach.log.slice() },
    competency: S.competency,
    totals: { ...S.totals },
    paid: S.paid.slice(),
    subtitle: S.dlg && S.dlg.text ? `${S.dlg.speaker}: ${S.dlg.text}` : '',
    time: S.time,
  };
}

// Debug / headless tests: the current client reaches 100% on the next tick.
// Skips any remaining segments: the client is paid on the next tick.
export function debugComplete() { if (S.phase === 'session') S.forceDone = true; }

// Debug / headless tests: the current segment reaches its top on the next tick (the next request fires).
export function debugSegment() {
  if (S.phase === 'session' && S.live && S.pending < 0) S.competency = ((S.seg + 1) * 100) / S.segs.length;
}
