// Player actions on foot: E (interactions, the chair fold that takes a moment), the Healing Palm
// input (palm.js), the massage gun (gun.js) and the arm poses they hold, and the perks read here:
// the ice pack on a chair pickup and the loaner scrubs.
import { setPersonColours, shirtFor } from '../world/people.js';
import { chairState } from './chair.js';
import { emit } from '../events.js';
import { handleInteract, interaction } from './interact.js';
import { startCharge, cancelCharge, updatePalm } from './palm.js';
import { updateGun, poseGun } from './gun.js';

const FOLD = 0.5;          // s to fold the chair onto your back / into a vehicle (auto-fold halves it)
const FOLD_ACTS = new Set(['pickup', 'take', 'load']);
const ICE_PACK = 20;       // hp the ice pack (perks.icePack) gives back on a chair pickup, once per run

// E: chair folding takes a moment (standing still); every other E acts at once.
export function interactInput(p, dt, ctx, input) {
  // At the exit without the chair (end.js ctx.leave) E in a vehicle is the leave hold, not "get out".
  if (input && input.ePressed && !(p.foldT > 0) && !(p.vehicle && ctx.leave)) {
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
export function palmInput(p, dt, ctx, input, knocked) {
  if (input && input.leftClicked && input.locked && p.elbowT <= 0 && !knocked) startCharge(p);
  updatePalm(p, dt, ctx, !!((input && input.mouseLeft && input.locked) || p.holdPalm));
  if (p.elbowT > 0) p.elbowT = Math.max(0, p.elbowT - dt);
}

// Arms: folding holds both out in front; otherwise the gun (if drawn) sets the right arm.
export function poseArms(p) {
  if (p.foldT > 0) { const l = p.mesh.userData.limbs; l.armL.rotation.x = -1.1; l.armR.rotation.x = -1.1; }
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
