// The PIVOT's lines read the record (DESIGN.md "PIVOT", rulings 2026-09-23 after the first plays):
// the three goon lines and the ranger's line come from a table keyed to meta.runs (the count before
// this run) and meta.lastOutcome. Polite corporate menace that escalates: run 1 polite, run 2 names
// how the last run ended, run 3 the boss steps out of the passenger seat, run 4 the ranger's line
// drifts, run 5 on they know your unlocks, run 7 on the late sets cycle. The third line stays a
// short '...' so the ranger cuts in on the same beat as before (the timing budget does not change).
import { has } from './meta.js';

const SERENITY = 'Serenity Group Incorporated.';
const PERMIT = "Sir, they have a permit for the plaza. You don't.";

// Run 2: one variant per way the last run ended.
const SECOND = {
  escape: {
    goons: [`${SERENITY} We know where you went last time.`, 'Nice neighborhood. Very quiet.', '...'],
    ranger: "Sir, they still have the permit. You still don't.",
  },
  arrest: {
    goons: [`${SERENITY} The county was very helpful.`, 'They let us keep a copy of your file.', '...'],
    ranger: "Sir, I read the report. They have a permit. You don't.",
  },
  death: {
    goons: [`${SERENITY} You looked tired last time.`, 'You should let someone work on you.', '...'],
    ranger: "Sir, they have a permit for the plaza. You don't.",
  },
  left: {
    goons: [`${SERENITY} You left the chair. We kept it warm.`, "It's a good chair. It deserves a brand.", '...'],
    ranger: "Sir, an unattended chair is a citation. They have a permit.",
  },
  none: {
    goons: [`${SERENITY} Good to see you back at the chair.`, "You're still operating without a brand.", '...'],
    ranger: PERMIT,
  },
};

// Run 5 on: what they have noticed, newest first in the rotation (the ruling's examples lead).
const REMARKS = [
  ['gun', 'Nice gun.'],
  ['cartkeys', 'The cart keys. Cute.'],
  ['disguise', 'That polo is ours, by the way.'],
  ['gun3', 'The Pro head. Expensive hobby.'],
  ['blockparty', 'A block party. How neighborly.'],
  ['regular', 'Your regular says hello. We asked.'],
  ['sprint', 'New shoes. We noticed.'],
  ['autofold', 'The chair folds faster now. Noted.'],
  ['gun2', 'A bigger head on the gun. Noted.'],
  ['gun1', 'A longer barrel. Noted.'],
  ['skipPivot', "You've stopped listening to us."],
];
const NO_REMARK = "You're still operating without a brand.";

// Late sets (run 7 on) cycle in this order, so no set follows itself.
const LATE = [
  {
    id: 'late-weekly',
    goons: [`${SERENITY} Same time next week, then.`, '{remark}', '...'],
    ranger: 'Alex. Just this once, come quietly.',
  },
  {
    id: 'late-offer', boss: true,
    goons: ["I'm prepared to make an offer on the chair.", '{remark}', '...'],
    ranger: "Alex, take the offer. Please.",
  },
];

function remark(meta, runs) {
  const owned = REMARKS.filter(([id]) => has(meta, id));
  if (!owned.length) return { text: NO_REMARK, unlock: null };
  const [id, text] = owned[(runs - 4) % owned.length];
  return { text, unlock: id };
}

// Returns { id, goons: [3 lines], ranger, boss, unlock } for this pivot. boss: the grey-suited
// man speaks goons[0] from the passenger door, then gets back in. unlock: the id a remark names.
export function pivotLines(meta) {
  const runs = Math.max(0, Math.floor((meta && meta.runs) || 0));
  const pack = (id, set, extra = {}) => ({ id, goons: set.goons.slice(), ranger: set.ranger, boss: !!set.boss, unlock: null, ...extra });
  if (runs === 0) {
    return pack('first', { goons: [`${SERENITY} We'd like a word about the chair.`, "You're operating without a brand.", '...'], ranger: PERMIT });
  }
  if (runs === 1) {
    const out = meta.lastOutcome && SECOND[meta.lastOutcome] ? meta.lastOutcome : 'none';
    return pack(`second-${out}`, SECOND[out]);
  }
  if (runs === 2) {
    return pack('boss', {
      boss: true,
      goons: ['So this is the chair. I wanted to see it myself.', 'The director would like it folded.', '...'],
      ranger: "Sir, their director drove out personally. I'd listen.",
    });
  }
  if (runs === 3) {
    return pack('folder', {
      goons: [`${SERENITY} We've started a folder on you.`, 'The folder has a tab for the chair.', '...'],
      ranger: "I'm sorry, Alex. My hands are tied.",
    });
  }
  let set;
  if (runs === 4) {
    set = { id: 'equipment', goons: [`${SERENITY} We've been reviewing your equipment.`, '{remark}', '...'], ranger: "Alex, I don't write the permits." };
  } else if (runs === 5) {
    set = { id: 'quarterly', goons: [`${SERENITY} The quarterly review is in.`, '{remark}', '...'], ranger: "I'm sorry, Alex. It's above my pay grade." };
  } else {
    set = LATE[(runs - 6) % LATE.length];
  }
  const r = remark(meta, runs);
  const out = pack(set.id, set, { unlock: r.unlock });
  out.goons = out.goons.map((l) => (l === '{remark}' ? r.text : l));
  return out;
}
