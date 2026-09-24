// Run comparisons for the watcher: diffRuns(prev, cur) -> one "vs run N" line; bestEscapeNote(best,
// cur) -> one line against the best escape so far. Pure functions over the event log.
import { runStats, clock, usd, plural, CAUSE, ENDING } from './run-stats.js';

const endWord = (e) => ENDING[e] || 'unfinished';
function chairStory(st) {
  if (st.throws.length) return `thrown at ${clock(st.throws[0].t)}`;
  if (st.droppedAt !== null) return `left on the ground at ${clock(st.droppedAt)}`;
  if (!st.chairMoved) return 'never picked up';
  return 'carried, never dropped';
}

// One line comparing a run with the one before it. Only what changed is listed.
export function diffRuns(prevEvents, curEvents) {
  const a = runStats(prevEvents), b = runStats(curEvents);
  const parts = [];
  const dd = Math.round(b.duration - a.duration);
  if (Math.abs(dd) >= 1) parts.push(`${Math.abs(dd)} s ${dd > 0 ? 'longer' : 'shorter'}`);
  if (a.maxStars !== b.maxStars) parts.push(`peak stars ${b.maxStars} (was ${a.maxStars})`);
  if (a.firstStar && b.firstStar) {
    if (a.firstStar.cause !== b.firstStar.cause) parts.push(`first star came from ${CAUSE[b.firstStar.cause] || b.firstStar.cause} (was ${CAUSE[a.firstStar.cause] || a.firstStar.cause})`);
    if (Math.abs(a.firstStar.t - b.firstStar.t) >= 5) parts.push(`first star at ${clock(b.firstStar.t)} (was ${clock(a.firstStar.t)})`);
  } else if (a.firstStar || b.firstStar) {
    parts.push(b.firstStar ? `first star at ${clock(b.firstStar.t)} from ${CAUSE[b.firstStar.cause] || b.firstStar.cause} (was no star at all)` : `no star at all (was first at ${clock(a.firstStar.t)})`);
  }
  if (a.decays !== b.decays) parts.push(`${plural(b.decays, 'star')} decayed (was ${a.decays})`);
  const ca = chairStory(a), cb = chairStory(b);
  if (ca !== cb) parts.push(`the chair was ${cb} (was ${ca})`);
  const la = a.loads.join(', ') || 'never', lb = b.loads.join(', ') || 'never';
  if (la !== lb) parts.push(`chair loaded: ${lb} (was ${la})`);
  const va = a.vehicles.join(', ') || 'none', vb = b.vehicles.join(', ') || 'none';
  if (va !== vb) parts.push(`vehicles ${vb} (was ${va})`);
  if (a.carjacks !== b.carjacks) parts.push(`${plural(b.carjacks, 'carjack')} (was ${a.carjacks})`);
  if (a.palms !== b.palms) parts.push(`${plural(b.palms, 'palm hit')} (was ${a.palms})`);
  if (a.guns !== b.guns) parts.push(`${plural(b.guns, 'gun knockdown')} (was ${a.guns})`);
  if (a.minis !== b.minis) parts.push(`${plural(b.minis, 'mini-massage')} (was ${a.minis})`);
  if (Math.round(a.cash) !== Math.round(b.cash)) parts.push(`cash ${usd(b.cash)} (was ${usd(a.cash)})`);
  if (a.damage !== b.damage) parts.push(`took ${b.damage} damage (was ${a.damage})`);
  if (a.knocked !== b.knocked) parts.push(`knocked down ${b.knocked}x (was ${a.knocked})`);
  if (a.ending !== b.ending) parts.push(`ended ${endWord(b.ending)} (was ${endWord(a.ending)})`);
  return `vs run ${a.run}: ${parts.length ? parts.join('; ') : 'the same run, number for number'}`;
}

// One line against the best (fastest) escape so far.
export function bestEscapeNote(bestEvents, curEvents) {
  const a = runStats(bestEvents), b = runStats(curEvents);
  const head = `vs best escape (run ${a.run}, ${clock(a.duration)})`;
  if (b.ending !== 'escape') return `${head}: ended ${endWord(b.ending)} at ${clock(b.duration)}, peak stars ${b.maxStars} (was ${a.maxStars})`;
  const dd = Math.round(b.duration - a.duration);
  if (dd < 0) return `${head}: new best, ${-dd} s faster`;
  return `${head}: ${dd} s slower, peak stars ${b.maxStars} (was ${a.maxStars})`;
}
