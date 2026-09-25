// Player actions on foot: E (interactions, the chair fold that takes a moment), the Healing Palm
// input (palm.js) or, carrying the chair, the chair swing, the massage gun (gun.js) and the arm
// poses they hold, and the perks read here: the ice pack on a chair pickup and the loaner scrubs.
import { setPersonColours, shirtFor } from '../world/people.js';
import { chairState, wearChair, holdChairFront, chairToBack } from './chair.js';
import { emit } from '../events.js';
import { handleInteract, interaction } from './interact.js';
import { startCharge, cancelCharge, updatePalm, knockBody, palmable } from './palm.js';
import { updateGun, poseGun } from './gun.js';
import { emitChaos } from '../run/wanted.js';
import { sfx, knockFx, shake } from '../juice.js';

const FOLD = 0.5;          // s to fold the chair onto your back / into a vehicle (auto-fold halves it)
const FOLD_ACTS = new Set(['pickup', 'take', 'load']);
const ICE_PACK = 20;       // hp the ice pack (perks.icePack) gives back on a chair pickup, once per run

// E: chair folding takes a moment (standing still); every other E acts at once.
export function interactInput(p, dt, ctx, input) {
  // At the exit without the chair (end.js ctx.leave) E in a vehicle is the leave hold, not "get out".
  if (input && input.ePressed && !(p.foldT > 0) && !(p.swingT >= 0) && !(p.vehicle && ctx.leave)) {
    const act = p.vehicle ? null : interaction(p, ctx).act;
    // Folding the chair or starting a mini-massage plants both hands: a charge or a quick palm's
    // wind-up in progress is dropped, or it would freeze under the massage and fire at its end.
    if (FOLD_ACTS.has(act) || act === 'massage') { cancelCharge(p, 'interact'); p.palmT = 0; }
    if (FOLD_ACTS.has(act)) { p.foldT = FOLD * ((ctx.perks && ctx.perks.foldMul) || 1); p.foldAct = act; }
    else handleInteract(p, ctx);
  }
  if (p.foldT > 0) {
    p.foldT -= dt;
    if (p.knockedT > 0 || p.vehicle) p.foldT = 0;
    else if (p.foldT <= 0) {
      p.foldT = 0;
      if (interaction(p, ctx).act === p.foldAct) { handleInteract(p, ctx); if (chairState(ctx.world).where === 'player') icePack(p, ctx); }
    }
  }
}

// The massage gun ticks on foot and in a vehicle (gun.js).
export function gunTick(p, dt, ctx) { updateGun(p, dt, ctx); }

// Healing Palm: press to charge, hold 0.7 s for the treating lunge, a tap for the quick
// palm (palm.js). p.holdPalm stands in for the button in headless checks.
// Carrying the chair, left click is the swing instead (the palm cannot be charged). p.swingChair
// stands in for the click in headless checks.
export function palmInput(p, dt, ctx, input, knocked) {
  const carrying = chairState(ctx.world).where === 'player';
  if (carrying) {
    if (((input && input.leftClicked && input.locked) || p.swingChair) && !knocked) startSwing(p, ctx);
    p.swingChair = false;
    updatePalm(p, dt, ctx, false);
  } else {
    if (input && input.leftClicked && input.locked && p.elbowT <= 0 && !knocked) startCharge(p);
    updatePalm(p, dt, ctx, !!((input && input.mouseLeft && input.locked) || p.holdPalm));
  }
  updateSwing(p, dt, ctx, knocked);
  if (p.elbowT > 0) p.elbowT = Math.max(0, p.elbowT - dt);
}

// ---- The chair swing (Andy's suggestion, ruled 2026-09-24) ----
// 0.15 s wind-up, 0.2 s arc, 0.15 s recover; no charge. The arc's midpoint hits everything up and
// in the half circle in front within 2.5 m (goons, cops, peds): down 3 s, ~2 m of knockback, a THUD,
// "CHAIR!", a bigger shake. No treatment: they rise straight back into what they were doing. A cop
// caught is wanted +1 each (report 'copHit'); a goon 'goonHit', a ped 'pedHurt' (DANGEROUS, 2026-09-25). Each swing wears the chair 10 (chair.js). Nobody dies.
export const SWING_UP = 0.15, SWING_ARC = 0.2, SWING_DOWN = 0.15;
export const SWING_REACH = 2.5;
const SWING_SHAKE = 0.5;

function startSwing(p, ctx) {
  if (p.swingT >= 0 || p.foldT > 0 || p.vehicle || p.massaging || p.knockedT > 0) return false;
  cancelCharge(p, 'swing'); p.palmT = 0; p.lungeT = 0;
  p.swingT = 0; p.swingHit = false;
  p.yaw = Math.atan2(-Math.sin(p.camYaw), -Math.cos(p.camYaw));   // swing where the camera looks
  sfx(ctx, 'whoosh', p.pos.x, p.pos.z);
  return true;
}

function updateSwing(p, dt, ctx, knocked) {
  if (!(p.swingT >= 0)) return;
  if (knocked || p.vehicle || chairState(ctx.world).where !== 'player') { endSwing(p, ctx); return; }
  p.swingT += dt;
  const t = p.swingT;
  if (!p.swingHit && t >= SWING_UP + SWING_ARC * 0.5) { p.swingHit = true; swingHit(p, ctx); }
  if (t >= SWING_UP + SWING_ARC + SWING_DOWN) { endSwing(p, ctx); return; }
  // The chair in both hands: raised over his right shoulder, swept right to left, lowered.
  const a = t < SWING_UP ? -Math.PI / 2 : t < SWING_UP + SWING_ARC ? -Math.PI / 2 + Math.PI * (t - SWING_UP) / SWING_ARC : Math.PI / 2;
  const lift = t < SWING_UP ? 0.25 * t / SWING_UP : t < SWING_UP + SWING_ARC ? 0.25 : 0.25 * (1 - (t - SWING_UP - SWING_ARC) / SWING_DOWN);
  holdChairFront(ctx, p, a, lift);
}

function endSwing(p, ctx) {
  p.swingT = -1; p.swingHit = false;
  chairToBack(ctx, p);
}

function swingHit(p, ctx) {
  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
  const hits = [];
  for (const e of ctx.npcs || []) {
    const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z, r = SWING_REACH + (e.radius || 0.35);
    if (dx * dx + dz * dz > r * r || dx * fx + dz * fz < 0 || !palmable(p, ctx, e)) continue;
    hits.push(e);
  }
  const kinds = new Set();
  for (const e of hits) {
    knockBody(p, ctx, e, 'chair', 'CHAIR!');
    kinds.add(e.kind);
  }
  const durability = wearChair(ctx);
  if (hits.length) {
    knockFx(ctx, hits[0], p);
    shake(ctx, SWING_SHAKE);
    p.shakeT = 0.15;
    ctx.grabUntil = 0;                        // like the palm, it brings the bats out (goon.js)
    if (ctx.wanted) {
      for (const e of hits) if (e.kind === 'cop') ctx.wanted.report('copHit');   // any action on a cop: +1 each
      if (kinds.has('goon')) ctx.wanted.report('goonHit');
      if (kinds.has('ped')) ctx.wanted.report('pedHurt');
    }
    emitChaos(ctx, p.pos.x + fx, p.pos.z + fz, 'chair');
  }
  p.lastSwing = { t: ctx.time, hits: hits.length, kinds: [...kinds], durability };
  emit('swing', { hits: hits.length, goons: hits.filter((e) => e.kind === 'goon').length, cops: hits.filter((e) => e.kind === 'cop').length,
    peds: hits.filter((e) => e.kind === 'ped').length, durability });
}

// Arms: folding and swinging hold both out in front; otherwise the gun (if drawn) sets the right arm.
export function poseArms(p) {
  if (p.foldT > 0 || p.swingT >= 0) { const l = p.mesh.userData.limbs; l.armL.rotation.x = -1.1; l.armR.rotation.x = -1.1; }
  else poseGun(p);
}

// The ice pack (consolation perk): the first chair pickup of a run that finds him hurt heals
// 20 hp. A pickup at full health does not spend it. p.icePackUsed is cleared on RUN entry.
function icePack(p, ctx) {
  if (!(ctx.perks && ctx.perks.icePack) || p.icePackUsed || !(p.hp > 0 && p.hp < 100)) return;
  const from = p.hp;
  p.hp = Math.min(100, p.hp + ICE_PACK);
  p.prevHp = p.hp;
  p.icePackUsed = true;
  if (ctx.hud && ctx.hud.floater) ctx.hud.floater(`+${Math.round(p.hp - from)}`, p.pos.x, p.pos.y + 2.1, p.pos.z, 'released');
  emit('perk', { id: 'icepack', hp: Math.round(p.hp), from: Math.round(from) });
}

// The loaner scrubs (perks.shirt): the player's shirt follows the perk, re-skinned via people.js.
export function wearPerks(p, perks) {
  setPersonColours(p.mesh, { shirt: shirtFor('player', perks && perks.shirt) });
}
