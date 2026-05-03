import { animate, stagger, createSpring, utils } from '../facets/vendor/anime.esm.min.js';

const CN = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
const ELABEL = ['WOOD','FIRE','EARTH','METAL','WATER'];

// Functional-agrarian China-max ruleset (8 rules):
//
// TIER 1 — Translation (Chinese tradition, character semantics):
//   R1. 鼠 = any rodent (rat, mouse, squirrel, beaver, agrarian pest)
//   R2. 羊 = goat/sheep/ram (horned ruminant)
//   R3. 鸡 = chicken specifically (no other birds)
//   R4. Lunar New Year date cutoff for birth-year flips
//
// TIER 2 — Project rubrics:
//   R5. Wuxing → types: Wood=Grass, Fire=Fire, Earth=Ground/Rock/Normal-as-mundane,
//       Metal=Steel only (NOT Electric — Wu Xing has no Air), Water=Water+Ice.
//       Pure Electric, Flying, Psychic, Dark, Fairy, Ghost are elementally orphaned.
//   R6. Animal-slot uses functional-agrarian design criteria (the 12 below);
//       element uses type-honest (R5). Pokémon must pass BOTH matchers to fill a cell.
//   R7. Cluster depth: 1 single · 2 line · 3 two-lines/line+legend · 4 three-lines · 5 four+
//   R8. Open-cell honesty: no qualifying match = cell stays open
//
// THE 12 FUNCTIONAL-AGRARIAN SLOT CRITERIA:
//   1. Rat — rodents only. Pikaclones rodent-shaped but most Electric → orphaned.
//   2. Ox — cattle/water buffalo only. American bison (Bouffalant) orphaned, wrong continent.
//   3. Tiger — actual tigers. Lions orphaned (Buddhist-imported, not native fauna).
//      Domestic cats orphaned per Great Race myth.
//   4. Rabbit — lagomorphs. Moon-rabbit canon.
//   5. Dragon — Chinese loong only (serpentine, whiskered, sky/water-associated)
//      + carp-dragon (Magikarp/Gyarados). Western heraldic (Charizard) ORPHANED.
//      Kaiju (Tyranitar) ORPHANED — Japanese tradition, not Chinese.
//   6. Snake — legless reptiles. Eels qualify. Sea-serpents here unless carp-dragon.
//   7. Horse — equines, donkeys included. Zebras orphaned (African).
//   8. Goat — horned ruminants. Houndoom ORPHANED (Baphomet/European Christian, not pastoral).
//   9. Monkey — primates. Sun Wukong canon.
//   10. Rooster — chicken specifically. Most birds orphaned.
//   11. Dog — domestic dogs only. Wolves (Mightyena, Lycanroc, Zamazenta) ORPHANED.
//       Foxes (Vulpix, Vaporeon) ORPHANED — fox-spirit lineage, separate Chinese category.
//       Jackals (Lucario) ORPHANED — Egyptian/Mediterranean fauna.
//   12. Pig — suids only. Hippos, tapirs orphaned.
//
// TIER 3 — Footnoted exclusions (the scholarly receipts):
//   - Domestic cats: Great Race myth (Rat tricked Cat off the Ox).
//   - Foxes (狐仙): supernatural lineage, separate from domestic dog.
//   - Wolves (狼): wild predators, not domestic-companion canid.
//   - Lions (狮): Buddhist-imported iconography, not native Chinese fauna.
//   - Most birds: Rooster slot is chicken-specific.
//   - Pure Electric: Wu Xing has no Air element; lightning is air-coded in Pokémon.
//   - Pure Flying/Psychic/Dark/Fairy/Ghost: no Five-Phases equivalent.
//   - Western dragons, kaiju, zebras, bison, jackals, mammoths, hippos, tapirs:
//     non-Chinese fauna or non-Chinese mythological lineages.
//
// The grid is a map of where Pokémon designers reached into Chinese tradition vs. drew
// from elsewhere. Open cells are the most interesting cells — they show where the dex
// went Western, Japanese, or fantastical. Honored gaps, not failures.
//
// trio tags surface in-game groupings on hover.

const DATA = [
  ['Rat', [
    ['open',  0, 'open',        '1984 / 2044', [], []],
    ['fire',  2, 'Cyndaquil',   '1996 / 2056', ['Cyndaquil-Quilava-Typhlosion (Fire Mouse Pokémon)'], []],
    ['earth', 3, 'Skwovet',     '2008 / 2068', ['Skwovet-Greedent (chipmunk, Normal-as-mundane)', 'Drilbur-Excadrill (mole, Ground/Steel — borderline rodent)'], []],
    ['metal', 1, 'Togedemaru',  '2020 / 2080', ['Togedemaru (Electric/Steel — Steel on the card; hedgehog borderline rodent)'], []],
    ['water', 3, 'Marill',      '2032 / 2092', ['Azurill-Marill-Azumarill (water mouse)', 'Bibarel line (Normal/Water beaver)'], []],
  ]],
  ['Ox', [
    ['open',  0, 'open',        '1985 / 2045', [], []],
    ['fire',  1, 'Blaze Tauros','1997 / 2057', ['Paldean Blaze Tauros (Fighting/Fire breed)'], []],
    ['earth', 2, 'Tauros',      '2009 / 2069', ['Tauros (base, Normal-as-mundane bull)', 'Miltank (Normal-as-mundane dairy cow)'], []],
    ['open',  0, 'open',        '2021 / 2081', [], []],
    ['water', 1, 'Aqua Tauros', '2033 / 2093', ['Paldean Aqua Tauros (Fighting/Water breed)'], []],
  ]],
  ['Tiger', [
    ['open',  0, 'open',        '2034 / 2094', [], []],
    ['open',  0, 'open',        '1986 / 2046', [], []],
    ['open',  0, 'open',        '1998 / 2058', [], []],
    ['open',  0, 'open',        '2010 / 2070', [], []],
    ['open',  0, 'open',        '2022 / 2082', [], []],
  ]],
  ['Rabbit', [
    ['open',  0, 'open',        '2035 / 2095', [], []],
    ['fire',  2, 'Cinderace',   '1987 / 2047', ['Scorbunny-Raboot-Cinderace (Galar starter)'], []],
    ['earth', 2, 'Diggersby',   '1999 / 2059', ['Bunnelby-Diggersby (Normal/Ground)'], []],
    ['open',  0, 'open',        '2011 / 2071', [], []],
    ['water', 2, 'Azumarill',   '2023 / 2083', ['Azurill-Marill-Azumarill (cross-codes Water Rat)'], []],
  ]],
  ['Dragon', [
    ['open',  0, 'open',        '2024 / 2084', [], []],
    ['open',  0, 'open',        '2036 / 2096', [], []],
    ['open',  0, 'open',        '1988 / 2048', [], []],
    ['open',  0, 'open',        '2000 / 2060', [], []],
    ['water', 4, 'Kingdra',     '2012 / 2072', ['Horsea-Seadra-Kingdra (seahorse-loong, whiskered, serpentine)', 'Palkia (Water/Dragon, sky/water-associated)', 'Magikarp-Gyarados (carp-dragon transformation, 鯉躍龍門 — explicit per criterion 5)', 'Dragalge (sea-dragon visual, borderline loong)'], []],
  ]],
  ['Snake', [
    ['wood',  2, 'Serperior',   '2025 / 2085', ['Snivy-Servine-Serperior (Grass, Royal Pokémon, Unova starter)'], []],
    ['open',  0, 'open',        '2037 / 2097', [], []],
    ['earth', 4, 'Sandaconda',  '1989 / 2049', ['Silicobra-Sandaconda (Ground)', 'Onix-Steelix (Rock/Ground; cross-codes Metal Snake)', 'Ekans-Arbok (Poison-coded but earthbound)', 'Dunsparce-Dudunsparce (Normal-as-mundane)'], []],
    ['metal', 2, 'Steelix',     '2001 / 2061', ['Onix-Steelix (Steel/Ground; cross-codes Earth Snake)'], []],
    ['water', 3, 'Milotic',     '2013 / 2073', ['Feebas-Milotic (sea-serpent — criterion 6 keeps it here, not Dragon)', 'Tynamo-Eelektrik-Eelektross (eel — criterion 6 explicit)'], []],
  ]],
  ['Horse', [
    ['open',  0, 'open',        '2014 / 2074', [], []],
    ['fire',  2, 'Rapidash',    '2026 / 2086', ['Ponyta-Rapidash (Kantonian Fire Horse, unicorn qualifies per criterion 7)'], [], true],
    ['earth', 2, 'Mudsdale',    '2038 / 2098', ['Mudbray-Mudsdale (Ground, Draft Horse)'], []],
    ['open',  0, 'open',        '1990 / 2050', [], []],
    ['water', 2, 'Keldeo',      '2002 / 2062', ['Keldeo (Water/Fighting, Resolute + Ordinary forms, Swords of Justice)'], ['swords']],
  ]],
  ['Goat', [
    ['wood',  3, 'Gogoat',      '2015 / 2075', ['Skiddo-Gogoat (Grass, horned ruminant)', 'Virizion (Grass/Fighting, Swords of Justice)'], ['swords']],
    ['open',  0, 'open',        '2027 / 2087', [], []],
    ['earth', 4, 'Terrakion',   '2039 / 2099', ['Terrakion (Rock/Fighting, ram-horned — debatable, leans Ox per criterion 8)', 'Stantler-Wyrdeer (Normal-as-mundane cervid — antlers stretch)', 'Wooloo-Dubwool (Normal-as-mundane sheep)'], ['swords']],
    ['metal', 2, 'Cobalion',    '1991 / 2051', ['Cobalion (Steel/Fighting, most goat-coded of Swords of Justice — ungulate horned design)'], ['swords']],
    ['water', 2, 'Gastrodon',   '2003 / 2063', ['Shellos-Gastrodon (West Sea form, ram horns per Serebii)'], []],
  ]],
  ['Monkey', [
    ['wood',  3, 'Rillaboom',   '2004 / 2064', ['Grookey-Thwackey-Rillaboom (Grass, Galar starter)', 'Pansage-Simisage (Grass, Sim trio)'], ['sims']],
    ['fire',  4, 'Infernape',   '2016 / 2076', ['Chimchar-Monferno-Infernape (Fire, Sinnoh starter)', 'Pansear-Simisear (Fire, Sim trio)', 'Darumaka-Darmanitan (Fire)'], ['sims']],
    ['earth', 2, 'Slaking',     '2028 / 2088', ['Slakoth-Vigoroth-Slaking (Normal-as-mundane — big ape that sits on the ground)'], []],
    ['open',  0, 'open',        '2040 / 2100', [], []],
    ['water', 2, 'Simipour',    '1992 / 2052', ['Panpour-Simipour (Water, Sim trio)'], ['sims']],
  ]],
  ['Rooster', [
    ['open',  0, 'open',        '2005 / 2065', [], []],
    ['fire',  2, 'Blaziken',    '2017 / 2077', ['Torchic-Combusken-Blaziken (Fire/Fighting — literally rooster-fighter)'], []],
    ['open',  0, 'open',        '2029 / 2089', [], []],
    ['open',  0, 'open',        '2041 / 2101', [], []],
    ['open',  0, 'open',        '1993 / 2053', [], []],
  ]],
  ['Dog', [
    ['open',  0, 'open',        '1994 / 2054', [], []],
    ['fire',  3, 'Arcanine',    '2006 / 2066', ['Growlithe-Arcanine (Kantonian, pure Fire — Legendary Pokémon classified as Fire dog, domestic-coded)', 'Hisuian Growlithe-Arcanine (Fire/Rock — primary read here)'], []],
    ['earth', 3, 'Stoutland',   '2018 / 2078', ['Lillipup-Herdier-Stoutland (Normal-as-mundane working dog)', 'Hisuian Growlithe-Arcanine (Fire/Rock — Rock-as-Earth cross-flex)'], []],
    ['open',  0, 'open',        '2030 / 2090', [], []],
    ['open',  0, 'open',        '2042 / 2102', [], []],
  ]],
  ['Pig', [
    ['open',  0, 'open',        '1995 / 2055', [], []],
    ['fire',  2, 'Emboar',      '2007 / 2067', ['Tepig-Pignite-Emboar (Fire/Fighting Mega Fire Pig, Unova starter)'], []],
    ['earth', 3, 'Mamoswine',   '2019 / 2079', ['Swinub-Piloswine-Mamoswine (Ice/Ground woolly mammoth)', 'Lechonk-Oinkologne (Normal-as-mundane pastoral pig)'], []],
    ['open',  0, 'open',        '2031 / 2091', [], []],
    ['open',  0, 'open',        '2043 / 2103', [], []],
  ]],
];

const TRIO_NAMES = {
  swords:  'Swords of Justice — Cobalion · Terrakion · Virizion · Keldeo',
  sims:    'Sim Monkey trio — Simisage · Simisear · Simipour',
};

const grid = document.getElementById('grid');

function dotsHTML(depth) {
  let s = '';
  for (let i = 1; i <= 5; i++) s += `<span class="dot ${i <= depth ? 'on' : ''}"></span>`;
  return `<span class="dots">${s}</span>`;
}

const cellRefs = {};

DATA.forEach((row, rIdx) => {
  const animal = row[0];
  const cells = row[1];

  const rowDepth = cells.reduce((s, c) => s + c[1], 0);

  const label = document.createElement('div');
  label.className = 'zl';
  label.dataset.rowDepth = rowDepth;
  label.innerHTML = `
    <div class="zl-name">${animal}<span class="zlsub">${CN[rIdx]}</span></div>
    <div class="zl-rowdepth" title="Row total cluster depth">${rowDepth}</div>
  `;
  grid.appendChild(label);

  cells.forEach(([el, depth, anchor, years, members, trios, isNow], cIdx) => {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = `zc e-${el}` + (isNow ? ' zc-now' : '') + (depth >= 4 ? ' zc-deep' : '');
    cell.dataset.title = `${animal} · ${ELABEL[cIdx]} · ${anchor}`;
    cell.dataset.years = years;
    cell.dataset.anchor = anchor;
    cell.dataset.animal = animal;
    cell.dataset.element = ELABEL[cIdx];
    cell.dataset.members = JSON.stringify(members);
    cell.dataset.depth = depth;
    cell.dataset.trios = JSON.stringify(trios || []);
    cell.dataset.row = rIdx;
    cell.dataset.col = cIdx;
    cell.innerHTML = `
      <div class="zn">${anchor}</div>
      ${dotsHTML(depth)}
      <div class="zy">${members.length} ${members.length === 1 ? 'line' : 'lines'} · ${years.split('/')[0].trim()}</div>
    `;
    grid.appendChild(cell);
    cellRefs[`${rIdx}-${cIdx}`] = cell;
  });
});

const cells = document.querySelectorAll('.zc');
const headers = document.querySelectorAll('.zh');
const labels = document.querySelectorAll('.zl');

utils.set(cells, { scale: 0, opacity: 0 });
utils.set(headers, { y: -16, opacity: 0 });
utils.set(labels, { x: -16, opacity: 0 });

animate(headers, { y: 0, opacity: 1, duration: 500, delay: stagger(60), ease: 'outQuad' });
animate(labels, { x: 0, opacity: 1, duration: 500, delay: stagger(50, { start: 200 }), ease: 'outQuad' });
animate(cells, {
  scale: [0, 1], opacity: [0, 1],
  duration: 600,
  delay: stagger(25, { grid: [5, 12], from: 'center', start: 350 }),
  ease: createSpring({ mass: 1, stiffness: 120, damping: 12 }),
});
animate('.dot.on', {
  scale: [0, 1], duration: 350,
  delay: stagger(40, { start: 1100 }),
  ease: createSpring({ mass: 0.6, stiffness: 220, damping: 9 }),
});

const titleEl = document.getElementById('title');
const titleText = titleEl.textContent;
titleEl.innerHTML = titleText.split('').map(c =>
  c === ' ' ? '<span class="ch">&nbsp;</span>' : `<span class="ch">${c}</span>`
).join('');
animate(titleEl.querySelectorAll('.ch'), {
  y: [-30, 0], opacity: [0, 1],
  duration: 700, delay: stagger(25),
  ease: createSpring({ mass: 1, stiffness: 100, damping: 10 }),
});

const nowCell = document.querySelector('.zc-now');
if (nowCell) {
  animate(nowCell, {
    boxShadow: [
      '0 0 0px 0px rgba(0,255,0,0)',
      '0 0 18px 4px rgba(0,255,0,0.7)',
      '0 0 0px 0px rgba(0,255,0,0)',
    ],
    duration: 1800, loop: true, ease: 'inOutSine',
  });
}

document.querySelectorAll('.zc-deep').forEach(c => {
  animate(c, {
    boxShadow: [
      '0 0 0px 0px rgba(255,255,0,0)',
      '0 0 12px 2px rgba(255,255,0,0.45)',
      '0 0 0px 0px rgba(255,255,0,0)',
    ],
    duration: 2600, loop: true, ease: 'inOutSine',
    delay: Math.random() * 1000,
  });
});

const toast = document.getElementById('triotoast');
function showToast(msg) {
  toast.textContent = msg;
  animate(toast, {
    keyframes: [
      { opacity: 1, duration: 200 },
      { opacity: 1, duration: 1400 },
      { opacity: 0, duration: 400 },
    ],
    ease: 'outQuad',
  });
}

cells.forEach(cell => {
  cell.addEventListener('mouseenter', () => {
    animate(cell, {
      scale: 1.06, duration: 400,
      ease: createSpring({ mass: 0.8, stiffness: 200, damping: 10 }),
    });

    const trios = JSON.parse(cell.dataset.trios);
    if (trios.length) {
      const trio = trios[0];
      cells.forEach(other => {
        const otherTrios = JSON.parse(other.dataset.trios);
        if (otherTrios.includes(trio) && other !== cell) {
          other.classList.add('trio-hl', `trio-${trio}`);
        }
      });
      cell.classList.add('trio-hl', `trio-${trio}`);
      showToast(TRIO_NAMES[trio] || '');
    }
  });
  cell.addEventListener('mouseleave', () => {
    animate(cell, {
      scale: 1, duration: 400,
      ease: createSpring({ mass: 0.8, stiffness: 200, damping: 12 }),
    });
    cells.forEach(other => {
      other.classList.remove('trio-hl', 'trio-swords', 'trio-sims', 'trio-beasts', 'trio-wolves', 'trio-tao');
    });
  });
});

const panel = document.getElementById('panel');
let selected = null;
let panelAnim = null;
let panelLiAnim = null;

function showPanel(cell) {
  if (selected && selected !== cell) {
    animate(selected, { scale: 1, duration: 250, ease: 'outQuad' });
  }
  selected = cell;

  animate(cell, {
    keyframes: [
      { scale: 0.92, duration: 100 },
      { scale: 1.08, duration: 200, ease: createSpring({ stiffness: 300, damping: 8 }) },
      { scale: 1.06, duration: 200 },
    ],
  });

  const members = JSON.parse(cell.dataset.members);
  const depth = parseInt(cell.dataset.depth, 10);
  const trios = JSON.parse(cell.dataset.trios);
  const memberHTML = members.length
    ? `<ul class="pmembers">${members.map(m => `<li>${m}</li>`).join('')}</ul>`
    : `<div class="pempty">No qualifying match — cell stays open per R8 (open-cell honesty).</div>`;

  const trioHTML = trios.length
    ? `<div class="ptrio">${trios.map(t => TRIO_NAMES[t]).join(' · ')}</div>`
    : '';

  if (panelAnim) panelAnim.pause();
  if (panelLiAnim) panelLiAnim.pause();

  panel.classList.remove('empty');
  panel.innerHTML = `
    <div class="ptitle">${cell.dataset.title}</div>
    <div class="pyears">Year cycle: ${cell.dataset.years}</div>
    <div class="pdepth">Cluster depth ${dotsHTML(depth)} <span class="pcount">(${members.length} ${members.length === 1 ? 'line' : 'lines'})</span></div>
    ${memberHTML}
    ${trioHTML}
  `;

  utils.set(panel, { opacity: 0, y: 20 });

  panelAnim = animate(panel, {
    opacity: 1, y: 0,
    duration: 450,
    ease: createSpring({ mass: 1, stiffness: 150, damping: 14 }),
  });

  const liNodes = panel.querySelectorAll('.pmembers li');
  if (liNodes.length) {
    utils.set(liNodes, { x: -12, opacity: 0 });
    panelLiAnim = animate(liNodes, {
      x: 0, opacity: 1,
      duration: 350,
      delay: stagger(40, { start: 150 }),
      ease: 'outQuad',
    });
  }
}

cells.forEach(cell => {
  cell.addEventListener('click', () => showPanel(cell));
});

// --- Year lookup ---
// Animal: (year - 1900) % 12, where 0 = Rat
// Element: pairs of years across 10-year cycle, starting Wood at 1924
//   (year - 1924) % 10, then floor / 2

function lookupYear(year) {
  const animalIdx = ((year - 1900) % 12 + 12) % 12;
  const elementIdx = Math.floor((((year - 1924) % 10) + 10) % 10 / 2);
  return { animalIdx, elementIdx };
}

const yrInput = document.getElementById('yr');
const yrBtn = document.getElementById('yrbtn');
const yrOut = document.getElementById('yrout');

function runLookup() {
  const year = parseInt(yrInput.value, 10);
  if (!year || year < 1900 || year > 2100) {
    yrOut.textContent = 'Enter a year between 1900 and 2100.';
    return;
  }
  const { animalIdx, elementIdx } = lookupYear(year);
  const cell = cellRefs[`${animalIdx}-${elementIdx}`];
  const animal = DATA[animalIdx][0];
  const element = ELABEL[elementIdx];
  yrOut.innerHTML = `${year} → <strong>${element} ${animal}</strong> — ${cell.dataset.anchor}`;

  cell.scrollIntoView({ behavior: 'smooth', block: 'center' });
  animate(cell, {
    keyframes: [
      { scale: 1.15, duration: 250, ease: createSpring({ stiffness: 200, damping: 8 }) },
      { scale: 1.0,  duration: 350 },
    ],
  });
  setTimeout(() => showPanel(cell), 400);
}

yrBtn.addEventListener('click', runLookup);
yrInput.addEventListener('keydown', e => { if (e.key === 'Enter') runLookup(); });
