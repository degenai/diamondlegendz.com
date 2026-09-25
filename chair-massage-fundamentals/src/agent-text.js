// The agent's words (DESIGN.md "Playtesting with Jev", milestone 1): a snapshot (session-log.js
// buildSnap) rendered as a short situation for a model that cannot count or do geometry, and the
// action menu valid right now, one line per id. agent.js runs the actions; this file only says them.
// Numbers stay in (a Haiku reads them), but every bearing also comes as a word: ahead, ahead-left...

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
  chase: 'chasing you', windup: 'winding up', recover: 'recovering from a swing', search: 'searching for you',
  return: 'walking back to the van', sit: 'sitting down', loose: 'relaxed', out: 'out for the day', treated: 'treated, sitting',
  wander: 'walking', flee: 'running away', toChair: 'coming to the chair', kneel: 'kneeling at the chair', leave: 'leaving',
  hang: 'hanging back', down: 'knocked down', parked: 'parked', driven: 'driven by someone', goons: 'driven by goons', cops: 'driven by cops',
};
function thing([id, kind, dist, b, state, tag]) {
  let what = STATE_WORDS[state] || state;
  if (tag.includes('stagger')) what = 'staggered (open to a palm)';
  else if (state === 'windup') what = `winding up ${tag.includes('pull') ? 'to pull you out' : tag.includes('bat') ? 'a bat swing' : tag.includes('grab') ? 'a grab' : 'a shove'}`;
  const extra = kind === 'goon' && tag.includes('bat') && state !== 'windup' ? ', has a bat' : kind.startsWith('car:') && tag.includes('keys') ? ', keys in' : kind === 'ped' && tag.includes('sore') ? ', sore back' : '';
  return `${kind.replace('car:', '')} ${id} ${Math.round(dist)} m ${side(b)}, ${what}${extra}`;
}

const CALL_WORDS = { lighter: 'lighter (tap S)', harder: 'harder (hold W)', still: 'right there (keep off W and S)', left: 'a little left (tap A)', right: 'a little right (tap D)' };

function massageText(s, A) {
  const m = s.m || {}, c = s.call, L = [];
  if (m.phase === 'intro') return ['MASSAGE course, intro card up: press a key to seat the first client.'];
  if (m.phase === 'paid') L.push(`MASSAGE. Client ${m.idx + 1} of ${m.n} is paid and standing up. Paid so far: ${m.paid} of ${m.n}. Press E for the next client.`);
  else {
    L.push(`MASSAGE. Client ${m.idx + 1} of ${m.n} (${m.client}), segment ${m.seg + 1} of ${m.segs}, competency ${Math.round(m.comp)}%. Paid so far: ${m.paid} of ${m.n}.`);
    L.push(m.want ? `The client wants ${m.want}; you are on ${m.mod}${m.mod === m.want ? ' (matched).' : ' (NOT matched: Space matches it).'}` : `Modality ${m.mod}; the client has not asked for one yet.`);
    L.push(`Ring tracking ${A.track ? 'on' : 'off'}; the cursor is ${m.inside ? 'on' : 'off'} the ring.`);
  }
  if (c && c.open) L.push(`CALL OPEN: the client wants ${CALL_WORDS[c.name] || c.name}. ${Math.max(0, Math.round((c.window - c.t) * 10) / 10)} s of ${c.window} s left. Answer now.`);
  else if (c) L.push(`The client is starting to say something (${CALL_WORDS[c.name] || c.name}); the answer window opens when the line starts.`);
  else if (m.phase === 'session') L.push('No call right now.');
  return L;
}

function runText(s) {
  const p = s.p, w = s.w, L = [];
  if (!p) return [`${s.st}.`];
  const where = p.veh ? `Driving the ${p.veh} (${p.vhp} hp), ${Math.round(p.spd)} m/s` : p.mass ? 'Giving a mini-massage (holding E)' : `On foot, ${p.spd > 0.5 ? `moving ${Math.round(p.spd)} m/s` : 'standing'}`;
  const chair = p.chair === 'player' ? `carrying the chair (${p.dur}%)` : p.chair === 'vehicle' ? 'the chair is loaded in a vehicle' : 'the chair is on the ground';
  L.push(`RUN. ${where}, ${chair}. HP ${p.hp}, stamina ${Math.round(p.sta * 100)}%${p.kn > 0 ? `, KNOCKED DOWN for ${p.kn} s` : ''}${p.chg ? ', charging a palm' : ''}. Wanted ${w.lv} star${w.lv === 1 ? '' : 's'}${w.rise ? ', rising' : ''}${w.arrestT > 0 ? `, A COP IS ARRESTING YOU (${w.arrestT} of 1.5 s)` : ''}. Cash $${s.cash}.`);
  const t = s.tgt || {};
  const tg = (n, v) => (!v ? `${n}: unknown` : v[1] === null ? `${n}: here` : `${n}: ${v[0]} m ${side(v[1])} (${v[1]} deg)`);
  L.push(`${tg('Exit', t.exit)}. ${tg('Chair', t.chair)}.${s.hud && s.hud.heat ? ` Heat line: "${s.hud.heat}"` : ''}`);
  L.push(s.near && s.near.length ? `Near: ${s.near.map(thing).join('; ')}.` : 'Nobody near.');
  if (s.dodge) L.push(`A GOON IS WINDING UP ON YOU (${s.dodge.map((d) => `goon ${d.id}, ${d.kind}, ${d.left} s left`).join('; ')}): tap S to back off and he whiffs, then he staggers 1 s (palm him).`);
  const M = s.mini;
  if (M && M.ph !== 'idle') L.push(`Mini-massage: ${M.ph}${M.ph === 'massage' ? `, ${Math.round(M.prog * 100)}% done, ${M.miss} misses` : ''}${M.call && M.call.open ? `; CALL OPEN: ${CALL_WORDS[M.call.name] || M.call.name}, ${Math.max(0, Math.round((M.call.window - M.call.t) * 10) / 10)} s left` : ''}.`);
  return L;
}

export function observeText(s, recent, A) {
  const L = s.st === 'MASSAGE' ? massageText(s, A) : s.st === 'RUN' ? runText(s) : s.st === 'TITLE' ? ['TITLE: the course catalog. Click Begin to start Module 1.'] : s.st === 'PIVOT' ? ['PIVOT: the cutscene is playing. Wait.'] : [`${s.st}: the run is over. Wait.`];
  const h = s.hud || {};
  const hud = Object.entries(h).filter(([k, v]) => v && k !== 'hint' && k !== 'wants' && k !== 'cue').map(([k, v]) => `${k}: "${v}"`);
  if (h.hint) hud.unshift(`hint: "${h.hint.split('  |  ')[0]}"`);
  if (hud.length) L.push(`HUD: ${hud.join('; ')}.`);
  if (recent.length) L.push(`Just now:\n${recent.map((r) => `- ${r}`).join('\n')}`);
  return L.join('\n');
}

// The valid actions right now, id -> one line (DESIGN.md MASSAGE macros; the RUN list is the on-foot
// and driving basics, milestone 3 will grow it).
export function menuFor(s, A) {
  const o = {};
  if (s.st === 'TITLE') o.click_begin = 'Click Begin: start the course.';
  else if (s.st === 'MASSAGE') {
    const m = s.m || {}, c = s.call;
    if (m.phase === 'intro') o.skip_intro = 'Press a key: close the intro card and seat the first client.';
    else if (m.phase === 'paid') o.next_client = 'Press E: bring in the next client.';
    else if (m.phase === 'session' && c && c.open) {
      o.answer_lighter = 'Tap S: the answer to "lighter".';
      o.answer_harder = 'Hold W for 1 s: the answer to "harder".';
      o.stay_still = 'Keep off W and S until the window ends: the answer to "right there".';
      o.answer_left = 'Tap A: the answer to "a little to the left".';
      o.answer_right = 'Tap D: the answer to "a little to the right".';
    } else if (m.phase === 'session') {
      if (m.want && m.mod !== m.want) o.match_modality = 'Press Space: switch to the modality the client wants.';
      if (A.track) o.track_ring_off = 'Stop keeping the cursor on the ring.'; else o.track_ring_on = 'Keep the cursor on the ring from now on (full credit per right answer).';
    }
  } else if (s.st === 'RUN' && s.p) {
    const p = s.p, M = s.mini || {};
    if (p.veh) {
      Object.assign(o, { drive_fwd_2s: 'Hold W 2 s: drive forward.', drive_fwd_left_1s: 'Hold W+A 1 s: forward, steering left.', drive_fwd_right_1s: 'Hold W+D 1 s: forward, steering right.',
        brake_reverse_1s: 'Hold S 1 s: brake, then reverse.', swerve_left: 'W+A+Space 0.6 s: handbrake swerve left (throws off a clinging goon).', swerve_right: 'W+D+Space 0.6 s: handbrake swerve right.',
        face_exit: 'Turn the camera toward the exit.', exit_vehicle: 'Press E: get out.' });
    } else if (M.ph === 'massage' && M.call && M.call.open) {
      Object.assign(o, { mini_answer_lighter: 'Tap S (keep holding E): "lighter".', mini_answer_harder: 'Hold W 0.7 s (keep holding E): "harder".', mini_answer_still: 'Keep off W and S (keep holding E): "right there".' });
    } else {
      if (s.dodge && !p.kn) o.dodge = 'Tap S: back off from the goon winding up (he whiffs and staggers 1 s).';
      Object.assign(o, { walk_fwd_1s: 'Hold W 1 s.', sprint_fwd_2s: 'Hold W+Shift 2 s.', back_off_1s: 'Hold S 1 s.', strafe_left_1s: 'Hold A 1 s.', strafe_right_1s: 'Hold D 1 s.',
        turn_left_30: 'Turn the camera 30 degrees left.', turn_right_30: 'Turn the camera 30 degrees right.', turn_around: 'Turn the camera 180 degrees.',
        face_exit: 'Turn toward the exit.', face_chair: 'Turn toward the chair.', face_nearest_goon: 'Turn toward the nearest goon.', face_nearest_car: 'Turn toward the nearest car.',
        palm_tap: 'Tap left click: a quick palm.', palm_charge: 'Hold left click 0.8 s: HEALING PALM (treats a goon).', jump: 'Tap Space: jump.', interact_E: 'Tap E: pick up / set down the chair, enter a car.' });
      if (M.ph === 'ready') o.hold_E_massage = 'Hold E: give the kneeling client a mini-massage (until it ends or something interrupts).';
    }
  }
  o.wait = 'Do nothing for half a second.';
  return o;
}
