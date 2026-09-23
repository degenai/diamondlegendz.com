// Run end: record why and hand over to the end state. reason: arrest | death | escape | left
// (escape without the chair). ESCAPE is checked here every RUN tick: the player (on foot or
// driving) inside world.spawns.escape.zone with wanted 0. With heat, the marker pulses red and
// the HUD says so.
import * as THREE from '../../vendor/three.module.js';
import { setState, getState, STATES } from '../state.js';
import { chairState } from '../entities/chair.js';

const STATE_FOR = { arrest: STATES.ARREST, death: STATES.DEATH, escape: STATES.ESCAPE, left: STATES.ESCAPE };
const RED = new THREE.Color(0xe0322c);

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
  if (heat) return 'Lose the heat first.';
  if (inside) endRun(ctx, hasChair(ctx) ? 'escape' : 'left');
  return '';
}

export function resetEscapeMarker(ctx) {
  const esc = ctx.world.spawns && ctx.world.spawns.escape;
  if (esc) pulse(esc.marker, false, 0);
  ctx._escHeat = false;
}
