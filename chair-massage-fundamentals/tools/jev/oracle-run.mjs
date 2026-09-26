// A scripted run policy for the harness (milestones 3 and 4): no model, a few rules over the
// snapshot, so the RUN macros can be proven while Jev is throttled and a Jev batch has a dumb
// baseline to beat. It never counts for a Jev pass. First match wins: answer an open mini call,
// hold E for a kneeling client, counter every wind-up (hold Q to treat), palm a staggered goon,
// quick-palm a goon inside 4 m. Then the plan: at 0 stars, the chair into a car and the car to the
// exit (take a thrown or left chair back first); with stars, pull over once nobody is within 40 m,
// set the chair down for a client and wait for the mini-massage to cool it.
const MINI = { lighter: 'mini_answer_lighter', harder: 'mini_answer_harder', still: 'mini_answer_still' };
const THREAT = ['goon', 'boss', 'cop', 'ranger'];
const LIVE = ['chase', 'windup', 'recover', 'search', 'hold', 'grab'];

export function runOracle(obs) {
  const o = obs.options, s = obs.state, p = s.p, M = s.mini || {}, w = s.w || {};
  const pick = (...ids) => ids.find((id) => id in o) || 'wait';
  if (M.call && M.call.open) return pick(MINI[M.call.name]);
  if ('hold_E_massage' in o) return 'hold_E_massage';
  if ('keep_massaging' in o) return 'keep_massaging';
  if ('counter_hold' in o) return 'counter_hold';
  const threats = (s.near || []).filter((n) => THREAT.includes(n[1]) && LIVE.includes(n[4]));
  const goons = threats.filter((n) => n[1] === 'goon' || n[1] === 'boss');
  const closest = threats.length ? Math.min(...threats.map((n) => n[2])) : Infinity;
  if (goons.some((n) => n[5].includes('stagger') && n[2] < 4)) return pick('palm_charge');
  if (p.veh) {
    const mine = p.chair === 'vehicle' && p.cin === p.vid;
    if (p.vhp <= 0) return pick('exit_vehicle');
    if (!mine) return s.tgt && s.tgt.chair && s.tgt.chair[0] < 12 ? pick('exit_vehicle') : pick('drive_to_chair');
    if (w.lv > 0 && closest > 40) return p.spd < 1 ? pick('exit_vehicle') : 'wait';   // coast to a stop, then the mini
    return pick('face_exit_steer');
  }
  if ('load_chair' in o && w.lv === 0) return 'load_chair';
  // Never the chair swing (+1 star on a goon, and the arc takes a cop beside him too), never a palm with a cop in reach.
  if (goons.some((n) => n[2] < 2.5) && !threats.some((n) => n[1] !== 'goon' && n[1] !== 'boss' && n[2] < 4)) return pick('palm_tap');
  const cop = threats.find((n) => n[1] === 'cop' || n[1] === 'ranger');
  // Clean, or a cop on foot closing in (a star cannot fall while he sees you): the car plan.
  if (w.lv === 0 || (cop && cop[2] < 25)) {
    if (p.chair === 'player') return pick('load_chair', 'go_to_car');
    if (p.chair === 'vehicle' && p.itv === p.cin && p.ithp !== null && p.ithp <= 0) return pick('go_to_chair', 'pick_up_chair');   // a wreck: carry it
    if (p.chair === 'vehicle') return p.itv === p.cin ? pick('enter_car', 'go_to_car') : pick('go_to_car', 'go_to_chair');
    return pick('pick_up_chair', 'go_to_chair');
  }
  if (p.chair === 'player') return closest > 12 ? pick('set_chair_down') : 'wait';
  if (M.ph === 'waiting' || M.ph === 'coming' || M.ph === 'ready') return 'wait';
  if (closest > 12) return pick('pick_up_chair', 'go_to_chair');
  return 'wait';
}
