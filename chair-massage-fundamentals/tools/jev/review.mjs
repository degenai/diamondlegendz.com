// The worst decisions of a run (milestone 4): every bad outcome in the session (the run's end,
// a knockdown or pull-out, the chair thrown, a star gained, an arrest starting, damage) is charged
// to the last decision made before it, and the decisions are ranked by what they led to within 3 s.
// Prints each with the observation text the pilot saw.
//   node tools/jev/review.mjs <dir> <seed> [--n 3]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSession } from './summary.mjs';

const WEIGHT = { end: 100, knock: 30, thrown: 30, star: 20, arrest: 15, damage: 5 };
function badOf(e) {
  const d = e.data || {};
  if (e.type === 'state' && ['ARREST', 'DEATH'].includes(d.to)) return ['end', `${d.to}: ${d.why}`];
  if (e.type === 'knockdown' && d.who === 'player') return ['knock', `knocked down (${d.cause})`];
  if (e.type === 'chair' && d.act === 'throw') return ['thrown', 'chair thrown out'];
  if (e.type === 'wanted' && d.level > d.prev) return ['star', `wanted ${d.prev} -> ${d.level} (${d.cause})`];
  if (e.type === 'telegraph' && d.act === 'arrestStart') return ['arrest', `arrest starting (${d.who} ${d.id})`];
  if (e.type === 'damage') return ['damage', `-${d.amount} hp from ${d.source}`];
  return null;
}

export function worst(actions, entries, n = 3) {
  const dec = actions.log.filter((d) => d.run);
  const blame = new Map();
  for (const e of entries) {
    const b = badOf(e);
    if (!b) continue;
    let i = dec.length - 1;
    while (i >= 0 && dec[i].tick > e.tick) i--;
    if (i < 0 || e.tick - dec[i].tick > 180) continue;
    const r = blame.get(i) || { d: dec[i], score: 0, what: [] };
    r.score += WEIGHT[b[0]]; r.what.push(`${e.tick}: ${b[1]}`);
    blame.set(i, r);
  }
  return [...blame.values()].sort((a, b) => b.score - a.score || a.d.tick - b.d.tick).slice(0, n);
}

if (process.argv[1] && process.argv[1].endsWith('review.mjs')) {
  const [dir, seed] = process.argv.slice(2);
  const i = process.argv.indexOf('--n'), n = i > 0 ? Number(process.argv[i + 1]) : 3;
  const actions = JSON.parse(readFileSync(join(dir, `${seed}.actions.json`), 'utf8'));
  const entries = parseSession(readFileSync(join(dir, `${seed}.session.ndjson`), 'utf8'));
  for (const w of worst(actions, entries, n)) {
    console.log(`\n== tick ${w.d.tick}: ${w.d.action}${w.d.probs ? ` (p ${Math.round((w.d.probs[w.d.action] || 0) * 100) / 100})` : ''}, score ${w.score}`);
    console.log(`   led to: ${w.what.join('; ')}`);
    console.log((w.d.text || '(no observation text logged)').split('\n').map((l) => `   | ${l}`).join('\n'));
  }
}
