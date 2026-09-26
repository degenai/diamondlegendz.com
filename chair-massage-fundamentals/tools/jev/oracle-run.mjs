// A scripted run policy for the harness (milestone 3/4): no model, a few rules over the snapshot, so
// the RUN macros can be proven while Jev is down and a Jev batch has a dumb baseline to beat. It
// never counts for a Jev pass. It stands its ground at the chair (a chair loaded in a car cannot be
// taken back out on 2026-09-25.7, so the car plan strands it): answer an open mini call, hold E for a
// kneeling client, dodge every wind-up, palm a staggered goon, quick-palm a goon about to reach him;
// once no goon or cop is within 12 m, pick the chair up and set it down for a client, and wait.
const MINI = { lighter: 'mini_answer_lighter', harder: 'mini_answer_harder', still: 'mini_answer_still' };
const THREAT = ['goon', 'boss', 'cop', 'ranger'];
const LIVE = ['chase', 'windup', 'recover', 'search', 'hold', 'grab'];

export function runOracle(obs) {
  const o = obs.options, s = obs.state, p = s.p, M = s.mini || {};
  const pick = (...ids) => ids.find((id) => id in o) || 'wait';
  if (M.call && M.call.open) return pick(MINI[M.call.name]);
  if ('hold_E_massage' in o) return 'hold_E_massage';
  if ('keep_massaging' in o) return 'keep_massaging';
  if ('dodge' in o) return 'dodge';
  const threats = (s.near || []).filter((n) => THREAT.includes(n[1]) && LIVE.includes(n[4]));
  const goons = threats.filter((n) => n[1] === 'goon' || n[1] === 'boss');
  const closest = threats.length ? Math.min(...threats.map((n) => n[2])) : Infinity;
  if (goons.some((n) => n[5].includes('stagger') && n[2] < 4)) return pick('palm_charge', 'swing_chair');
  if (p.veh) return pick('exit_vehicle');
  if (goons.some((n) => n[2] < 4)) return pick('palm_tap', 'swing_chair');
  if (p.chair === 'player') return closest > 12 ? pick('set_chair_down') : 'wait';
  if (M.ph === 'waiting' || M.ph === 'coming' || M.ph === 'ready') return 'wait';
  if (closest > 12) return pick('pick_up_chair', 'go_to_chair');
  return 'wait';
}
