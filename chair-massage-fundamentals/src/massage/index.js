// MASSAGE: the minigame loop. Intro card -> clients (meter + stroke guide + subtitles)
// -> payout and ledger -> E for the next client -> after the last one, PIVOT.
import { STATES, setState } from '../state.js';
import { roster, createDialogue, updateDialogue, say, OUCH } from './clients.js';
import { createMeter, updateMeter, hintRange } from './meter.js';
import { createGuide, updateGuide, cycleModality, modality, disposeGuide } from './guide.js';
import * as stage from './stage.js';

const INTRO_TITLE = 'Module 1: Pressure and Stroke.';
const INTRO_BODY = 'Use W/S to set pressure, A/D to move along the back, keep the cursor on the stroke guide. '
  + 'Space changes modality. Press E when the client is done.';

let st = null; // stage (persists: the chair stays at the spot for the run)
const S = {
  phase: 'idle', roster: [], idx: 0, client: null, meter: null, guide: null, dlg: null,
  competency: 0, ouchCd: 0, time: 0, totals: { you: 0, host: 0 }, paid: [],
};

const usd = (n) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

function showDialogue(hud) {
  if (S.dlg.changed) { hud.showDialogue(S.dlg.speaker, S.dlg.text); S.dlg.changed = false; }
}

function startClient(ctx, i) {
  const c = S.roster[i];
  S.idx = i; S.client = c; S.competency = 0; S.ouchCd = 0;
  stage.seatClient(st, c.kind);
  S.meter = createMeter(c.bandWidth, ctx.rng, S.meter ? S.meter.pressure : 0); // pressure holds where left
  S.guide.baseRadius = c.ringRadius;
  S.guide.spineV = c.spineV;
  S.guide.t = 0; // fresh pattern per client (trigger point starts at full radius)
  S.guide.mesh.visible = true;
  S.dlg = createDialogue(c);
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
  ctx.massageTotals = { ...S.totals }; // becomes the run's starting cash later
  say(S.dlg, c.name, c.done, 4);
  ctx.hud.setLedger([
    `${c.name} paid ${usd(c.pay)}`,
    `You ${usd(half)} / Host cause ${usd(half)}`,
    `Session total: You ${usd(S.totals.you)} / Host cause ${usd(S.totals.host)}`,
  ]);
  const lastOne = S.idx >= S.roster.length - 1;
  ctx.hud.setPrompt(lastOne ? 'Module complete. Press E to continue.' : 'Client complete. Press E for the next client.');
  stage.standClient(st);
  S.guide.mesh.visible = false;
  S.phase = 'paid';
}

export function enter(ctx) {
  if (!st) { st = stage.createStage(ctx); ctx.station = st.station; }
  stage.addCast(st, ctx.scene);
  S.roster = roster(ctx.meta);
  S.idx = 0; S.client = null; S.totals = { you: 0, host: 0 }; S.paid = []; S.meter = null; S.time = 0;
  S.competency = 0;
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
  hud.hideDialogue();
  hud.setPrompt('');
  hud.showCard(INTRO_TITLE, [INTRO_BODY, 'Press any key to begin.'], 'course');
  S.phase = 'intro';
}

export function exit(ctx) {
  stage.removeCast(st, ctx.scene);
  if (S.guide) disposeGuide(S.guide, ctx.scene);
  S.guide = null;
  ctx.hud.hideCard();
  ctx.hud.hideDialogue();
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
  if (input && input.spacePressed) cycleModality(S.guide);
  stage.poseClient(st, dt, S.time);
  const inside = updateGuide(S.guide, dt, st.client.userData.back, ctx.camera,
    input ? input.mouseX : -1, input ? input.mouseY : -1, window.innerWidth, window.innerHeight);
  stage.placeHands(st, S.meter.spot, S.meter.pressure, S.guide.spineV + S.guide.v * 0.5);

  const fill = c.fillRate * (modality(S.guide) === c.wants ? 1 : 0.5); // wrong modality: half
  S.ouchCd = Math.max(0, S.ouchCd - dt);
  if (zone === 'over') {
    S.competency -= 2 * fill * dt;
    if (S.ouchCd <= 0) {
      stage.flinch(st);
      say(S.dlg, c.name, OUCH[Math.floor(ctx.rng.next() * OUCH.length)], 1.6);
      S.ouchCd = 1.8;
    }
  } else if (zone === 'in' && inside) {
    S.competency += fill * dt;
  }
  S.competency = Math.max(0, Math.min(100, S.competency));

  updateDialogue(S.dlg, dt);
  const [lo, hi] = hintRange(S.meter);
  ctx.hud.setMeter(S.meter.pressure, lo, hi);
  ctx.hud.setMeterState(zone);
  ctx.hud.setCompetency(S.competency);
  ctx.hud.setModality(modality(S.guide), c.wants);
  showDialogue(ctx.hud);
  if (S.competency >= 100) finishClient(ctx);
}

export function update(dt, ctx) {
  if (!st) return;
  S.time += dt;
  stage.updateCamera(st, ctx.camera, S.time);
  const input = ctx.input;

  if (S.phase === 'intro') {
    if (input && input.pressed.size > 0) { ctx.hud.hideCard(); startClient(ctx, 0); }
  } else if (S.phase === 'session') {
    updateSession(dt, ctx);
  } else if (S.phase === 'paid') {
    updateDialogue(S.dlg, dt);
    showDialogue(ctx.hud);
    stage.walkOff(st, dt);
    if (input && input.ePressed) {
      if (S.idx + 1 < S.roster.length) startClient(ctx, S.idx + 1);
      else setState(STATES.PIVOT);
    }
  }
}

export const tuning = { CAM_POS: stage.CAM_POS, CAM_LOOK: stage.CAM_LOOK, THERAPIST: stage.THERAPIST };

// Plain snapshot for window.CMF.massage (debug handle + headless tests).
export function debugState() {
  const m = S.meter, g = S.guide;
  return {
    phase: S.phase,
    clientIndex: S.idx,
    clientId: S.client ? S.client.id : null,
    clientCount: S.roster.length,
    requested: S.client ? S.client.wants : null,
    modality: g ? modality(g) : null,
    pressure: m ? m.pressure : 0,
    spot: m ? m.spot : 0,
    band: m ? { centre: m.bandCentre, width: m.bandWidth, lo: m.bandCentre - m.bandWidth / 2, hi: m.bandCentre + m.bandWidth / 2 } : null,
    zone: m ? m.zone : null,
    inside: g ? g.inside : false,
    ring: g ? { x: g.screen.x, y: g.screen.y, r: g.screen.r, worldRadius: g.radius } : null,
    competency: S.competency,
    totals: { ...S.totals },
    paid: S.paid.slice(),
    subtitle: S.dlg && S.dlg.text ? `${S.dlg.speaker}: ${S.dlg.text}` : '',
  };
}
