// Run report for the watcher (watch.html): pure functions over the event log (src/events.js).
// reportRun(events) -> a plain-text timeline (m:ss lines) and a one-line verdict computed from the
// numbers; diffRuns(prev, cur) -> one "vs run N" line; bestEscapeNote(best, cur) -> one line against
// the best escape so far. Rules only, no model: paste the JSON to one for a richer read.
// linesHeard(events) -> every voice line of a run (`line` events) with its count; repeatLines(groups)
// -> the lines heard in REPEAT_RUNS or more runs across the log (owner ruling 2026-09-24: line diversity).
// Split 2026-09-24 (refactor/split): the numbers are run-stats.js, the diffs run-diff.js, the voice
// lines run-lines.js. This module keeps the timeline, the verdict, reportRun and fullReport.
import { clock, usd, plural, ENDING, groupRuns, runStats, nearby } from './run-stats.js';
import { diffRuns, bestEscapeNote } from './run-diff.js';
import { REPEAT_RUNS, linesHeard, linesSection, repeatLines, repeatsText } from './run-lines.js';

// Moved out in the split; re-exported here for one release (watch.js and the test scripts).
export { clock, groupRuns, runStats, diffRuns, bestEscapeNote, REPEAT_RUNS, linesHeard, linesSection, repeatLines, repeatsText };

function wantedWhy(evs, i, d) {
  const v = nearby(evs, i, 'vehicle', 0.6);
  switch (d.cause) {
    case 'stealVehicle': return v ? `stole a ${v.data.type}` : 'stole a car';
    case 'carjack': return v ? `carjacked a ${v.data.type}` : 'carjacked a car';
    case 'goonHit': return nearby(evs, i, 'swing', 0.1) ? 'swung the chair at a goon' : 'ran a goon down';
    case 'pedHurt': return nearby(evs, i, 'swing', 0.1) ? 'swung the chair at a pedestrian' : 'hit a pedestrian';
    case 'copHit': {
      if (nearby(evs, i, 'swing', 0.1)) return 'swung the chair at a cop';
      if (nearby(evs, i, 'palm', 0.1)) return 'palmed a cop';
      if (nearby(evs, i, 'gun', 0.1)) return 'gunned a cop';
      return 'ran a cop down';
    }
    case 'vehicleWreck': return 'wrecked a car';
    case 'propertyHit': return 'dented a car';
    case 'chaos': return 'a minute of chaos';
    case 'decay': return 'a star decayed';
    case 'massage': return 'finished a mini-massage';
    case 'drop': return 'dropped by hand (debug)';
    case 'vending': return 'camped the chair (unlicensed vending)';
    default: return d.cause || 'unknown';
  }
}

function line(e, evs, i, t0) {
  const d = e.data || {}, at = clock(e.t - t0);
  switch (e.type) {
    case 'run.start': return `${at} run ${e.run} started (seed ${d.seed}${d.unlocks && d.unlocks.length ? `, unlocks: ${d.unlocks.join(', ')}` : ''})`;
    case 'wanted': return d.level === d.prev ? null : `${at} wanted ${d.level} (${wantedWhy(evs, i, d)})`;
    case 'vehicle':
      if (d.act === 'carjack') return null;       // the wanted line says it
      if (d.act === 'batHit') return `${at} a goon's bat on the ${d.type} (hp ${d.hp})`;
      if (d.act === 'exit' && (nearby(evs, i, 'goon', 0.1) || {}).data?.act === 'pullout') return null;   // the pull-out line says it
      return d.act === 'exit' ? `${at} got out of the ${d.type}` : `${at} ${d.stolen ? 'took' : 'got in'} the ${d.type}${d.stolen ? ' (stolen)' : ''}`;
    case 'chair':
      if (d.act === 'pickup') return `${at} chair on your back`;
      if (d.act === 'take') return `${at} took the chair out of the ${d.vehicle}`;
      if (d.act === 'load') return `${at} chair loaded in the ${d.vehicle}`;
      if (d.act === 'throw') return `${at} chair thrown from the ${d.vehicle}`;
      if (d.act === 'setdown') return `${at} chair set down`;
      return null;
    case 'palm': return d.target ? `${at} ${d.charged ? 'HEALING PALM on' : 'palmed'} a ${d.target}` : d.phase === 'cancel' ? `${at} palm charge broken (${d.cause})` : null;
    case 'treat': return !d.phase || d.phase === 'sit' ? `${at} treated a ${d.kind || d.target}${d.wave ? ' from a van wave' : ''}` : null;
    case 'leave':
      if (d.phase === 'prompt') return `${at} at the exit without the chair`;
      if (d.phase === 'done') return `${at} held E: left without the chair`;
      return null;
    case 'gun': return d.stun ? null : `${at} massage gun put a ${d.target} down`;
    case 'van': return d.act === 'ram' ? `${at} the van rammed you (hp ${d.hp})` : d.act === 'park' ? `${at} the van parked across the exit` : d.act === 'pursue' ? `${at} the van gave chase` : null;
    case 'vending':
      if (d.act === 'alert') return `${at} word got out: goons radioed to the chair`;
      if (d.act === 'dispatch') return `${at} a ${d.rank} sent to the chair`;
      if (d.act === 'arrive') return `${at} "We told you to stop that."`;
      return null;
    case 'goon':
      if (d.act === 'pullout') return `${at} a goon pulled you out of the ${d.vehicle}`;
      return d.act === 'cling' ? `${at} a goon jumped on the ${d.vehicle}` : d.act === 'thrown' ? `${at} threw a goon off the ${d.vehicle}` : null;
    case 'knockdown':
      if (d.who === 'player' && d.cause === 'pullout') return null;   // the goon line says it
      if (d.who === 'player') return `${at} knocked down (${d.by ? `${d.by}` : d.cause})`;
      return d.mine ? `${at} ran down a ${d.who} (${d.by})` : null;
    case 'damage': return `${at} took ${d.amount} (${d.source}), hp ${d.hp}`;
    case 'mini':
      if (d.phase === 'start') return `${at} mini-massage started`;
      if (d.phase === 'success') return `${at} mini-massage done (+${usd(d.pay)})`;
      return d.during === 'massage' ? `${at} mini-massage interrupted (${d.reason})` : null;
    case 'run.end': return null;                   // the ending line uses the run's duration
    default: return null;
  }
}

function endingLine(st) {
  if (!st.ending) return null;
  const at = clock(st.duration);
  if (st.ending === 'escape') return `${at} escaped with the chair${st.chairVehicle ? ` (in the ${st.chairVehicle})` : ''}`;
  if (st.ending === 'left') return `${at} left without the chair`;
  return `${at} ${st.ending === 'arrest' ? 'arrested' : 'overworked'}${st.chair === 'ground' ? ' with the chair on the ground' : ''}`;
}

export function verdict(st) {
  if (!st.started) return 'no run started';
  if (!st.ending) return `still running at ${clock(st.duration)} (or the tab closed mid-run)`;
  const at = clock(st.duration);
  if (st.ending === 'escape') {
    const route = st.chairVehicle ? `the ${st.chairVehicle}` : 'the on-foot';
    if (st.maxStars === 0) return `escaped in ${at} without a single star: ${route} route worked, clean`;
    return `escaped in ${at} at 0 stars: ${route} route worked${st.decays ? ` (${plural(st.decays, 'star')} decayed on the way)` : ''}`;
  }
  if (st.ending === 'left') return `left without the chair after ${at}: the chair stayed ${st.chair === 'vehicle' ? `in the ${st.chairVehicle || 'car'}` : 'on the ground'}`;
  const who = st.ending === 'arrest' ? 'arrested' : 'died';
  if (!st.chairMoved) return `${who} at ${at} without ever picking the chair up`;
  if (st.droppedAt !== null) return `${who} with the chair on the ground: dropped at ${clock(st.droppedAt)} and never came back`;
  if (st.maxStars > 0 && st.decays === 0) return 'no star ever decayed: nowhere to hide on this seed';
  if (st.ending === 'death') {
    const top = Object.entries(st.damageBy).sort((a, b) => b[1] - a[1])[0];
    return `overworked at ${at}: ${st.damage} damage taken${top ? `, mostly ${top[0]}` : ''}`;
  }
  return `arrested at ${at} with ${plural(st.level, 'star')} still on`;
}

// The plain-text report for one run's events. opts.lines: false leaves the lines heard off
// (fullReport puts them after the diffs).
export function reportRun(events, opts = {}) {
  const evs = events || [];
  const st = runStats(evs);
  let i0 = -1;
  for (let i = evs.length - 1; i >= 0; i--) if (evs[i].type === 'run.start') { i0 = i; break; }
  const body = i0 >= 0 ? evs.slice(i0) : evs;
  const t0 = body.length ? body[0].t : 0;
  const head = [`Run ${st.run ?? '?'}`];
  if (st.seed !== null && st.seed !== undefined) head.push(`seed ${st.seed}`);
  if (st.build) head.push(`build ${st.build}`);
  head.push(st.ending ? `${(ENDING[st.ending] || st.ending).toUpperCase()} in ${clock(st.duration)}` : 'in progress');
  const out = [head.join(' · ')];
  const pre = [];
  if (st.roster) pre.push(`${plural(st.roster, 'client')} before the van`);
  if (st.pivot && st.pivot.vanStop !== undefined) pre.push(`van stopped at ${st.pivot.vanStop} s`);
  if (st.pivot && st.pivot.unlock !== undefined) pre.push(`controls at ${st.pivot.unlock} s`);
  if (st.pivot && st.pivot.skip !== undefined) pre.push('cutscene skipped');
  if (pre.length) out.push(`(${pre.join(', ')})`);
  for (let i = 0; i < body.length; i++) {
    const s = line(body[i], body, i, t0);
    if (s) out.push(s);
  }
  const end = endingLine(st);
  if (end) out.push(end);
  if (st.finished) out.push(`cash ${usd(st.cash)} · tension released ${st.tension} · peak stars ${st.maxStars}${unlockNote(st)}`);
  out.push(`Verdict: ${verdict(st)}`);
  if (opts.lines !== false) out.push('', linesSection(evs));
  return out.join('\n');
}

// The unlock the run earned, by track: escapes take the main list, arrests and deaths a consolation.
function unlockNote(st) {
  if (st.unlock) return st.track === 'consolation' ? ` · consolation ${st.unlock}` : ` · unlocked ${st.unlock} (main)`;
  if (st.ending === 'arrest' || st.ending === 'death') return ' · no consolation left';
  return '';
}

// Report for groups[i] (from groupRuns) with its diffs: vs the previous run, vs the best escape before it.
export function fullReport(groups, i) {
  const g = groups[i];
  if (!g) return '';
  const lines = [reportRun(g.events, { lines: false })];
  if (i > 0) lines.push(diffRuns(groups[i - 1].events, g.events));
  let best = null;
  for (let j = 0; j < i; j++) {
    const s = runStats(groups[j].events);
    if (s.ending === 'escape' && (!best || s.duration < best.s.duration)) best = { g: groups[j], s };
  }
  if (best) lines.push(bestEscapeNote(best.g.events, g.events));
  lines.push('', linesSection(g.events));
  return lines.join('\n');
}
