// MASSAGE: the minigame loop. Intro card -> clients (calls + stroke guide + speech bubbles)
// -> payout and ledger -> E for the next client. Each client runs in segments (Swedish, then
// cross-fiber, then trigger point; two between runs): the client asks for each one out loud, the
// HUD says CLIENT WANTS over the ring, and only the requested modality fills competency.
// Keys match the run (DESIGN.md pillar 1): W/S answer the client's calls, more and less (forward/
// back: "harder" is hold W, "lighter" is tap S), A/D modality (strafe; during "a little to the left /
// right" they are the answer instead),
// mouse on the guide (look), E next client (interact), Space (the run's jump and handbrake) snaps
// the modality to the one the client wants (owner ruling 2026-09-24, Andy's first play: cycling
// under a fresh request was a micro panic). Space does nothing else here. The last client never
// gets up: the moment they are done, PIVOT fires with them still in the chair (the cast stays).
// First playthrough only, client 1 is guided: five course prompts by the ring (COACH in session.js).
// The per-client session is session.js; the pay and totals are ledger.js.
import { STATES, setState } from '../state.js';
import { updateDialogue } from './clients.js';
import { roster } from './client-lines.js';
import { createGuide, modality, disposeGuide } from './guide.js';
import * as stage from './stage.js';
import { heard } from '../bubbles.js';
import { setRing, gaugeState, setCoach } from '../hud-massage.js';
import { COACH, wanted, coachDone, showDialogue, startClient, updateSession, handSpot } from './session.js';
import { resetLedger } from './ledger.js';

const INTRO_TITLE = 'Module 1: Pressure and Stroke.';
const INTRO_BODY = 'Listen to the client. Harder: hold W. Lighter: tap S. Right there: hands off W and S. '
  + 'A little to the left or right: tap A or D. The rest of the time A / D change the modality, '
  + 'Space matches the one they want, the mouse stays on the guide, and E brings the next client.';

let st = null; // stage (persists: the chair stays at the spot for the run)
const S = {
  phase: 'idle', roster: [], idx: 0, client: null, caller: null, guide: null, dlg: null,
  competency: 0, time: 0, flash: null, flashT: 0, trackT: 0, trackIn: 0, press: 40, totals: { you: 0, host: 0 }, paid: [],
  segs: [], seg: 0, live: false, pending: -1, wrongT: 0, notIt: 0, requests: [], forceDone: false,
  coach: { on: false, step: -1, next: 0, held: 0, log: [] },
};

export function enter(ctx) {
  if (!st) { st = stage.createStage(ctx); ctx.station = st.station; }
  stage.removeLeaver(st, ctx.scene);
  if (st.therapist || st.client) stage.removeCast(st, ctx.scene); // a run that never reached RUN
  stage.addCast(st, ctx.scene, ctx.perks && ctx.perks.shirt);
  S.roster = roster(ctx.meta);
  S.idx = 0; S.client = null; S.caller = null; S.time = 0;
  S.competency = 0; S.segs = []; S.seg = 0; S.live = false; S.pending = -1; S.requests = [];
  S.guide = createGuide(ctx.scene);
  S.guide.mesh.visible = false;
  if (ctx.player && ctx.player.mesh) ctx.player.mesh.visible = false;
  const hud = ctx.hud;
  hud.showMassageHud(true);
  resetLedger(ctx, S);                    // totals, paid list, the ledger strip (ledger.js)
  hud.setCompetency(0);
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

export function update(dt, ctx) {
  if (!st) return;
  S.time += dt;
  stage.updateCamera(st, ctx.camera, S.time);
  const input = ctx.input;

  if (S.phase === 'intro') {
    if (input && input.pressed.size > 0) {
      ctx.hud.hideCard();
      if (ctx.voice) ctx.voice.stop('narrator');   // any key skips the narration with the card
      startClient(ctx, S, st, 0);
    }
  } else if (S.phase === 'session') {
    updateSession(dt, ctx, S, st);
  } else if (S.phase === 'paid') {
    updateDialogue(S.dlg, dt);
    showDialogue(ctx, S, st);
    stage.walkOff(st, dt);
    if (input && input.ePressed) {
      if (S.coach.on && COACH[S.coach.step] && COACH[S.coach.step].step === 'd') { coachDone(ctx, S); S.coach.on = false; }
      if (S.idx + 1 < S.roster.length) startClient(ctx, S, st, S.idx + 1);
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
  const k = S.caller, g = S.guide, c = k && k.call;
  return {
    phase: S.phase,
    clientIndex: S.idx,
    clientId: S.client ? S.client.id : null,
    clientCount: S.roster.length,
    requested: S.client ? wanted(S) : null,
    segment: S.seg,
    segmentLive: S.live,
    pendingSegment: S.pending,
    segments: S.segs.slice(),
    wrongT: S.wrongT,
    notItSaid: !!S.notIt,
    requests: S.requests.slice(),
    modality: g ? modality(g) : null,
    spot: g ? handSpot(g) : 0,
    call: c ? { name: c.name, text: c.text, key: c.key || 'none', open: c.open, t: c.t, window: c.window } : null,
    nextCallIn: k && !c ? k.wait : null,
    calls: k ? k.log.slice() : [],
    flash: S.flash,
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
  if (S.phase === 'session' && S.live && S.pending < 0) { S.competency = ((S.seg + 1) * 100) / S.segs.length; if (S.caller) S.caller.call = null; }
}
