// A finished Jev session in numbers (milestone 4): the game's own runStats (src/run-stats.js, pure)
// over the session log's events, plus the pilot's decision log. Shared by pilot.mjs and batch.mjs.
import { runStats, ENDING } from '../../src/run-stats.js';

export function parseSession(ndjson) {
  return String(ndjson).split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

// events: session entries (snaps and input are skipped); log: the pilot's [{tick, action, ms, retries}].
export function summarize(entries, log = []) {
  const events = entries.filter((e) => e.type !== 'snap' && e.type !== 'input');
  const st = runStats(events);
  const minis = events.filter((e) => e.type === 'mini');
  const run = log.filter((d) => d.run);   // decisions made in the RUN
  return {
    ending: st.ending ? ENDING[st.ending] || st.ending : 'none',
    time: Math.round(st.duration * 10) / 10,
    peakStars: st.maxStars,
    tension: st.tension, treats: st.treats, minis: st.minis,
    miniStarts: minis.filter((e) => e.data.phase === 'start').length,
    miniCancels: minis.filter((e) => e.data.phase === 'cancel').map((e) => e.data.reason),
    chair: st.ending === 'escape' ? 'kept (escaped with it)' : st.chair === 'vehicle' ? `in a vehicle (${st.chairVehicle || '?'})` : st.chair === 'player' ? 'on his back' : 'on the ground',
    chairKept: st.ending === 'escape',
    throws: st.throws.length, knocked: st.knocked, damage: st.damage,
    vehicles: st.vehicles.length, carjacks: st.carjacks, steals: st.steals, palms: st.palms,
    decisions: run.length || log.length,
    modelS: Math.round(log.reduce((a, d) => a + (d.ms || 0), 0) / 100) / 10,
    retries: log.reduce((a, d) => a + (d.retries || 0), 0),
  };
}
