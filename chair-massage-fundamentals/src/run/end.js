// Run end: record why and hand over to the end state. reason: arrest | death | escape | left
// (escape without the chair). ESCAPE is checked here every RUN tick: the player (on foot or
// driving) inside world.spawns.escape.zone with wanted 0. With heat, the marker pulses red and
// the HUD says so. Without the chair the zone does not end the run (ruled 2026-09-24 after run 7
// ended LEFT the instant he drove in): the strip asks, the compass points at the chair, and
// holding E for LEAVE_HOLD s inside the zone (on foot or driving) ends it as LEFT. Watcher events:
// `leave` prompt (in the zone without the chair), start (E went down), done (held), off.
import * as THREE from '../../vendor/three.module.js';
import { setState, getState, STATES } from '../state.js';
import { chairState } from '../entities/chair.js';
import { emit } from '../events.js';

const STATE_FOR = { arrest: STATES.ARREST, death: STATES.DEATH, escape: STATES.ESCAPE, left: STATES.ESCAPE };
const RED = new THREE.Color(0xe0322c);
export const LEAVE_HOLD = 2;         // s of E inside the zone to leave without the chair
export const LEAVE_TEXT = 'You left the chair. Hold E for 2 s to leave without it, or go back.';

export function endRun(ctx, reason) {
  if (ctx.runEnd || getState() !== STATES.RUN || !STATE_FOR[reason]) return false;
  ctx.runEnd = { reason, time: ctx.time };
  setState(STATE_FOR[reason]);
  return true;
}

function inZone(z, x, zz) { return x >= z.minX && x <= z.maxX && zz >= z.minZ && zz <= z.maxZ; }

// Does the player have the chair with them (on their back, or loaded in the car they drive)?
export function hasChair(ctx) {
  const cs = chairState(ctx.world), p = ctx.player;
  return cs.where === 'player' || (cs.where === 'vehicle' && !!p.vehicle && cs.vehicle === p.vehicle);
}

function pulse(marker, on, t) {
  if (!marker) return;
  marker.traverse((o) => {
    if (!o.material || !o.material.color) return;
    if (!o.userData.baseColor) o.userData.baseColor = o.material.color.clone();
    if (on) o.material.color.copy(o.userData.baseColor).lerp(RED, 0.55 + 0.45 * Math.sin(t * 9));
    else o.material.color.copy(o.userData.baseColor);
  });
}

// Per RUN tick. Returns the HUD heat line ('' when none).
export function checkEscape(ctx) {
  const esc = ctx.world.spawns && ctx.world.spawns.escape;
  if (!esc || ctx.runEnd) return '';
  const p = ctx.player, at = p.vehicle ? p.vehicle.pos : p.pos;
  const inside = inZone(esc.zone, at.x, at.z);
  const heat = inside && ctx.wanted.level > 0;
  if (heat !== !!ctx._escHeat || heat) pulse(esc.marker, heat, ctx.time);
  ctx._escHeat = heat;
  if (heat) { leaveOff(ctx, 'heat'); return 'Lose the heat first.'; }
  if (!inside) { leaveOff(ctx, 'out'); return ''; }
  if (hasChair(ctx)) { leaveOff(ctx, 'chair'); endRun(ctx, 'escape'); return ''; }
  let L = ctx.leave;
  if (!L) {
    L = ctx.leave = { held: 0, at: ctx.time, holding: false };
    emit('leave', { phase: 'prompt', vehicle: p.vehicle ? p.vehicle.type : null });
  }
  const dt = Math.max(0, ctx.time - L.at);
  L.at = ctx.time;
  if (ctx.input && ctx.input.e) {
    if (!L.holding) { L.holding = true; L.held = 0; emit('leave', { phase: 'start', vehicle: p.vehicle ? p.vehicle.type : null }); }
    else L.held += dt;
    if (L.held >= LEAVE_HOLD) {
      emit('leave', { phase: 'done', held: Math.round(L.held * 10) / 10 });
      ctx.leave = null;
      endRun(ctx, 'left');
      return '';
    }
  } else if (L.holding) { L.holding = false; L.held = 0; }   // let go: start over
  return LEAVE_TEXT;
}

// The leave confirm, 0..1 of the hold (the strip's fill), or null when not asking.
export function leaveHold(ctx) {
  return ctx.leave ? Math.min(1, ctx.leave.held / LEAVE_HOLD) : null;
}

function leaveOff(ctx, why) {
  if (!ctx.leave) return;
  ctx.leave = null;
  emit('leave', { phase: 'off', why });
}

export function resetEscapeMarker(ctx) {
  const esc = ctx.world.spawns && ctx.world.spawns.escape;
  if (esc) pulse(esc.marker, false, 0);
  ctx._escHeat = false;
  ctx.leave = null;
}
