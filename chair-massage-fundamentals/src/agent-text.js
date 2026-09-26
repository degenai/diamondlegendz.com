// The agent's words (DESIGN.md "Playtesting with Jev", milestone 1): a snapshot (session-log.js
// buildSnap) rendered as a short situation for a model that cannot count or do geometry, and the
// action menu valid right now, one line per id. agent.js runs the actions; this file only says them.
// Numbers stay in (a Haiku reads them), but every bearing also comes as a word: ahead, ahead-left...

import { runText, runMenu } from './agent-run-text.js';
export { side } from './agent-run-text.js';

const CALL_WORDS = { lighter: 'lighter (tap S)', harder: 'harder (hold W)', still: 'right there (keep off W and S)', left: 'a little left (tap A)', right: 'a little right (tap D)' };

function massageText(s, A) {
  const m = s.m || {}, c = s.call, L = [];
  if (m.phase === 'intro') return ['MASSAGE course, intro card up: press a key to seat the first client.'];
  if (m.phase === 'paid') L.push(`MASSAGE. Client ${m.idx + 1} of ${m.n} is paid and standing up. Paid so far: ${m.paid} of ${m.n}. Press E for the next client.`);
  else {
    L.push(`MASSAGE. Client ${m.idx + 1} of ${m.n} (${m.client}), segment ${m.seg + 1} of ${m.segs}, competency ${Math.round(m.comp)}%. Paid so far: ${m.paid} of ${m.n}.`);
    L.push(m.want ? `The client wants ${m.want}; you are on ${m.mod}${m.mod === m.want ? ' (matched).' : ' (NOT matched: Space matches it).'}` : `Modality ${m.mod}; the client has not asked for one yet.`);
    L.push(`Ring tracking ${A.track ? 'on' : 'off'}; the cursor is ${m.inside ? 'on' : 'off'} the ring.${m.mod === 'Trigger point' ? ` Trigger point is a held click: ${A.clickHeld ? 'the click is held' : 'the click is NOT held (half credit)'}.` : ''}`);
  }
  if (c && c.open) L.push(`CALL OPEN: the client wants ${CALL_WORDS[c.name] || c.name}. ${Math.max(0, Math.round((c.window - c.t) * 10) / 10)} s of ${c.window} s left. Answer now.`);
  else if (c) L.push(`The client is starting to say something (${CALL_WORDS[c.name] || c.name}); the answer window opens when the line starts.`);
  else if (m.phase === 'session') L.push('No call right now.');
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

// The valid actions right now, id -> one line (DESIGN.md MASSAGE macros; the RUN menu is
// agent-run-text.js runMenu).
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
      // One way: once the reflex is on, turning it off is not offered (Laya toggled on/off 60 times at
      // tick 62, a 1-tick action that never lets time pass). replay() still accepts track_ring_off.
      if (!A.track) o.track_ring_on = 'Keep the cursor on the ring from now on, holding the click in trigger point (full credit per right answer).';
    }
  } else if (s.st === 'RUN' && s.p) runMenu(s, o);
  // Waiting on the title or the intro card changes nothing (they wait for a key): a stateless model
  // that prefers `wait` there never starts (Laya, 2026-09-25, 260 waits at the intro card).
  const idle = s.st === 'TITLE' || (s.st === 'MASSAGE' && s.m && s.m.phase === 'intro');
  if (!idle) o.wait = 'Do nothing for half a second.';
  return o;
}
