// The RUN in words for a model that cannot count or do geometry (DESIGN.md "Playtesting with Jev",
// milestone 3): the snapshot (session-log.js buildSnap) as a short situation, the threats first,
// every bearing also as a word, and the action menu valid right now. agent-run.js and agent.js do
// the actions; this file only says them. The massage course's words are agent-text.js.

// Bearing in degrees (+ = right) to a word.
export function side(b) {
  if (b === null || b === undefined) return 'here';
  const a = Math.abs(b), s = b > 0 ? 'right' : 'left';
  if (a < 20) return 'ahead';
  if (a < 70) return `ahead-${s}`;
  if (a < 110) return s;
  if (a < 160) return `behind-${s}`;
  return 'behind';
}

const STATE_WORDS = {
  chase: 'chasing you', windup: 'winding up', recover: 'recovering from a swing', search: 'searching for you', hold: 'holding position',
  return: 'walking back to the van', sit: 'sitting down', loose: 'relaxed', out: 'out for the day', treated: 'treated, sitting',
  wander: 'walking', flee: 'running away', toChair: 'coming to the chair', kneel: 'kneeling at the chair', leave: 'leaving',
  hang: 'hanging back', down: 'knocked down', parked: 'parked', driven: 'driven by someone', goons: 'driven by goons', cops: 'driven by cops',
};
export function thing([id, kind, dist, b, state, tag]) {
  let what = STATE_WORDS[state] || state;
  if (tag.includes('stagger')) what = 'staggered (open to a palm)';
  else if (state === 'windup') what = `winding up ${tag.includes('pull') ? 'to pull you out' : tag.includes('bat') ? 'a bat swing' : tag.includes('grab') ? 'a grab' : 'a shove'}`;
  const extra = [kind === 'goon' && tag.includes('bat') && state !== 'windup' ? 'has a bat' : '', tag.includes('cling') ? 'CLINGING TO YOUR CAR' : '',
    kind.startsWith('car:') && tag.includes('van') ? 'the Serenity van' : '', kind.startsWith('car:') && state === 'parked' ? 'free to take' : '',
    kind === 'ped' && tag.includes('sore') ? 'sore back' : ''].filter(Boolean).join(', ');
  return `${kind.replace('car:', '')} ${id} ${Math.round(dist)} m ${side(b)}, ${what}${extra ? `, ${extra}` : ''}`;
}
const THREAT_KINDS = ['goon', 'boss', 'cop', 'ranger'];
const LIVE = ['chase', 'windup', 'recover', 'search', 'hold', 'grab'];
export const isThreat = (n) => (THREAT_KINDS.includes(n[1]) && (LIVE.includes(n[4]) || n[5].includes('cling'))) || (n[1].startsWith('car:') && (n[4] === 'goons' || n[4] === 'cops'));

const MINI_CALL = { lighter: 'lighter (tap S)', harder: 'harder (hold W)', still: 'right there (keep off W and S)' };
const IT_WORDS = { enter: 'get into the vehicle beside you', exit: 'get out', repair: 'repair the vehicle here ($20)', load: 'load the chair into the vehicle beside you',
  setdown: 'set the chair down here', massage: 'start the mini-massage (hold E)', pickup: 'pick up the chair', take: 'take the chair out of the vehicle', carjack: 'pull the driver out of the car beside you' };
const DECAY = 25;   // run/wanted.js: a star drops after 25 s with no cop in sight

function chairWords(p, t) {
  if (p.chair === 'player') return `You are carrying the chair (durability ${p.dur}%${p.dur <= 0 ? ', BENT' : ''}).`;
  const c = t.chair, where = !c ? 'somewhere' : c[1] === null ? 'right here' : `${c[0]} m ${side(c[1])}`;
  if (p.chair === 'vehicle') return p.veh && p.cin === p.vid ? `The chair is loaded in the ${p.veh} you are driving.` : `The chair is loaded in vehicle ${p.cin}, ${where}. You do NOT have it.`;
  return `The chair is on the ground, ${where}. You do NOT have it.`;
}

function wantedWords(w) {
  if (!w.lv) return 'Wanted: 0 stars (clean: you can escape at the exit with the chair).';
  const how = w.rise ? 'RISING' : w.seen ? 'a cop can see you, so it is not falling' : `no cop sees you, so it is falling: the next star drops in ${Math.max(0, Math.round(DECAY - w.decay))} s`;
  return `Wanted: ${w.lv} star${w.lv === 1 ? '' : 's'}, ${how}. The exit only works at 0 stars; a finished mini-massage drops one star.`;
}

function miniWords(M, p) {
  if (!M || M.ph === 'idle') return p.chair === 'ground' ? 'Mini-massage: the chair is not set down for clients (pick it up and set it down to open).' : null;
  if (M.ph === 'waiting') return `Mini-massage: the chair is set down, waiting for a willing pedestrian within 12 m (${M.t} s so far). Goons or cops within 6 m scare them off.`;
  if (M.ph === 'coming') return `Mini-massage: ped ${M.who} is walking over to the chair (${M.cd} m away). Stay near; keep threats away.`;
  if (M.ph === 'ready') return `Mini-massage: ped ${M.who} is KNEELING AT THE CHAIR. Hold E beside it to start (they leave after 25 s or if you go 8 m away).`;
  const c = M.call && M.call.open ? ` CALL OPEN: the client wants ${MINI_CALL[M.call.name] || M.call.name}, ${Math.max(0, Math.round((M.call.window - M.call.t) * 10) / 10)} s left. Answer now.` : ' No call open: keep holding E.';
  return `Mini-massage IN PROGRESS: ${Math.round(M.prog * 100)}% done, ${M.miss} of 3 misses.${c}`;
}

export function runText(s) {
  const p = s.p, w = s.w, t = s.tgt || {}, L = [];
  if (!p) return [`${s.st}.`];
  const where = p.veh ? `Driving the ${p.veh} (${p.vhp} hp${p.vhp <= 0 ? ': WRECKED, it only coasts; get out' : ''}), ${Math.round(p.spd)} m/s` : p.mass ? 'Giving a mini-massage (holding E)' : `On foot, ${p.spd > 0.5 ? `moving ${Math.round(p.spd)} m/s` : 'standing'}`;
  L.push(`RUN. ${where}. HP ${p.hp}, stamina ${Math.round(p.sta * 100)}%${p.kn > 0 ? `, KNOCKED DOWN for ${p.kn} s` : ''}${p.chg ? ', charging a palm' : ''}. Cash $${s.cash}.`);
  const alarms = [];
  if (w.arrestT > 0) alarms.push(`A COP IS ARRESTING YOU (${w.arrestT} of 1.5 s): move now`);
  if (s.dodge) alarms.push(`GOON WIND-UP ON YOU (${s.dodge.map((d) => `goon g${d.id} ${d.kind}, ${d.left} s left`).join('; ')}): dodge (tap S) and he whiffs and staggers 1 s, open to a palm`);
  for (const n of s.near || []) if (n[4] === 'windup' && n[5].includes('pull')) alarms.push(`goon ${n[0]} is about to PULL YOU OUT of the car: drive off`);
  if ((s.near || []).some((n) => n[5].includes('cling'))) alarms.push('a goon is clinging to your car: swerve to throw him off');
  if (alarms.length) L.push(`DANGER: ${alarms.join('. ')}.`);
  L.push(chairWords(p, t));
  L.push(wantedWords(w));
  L.push(`Exit: ${t.exit ? (t.exit[1] === null ? 'you are at it' : `${t.exit[0]} m ${side(t.exit[1])} (straight line; roads and walkways wind)`) : 'unknown'}.`);
  const near = s.near || [], threats = near.filter(isThreat), rest = near.filter((n) => !isThreat(n));
  L.push(threats.length ? `Threats: ${threats.map(thing).join('; ')}.` : 'Threats: none within 40 m.');
  if (rest.length) L.push(`Also near: ${rest.map(thing).join('; ')}.`);
  if (s.car) L.push(`Nearest car you could take: ${s.car[1]} ${s.car[0]}, ${Math.round(s.car[2])} m ${side(s.car[3])}${s.car[4] === 'carjack' ? ' (a driver in it: E pulls him out, +1 star)' : ' (empty: E gets in, a stolen car is +1 star)'}, ${s.car[5]} hp.`);
  if (p.it && !p.mass) L.push(`E right now would ${IT_WORDS[p.it] || p.it}.`);
  const mw = miniWords(s.mini, p);
  if (mw) L.push(mw);
  if (s.hud && s.hud.heat) L.push(`Heat line: "${s.hud.heat}"`);
  return L;
}

// The RUN menu, id -> one line, added to `o`.
export function runMenu(s, o) {
  const p = s.p, M = s.mini || {};
  if (p.kn > 0) return o;                                     // knocked down: only wait
  if (p.mass || M.ph === 'massage') {
    if (M.call && M.call.open) Object.assign(o, { mini_answer_lighter: 'Tap S (keep holding E): "lighter".', mini_answer_harder: 'Hold W 0.7 s (keep holding E): "harder".', mini_answer_still: 'Keep off W and S (keep holding E): "right there".' });
    else o.keep_massaging = 'Keep holding E until the next call or the end.';
    o.let_go = 'Let go of E: stop the massage (the client leaves unpaid).';
    return o;
  }
  if (p.veh) {
    Object.assign(o, { face_exit_steer: 'Drive toward the exit for 2 s (code follows the streets).', drive_fwd_2s: 'Hold W 2 s: drive forward.',
      drive_fwd_left_1s: 'Hold W+A 1 s: forward, steering left.', drive_fwd_right_1s: 'Hold W+D 1 s: forward, steering right.', brake_reverse_1s: 'Hold S 1 s: brake, then reverse.',
      swerve_left: 'W+A+Space 0.6 s: handbrake swerve left (throws off a clinging goon).', swerve_right: 'W+D+Space 0.6 s: handbrake swerve right.' });
    if (p.chair !== 'vehicle' || p.cin !== p.vid) o.drive_to_chair = 'Drive toward the chair for 2 s (code follows the streets).';
    if (p.it === 'repair') o.repair_vehicle = 'Press E: repair the vehicle at this food cart ($20).';
    else o.exit_vehicle = 'Press E: get out (a chair loaded in it stays in it).';
    return o;
  }
  if (s.dodge) o.dodge = 'Tap S: back off from the goon winding up (he whiffs and staggers 1 s).';
  if (p.it === 'massage') o.hold_E_massage = 'Hold E: give the kneeling client a mini-massage (5 s of hold, answer their calls).';
  if (p.it === 'setdown') o.set_chair_down = 'Press E: set the chair down here and open for a client (a mini-massage drops a star).';
  if (p.it === 'load') o.load_chair = 'Press E: load the chair into the vehicle beside you.';
  if (p.it === 'pickup' || p.it === 'take') o.pick_up_chair = 'Press E: pick up the chair.';
  if (p.it === 'enter') o.enter_car = 'Press E: get into the vehicle beside you (the chair stays wherever it is unless loaded).';
  if (p.it === 'carjack') o.carjack = 'Press E: pull the driver out and take the car (+1 star).';
  if (p.it === 'repair') o.repair_vehicle = 'Press E: repair your vehicle at this food cart ($20).';
  if (p.chair !== 'player' && s.tgt && s.tgt.chair && (s.tgt.chair[1] !== null || (p.chair === 'vehicle' && p.it !== 'take'))) o.go_to_chair = 'Run to the chair (code steers, 1.5 s).';
  if (s.car && s.car[2] > 2) o.go_to_car = `Run to the nearest takeable car, ${s.car[1]} ${s.car[0]} (code steers, 1.5 s).`;
  o.run_to_exit = 'Run toward the exit along the walkways (code steers, 2 s).';
  Object.assign(o, { walk_fwd_1s: 'Hold W 1 s.', sprint_fwd_2s: 'Hold W+Shift 2 s.', back_off_1s: 'Hold S 1 s.', strafe_left_1s: 'Hold A 1 s.', strafe_right_1s: 'Hold D 1 s.',
    turn_left_30: 'Turn the camera 30 degrees left.', turn_right_30: 'Turn the camera 30 degrees right.', turn_around: 'Turn the camera 180 degrees.',
    face_exit: 'Turn toward the exit (straight line).', face_nearest_goon: 'Turn toward the nearest goon.' });
  if (p.chair !== 'player') o.face_chair = 'Turn toward the chair.';
  if (s.car) o.face_nearest_car = 'Turn toward the nearest takeable car.';
  if (p.chair === 'player') o.swing_chair = 'Left click: swing the chair (knocks down everyone in front within 2.5 m, costs 10 durability, a hit goon is +1 star).';
  else Object.assign(o, { palm_tap: 'Tap left click: a quick palm at the nearest goon within 4 m (knockdown 3 s, no treatment).', palm_charge: 'Hold left click 0.8 s: HEALING PALM, aimed at the nearest goon within 4 m (treats him: out of the chase ~2 min; on a cop it is +1 star).' });
  o.jump = 'Tap Space: jump.';
  return o;
}
