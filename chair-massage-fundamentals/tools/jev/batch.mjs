// Jev's batch (DESIGN.md "Playtesting with Jev", milestone 4): N seeds flown to any ending, one at a
// time (never in parallel: one Chrome on the machine), each through pilot.mjs --until end, then a
// summary table and the aggregate in <out>/batch-<date>.md (and .json beside it).
//
//   node tools/jev/batch.mjs --model jev --n 10 [--start 1001 | --seeds 1,2,3] [--max-run-s 600]
//        [--url http://127.0.0.1:8821/] [--port 9844] [--out tools/jev/out]
//
// Serve the game folder first; the model's key comes from the environment (models.mjs). The
// overnight run is the same line with --n 50 (about 2 hours; see README "Playtesting").
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : def; };
const model = arg('model', 'jev');
const n = Number(arg('n', '10')), start = Number(arg('start', '1001'));
const seeds = arg('seeds', '') ? arg('seeds', '').split(',').filter(Boolean) : Array.from({ length: n }, (_, i) => String(start + i));
const outDir = arg('out', join(here, 'out'));
const date = new Date().toLocaleDateString('sv');   // local YYYY-MM-DD
// The overnight run (owner, one line, game served on 8821 with pythonw, key in the environment):
//   set -a; . ~/.config/jev.env; set +a; node tools/jev/batch.mjs --model jev --n 50 --start 2001
const pass = ['--url', arg('url', 'http://127.0.0.1:8821/'), '--port', arg('port', '9844'), '--max-run-s', arg('max-run-s', '600'), '--out', outDir];
mkdirSync(outDir, { recursive: true });

const rows = [];
const pilotName = model === 'oracle' ? 'oracle (scripted, not Jev)' : model;
const t0 = Date.now();
for (const seed of seeds) {
  const t1 = Date.now();
  const r = spawnSync(process.execPath, [join(here, 'pilot.mjs'), '--model', model, '--seeds', seed, '--until', 'end', ...pass], { encoding: 'utf8', env: process.env, maxBuffer: 1 << 26 });
  const line = (r.stdout || '').split('\n').find((l) => l.startsWith('{'));
  let o = null;
  try { o = line ? JSON.parse(line) : null; } catch { o = null; }
  const row = o && o.run ? { seed, ...o.run, reason: o.reason, simS: o.simS, wallS: Math.round((Date.now() - t1) / 1000), errors: o.errors || 0 }
    : { seed, ending: 'harness error', error: (o && o.error) || (r.stderr || '').split('\n').filter(Boolean).slice(-3).join(' | ') };
  rows.push(row);
  console.log(JSON.stringify(row));
  writeFileSync(join(outDir, `batch-${date}.json`), JSON.stringify({ model, seeds, rows }, null, 1));
}

const ok = rows.filter((r) => r.decisions !== undefined);
const rate = (f) => (ok.length ? `${Math.round((100 * ok.filter(f).length) / ok.length)}% (${ok.filter(f).length}/${ok.length})` : 'n/a');
const times = ok.map((r) => r.time).sort((a, b) => a - b);
const median = times.length ? (times.length % 2 ? times[(times.length - 1) / 2] : (times[times.length / 2 - 1] + times[times.length / 2]) / 2) : 0;
const md = [
  `# Jev batch ${date}`, '',
  `Model ${model}; ${seeds.length} seeds (${seeds[0]}..${seeds[seeds.length - 1]}), in sequence, render-less and paused per decision, --until end, max ${pass[5]} s of run. Wall ${Math.round((Date.now() - t0) / 60000)} min.`, '',
  '| seed | pilot | ending | time s | peak stars | tension | chair kept | decisions | model s | retries |',
  '|---|---|---|---|---|---|---|---|---|---|',
  ...rows.map((r) => (r.decisions === undefined ? `| ${r.seed} | ${pilotName} | ${r.ending}: ${String(r.error).slice(0, 120)} | | | | | | | |`
    : `| ${r.seed} | ${pilotName} | ${r.ending}${r.reason === 'timeout' || r.reason === 'loop' || r.reason === 'error' ? ` (${r.reason})` : ''} | ${r.time} | ${r.peakStars} | ${r.tension} | ${r.chairKept ? 'yes' : `no: ${r.chair}`} | ${r.decisions} | ${r.modelS} | ${r.retries} |`)),
  '', '## Aggregate', '',
  `- escape rate ${rate((r) => r.ending === 'escaped')}`,
  `- arrest rate ${rate((r) => r.ending === 'arrested')}`,
  `- death rate ${rate((r) => r.ending === 'overworked')}`,
  `- left the chair ${rate((r) => r.ending === 'left the chair')}; no ending (timeout) ${rate((r) => r.ending === 'none')}`,
  `- median time ${median} s`,
  `- mini-massages finished ${ok.reduce((a, r) => a + r.minis, 0)} (started ${ok.reduce((a, r) => a + r.miniStarts, 0)}); treatments ${ok.reduce((a, r) => a + r.treats, 0)}; chair thrown ${ok.reduce((a, r) => a + r.throws, 0)} times`,
  `- harness errors ${rows.length - ok.length}`, '',
  `Per seed: <seed>.actions.json (every decision with its probabilities and the question battery) and <seed>.session.ndjson in ${outDir.replace(/\\/g, '/')}.`,
];
writeFileSync(join(outDir, `batch-${date}.md`), md.join('\n') + '\n');
console.log(md.join('\n'));
