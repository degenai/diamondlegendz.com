// The paused decision loop shared by pilot.mjs and replay-test.mjs (docs/playtest-jev.md 4b).
// observe -> choose -> act -> step: a key macro runs to its end (step(ticks) with no interrupts), a
// `wait` is 30 ticks (2 decisions per sim second) cut short by any interrupt. Every choice is logged
// as {tick, action, ...} so a run can be replayed blind with replayActions().

export async function play(T, choose, { until = () => false, maxTicks = 60 * 60 * 20, log = [], onDecision = null } = {}) {
  await T.ev('CMF.agent.ready');
  for (;;) {
    const obs = await T.J('CMF.agent.observe()');
    if (await until(obs)) return { reason: 'goal', obs, log };
    if (obs.done) return { reason: 'done', obs, log };
    if (obs.tick > maxTicks) return { reason: 'timeout', obs, log };
    const ids = Object.keys(obs.options);
    let d;
    if (ids.length === 1) d = { action: ids[0], auto: true };
    else {
      try { d = await choose(obs); } catch (err) { throw new Error(`model call failed at tick ${obs.tick}: ${err.message}`); }
      if (!ids.includes(d.action)) { d.invalid = d.action; d.action = 'wait'; }
    }
    const r = await T.J(`CMF.agent.act(${JSON.stringify(d.action)})`);
    if (!r.ok) throw new Error(`act(${d.action}) refused at tick ${obs.tick}: ${r.error}`);
    const entry = { tick: obs.tick, action: d.action };
    // What the pilot saw, for review.mjs and compare.mjs (the same input through another model).
    if (obs.state.st === 'RUN') entry.run = true;
    if (ids.length > 1) { entry.text = obs.text; entry.opts = obs.options; if (obs.state.st === 'RUN') entry.near = obs.state.near; if (obs.state.st === 'MASSAGE' && obs.state.call) entry.call = obs.state.call; if (obs.state.mini && obs.state.mini.call) entry.call = obs.state.mini.call; }
    for (const k of ['auto', 'invalid', 'probs', 'conf', 'danger', 'q', 'ms', 'lms', 'retries', 'prov', 'fit', 'raw']) if (d[k] !== undefined && d[k] !== null) entry[k] = d[k];
    log.push(entry);
    // A pilot flapping between two instant actions (enter/exit, 4000 times) ends the run as 'loop':
    // 400 decisions inside 20 s of sim using two actions or fewer. (60 in 5 s was too tight: Laya
    // tapping S through one open call, 2 ticks a tap, is a wrong answer, not a stuck run.)
    const L = log.length;
    // Or the same observation 120 times running with the model's answer unchanged: a deterministic
    // stateless pilot at a state that only it can change ends as 'stall'.
    if (L >= 120 && log.slice(L - 120).every((e) => e.text && e.text === log[L - 1].text && e.action === log[L - 1].action)) return { reason: 'stall', obs, log };
    if (L >= 400 && log[L - 1].tick - log[L - 400].tick < 1200 && new Set(log.slice(L - 400).map((e) => e.action)).size <= 2) return { reason: 'loop', obs, log };
    if (onDecision) onDecision(entry, obs);
    if (d.action === 'wait') await T.J('CMF.agent.step(30)');
    else if (r.ticks > 0) await T.J(r.interruptible ? `CMF.agent.step(${r.ticks})` : `CMF.agent.step(${r.ticks}, { stopOn: null })`);
  }
}

// Blind replay of a logged list: step to each tick, act without the menu check, then run on to endTick.
export async function replayActions(T, actions, endTick) {
  await T.ev('CMF.agent.ready');
  for (const a of actions) {
    const now = await T.ev('CMF.agent.tick');
    if (a.tick > now) await T.J(`CMF.agent.step(${a.tick - now}, { stopOn: null })`);
    const r = await T.J(`CMF.agent.replay(${JSON.stringify(a.action)})`);
    if (!r.ok) throw new Error(`replay(${a.action}) failed at tick ${a.tick}`);
  }
  const now = await T.ev('CMF.agent.tick');
  if (endTick > now) await T.J(`CMF.agent.step(${endTick - now}, { stopOn: null })`);
}

// Past the course: the pivot (or anything after it) reached.
export const pastCourse = (obs) => ['PIVOT', 'RUN', 'ARREST', 'DEATH', 'ESCAPE', 'SUMMARY'].includes(obs.state.st);
