// The skipPivot unlock (DESIGN.md "Phases of a session", PIVOT: "Skipping it is earned by
// watching", re-ruled 2026-09-25). Earned by ten viewings (meta.js pivotsSeen). With it, a
// course-skin line shows during the drive-up only, from pivot start until the van stop, and any
// key or click cuts to the van stop: the van placed at its mark, the client gone. Everything after
// the stop plays as if the drive had: the crew steps out, their lines and the ranger's run from
// the first, controls unlock at the usual offset. After the stop there is no line and no skip.
import * as stage from './massage/stage.js';
import * as massage from './massage/index.js';
import { showSkip, hideSkip, stopPoint } from './pivot-cast.js';
import { floorHeightAt } from './physics.js';
import { clearBubbles } from './bubbles.js';
import { emit } from './events.js';

export const SKIP_LINE = 'Press any key to skip the drive-up';

export function showDriveSkip(P) {
  showSkip(P);
  if (P.skipEl) P.skipEl.textContent = SKIP_LINE;   // pivot-cast's banner, this line
}

// Per PIVOT tick before the drive: true when this tick's key or click cut the drive-up.
export function checkDriveSkip(ctx, P, arrive) {
  if (!P.canSkip || P.skipped || P.phase === 'parked') return false;   // arrive() took the line down
  const inp = ctx.input;
  if (!inp || !(inp.pressed.size || inp.clicked.size)) return false;
  P.skipped = true;
  hideSkip(P);
  const v = P.van;
  if (v && P.poly && P.poly.pts.length > 1) {
    const s = stopPoint(ctx, P);
    // Up on the plaza: settleHeight only steps up gradually, and a van left at road height inside
    // the terrace's footprint gets pushed out of it.
    v.pos.set(s.x, floorHeightAt(s.x, s.z, ctx.world.colliders, ctx.world.chairSpot.y + 0.5), s.z); v.yaw = s.yaw;
  }
  if (v) { v.steer = 0; v.yawRate = 0; v.mesh.position.copy(v.pos); v.mesh.rotation.y = v.yaw; }
  // The client has already gone, mid-sentence if they were talking: nobody in the chair to walk
  // off when RUN begins.
  if (ctx.voice && typeof ctx.voice.stop === 'function') ctx.voice.stop();
  clearBubbles();
  const st = massage.station();
  if (st) { stage.removeClient(st); st.hands.forEach((h) => { h.visible = false; }); }
  emit('pivot', { beat: 'skip', at: Math.round(P.t * 10) / 10, to: 'vanStop' });
  arrive(ctx);
  return true;
}
