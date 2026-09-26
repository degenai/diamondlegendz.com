// Determinism proof (DESIGN.md "Playtesting with Jev", milestone 1): one seed, a fresh profile with a
// fixed meta injected before boot, render-less. Run A plays a scripted action list (the course: every
// call answered right, Space to match, E for the next client, the ring reflex on; then 20 s of run
// with a few on-foot macros) and logs every {tick, action}. Run B, a new Chrome and profile, replays
// that list blind. The two snapshot streams must be byte-identical; the first differing snapshot is
// printed if not. Events are compared too (without their wall clock).
//
//   node tools/jev/replay-test.mjs [--seed 777] [--run-seconds 20] [--url http://127.0.0.1:8817/] [--port 9736]
import { openGame } from './cdp.mjs';
import { makeModel } from './models.mjs';
import { play, replayActions } from './loop.mjs';

const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : def; };
const seed = arg('seed', '777'), base = arg('url', 'http://127.0.0.1:8817/'), port = Number(arg('port', '9736'));
const META = { runs: 0, bestTime: 0, bestCash: 0, escapes: 0, pivotsSeen: 0, firstPivotSeen: false, firstRunSeen: false, unlocks: [], consolations: [], lastOutcome: null, lastUnlock: null };
const RUN_SECONDS = Number(arg('run-seconds', '20'));
const RUN_SCRIPT = ['face_exit', 'walk_fwd_1s', 'turn_left_30', 'palm_tap', 'sprint_fwd_2s', 'face_nearest_goon', 'counter', 'palm_charge', 'counter_hold', 'turn_right_30', 'strafe_left_1s', 'jump', 'interact_E', 'back_off_1s', 'turn_around', 'walk_fwd_1s'];
const url = `${base}?seed=${seed}&norender&snap=4`;

async function streams(T) {
  const all = await T.J('CMF.session.since(0)');
  const snaps = all.filter((e) => e.type === 'snap').map((e) => JSON.stringify(e));
  const events = all.filter((e) => e.type !== 'snap' && e.type !== 'input').map((e) => { const { wall, ...rest } = e; return JSON.stringify(rest); });
  const inputs = all.filter((e) => e.type === 'input').map((e) => JSON.stringify(e));
  return { snaps, events, inputs };
}

const t0 = Date.now();
let fail = false;
const oracle = makeModel('oracle');
let A, B, actions, endTick;
{
  const T = await openGame(url, { port, meta: META });
  try {
    let runStart = -1, k = 0;
    const res = await play(T, async (obs) => {
      if (obs.state.st !== 'RUN') return oracle.decide(obs);
      const id = RUN_SCRIPT[k++ % RUN_SCRIPT.length];
      return { action: id in obs.options ? id : 'wait' };
    }, {
      until: (obs) => { if (obs.state.st === 'RUN' && runStart < 0) runStart = obs.tick; return runStart >= 0 && obs.tick - runStart >= RUN_SECONDS * 60; },
    });
    actions = res.log; endTick = res.obs.tick;
    A = await streams(T);
    console.log(`run A: ${res.reason} at tick ${endTick} (${res.obs.state.st}), ${actions.length} actions, ${A.snaps.length} snapshots, ${A.events.length} events, errors ${T.S.errors}`);
    const kinds = {}; for (const e of A.events) { const o = JSON.parse(e); const k = o.type + (o.data.act ? `.${o.data.act}` : o.data.phase ? `.${o.data.phase}` : ''); kinds[k] = (kinds[k] || 0) + 1; }
    console.log('run A events:', JSON.stringify(kinds));
    if (T.S.errors) { fail = true; console.log(T.logs.filter((l) => /error|exception/i.test(l)).slice(0, 5).join('\n')); }
    if (runStart < 0) { fail = true; console.log('run A never reached RUN'); }
  } finally { await T.close(); }
}
{
  const T = await openGame(url, { port, meta: META });
  try {
    await replayActions(T, actions, endTick);
    B = await streams(T);
    console.log(`run B: replayed to tick ${await T.ev('CMF.agent.tick')}, ${B.snaps.length} snapshots, ${B.events.length} events, errors ${T.S.errors}`);
    if (T.S.errors) fail = true;
  } finally { await T.close(); }
}
function compare(name, a, b) {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) {
      console.log(`${name}: FIRST DIFFERENCE at #${i}\n  A: ${a[i]}\n  B: ${b[i]}`);
      return false;
    }
  }
  console.log(`${name}: ${a.length} identical (${a.join('\n').length} bytes)`);
  return true;
}
const same = compare('snapshots', A.snaps, B.snaps);
compare('events', A.events, B.events);
compare('input', A.inputs, B.inputs);
if (!same) fail = true;
console.log(`${fail ? 'REPLAY FAIL' : 'REPLAY PASS'} in ${Math.round((Date.now() - t0) / 1000)} s`);
process.exit(fail ? 1 : 0);
