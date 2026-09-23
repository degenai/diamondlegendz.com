// Client roster (DESIGN.md "Clients") and the timed subtitle scheduler.
import { unlockInfo } from '../meta.js';

// Difficulty follows the boredom curve: band width 30 -> 18 -> 12, ring 0.18 -> 0.14 -> 0.11 m.

export const MODALITIES = ['Swedish', 'Cross-fiber', 'Trigger point'];

export const CLIENTS = [
  {
    id: 'jogger', name: 'Dana', role: 'jogger', kind: 'jogger',
    wants: 'Swedish', pay: 40, bandWidth: 30, ringRadius: 0.18, fillRate: 5, spineV: -0.02,
    lines: [
      [1.0, 'Hi. Swedish, please. Long and slow. My calves are cooked.'],
      [8.0, 'Pond loop twice this morning. The geese have opinions about my pace.'],
      [15.0, 'The new place at the strip mall wants ninety bucks for this.'],
      [22.0, 'I only stopped because I saw the chair. Honestly I should stop more.'],
    ],
    done: "Oh, that's so much better. Here, take this.",
  },
  {
    id: 'retiree', name: 'Walt', role: 'retiree, the bench by the pond', kind: 'retiree',
    wants: 'Trigger point', pay: 45, bandWidth: 18, ringRadius: 0.14, fillRate: 4, spineV: 0.14,
    lines: [
      [1.0, "Trigger point, please. Upper traps. Don't be shy about it."],
      [8.5, 'Same bench eleven years. The pigeons know my car.'],
      [16.0, 'Some guys in a black van were asking who runs the chair.'],
      [24.0, "I told them it's a chair. It runs itself. They didn't laugh."],
    ],
    done: "Ahh. That knot's been there since the Carter administration.",
  },
  {
    id: 'dad', name: 'Marcus', role: 'dad from the playground', kind: 'dad',
    wants: 'Cross-fiber', pay: 60, bandWidth: 12, ringRadius: 0.11, fillRate: 3.5, spineV: 0.06,
    lines: [
      [1.0, "Cross-fiber, if you do that. It's the forearms, but it runs all the way up."],
      [7.0, 'Four hundred swing pushes. I counted. "Higher" every single time.'],
      [13.0, "There's a sign-up sheet for the swings now. Laminated. Who laminates?"],
      [19.0, 'My HOA got a letter about unlicensed vendors, is that you?'],
      [26.0, "Anyway, she's on the slide now, so I have maybe four minutes."],
      [33.0, "My wife does the thing with the tennis ball. This is better. Don't tell her."],
    ],
    done: 'Okay. Okay, wow. Worth every dollar.',
  },
];

export const OUCH = ['Ouch.', 'Easy!', 'Ow. OW.', 'Too much, too much.', 'Hey!'];

const LINE_TIME = 5.0;

// Between runs the jogger comes back with two new lines: one about how the last run ended,
// one about the new unlock ({gift}). Three variants per outcome, rotated by the run count.
const RETURN = {
  escape: [
    ['Word is you got out clean. Chair and all.', 'Somebody left {gift} by the fountain. Said it was for you.'],
    ['The van guys were circling the block all night. Looking for you, I think.', "I brought {gift}. Don't ask where from."],
    ["You made the news. Well, the neighborhood app. 'Chair guy escapes.'", 'Walt says you should have {gift}. He dropped it off.'],
  ],
  arrest: [
    ['I saw them put you in the back of the car. Over a chair.', 'We passed the hat. Got you {gift}.'],
    ['How was booking? Walt says the coffee is terrible.', "There's {gift} under the bench. From the regulars."],
    ["They let you out already? The chair's still here, anyway.", 'Marcus found {gift} at a yard sale. Figured you could use it.'],
  ],
  death: [
    ['You look wrecked. Somebody should work on you for once.', 'Take it easy. Here, {gift}. You earned it.'],
    ['Heard you took a bat for this chair. Is that in the course?', 'The dads chipped in for {gift}.'],
    ['You were face down by the fountain. I thought you were napping.', 'Dana, jogger, I know. I brought {gift}.'],
  ],
  left: [
    ['You left the chair out here all night. Walt sat in it.', "Nobody brought you anything. You left the chair, man."],
    ['Where did you go? The chair was just sitting here.', "No gifts today. The chair's the whole point."],
    ['The van guys took pictures of your chair. Just sitting there.', "Don't leave it again, okay? It's the only one."],
  ],
};

export function roster(meta) {
  if (!meta || !meta.firstPivotSeen) return CLIENTS.slice();
  const out = meta.lastOutcome && RETURN[meta.lastOutcome];
  if (!out) return [CLIENTS[0]];
  const pair = out[(meta.runs || 0) % out.length];
  const info = unlockInfo(meta.lastUnlock);
  const gift = info ? info.gift : 'a thank-you card';
  const base = CLIENTS[0];
  return [{
    ...base,
    lines: [
      [1.0, 'Back again. Swedish, please. Same calves, new problems.'],
      [7.0, pair[0]],
      [14.0, pair[1].replace('{gift}', gift)],
      [22.0, base.lines[3][1]],
    ],
  }];
}

// Plain-object scheduler: scheduled lines plus one-off interjections (ouch, done).
export function createDialogue(client) {
  return { client, t: 0, next: 0, speaker: '', text: '', showUntil: -1, changed: true };
}

export function say(d, speaker, text, dur = 2.2) {
  d.speaker = speaker; d.text = text; d.showUntil = d.t + dur; d.changed = true;
}

export function updateDialogue(d, dt) {
  d.t += dt;
  const lines = d.client.lines;
  if (d.next < lines.length && d.t >= lines[d.next][0]) {
    say(d, d.client.name, lines[d.next][1], LINE_TIME);
    d.next++;
  }
  if (d.text && d.t > d.showUntil) { d.text = ''; d.speaker = ''; d.changed = true; }
}
