// Run report for the watcher (watch.html): pure functions over the event log (src/events.js).
// reportRun(events) -> a plain-text timeline (m:ss lines) and a one-line verdict computed from the
// numbers; diffRuns(prev, cur) -> one "vs run N" line; bestEscapeNote(best, cur) -> one line against
// the best escape so far. Rules only, no model: paste the JSON to one for a richer read.

export const clock = (s) => { s = Math.max(0, s || 0); return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; };
const usd = (n) => `$${Math.round((n || 0) * 100) / 100}`;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const ENDING = { escape: 'escaped', arrest: 'arrested', death: 'overworked', left: 'left the chair' };
const END_STATE = { ESCAPE: 'escape', ARREST: 'arrest', DEATH: 'death' };
const CAUSE = {
  stealVehicle: 'a stolen car', carjack: 'a carjack', goonHit: 'a goon hit', pedHurt: 'a ped hit',
  vehicleWreck: 'a wreck', propertyHit: 'a dented car', chaos: 'a minute of chaos',
};

// Split a log into runs: consecutive events with the same run number; a second run.start under
// the same number (progress was reset) opens a new group. Only groups with a run.start are runs.
export function groupRuns(events) {
  const groups = [];
  let cur = null;
  for (const e of events || []) {
    if (!e || typeof e !== 'object') continue;
    if (!cur || e.run !== cur.run || (e.type === 'run.start' && cur.started)) {
      cur = { run: e.run, events: [], started: false };
      groups.push(cur);
    }
    if (e.type === 'run.start') cur.started = true;
    cur.events.push(e);
  }
  return groups.filter((g) => g.started);
}

// Numbers for one run's events. Times are seconds from run.start.
export function runStats(events) {
  const all = events || [];
  let i0 = -1;
  for (let i = all.length - 1; i >= 0; i--) if (all[i].type === 'run.start') { i0 = i; break; }
  const pre = i0 >= 0 ? all.slice(0, i0) : [];
  const evs = i0 >= 0 ? all.slice(i0) : all.slice();
  const S0 = evs[0] || { t: 0, data: {} };
  const t0 = i0 >= 0 ? S0.t : (all[0] ? all[0].t : 0);
  const rel = (e) => Math.max(0, e.t - t0);
  const st = {
    run: S0.run ?? (all[0] && all[0].run), seed: i0 >= 0 ? S0.data.seed : null, build: i0 >= 0 ? S0.data.build : null,
    unlocks: i0 >= 0 ? S0.data.unlocks || [] : [], started: i0 >= 0, wallStart: S0.wall,
    ending: null, finished: false, duration: 0, cash: 0, tension: 0, unlock: null,
    level: 0, maxStars: 0, firstStar: null, decays: 0, stars: [{ t: 0, level: 0 }],
    chair: 'ground', chairMoved: false, chairLog: [], throws: [], setdowns: [], loads: [],
    vehicles: [], carjacks: 0, steals: 0, palms: 0, guns: 0, runDowns: 0,
    minis: 0, miniStarts: 0, miniCancels: 0, miniCash: 0,
    damage: 0, damageBy: {}, knocked: 0, state: null, roster: null, pivot: null, lastT: 0,
  };
  for (const e of pre) {
    if (e.type === 'massage') st.roster = e.data.roster;
    if (e.type === 'pivot' && e.data.beat === 'vanStop') st.pivot = { ...(st.pivot || {}), vanStop: e.data.at };
    if (e.type === 'pivot' && (e.data.beat === 'unlock' || e.data.beat === 'skip')) st.pivot = { ...(st.pivot || {}), [e.data.beat]: e.data.at };
  }
  let lastVehicle = null;
  for (let i = 0; i < evs.length; i++) {
    const e = evs[i], d = e.data || {}, t = rel(e);
    st.lastT = Math.max(st.lastT, t);
    if (e.type === 'state') {
      st.state = d.to;
      if (END_STATE[d.to] && !st.ending) { st.ending = END_STATE[d.to]; st.duration = t; }
    } else if (e.type === 'vehicle') {
      lastVehicle = { t, type: d.type, act: d.act };
      if (d.act !== 'exit' && !st.vehicles.includes(d.type)) st.vehicles.push(d.type);
      if (d.act === 'carjack') st.carjacks++;
      else if (d.act === 'enter' && d.stolen) st.steals++;
    } else if (e.type === 'wanted') {
      if (d.level === d.prev) continue;
      st.level = d.level;
      st.stars.push({ t, level: d.level });
      if (d.level > st.maxStars) st.maxStars = d.level;
      if (d.cause === 'decay') st.decays++;
      if (!st.firstStar && d.level > 0) {
        let cause = CAUSE[d.cause] || d.cause;
        const v = nearby(evs, i, 'vehicle', 0.6);
        if ((d.cause === 'stealVehicle' || d.cause === 'carjack') && v) cause = d.cause === 'carjack' ? `carjacking a ${v.data.type}` : `stealing a ${v.data.type}`;
        st.firstStar = { t, cause: d.cause, text: cause };
      }
    } else if (e.type === 'chair') {
      st.chairMoved = true;
      st.chair = d.where;
      st.chairLog.push({ t, act: d.act, vehicle: d.vehicle || null });
      if (d.act === 'throw') st.throws.push({ t, vehicle: d.vehicle });
      if (d.act === 'setdown') st.setdowns.push(t);
      if (d.act === 'load') st.loads.push(d.vehicle);
    } else if (e.type === 'palm') st.palms++;
    else if (e.type === 'gun') st.guns++;
    else if (e.type === 'knockdown') {
      if (d.who === 'player') st.knocked++;
      else if (d.mine) st.runDowns++;
    } else if (e.type === 'damage') {
      st.damage += d.amount || 0;
      st.damageBy[d.source] = (st.damageBy[d.source] || 0) + (d.amount || 0);
    } else if (e.type === 'mini') {
      if (d.phase === 'start') st.miniStarts++;
      else if (d.phase === 'success') { st.minis++; st.miniCash += d.pay || 0; }
      else if (d.phase === 'cancel' && d.during === 'massage') st.miniCancels++;
    } else if (e.type === 'run.end') {
      st.ending = d.reason; st.finished = true; st.duration = d.time;
      st.cash = d.cash; st.tension = d.tension; st.unlock = d.unlock; st.track = d.track || (d.unlock ? 'main' : null);
    }
  }
  if (!st.ending) st.duration = st.lastT;
  if (!st.finished) { st.cash = (i0 >= 0 ? S0.data.cash || 0 : 0) + st.miniCash; st.tension = st.palms + st.guns + st.minis; }
  st.lastVehicle = lastVehicle;
  // Where the chair went to the ground for the last time (and stayed).
  const lastGround = [...st.chairLog].reverse().find((c) => c.act === 'throw' || c.act === 'setdown');
  st.droppedAt = st.chair === 'ground' && lastGround ? lastGround.t : null;
  st.chairVehicle = st.chair === 'vehicle' ? (st.chairLog.length ? st.chairLog[st.chairLog.length - 1].vehicle : null) : null;
  return st;
}

function nearby(evs, i, type, win) {
  let best = null, bd = win;
  for (let j = Math.max(0, i - 6); j < Math.min(evs.length, i + 7); j++) {
    if (evs[j].type !== type) continue;
    const d = Math.abs(evs[j].t - evs[i].t);
    if (d <= bd) { bd = d; best = evs[j]; }
  }
  return best;
}

function wantedWhy(evs, i, d) {
  const v = nearby(evs, i, 'vehicle', 0.6);
  switch (d.cause) {
    case 'stealVehicle': return v ? `stole a ${v.data.type}` : 'stole a car';
    case 'carjack': return v ? `carjacked a ${v.data.type}` : 'carjacked a car';
    case 'goonHit': {
      if (nearby(evs, i, 'palm', 0.1)) return 'palmed a goon';
      if (nearby(evs, i, 'gun', 0.1)) return 'gunned a goon down';
      return 'ran a goon down';
    }
    case 'pedHurt': return 'hit a pedestrian';
    case 'vehicleWreck': return 'wrecked a car';
    case 'propertyHit': return 'dented a car';
    case 'chaos': return 'a minute of chaos';
    case 'decay': return 'a star decayed';
    case 'massage': return 'finished a mini-massage';
    case 'drop': return 'dropped by hand (debug)';
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
      return d.act === 'exit' ? `${at} got out of the ${d.type}` : `${at} ${d.stolen ? 'took' : 'got in'} the ${d.type}${d.stolen ? ' (stolen)' : ''}`;
    case 'chair':
      if (d.act === 'pickup') return `${at} chair on your back`;
      if (d.act === 'take') return `${at} took the chair out of the ${d.vehicle}`;
      if (d.act === 'load') return `${at} chair loaded in the ${d.vehicle}`;
      if (d.act === 'throw') return `${at} chair thrown from the ${d.vehicle}`;
      if (d.act === 'setdown') return `${at} chair set down`;
      return null;
    case 'palm': return `${at} palmed a ${d.target}`;
    case 'gun': return `${at} massage gun put a ${d.target} down`;
    case 'knockdown':
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

// The plain-text report for one run's events.
export function reportRun(events) {
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
  return out.join('\n');
}

// The unlock the run earned, by track: escapes take the main list, arrests and deaths a consolation.
function unlockNote(st) {
  if (st.unlock) return st.track === 'consolation' ? ` · consolation ${st.unlock}` : ` · unlocked ${st.unlock} (main)`;
  if (st.ending === 'arrest' || st.ending === 'death') return ' · no consolation left';
  return '';
}
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

// Report for groups[i] (from groupRuns) with its diffs: vs the previous run, vs the best escape before it.
export function fullReport(groups, i) {
  const g = groups[i];
  if (!g) return '';
  const lines = [reportRun(g.events)];
  if (i > 0) lines.push(diffRuns(groups[i - 1].events, g.events));
  let best = null;
  for (let j = 0; j < i; j++) {
    const s = runStats(groups[j].events);
    if (s.ending === 'escape' && (!best || s.duration < best.s.duration)) best = { g: groups[j], s };
  }
  if (best) lines.push(bestEscapeNote(best.g.events, g.events));
  return lines.join('\n');
}
