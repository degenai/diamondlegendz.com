// Between-run clients: the returning regulars (Dana, Walt, Marcus, Priya), their line tables and
// the roster that puts one of them in the chair (split from clients.js, refactor/split).
import { unlockInfo, has as hasPerk } from '../meta.js';
import { CLIENTS } from './clients.js';

// Between runs a regular comes back (owner ruling 2026-09-24: always Dana read as a rut). The three
// regulars rotate by run number: run 2 Dana, run 3 Walt, run 4 Marcus, then Dana again. With the
// "Regular client" unlock owned, every third returning visit is Priya, the barista from the corner
// (she is also the regular who waits near the chair in the run, run/peds-budget.js); the other three keep
// their order around her. Each brings two new lines in their own voice: an opener for how the last
// run ended, then the gift: an escape brings the next main unlock, an arrest or death the next
// consolation, or, once those run out, a line saying so. Two segments between runs.

// The fourth regular: only between runs, only with the unlock (forearms, wants cross-fiber).
export const PRIYA = {
  id: 'priya', name: 'Priya', role: 'the barista from the corner', kind: 'client',
  pay: 50, bandWidth: 18, ringRadius: 0.1, travelSpeed: 1, fillRate: 4, spineV: 0.06,
  calls: { every: [4.5, 7], weights: { lighter: 1, harder: 1, still: 1, left: 1, right: 1 }, miss: "Nope. Not that." },
  asks: ['Long strokes first, please. The morning rush was a lot.', "Now the cross-fiber, across the forearm. That's the one I came for."],
  notIt: "Nope. That's not it.",
  holdIt: "Nope, hold it. Don't let go.",
  lines: [
    [8.0, 'Six hundred shots a day. The tamper is winning.'],
    [15.0, 'The van guys order oat milk. Every single one of them.'],
    [22.0, "They asked who makes the chair guy's coffee. I said nobody. I'm a nobody."],
  ],
  done: "I can feel my fingers again. Here. And a free latte, don't tell my manager.",
};

// Per regular: back (the first ask), open[outcome] (rotated by run count), leftSecond (after leaving
// the chair: no gift), gifts[unlock id] (main unlocks and consolations; Dana's main unlocks use her
// {gift} templates and her consolations the meta.js sympathy lines), empty (no consolation left),
// getWell[outcome] (the opener once the get-well card is owned), filler (the third line).
const DANA = {
  client: CLIENTS[0],
  back: 'Back again. Long strokes first. Same calves, new problems.',
  open: {
    escape: ['Word is you got out clean. Chair and all.', 'The van guys were circling the block all night. Looking for you, I think.',
      "You made the news. Well, the neighborhood app. 'Chair guy escapes.'"],
    arrest: ['I saw them put you in the back of the car. Over a chair.', 'How was booking? Walt says the coffee is terrible.',
      "They let you out already? The chair's still here, anyway."],
    death: ['You look wrecked. Somebody should work on you for once.', 'Heard you took a bat for this chair. Is that in the course?',
      'You were face down by the fountain. I thought you were napping.'],
    left: ['You left the chair out here all night. Walt sat in it.', 'Where did you go? The chair was just sitting here.',
      'The van guys took pictures of your chair. Just sitting there.'],
  },
  leftSecond: ["Nobody brought you anything. You left the chair, man.", "No gifts today. The chair's the whole point.",
    "Don't leave it again, okay? It's the only one."],
  giftTemplates: ['Somebody left {gift} by the fountain. Said it was for you.', "I brought {gift}. Don't ask where from.",
    'Walt says you should have {gift}. He dropped it off.'],
  gifts: {},
  empty: "I didn't bring anything this time. Get out clean and there's something waiting.",
  getWell: {
    arrest: 'Get well soon, the card said. For a night in a holding cell. Walt insisted.',
    death: 'Get well soon. I mean it this time. Sit, I have ice in the car.',
  },
  filler: CLIENTS[0].lines[2][1],
};

const WALT = {
  client: CLIENTS[1],
  back: 'Back again. Long strokes first. Same old shoulders.',
  open: {
    escape: ['Heard you got away. Good. The pigeons were worried.', "You got out. I'd have bet against you. I'd have lost, I guess."],
    arrest: ['They booked you over a chair. In my day you had to rob something.', 'Out already? Holding cells have gotten soft.'],
    death: ["You went down like my '88 Buick. Sit, after. I'll wait.", "You look like I feel. That's not a compliment."],
    left: ["You left the chair out all night. I sat in it. It's a good chair.", "The chair was here, you weren't. I kept an eye on it. Mostly."],
  },
  leftSecond: ["No present. You don't leave a man's chair, kid."],
  gifts: {
    gun: "Somebody left a massage gun on my bench. I assume it's yours. It's too loud for me.",
    sprint: 'Here. Running shoes. Bought them in 1994 and never ran. Good as new.',
    gun1: 'Found a longer barrel for that gun thing. The hardware store fella asked no questions.',
    autofold: 'I put a new hinge on the chair. Forty years at the plant. It folds now. Fast.',
    regular: "A barista from the corner says she'll be your regular. Priya. Nice girl. Strong grip.",
    gun2: "A bigger head for the gun. Don't ask me how it works. I just carried it.",
    cartkeys: "The maintenance fella owed me twenty. Now you have his cart keys. We're square.",
    disguise: 'Got you one of their polos. Serenity Group. Fits like a lie.',
    gun3: "The Pro head. The kid at the store said 'Pro' like it meant something.",
    blockparty: "A block party flyer. The whole bench crew's coming. That's four of us.",
    skipPivot: "A hall pass from the course office. You've heard the speech. So have I.",
    icepack: 'Ice pack. I keep a few in the car. At my age you plan ahead.',
    coffee: 'Coffee. Black. Anything else is a milkshake.',
    parkingpass: "My parking pass. You keep leaving on foot. It's embarrassing to watch.",
    tipjar: "A tip jar. It's a coffee can. I put the first dollar in. Don't spend it all.",
    getwellcard: 'A get-well card. Everybody at the pond signed it. I signed it twice. Nobody checks.',
    loanerscrubs: "Dana's sister lent you scrubs. They're gold. I told her you're more of a beige.",
  },
  empty: 'Nothing for you today, kid. Get out clean and there might be something.',
  getWell: {
    arrest: 'The card said get well soon. For a holding cell. Dana made me sign it.',
    death: 'Get well soon. I mean that. Sit down before you fall down.',
  },
  filler: CLIENTS[1].lines[0][1],
};

const MARCUS = {
  client: CLIENTS[2],
  back: 'Back again. Long strokes first. Forearms, as always.',
  open: {
    escape: ['You got out! My daughter saw it on the app. She wants to be you now. Great.',
      "Clean escape, huh? Hang on, she's on the monkey bars. Okay. Nice work."],
    arrest: ['They arrested you? Over a... sweetie, not the gravel. Over a chair?',
      "Heard you got booked. My HOA would love that. Don't tell them."],
    death: ["You look like four hundred swing pushes. Sit. Wait, no, you're the one working.",
      'Heard you went down by the fountain. She asked if you were okay. I said probably.'],
    left: ['You left the chair out overnight. My kid used it as a fort.',
      "The chair was just sitting out. Somebody put a juice box in the cup holder. There's no cup holder."],
  },
  leftSecond: ['No present. She drew you one, but she ate it. Crayon. Long story.'],
  gifts: {
    gun: 'Brought you a massage gun. Lost and found at the rec center. Nobody claims a massage gun.',
    sprint: "Running shoes. My wife's idea. I'm supposed to wear them. You wear them.",
    gun1: "A longer barrel for the gun. Don't let her near it. Sweetie, don't touch.",
    autofold: 'Fixed the hinge on the chair. Stroller hinges, same idea. It folds in one go now.',
    regular: "The barista from the corner says she'll be your regular. Priya. She gets my order wrong. On purpose, I think.",
    gun2: 'A bigger head for the gun. It was in the minivan. Why was it in the minivan?',
    cartkeys: "Cart keys. The park guy dropped them by the sandbox. I'm calling it a gift.",
    disguise: "A Serenity Group polo. From the dad with the van. We don't talk about the dad with the van.",
    gun3: 'The Pro head. It came with a manual. I read the manual. Nobody reads the manual.',
    blockparty: "A block party flyer. There's a bounce house. I'll be in the bounce house.",
    skipPivot: "A hall pass from the course office. She made it. It's laminated. Who laminates?",
    icepack: "Ice pack. It's shaped like a penguin. It's hers. She says you can borrow it.",
    coffee: "Coffee. Gas station. I had two. Okay, three. This one's yours.",
    parkingpass: "Walt's parking pass. He says you keep leaving on foot. He said it slower than that.",
    tipjar: "A tip jar. It's a pickle jar. She decorated it. Sorry about the glitter.",
    getwellcard: "A get-well card. My kid drew you as a horse. It's a good horse.",
    loanerscrubs: "Loaner scrubs, gold. Dana's sister's. Gold is a healing color, I'm told. By a six-year-old.",
  },
  empty: "I didn't bring anything. I barely brought my kid. Get out clean and there's something.",
  getWell: {
    arrest: 'Get well soon, the card says. She thinks jail is a hospital. I let her.',
    death: 'Get well soon. She made me say that. I also mean it.',
  },
  filler: CLIENTS[2].lines[3][1],
};

const PRIYA_LINES = {
  client: PRIYA,
  back: PRIYA.asks[0],
  open: {
    escape: ['You got out! The whole cafe cheered. Well, two people. It was early.', 'Clean escape. I wrote it on the specials board.'],
    arrest: ["They arrested you? I'd have bailed you out in tips. Mostly dimes.", 'Out already? The van guys were bragging at the register.'],
    death: ['You look like closing shift on a Saturday. Sit down after, okay?', "Heard you went down by the fountain. I'm making you something with extra shots."],
    left: ['You left the chair out. I watched it from the window all morning.', 'The chair was alone all night. I brought it a coffee. Kidding. Mostly.'],
  },
  leftSecond: ["No gift. You left the chair. Even I don't leave the espresso machine."],
  gifts: {
    gun: 'Somebody left a massage gun at the cafe. Figured it was yours.',
    sprint: 'Running shoes. Non-slip, kitchen grade. You need them more than I do.',
    gun1: 'A longer barrel for your gun. A regular fixes espresso machines. Same idea, he said.',
    autofold: 'My espresso repair guy did the chair hinge. It folds like a cafe table now.',
    regular: 'The course made me your official regular. I was already your regular.',
    gun2: "A bigger head for the gun. It came in a box marked 'milk frother'. It is not.",
    cartkeys: "The maintenance guy tips in keys, apparently. These are the cart's.",
    disguise: 'A Serenity Group polo. One of them left it on a chair. I did not give it back.',
    gun3: 'The Pro head. I traded a month of lattes for it. Worth it.',
    blockparty: "A block party flyer. The cafe's doing a stand. I'll save you a cold brew.",
    skipPivot: 'A hall pass from the course office. They get their coffee from us. I asked nicely.',
    icepack: 'Ice pack. Straight from the cafe freezer. It smells a little like vanilla.',
    coffee: "Coffee. The good kind, not the gas station kind. Drink it while it's hot.",
    parkingpass: "Walt's parking pass. He dropped it off at the counter with a very long story.",
    tipjar: "A tip jar. The cafe's old one. It still says 'Change is good'.",
    getwellcard: 'A get-well card. I left it by the register. Forty regulars signed it.',
    loanerscrubs: "Gold scrubs. Dana's sister's. I steamed them with the milk wand.",
  },
  empty: "No gift today. Get out clean and I'll have something behind the counter.",
  getWell: {
    arrest: 'Get well soon, the card says. The whole counter signed it. Even a van guy, weirdly.',
    death: 'Get well soon. Really. Come by after, first cup is free.',
  },
  filler: PRIYA.lines[2][1],
};

const ROTATION = [DANA, WALT, MARCUS];

// Who comes back before run meta.runs + 1 (visit r = meta.runs, the first return is r = 1).
export function returningRegular(meta) {
  const r = Math.max(1, Math.floor((meta && meta.runs) || 1));
  const priya = hasPerk(meta, 'regular');
  if (priya && r % 3 === 0) return PRIYA_LINES;
  return ROTATION[(priya ? r - 1 - Math.floor(r / 3) : r - 1) % ROTATION.length];
}

function giftLine(reg, info, k) {
  if (!info) return null;
  if (reg.gifts[info.id]) return reg.gifts[info.id];
  if (info.sympathy && reg === DANA) return info.sympathy;
  if (reg.giftTemplates) return reg.giftTemplates[k % reg.giftTemplates.length].replace('{gift}', info.gift);
  return `The regulars chipped in for ${info.gift}.`;
}

export function roster(meta) {
  if (!meta || !meta.firstPivotSeen) return CLIENTS.slice();
  const reg = returningRegular(meta);
  const base = reg.client;
  const k = meta.runs || 0;
  const asks = [reg.back, base.asks[1]];
  const outcome = meta.lastOutcome;
  const opens = outcome && reg.open[outcome];
  if (!opens) return [{ ...base, segments: 2, asks }];
  const info = unlockInfo(meta.lastUnlock);
  const failed = outcome === 'arrest' || outcome === 'death';
  let opener = opens[k % opens.length], second;
  if (failed) {
    // A save from before the two tracks can hold a failure that earned a main unlock: say it plainly.
    second = !info ? reg.empty : giftLine(reg, info, k);   // the same voice as any gift (Dana's templates included)
    if (hasPerk(meta, 'getwellcard') && meta.lastUnlock !== 'getwellcard') opener = reg.getWell[outcome];
  } else if (outcome === 'left') {
    // Leaving grants nothing, but the tenth viewing's hall pass arrives whatever the outcome (meta.js).
    second = (info && giftLine(reg, info, k)) || reg.leftSecond[k % reg.leftSecond.length];
  } else {
    second = giftLine(reg, info, k) || giftLine(reg, { id: '', gift: 'a thank-you card' }, k);
  }
  return [{
    ...base,
    segments: 2, // between runs: Swedish, then cross-fiber
    asks,
    lines: [
      [7.0, opener],
      [14.0, second],
      [22.0, reg.filler],
    ],
  }];
}
