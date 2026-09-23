// Run end: record why and hand over to the end state (ARREST / DEATH). Phase 6 adds ESCAPE
// and the summary card.
import { setState, getState, STATES } from '../state.js';

export function endRun(ctx, reason) {
  if (ctx.runEnd || getState() !== STATES.RUN) return false;
  ctx.runEnd = { reason, time: ctx.time };
  setState(reason === 'arrest' ? STATES.ARREST : STATES.DEATH);
  return true;
}
