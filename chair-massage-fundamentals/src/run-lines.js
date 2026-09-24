// Voice lines for the watcher: linesHeard(events) -> every voice line of a run (`line` events, one
// per line as bubbles.js starts speaking it) with its count; repeatLines(groups) -> the lines heard
// in REPEAT_RUNS or more runs across the log (owner ruling 2026-09-24: line diversity).
import { plural } from './run-stats.js';

export const REPEAT_RUNS = 3;
const lineKey = (d) => `${d.speaker || '?'}|${d.text}`;
const who = (r) => (r.names.length && (r.speaker === 'client' || r.speaker === 'boss') ? `${r.speaker} (${r.names.join(', ')})` : r.speaker);
const quote = (t) => `"${String(t).length > 90 ? `${String(t).slice(0, 87)}...` : t}"`;

// One row per distinct line (speaker + text) in the order first heard: { speaker, names, text, count }.
export function linesHeard(events) {
  const rows = new Map();
  for (const e of events || []) {
    if (!e || e.type !== 'line' || !e.data || !e.data.text) continue;
    const d = e.data, k = lineKey(d);
    let r = rows.get(k);
    if (!r) { r = { speaker: d.speaker || '?', names: [], text: d.text, count: 0 }; rows.set(k, r); }
    r.count++;
    if (d.name !== null && d.name !== undefined && !r.names.includes(d.name)) r.names.push(d.name);
  }
  return [...rows.values()];
}

export function linesSection(events) {
  const rows = linesHeard(events);
  if (!rows.length) return 'Lines heard: none logged';
  const plays = rows.reduce((n, r) => n + r.count, 0);
  const out = [`Lines heard (${plural(rows.length, 'line')}, ${plural(plays, 'play')}):`];
  for (const r of rows) out.push(`  ${r.count}x ${who(r)}: ${quote(r.text)}`);
  return out.join('\n');
}

// Across the log: lines heard in minRuns or more runs, most repeated first.
// groups: from groupRuns. Rows { speaker, text, runs: [run numbers], plays }.
export function repeatLines(groups, minRuns = REPEAT_RUNS) {
  const all = new Map();
  for (const g of groups || []) {
    for (const r of linesHeard(g.events)) {
      const k = lineKey(r);
      let a = all.get(k);
      if (!a) { a = { speaker: r.speaker, names: [], text: r.text, runs: [], plays: 0 }; all.set(k, a); }
      a.runs.push(g.run); a.plays += r.count;
      for (const n of r.names) if (!a.names.includes(n)) a.names.push(n);
    }
  }
  return [...all.values()].filter((a) => a.runs.length >= minRuns)
    .sort((a, b) => b.runs.length - a.runs.length || b.plays - a.plays);
}

export function repeatsText(groups, minRuns = REPEAT_RUNS) {
  const rows = repeatLines(groups, minRuns);
  if (!rows.length) return `Repeats: no line heard in ${minRuns} or more runs yet`;
  return [`Repeats (lines heard in ${minRuns}+ runs):`,
    ...rows.map((r) => `  ${r.runs.length} runs, ${plural(r.plays, 'play')}: ${who(r)}: ${quote(r.text)}`)].join('\n');
}
