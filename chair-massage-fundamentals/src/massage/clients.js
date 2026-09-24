// Client roster (DESIGN.md "Clients") and the timed subtitle scheduler. The between-run regulars
// and their lines are in client-lines.js.

// Difficulty follows the boredom curve: band width 30 -> 18 -> 12, ring 0.09 -> 0.075 -> 0.06 m,
// ring travel speed 0.8x -> 1x -> 1.2x (third play, 2026-09-23: small rings that really move).
// Every session runs in segments (owner ruling 2026-09-23): Swedish warm-up, then cross-fiber,
// then trigger point, each a third of competency. `asks` are the client's requests in that order;
// `notIt` is said once per segment after 3 s on the wrong modality.

export const MODALITIES = ['Swedish', 'Cross-fiber', 'Trigger point'];

export const CLIENTS = [
  {
    id: 'jogger', name: 'Dana', role: 'jogger', kind: 'jogger',
    pay: 40, bandWidth: 30, ringRadius: 0.13, travelSpeed: 0.8, fillRate: 5, spineV: -0.02,
    asks: ['Long strokes first. Slow. My calves are cooked.', 'Now the cross-fiber, right across the knot.', 'Now hold that spot. Right there.'],
    notIt: "That's not it.",
    lines: [
      [8.0, 'Pond loop twice this morning. The geese have opinions about my pace.'],
      [15.0, 'The new place at the strip mall wants ninety bucks for this.'],
      [22.0, 'I only stopped because I saw the chair. Honestly I should stop more.'],
    ],
    done: "Oh, that's so much better. Here, take this.",
  },
  {
    id: 'retiree', name: 'Walt', role: 'retiree, the bench by the pond', kind: 'retiree',
    pay: 45, bandWidth: 18, ringRadius: 0.11, travelSpeed: 1, fillRate: 4, spineV: 0.14,
    asks: ['Long strokes first. These shoulders are old.', "Now the cross-fiber. Don't be shy about it.", 'Now hold that spot. Upper traps. Hold it.'],
    notIt: "That's not it, kid.",
    lines: [
      [8.5, 'Same bench eleven years. The pigeons know my car.'],
      [16.0, 'Some guys in a black van were asking who runs the chair.'],
      [24.0, "I told them it's a chair. It runs itself. They didn't laugh."],
    ],
    done: "Ahh. That knot's been there since the Carter administration.",
  },
  {
    id: 'dad', name: 'Marcus', role: 'dad from the playground', kind: 'dad',
    pay: 60, bandWidth: 12, ringRadius: 0.09, travelSpeed: 1.2, fillRate: 3.5, spineV: 0.06,
    asks: ['Long strokes first. It all runs up from the forearms.', 'Now the cross-fiber, across the forearm.', 'Now hold that spot. That one. Yes.'],
    notIt: "Hm. That's not it.",
    lines: [
      [7.0, 'Four hundred swing pushes. I counted. "Higher" every single time.'],
      [13.0, "There's a sign-up sheet for the swings now. Laminated. Who laminates?"],
      [19.0, 'My HOA got a letter about unlicensed vendors, is that you?'],
      [26.0, "Anyway, she's on the slide now, so I have maybe four minutes."],
      [33.0, "My wife does the thing with the tennis ball. This is better. Don't tell her."],
    ],
    done: 'Okay. Okay, wow. Worth every dollar.',
  },
];

// Segment plan per client: MODALITIES in order, or only the first `segments` of them (between runs).
export function segmentsOf(client) { return MODALITIES.slice(0, client.segments || MODALITIES.length); }

export const OUCH = ['Ouch.', 'Easy!', 'Ow. OW.', 'Too much, too much.', 'Hey!'];

const LINE_TIME = 5.0;

// Plain-object scheduler: scheduled lines plus one-off interjections (ouch, done). It does not
// speak by itself: say() puts a line in the outbox and the massage loop hands it to the speaker's
// bubble queue (bubbles.js), which plays one line at a time. kind: 'request' (a segment ask; jumps
// ahead of chatter, never dropped), 'banter' (the default) or 'aside' (ouch: dropped first).
// onStart runs when the line actually starts speaking; the subtitle follows the spoken line.
export function createDialogue(client) {
  return { client, t: 0, next: 0, out: [], speaker: '', text: '', until: -1 };
}

export function say(d, speaker, text, dur = 2.2, kind = 'banter', onStart = null) {
  d.out.push({ speaker, text, dur, kind, onStart });
}

// The bubble queue reports that a line started (secs: its spoken duration).
export function started(d, line, secs) {
  d.speaker = line.speaker; d.text = line.text; d.until = d.t + secs;
  if (line.onStart) line.onStart(secs);
}

export function updateDialogue(d, dt) {
  d.t += dt;
  const lines = d.client.lines;
  if (d.next < lines.length && d.t >= lines[d.next][0]) {
    say(d, d.client.name, lines[d.next][1], LINE_TIME);
    d.next++;
  }
  if (d.text && d.t > d.until) { d.text = ''; d.speaker = ''; }
}
