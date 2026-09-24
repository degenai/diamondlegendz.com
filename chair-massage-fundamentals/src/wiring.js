// The state machine's enter/exit hooks: what each state sets up and tears down (split from main.js,
// refactor/split). Registered once at boot, after initAudio (its MASSAGE hook hushes the voice first).
import { STATES, setState, onEnter, onExit } from './state.js';
import * as input from './input.js';
import * as meta from './meta.js';
import * as hud from './hud.js';
import * as massage from './massage/index.js';
import { wearPerks } from './entities/player-actions.js';
import { ensureChair, resetChair } from './entities/chair.js';
import { exitVehicle } from './entities/interact.js';
import * as spawner from './run/spawner.js';
import { createMini } from './run/minimassage.js';
import { cancelCharge } from './entities/palm.js';
import { resetGun } from './entities/gun.js';
import * as pivot from './pivot.js';
import { clearBubbles } from './bubbles.js';
import { resetEscapeMarker } from './run/end.js';
import { startSlowmo, clearSlowmo } from './run/slowmo.js';
import { startStats, showSummary, hideSummary } from './run/summary.js';
import { emit } from './events.js';
import { VERSION } from './version.js';
import { resetJuice, clearHitStop } from './juice.js';

export const END = [STATES.ARREST, STATES.DEATH, STATES.ESCAPE];

export function wireStates(ctx, player, hudRoot, updateHint) {
onEnter(STATES.TITLE, () => { hud.showTitle(); input.releaseLock(); });
onExit(STATES.TITLE, () => hud.hideTitle());
onEnter(STATES.MASSAGE, () => {
  ctx.perks = meta.perks(ctx.meta); // a consolation won last run dresses the therapist now (stage.addCast)
  // Everything the last run created goes: NPCs (pivot goons included), police, the van's trip.
  if (player.vehicle) exitVehicle(player, ctx);
  player.knockedT = 0; player.massaging = false; player.palmT = 0; player.chargeT = -1; player.lungeT = 0; player.holdPalm = false; player.hp = 100; player.foldT = 0;
  spawner.clear(ctx);
  spawner.resetVan(ctx);
  pivot.reset();
  clearBubbles(); clearSlowmo(ctx); hideSummary(); resetEscapeMarker(ctx); resetJuice(ctx);
  hud.showRunHud(false);
  ctx.mini = createMini();
  ctx.wanted.reset();
  ctx.runEnd = null; ctx.runStats = null;
});
onEnter(STATES.MASSAGE, () => massage.enter(ctx));
onEnter(STATES.MASSAGE, () => resetChair(ctx)); // after enter: the station exists by now
onEnter(STATES.MASSAGE, () => emit('massage', { roster: massage.debugState().clientCount }));
onExit(STATES.MASSAGE, (next) => massage.exit(ctx, next));
onEnter(STATES.PIVOT, () => pivot.start(ctx));
// Any way out of the cutscene other than the run restores the van's steering and clears the cast.
onExit(STATES.PIVOT, (next) => { if (next !== STATES.RUN) pivot.reset(); });
onEnter(STATES.RUN, (prev) => {
  clearHitStop(); // no hit-stop or shake carried in from a previous state
  // The lie is only spent once the player actually reaches the run.
  if (prev === STATES.PIVOT && !ctx.meta.firstPivotSeen) {
    ctx.meta.firstPivotSeen = true;
    meta.save(ctx.meta);
  }
  ensureChair(ctx);
  ctx.mini = createMini();
  ctx.perks = meta.perks(ctx.meta);
  wearPerks(player, ctx.perks);
  ctx.timeScale = 1;
  resetGun(player);
  if (prev === STATES.PIVOT) pivot.beginRun(ctx); else hud.setRunTitle(true);
  spawner.begin(ctx, prev === STATES.PIVOT);
  startStats(ctx);
  emit('run.start', { seed: ctx.seed, build: VERSION, unlocks: [...ctx.meta.unlocks], perks: { ...ctx.perks }, cash: ctx.massageTotals ? ctx.massageTotals.you : 0, fromPivot: prev === STATES.PIVOT });
  hud.showRunHud(true); updateHint();
});
onExit(STATES.RUN, () => {
  input.releaseLock(); hud.setHint(''); hud.setRunTitle(false);
  hud.setVehicleLine(''); hud.setChairStrip(''); hud.setMini(null); hud.setHeatLine('');
});
// Run end: slow motion and a stamp (run/slowmo.js), then the certificate (run/summary.js).
for (const s of END) {
  onEnter(s, () => {
    // Debug entry without a runEnd: an ESCAPE that nobody verified cannot know the chair came along.
    if (!ctx.runEnd) ctx.runEnd = { reason: s === STATES.ARREST ? 'arrest' : s === STATES.DEATH ? 'death' : 'left', time: ctx.time };
    player.massaging = false; player.foldT = 0; // a fold in progress must not finish under the slow motion
    // Nor a palm: the end states still tick the player with neutral input (button up), which would
    // turn a charge into a quick palm, or finish a wind-up or a lunge, under the stamp.
    cancelCharge(player, 'runend'); player.palmT = 0; player.lungeT = 0; player.holdPalm = false;
    resetEscapeMarker(ctx);
    startSlowmo(ctx, ctx.runEnd.reason);
  });
  onExit(s, () => { hud.showRunHud(false); ctx.timeScale = 1; });
}
onEnter(STATES.SUMMARY, () => {
  hud.hideStamp();
  showSummary(ctx, hudRoot, () => setState(STATES.MASSAGE));
});
onExit(STATES.SUMMARY, () => hideSummary());
}
