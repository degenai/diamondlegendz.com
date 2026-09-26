// The same input through another model (the Laya milestone): every logged decision's observation
// text and menu (loop.mjs writes them into actions.json) goes to the target models with no game
// running, and their answers are set against the reference pilot's.
//
//   node tools/jev/compare.mjs --ref tools/jev/out/course-oracle --seeds 101,202,303 --targets laya[,jev,cf]
//        [--max 400] [--out tools/jev/out/compare-<date>.md]
//
// Per seed and target: agreement on `action` with the reference; the call answers (a course or mini
// call open) scored against the right answer, for the reference and the target; the mean absolute
// difference of `danger` where both gave one; latency (round trip, and Laya's own forward pass);
// Laya's reading of the input (state tokens, and how often the state, the instructions or the options
// were cut to fit its window); and the first divergences with the text the pilot saw.
// RUN decisions logged before `near` was (milestone 4 and earlier) get an empty threat list.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeModel } from './models.mjs';

const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : def; };
const ref = arg('ref', 'tools/jev/out/course-oracle');
const seeds = arg('seeds', '101,202,303').split(',').filter(Boolean);
const targets = arg('targets', 'laya').split(',').filter(Boolean);
const max = Number(arg('max', '400'));
const date = new Date().toLocaleDateString('sv');
const out = arg('out', `tools/jev/out/compare-${date}.md`);
const RIGHT = { lighter: ['answer_lighter', 'mini_answer_lighter'], harder: ['answer_harder', 'mini_answer_harder'], still: ['stay_still', 'mini_answer_still'], left: ['answer_left'], right: ['answer_right'] };
const right = (e, a) => !!(e.call && e.call.open && (RIGHT[e.call.name] || []).includes(a));
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}% (${a}/${b})` : 'n/a');
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const r1 = (x) => (Number.isFinite(x) ? Math.round(x * 10) / 10 : '-');

const models = Object.fromEntries(targets.map((t) => [t, makeModel(t)]));
const md = [`# Same input, other models (${date})`, '', `Reference: ${ref} (${seeds.join(', ')}). Targets: ${targets.map((t) => models[t].name).join('; ')}.`, ''];
const all = {};
for (const seed of seeds) {
  const A = JSON.parse(readFileSync(join(ref, `${seed}.actions.json`), 'utf8'));
  const dec = A.log.filter((e) => e.text && e.opts).slice(0, max);
  md.push(`## Seed ${seed}: ${dec.length} decisions with a choice (reference ${A.model}, until ${A.until})`, '');
  for (const t of targets) {
    const R = { agree: 0, n: 0, calls: 0, refRight: 0, tRight: 0, dd: [], ms: [], lms: [], tok: [], cut: 0, head: 0, opt: 0, div: [], ck: null, err: null };
    for (const e of dec) {
      const obs = { text: e.text, options: e.opts, state: { st: e.run ? 'RUN' : 'MASSAGE', near: e.near || [], call: e.call } };
      let d;
      try { d = await models[t].decide(obs); } catch (err) { R.err = err.message.slice(0, 200); break; }
      R.n++;
      const a = d.action in e.opts ? d.action : `(invalid ${d.action})`;
      if (a === e.action) R.agree++;
      else if (R.div.length < 5) R.div.push({ e, a, p: d.probs && d.probs[d.action] });
      if (e.call && e.call.open) { R.calls++; if (right(e, e.action)) R.refRight++; if (right(e, a)) R.tRight++; }
      if (Number.isFinite(d.danger) && Number.isFinite(e.danger)) R.dd.push(Math.abs(d.danger - e.danger));
      if (d.ms) R.ms.push(d.ms);
      if (d.lms) R.lms.push(d.lms);
      if (d.fit) { R.ck = d.fit.ck; R.tok.push(d.fit.tok); if (d.fit.cut.length) R.cut++; if (d.fit.head.length) R.head++; if (d.fit.opt.length) R.opt++; }
    }
    all[`${seed}:${t}`] = R;
    md.push(`### ${t}${R.ck ? ` (checkpoint ${R.ck})` : ''}`, '');
    if (R.err) md.push(`Stopped: ${R.err}`, '');
    md.push(`- action agreement with the reference: ${pct(R.agree, R.n)}`,
      `- call answers right: reference ${pct(R.refRight, R.calls)}, ${t} ${pct(R.tRight, R.calls)}`,
      `- danger, mean absolute difference: ${R.dd.length ? r1(mean(R.dd) * 100) / 100 : 'n/a (the reference gave none)'}`,
      `- latency per call: round trip median ${r1(med(R.ms))} ms (mean ${r1(mean(R.ms))})${R.lms.length ? `, forward pass median ${r1(med(R.lms))} ms` : ''}`);
    if (R.tok.length) md.push(`- input: state tokens median ${med(R.tok)}, max ${Math.max(...R.tok)}; state cut on ${pct(R.cut, R.n)}, instructions cut on ${pct(R.head, R.n)}, options cut on ${pct(R.opt, R.n)} of calls`);
    md.push('');
    for (const v of R.div) md.push(`- tick ${v.e.tick}: reference \`${v.e.action}\`, ${t} \`${v.a}\`${v.p ? ` (p ${Math.round(v.p * 100) / 100})` : ''}; saw: "${v.e.text.split('\n').slice(0, 3).join(' / ').slice(0, 260)}"`);
    md.push('');
    console.log(`${seed} ${t}: agree ${pct(R.agree, R.n)}, calls ref ${pct(R.refRight, R.calls)} ${t} ${pct(R.tRight, R.calls)}, ms ${r1(med(R.ms))}, tok ${R.tok.length ? med(R.tok) : '-'}, cut ${R.cut}${R.err ? `, STOPPED ${R.err}` : ''}`);
  }
}
writeFileSync(out, md.join('\n') + '\n');
writeFileSync(out.replace(/\.md$/, '.json'), JSON.stringify(all, (k, v) => (k === 'e' ? { tick: v.tick, action: v.action } : v), 1));
console.log(`wrote ${out}`);
