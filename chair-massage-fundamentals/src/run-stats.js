// Run numbers for the watcher (watch.html): pure functions over the event log (src/events.js).
// groupRuns(events) splits a log into runs; runStats(events) -> the numbers for one run that the
// report (run-report.js), the diffs (run-diff.js) and the watcher read. Shared text helpers too.

export const clock = (s) => { s = Math.max(0, s || 0); return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; };
export const usd = (n) => `$${Math.round((n || 0) * 100) / 100}`;
export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const ENDING = { escape: 'escaped', arrest: 'arrested', death: 'overworked', left: 'left the chair' };
const END_STATE = { ESCAPE: 'escape', ARREST: 'arrest', DEATH: 'death' };
export const CAUSE = {
  stealVehicle: 'a stolen car', carjack: 'a carjack', goonHit: 'a goon hit', pedHurt: 'a ped hit', copHit: 'a cop hit',
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
    vehicles: [], carjacks: 0, steals: 0, palms: 0, counters: 0, treats: 0, guns: 0, runDowns: 0,
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
    } else if (e.type === 'palm') { if (d.target) st.palms++; }
    else if (e.type === 'counter') { if (d.act === 'tap' || d.act === 'hold') st.counters++; }
    else if (e.type === 'treat') { if (!d.phase || d.phase === 'sit') st.treats++; }
    else if (e.type === 'gun') { if (!d.stun) st.guns++; }
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
  if (!st.finished) { st.cash = (i0 >= 0 ? S0.data.cash || 0 : 0) + st.miniCash; st.tension = st.treats + st.guns + st.minis; }
  st.lastVehicle = lastVehicle;
  // Where the chair went to the ground for the last time (and stayed).
  const lastGround = [...st.chairLog].reverse().find((c) => c.act === 'throw' || c.act === 'setdown');
  st.droppedAt = st.chair === 'ground' && lastGround ? lastGround.t : null;
  st.chairVehicle = st.chair === 'vehicle' ? (st.chairLog.length ? st.chairLog[st.chairLog.length - 1].vehicle : null) : null;
  return st;
}

export function nearby(evs, i, type, win) {
  let best = null, bd = win;
  for (let j = Math.max(0, i - 6); j < Math.min(evs.length, i + 7); j++) {
    if (evs[j].type !== type) continue;
    const d = Math.abs(evs[j].t - evs[i].t);
    if (d <= bd) { bd = d; best = evs[j]; }
  }
  return best;
}
