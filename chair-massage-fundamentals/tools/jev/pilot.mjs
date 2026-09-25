// The Jev pilot (DESIGN.md "Playtesting with Jev", milestone 2): headless Chrome, render-less and
// paused, a model choosing one macro at a time from CMF.agent.observe()'s menu, 2 decisions per sim
// second plus interrupts. Fresh profile per seed, no debug hooks: only CMF.agent.
//
//   node tools/jev/pilot.mjs --model oracle|jev|claude|openai:<model-id> --seeds 101,202,303
//        [--until pivot|end] [--url http://127.0.0.1:8817/] [--port 9735] [--out tools/jev/out]
//
// Serve the game folder first (python -m http.server 8817 --bind 127.0.0.1). Each seed writes
// <out>/<seed>.actions.json (seed, build, model, meta, [{tick, action, probs, danger, ms}]) and
// <out>/<seed>.session.ndjson (CMF.session.dump(): events, 4 Hz snapshots, input). Exit 0 when every
// seed reached the goal: `pivot` = all clients paid and the pivot reached (the milestone 2 pass).
// Keys: see models.mjs (environment only; a missing key stops the run before Chrome starts).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openGame } from './cdp.mjs';
import { makeModel } from './models.mjs';
import { play, pastCourse } from './loop.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : def; };
const spec = arg('model', 'oracle');
const seeds = String(arg('seeds', arg('seed', '101'))).split(',').filter(Boolean);
const until = arg('until', 'pivot');
const base = arg('url', 'http://127.0.0.1:8817/');
const port = Number(arg('port', '9735'));
const outDir = arg('out', join(here, 'out'));

let model;
try { model = makeModel(spec); } catch (err) { console.error(`pilot: ${err.message}`); process.exit(2); }
mkdirSync(outDir, { recursive: true });

async function one(seed) {
  const t0 = Date.now();
  const T = await openGame(`${base}?seed=${encodeURIComponent(seed)}&norender&snap=4`, { port });
  try {
    const build = await T.ev(`import('./src/version.js').then((m) => m.VERSION)`);
    const meta = await T.J('CMF.meta');
    const log = [];
    let calls = 0, modelMs = 0;
    const res = await play(T, async (obs) => { calls++; const d = await model.decide(obs); modelMs += d.ms || 0; return d; }, {
      until: until === 'pivot' ? pastCourse : () => false, log,
    });
    const ev = await T.J(`CMF.session.since(0).filter((e) => e.type === 'call' && e.data.act === 'answer' && !e.data.where).map((e) => e.data.correct)`);
    const m = res.obs.state.m || {};
    const paid = m.paid ?? 0, n = m.n ?? 3;
    const pass = until === 'pivot' ? res.reason === 'goal' && paid === n && n === 3 : res.reason === 'done';
    const session = await T.ev('CMF.session.dump()');
    writeFileSync(join(outDir, `${seed}.actions.json`), JSON.stringify({ seed, build, model: model.name, meta, until, reason: res.reason, endTick: res.obs.tick, log }, null, 1));
    writeFileSync(join(outDir, `${seed}.session.ndjson`), session);
    const r = { seed, pass, reason: res.reason, st: res.obs.state.st, paid: `${paid}/${n}`, answers: `${ev.filter(Boolean).length} right of ${ev.length}`,
      decisions: log.length, modelCalls: calls, modelS: Math.round(modelMs / 100) / 10, simS: Math.round(res.obs.tick / 6) / 10,
      wallS: Math.round((Date.now() - t0) / 100) / 10, sessionKB: Math.round(session.length / 1024), errors: T.S.errors };
    if (T.S.errors) r.firstErrors = T.logs.filter((l) => /error|exception/i.test(l)).slice(0, 5);
    return r;
  } finally { await T.close(); }
}

console.log(`pilot: model ${model.name}, seeds ${seeds.join(', ')}, until ${until}`);
let ok = true;
for (const seed of seeds) {                      // one at a time: one Chrome on the machine
  let r;
  try { r = await one(seed); } catch (err) { r = { seed, pass: false, error: err.message }; }
  ok = ok && r.pass && !r.errors;
  console.log(JSON.stringify(r));
}
console.log(ok ? 'PILOT PASS' : 'PILOT FAIL');
process.exit(ok ? 0 : 1);
