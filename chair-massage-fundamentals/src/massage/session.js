// MASSAGE, one client's session: the calls and answers, the stroke guide, the segments the client
// asks for out loud, and the guided first client's course prompts (COACH). index.js owns the state
// object S and the stage st and passes them in; the pay and totals are ledger.js.
// Call and response (owner ruling 2026-09-24, Andy: "the pressure meter reads too heavy"): no meter.
// Every 4 to 8 s the client calls out (meter.js has the calls and the judging) and competency fills
// only on a right answer: the segment's whole share when the modality is the one asked for and the
// cursor stayed on the ring (80% of the time is enough) since the last answer, half of it for a
// cursor that never did, nothing on the wrong modality. The guided client's first segment takes two
// right answers. A wrong or late answer drains a quarter share and gets a line ("Not that.").
import { STATES, setState } from '../state.js';
import { createDialogue, updateDialogue, say, started, segmentsOf } from './clients.js';
import { createCaller, nextGap, pickCall, makeCall, openCall, judge, takesAD } from './meter.js';
import { updateGuide, cycleModality, setModality, modality, toneGuide, resetPattern, fillGuide } from './guide.js';
import { TP, createHold, resetHoldNag, holding, holdTick } from './hold.js';
import * as stage from './stage.js';
import { say as bubble } from '../bubbles.js';
import { emit } from '../events.js';
import { sfx } from '../juice.js';
import { setRing, setCoach, setCall, setRingFlash } from '../hud-massage.js';
import { payClient, showPaid } from './ledger.js';

const NOT_IT_AFTER = 3; // s on the wrong modality before the client says so (once per segment)
const HAND_SPOT = 0.86; // hands follow the ring across the back but stop short of the torso's edge
const DRAIN = 0.25;     // a wrong or late answer takes this much of a segment's share back
const FLASH = 1;        // s the ring stays green or red after an answer
const ON_RING = 0.8;    // on the ring this share of the time since the last answer counts as tracked in full
const FIRST_CALL = 4;   // s to the guided client's first call (the floor of the 4 to 8 s cadence)

// The guided first client (owner ruling 2026-09-24, Andy: "took a min to figure out how to play").
// Layered on the real session: one prompt at a time, each waits for the action, and nothing here
// gates the fill, so the client still finishes in about the usual time. Step a waits for the first
// right answer (the guided client says "harder" until they get one), b follows it, c waits for the
// first segment change, e (trigger point, shown once it is matched) for one full held close, d for
// the client being done. A step the session outruns (a debug finish,
// a segment filled before the prompt was obeyed) is closed as skipped.
export const COACH = [
  { step: 'a', text: 'When they say harder, hold W.' },                 // until the first right answer
  { step: 'b', text: 'Keep the cursor on the guide.', hold: 2 },        // 2 s inside the ring in all
  { step: 'c', text: 'Press Space to give them what they asked for.' }, // until the modality matches
  { step: 'e', text: 'Trigger point: hold the click while it closes.' }, // until one full held close (hold.js)
  { step: 'd', text: "Press E when they're done." },                    // until E
];
const STEP_E = 3, STEP_D = 4;   // e runs before d: trigger point is the last segment before E

function coachShow(ctx, S, k) {
  const C = S.coach, p = COACH[k];
  C.step = k; C.next = k + 1; C.held = 0;
  setCoach(p.text);
  C.log.push({ step: p.step, act: 'shown', at: S.time });
  emit('tutorial', { step: p.step, act: 'shown', text: p.text, client: S.client ? S.client.id : null });
}
export function coachDone(ctx, S, skipped = false) {
  const C = S.coach, p = COACH[C.step];
  if (!p) return;
  setCoach('');
  C.log.push({ step: p.step, act: skipped ? 'skipped' : 'done', at: S.time });
  emit('tutorial', { step: p.step, act: skipped ? 'skipped' : 'done', text: p.text, client: S.client ? S.client.id : null });
  C.step = -1;
}
// Close the open step and show every step before k as skipped, then show k.
function coachTo(ctx, S, k) {
  const C = S.coach;
  if (C.step >= k) return;
  if (C.step >= 0) coachDone(ctx, S, true);
  while (C.next < k) { coachShow(ctx, S, C.next); coachDone(ctx, S, true); }
  coachShow(ctx, S, k);
}

// Per session tick while the guided client is on.
function coachTick(ctx, S, dt, inside) {
  const C = S.coach;
  if (!C.on) return;
  if (C.next <= 2 && S.seg >= 1 && S.live) coachTo(ctx, S, 2);  // the first segment change came
  if (C.step === 0) {
    if (C.firstRight) { coachDone(ctx, S); coachShow(ctx, S, 1); }
  } else if (C.step === 1) {
    if (inside) C.held += dt;
    if (C.held >= COACH[1].hold) coachDone(ctx, S);
  } else if (C.step === 2) {
    if (modality(S.guide) === wanted(S)) coachDone(ctx, S);
  } else if (C.step === STEP_E) {
    if (S.hold.closed) coachDone(ctx, S);
  }
  if (C.next <= STEP_E && S.live && wanted(S) === TP && modality(S.guide) === TP) coachTo(ctx, S, STEP_E);
}

// What the client wants: only once the segment's request line has started speaking (S.live).
// Until then the previous segment's rule stands (its competency is already capped, so nothing fills).
export const wanted = (S) => (S.live ? S.segs[S.seg] || null : S.seg > 0 ? S.segs[S.seg - 1] : null);
const segFloor = (S) => (S.seg * 100) / S.segs.length;

// A segment is asked for: the request line jumps the client's bubble queue (ahead of chatter), and
// the segment goes live, CLIENT WANTS and the zero-progress rule with it, when the line starts.
function startSegment(ctx, S, k) {
  const c = S.client;
  const text = (c.asks && c.asks[k]) || `Now ${S.segs[k].toLowerCase()}, please.`;
  const req = { client: c.id, segment: k, modality: S.segs[k], text, queuedAt: S.time, startedAt: null };
  S.requests.push(req);
  S.pending = k;
  const client = c;
  say(S.dlg, c.name, text, 3.2, 'request', () => {
    if (S.client !== client || S.pending !== k) return;
    S.seg = k; S.live = true; S.pending = -1; S.wrongT = 0; S.notIt = 0; resetHoldNag(S.hold);
    req.startedAt = S.time;
    if (S.guide) ctx.hud.setModality(modality(S.guide), wanted(S)); // the HUD switches with the voice, same frame
  });
}

// Client lines go in a bubble over the client's head (the narrator keeps the strip). The bubble
// queue decides when each one starts; with no bubble to speak in, a line counts as started at once.
export function showDialogue(ctx, S, st) {
  const d = S.dlg;
  while (d.out.length) {
    const line = d.out.shift();
    const onStart = (secs) => started(d, line, secs);
    const r = st.client ? bubble(ctx, st.client, line.text,
      { skin: 'course', preset: 'client', seconds: line.dur, kind: line.kind, onStart, speaker: 'client', name: line.speaker }) : null;
    if (!r && line.kind === 'request') onStart(line.dur); // never strand a segment
  }
}

export function startClient(ctx, S, st, i) {
  const c = S.roster[i];
  S.idx = i; S.client = c; S.competency = 0;
  S.segs = segmentsOf(c); S.forceDone = false; S.seg = 0; S.live = false; S.pending = -1;
  stage.seatClient(st, c.kind);
  S.caller = createCaller(c, ctx.seed, `${i}:${(ctx.meta && ctx.meta.runs) || 0}`);  // per run seed, client and visit: a regular calls differently each time back
  S.flash = null; S.flashT = 0; S.trackT = 0; S.trackIn = 0; S.hold = createHold();
  if (!Number.isFinite(S.press)) S.press = 40;  // the hands' press, eased toward W / S (looks only)
  S.guide.baseRadius = c.ringRadius;
  S.guide.speed = c.travelSpeed || 1;
  S.guide.spineV = c.spineV;
  resetPattern(S.guide); // fresh pattern per client (trigger point starts at full radius)
  S.guide.mesh.visible = true;
  S.dlg = createDialogue(c);
  const C = S.coach;
  C.on = i === 0 && !!ctx.meta && ctx.meta.firstPivotSeen === false; // first playthrough, client 1 only
  C.step = -1; C.next = 0; C.held = 0; C.log = []; C.firstRight = false;
  S.caller.wait = C.on ? FIRST_CALL : nextGap(S.caller);
  setCall(null); setRingFlash(null);
  setCoach('');
  if (C.on) coachShow(ctx, S, 0);
  startSegment(ctx, S, 0);
  ctx.hud.setClientInfo(`Client ${i + 1} of ${S.roster.length}: ${c.name}, ${c.role}`);
  ctx.hud.setCompetency(0);
  ctx.hud.setPrompt('');
  S.phase = 'session';
}

function finishClient(ctx, S, st) {
  const c = S.client;
  const half = payClient(ctx, S, c);  // totals first, then the ring and the till sound (ledger.js)
  setRing(null);
  S.caller.call = null; setCall(null);
  sfx(ctx, 'pay');
  S.pending = -1;
  say(S.dlg, c.name, c.done, 4, 'request'); // the thank-you is never dropped
  showDialogue(ctx, S, st);
  showPaid(ctx, S, c, half);
  if (S.idx >= S.roster.length - 1) {     // the last client stays seated into the pivot
    S.guide.mesh.visible = false;
    S.phase = 'pivot';
    setState(STATES.PIVOT);
    return;
  }
  if (S.coach.on) coachTo(ctx, S, STEP_D);
  ctx.hud.setPrompt('Client complete. Press E for the next client.');
  stage.standClient(st);
  S.guide.mesh.visible = false;
  S.phase = 'paid';
}

// The client calls out: the line jumps the chatter, and the answer window opens when it starts.
function askCall(ctx, S) {
  const k = S.caller, c = S.client, C = S.coach;
  const call = makeCall(pickCall(k, C.on && !C.firstRight ? 'harder' : null));
  k.call = call;
  emit('call', { act: 'asked', prompt: call.text, call: call.name, key: call.key || 'none', window: call.window, client: c.id });
  const client = c;
  say(S.dlg, c.name, call.text, 1.8, 'request', () => {
    if (S.client === client && k.call === call && !call.open) openCall(call);
  });
}

function answerCall(ctx, S, st, r) {
  const k = S.caller, c = S.client, call = k.call;
  k.call = null;
  k.wait = nextGap(k);
  const share = 100 / S.segs.length;
  let fill;
  if (r.correct) {
    const track = S.trackT > 0 ? Math.min(1, S.trackIn / S.trackT / ON_RING) : 1;
    fill = modality(S.guide) === wanted(S) ? share * (0.5 + 0.5 * track) : 0;
    if (S.coach.on && (S.seg === 0 || wanted(S) === TP)) fill *= 0.5;  // the guided warm-up and trigger point take two, so prompts b and e get their turn
    S.flash = 'ok';
    if (S.coach.on) S.coach.firstRight = true;
  } else {
    fill = -share * DRAIN;
    S.flash = 'bad';
    if (r.answer === 'W') stage.flinch(st);     // pushing when they asked for less, or for stillness
    say(S.dlg, c.name, (c.calls && c.calls.miss) || 'Not that.', 1.4, 'request');
  }
  const was = S.competency;                     // the segment's floor and top hold (a finished segment stays finished)
  S.competency = Math.max(segFloor(S), Math.min(((S.seg + 1) * 100) / S.segs.length, was + fill));
  fill = S.competency - was;
  S.flashT = FLASH;
  S.trackT = 0; S.trackIn = 0;
  const rec = { call: call.name, prompt: call.text, key: call.key || 'none', answer: r.answer, correct: r.correct, late: r.late,
    after: Math.round(call.t * 100) / 100, fill: Math.round(fill * 10) / 10, at: Math.round(S.time * 100) / 100 };
  k.log.push(rec);
  emit('call', { act: 'answer', ...rec, client: c.id });
}

export function updateSession(dt, ctx, S, st) {
  const input = ctx.input;
  const c = S.client;
  const k = S.caller;
  if (input && input.pressed && !takesAD(k.call)) { // edges only; during "left / right" A and D answer instead
    const p = input.pressed;
    if (p.has('KeyA') || p.has('ArrowLeft')) cycleModality(S.guide, -1);
    if (p.has('KeyD') || p.has('ArrowRight')) cycleModality(S.guide, 1);
  }
  // Space: straight to what CLIENT WANTS says, any time in the session. No bonus, no window.
  if (input && input.spacePressed && wanted(S)) setModality(S.guide, wanted(S));
  stage.poseClient(st, dt, S.time);
  const g = S.guide;
  g.tight = holding(S.hold, g, input);           // trigger point is a held click (hold.js)
  const inside = updateGuide(g, dt, st.client.userData.back, ctx.camera,
    input ? input.mouseX : -1, input ? input.mouseY : -1, window.innerWidth, window.innerHeight);
  const aim = input && input.forward ? 85 : input && input.back ? 10 : 40; // W leans in, S eases off
  S.press += (aim - S.press) * Math.min(1, 6 * dt);
  stage.placeHands(st, handSpot(g), S.press, g.spineV + g.v); // hands ride the ring

  const want = wanted(S);
  const right = modality(g) === want;
  S.wrongT = right || !S.live ? 0 : S.wrongT + dt; // no "not it" while the ask is still waiting
  if (!right && S.wrongT >= NOT_IT_AFTER && !S.notIt) {
    S.notIt = 1;
    say(S.dlg, c.name, c.notIt || "That's not it.", 2);
  }
  const onRing = holdTick(S.hold, g, dt, inside, S.live, want);   // in trigger point: held and inside
  fillGuide(g, S.hold.fill);
  if (S.hold.nag) say(S.dlg, c.name, c.holdIt || "Hold it. Don't let go.", 2, 'request');
  if (S.live) { S.trackT += dt; if (onRing) S.trackIn += dt; } // how well the stroke is tracked between answers

  if (!k.call) {                                   // calls only on a live segment, one at a time
    if (S.live && S.pending < 0) { k.wait -= dt; if (k.wait <= 0) askCall(ctx, S); }
  } else if (k.call.open) {
    const r = judge(k.call, input, dt);
    if (r) answerCall(ctx, S, st, r);
  }
  if (S.flashT > 0) { S.flashT -= dt; if (S.flashT <= 0) S.flash = null; }
  toneGuide(g, S.flash || (S.hold.pulseT > 0 ? 'ok' : null));   // green on a full held close
  setRingFlash(S.flash);
  let top = ((S.seg + 1) * 100) / S.segs.length; // a finished segment stays finished
  S.competency = Math.max(segFloor(S), Math.min(top, S.competency));

  updateDialogue(S.dlg, dt);
  ctx.hud.setCompetency(S.competency);
  ctx.hud.setModality(modality(g), want);
  setRing(g.mesh.visible ? g.screen : null);
  setCall(k.call && k.call.open ? { name: k.call.name, frac: 1 - k.call.t / k.call.window } : null);
  coachTick(ctx, S, dt, inside);
  if (S.forceDone) { S.forceDone = false; S.seg = S.segs.length - 1; S.live = true; S.pending = -1; S.competency = top = 100; } // debug / tests
  if (S.pending < 0 && S.live && S.competency >= top - 1e-9) {
    if (S.seg + 1 < S.segs.length) startSegment(ctx, S, S.seg + 1);
    else { S.competency = 100; finishClient(ctx, S, st); return; }
  }
  showDialogue(ctx, S, st);
}

// The hands' working spot for stage.placeHands (spot * 0.14 m = hand centre across the back).
export function handSpot(g) { return Math.max(-HAND_SPOT, Math.min(HAND_SPOT, g.u / 0.14)); }
