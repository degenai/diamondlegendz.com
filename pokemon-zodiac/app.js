import { animate, stagger, spring, utils } from '../facets/vendor/anime.esm.min.js';

const CN = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
const ELABEL = ['WOOD','FIRE','EARTH','METAL','WATER','AURA'];
const CURRENT_YEAR = new Date().getFullYear();

// Functional-agrarian China-max ruleset (9 rules — R9 added per md/ research notes):
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
//       R5 extension: Poison-type Pokémon with terrestrial-habitat coding (cobras,
//       skunks, sludge piles) extend to Earth — toxin is a lifecycle adaptation,
//       not an elemental realm; Wu Xing has no poison phase, terrestrial poisons
//       are chthonic / 土-coded by tradition. Aquatic, aerial, gaseous, and
//       ghostly Poison-types do NOT get this extension.
//   R6. Animal-slot uses functional-agrarian design criteria (the 12 below);
//       element uses type-honest (R5). Pokémon must pass BOTH matchers to fill a cell.
//   R7. Cluster depth: 1 single · 2 line · 3 two-lines/line+legend · 4 three-lines · 5 four+
//   R8. Open-cell honesty: no qualifying match = cell stays open
//   R9. Market-acceptance test (Tier 3 override). When The Pokémon Company ships a
//       Pokémon under official zodiac/Wuxing framing — Lunar New Year events,
//       Year-of-X TCG product, Pokémon Center merchandise — and the AAPI community
//       doesn't push back, the placement is ratified. TPC has access to cultural
//       consultants the project doesn't; absence of community objection counts as
//       positive ratification. R9 overrides Tier 3 fauna/cultural exclusions
//       (Western dragons, wolves, foxes, American bison, hyenas) but does NOT
//       override R5 element rules — Wuxing element constraints are structural,
//       not cultural. Pure Electric, Dark, Ghost, etc. stay element-orphaned even
//       when TPC bundles them in Year-of-X events.
//
// THE 12 FUNCTIONAL-AGRARIAN SLOT CRITERIA (with R9 restorations noted):
//   1. Rat — rodents broadly. Sandshrew restored under R9 (TPC bundled in Year of Rat 2020).
//   2. Ox — bovines broadly. Bouffalant restored under R9 (TPC bundled in Year of Ox 2021).
//   3. Tiger — actual tigers. Lions stay orphaned (R9 also: TPC declined to ship lions
//      for Year of Tiger 2022 — both strict and market agree). Row stays fully open.
//   4. Rabbit — lagomorphs. Moon-rabbit canon.
//   5. Dragon — Chinese loong + carp-dragon STRICT, BUT Western heraldic dragons and
//      kaiju RESTORED under R9 (TPC shipped Charizard for Year of Dragon 2024 Taiwan/HK).
//      Five filled cells, not two. Cultural-design observation about Western-loong
//      dominance preserved as Findings scholarship.
//   6. Snake — legless reptiles strict, BUT 2025 TPC Year of Snake bundled Gorebyss/Huntail
//      (sea-serpent fish) and Giratina Origin (Ghost/Dragon) under R9 visual coding.
//      Eelektross still R5 element-orphan (pure Electric).
//   7. Horse — equines, donkeys included via line-as-unit. Zebras orphaned (Electric).
//   8. Goat — horned ruminants. Houndoom NOT goat (predatory canid with horns) → moved
//      to Fire Dog under R9.
//   9. Monkey — primates. Sun Wukong canon.
//   10. Rooster — chicken specifically. Most birds orphaned.
//   11. Dog — domestic dogs strict, BUT wolves (Lycanroc), foxes (Vaporeon eeveelution),
//       hellhound (Houndoom) RESTORED under R9 (TPC bundled Poochyena/Eevee/Growlithe in
//       Year of Dog 2018). Mightyena (pure Dark) stays R5 element-orphan. Vulpix-Ninetales
//       kept orphan (kitsune is Japanese supernatural cross-cultural, not just Chinese).
//   12. Pig — suids broadly. Hippos, tapirs orphaned.
//
// TIER 3 — Footnoted exclusions (the scholarly receipts, post-R9):
//   - Domestic cats: Great Race myth — TPC also declined to ship cats. Stays orphaned.
//   - Most birds: Rooster slot is chicken-specific. Stays orphaned.
//   - Pure Electric, Flying, Psychic, Dark, Fairy, Ghost: no Five-Phases equivalent.
//     R9 cannot rescue (R5 is structural).
//   - Hippos, tapirs, kangaroos: no zodiac slot fits AND not market-readable as
//     another listed animal. Stays orphaned.
//   - Vulpix-Ninetales (kitsune): R9 doesn't apply — kitsune is Japanese 狐仙 sacred-
//     category, AAPI community would object to Year-of-Dog framing.
//
// The grid is a map of where Pokémon designers reached into Chinese tradition vs. drew
// from elsewhere, AND a market-validated guide for collector box-building. Findings
// section preserves the design-history scholarship; the grid itself follows R9.
//
// trio tags surface in-game groupings on hover.

const DATA = [
  ['Rat', [
    ['open',     0, 'open',        '1984 / 2044', [], []],
    ['fire',     2, 'Cyndaquil',   '1996 / 2056', ['Cyndaquil-Quilava-Typhlosion (Fire Mouse Pokémon)'], []],
    ['earth',    5, 'Skwovet',     '2008 / 2068', ['Skwovet-Greedent (chipmunk, Normal-as-mundane)', 'Drilbur-Excadrill (mole, Ground/Steel — borderline rodent)', 'Sandshrew-Sandslash (Ground — pangolin/armadillo silhouette but TPC bundled in Year of the Rat 2020 spawn list; restored under R9 market-acceptance test)', 'Rattata-Raticate (Normal-as-mundane — TPC\'s 2019 Year of the Pig 12-zodiac spawn list pick for Year of the Rat; the canonical agrarian rodent)'], []],
    ['metal',    1, 'Togedemaru',  '2020 / 2080', ['Togedemaru (Electric/Steel — Steel on the card; hedgehog borderline rodent)'], []],
    ['water',    3, 'Marill',      '2032 / 2092', ['Azurill-Marill-Azumarill (water mouse)', 'Bibarel line (Normal/Water beaver)'], []],
    ['agnostic', 2, 'Pikachu',     'animal',      ['Pichu-Pikachu-Raichu (pure Electric — TPC franchise mascot, bundled in Year of the Rat 2020 Pokémon GO spawn list. Element-orphan per R5 but R9 zodiac aura is unambiguous.)'], []],
  ]],
  ['Ox', [
    ['open',     0, 'open',        '1985 / 2045', [], []],
    ['fire',     1, 'Blaze Tauros','1997 / 2057', ['Paldean Blaze Tauros (Fighting/Fire breed)'], []],
    ['earth',    5, 'Terrakion',   '2009 / 2069', ['Terrakion (Rock/Fighting — Bulbapedia: "bovine, quadrupedal Pokémon" with charging-bull behavior; Swords of Justice)', 'Tauros (base, Normal-as-mundane bull)', 'Bouffalant (Normal-as-mundane — North American bison passes 野牛 in modern Mandarin; market would accept in a Year of the Ox box)', 'Miltank (Normal-as-mundane dairy cow)'], ['swords']],
    ['open',     0, 'open',        '2021 / 2081', [], []],
    ['water',    1, 'Aqua Tauros', '2033 / 2093', ['Paldean Aqua Tauros (Fighting/Water breed)'], []],
    ['agnostic', 0, '→ Miltank',   'animal',      ['TPC\'s 2019 Year of the Pig 12-zodiac spawn list pick for Year of the Ox was Miltank — already cataloged in Earth Ox cluster. The Aura column defers to the elemental home where 牛 + 土 stack: pairing a 2009 / 2069 Year-of-Ox + Earth-Ox collector spread compounds the investment fit.'], []],
  ]],
  ['Tiger', [
    ['open',     0, 'open',        '2034 / 2094', [], []],
    ['open',     0, 'open',        '1986 / 2046', [], []],
    ['open',     0, 'open',        '1998 / 2058', [], []],
    ['open',     0, 'open',        '2010 / 2070', [], []],
    ['open',     0, 'open',        '2022 / 2082', [], []],
    ['agnostic', 2, 'Electabuzz',  'animal',      ['Elekid-Electabuzz-Electivire (pure Electric — TPC\'s 2019 Year of the Pig 12-zodiac spawn list assigned Electabuzz to Tiger, picked for yellow-and-black tiger-stripe coding despite humanoid silhouette. Strongest evidence in the entire ledger that TPC privileges visual coding over silhouette-fit.)'], []],
  ]],
  ['Rabbit', [
    ['open',     0, 'open',        '2035 / 2095', [], []],
    ['fire',     2, 'Cinderace',   '1987 / 2047', ['Scorbunny-Raboot-Cinderace (Galar starter)'], []],
    ['earth',    3, 'Diggersby',   '1999 / 2059', ['Bunnelby-Diggersby (Normal/Ground)', 'Buneary-Lopunny (Normal-as-mundane — TPC\'s 2019 Year of the Pig 12-zodiac spawn list pick for Year of the Rabbit)'], []],
    ['open',     0, 'open',        '2011 / 2071', [], []],
    ['water',    2, 'Azumarill',   '2023 / 2083', ['Azurill-Marill-Azumarill (cross-codes Water Rat)'], []],
    ['agnostic', 0, '→ Buneary',   'animal',      ['TPC\'s 2019 Year of the Pig 12-zodiac spawn list pick for Year of the Rabbit was Buneary — Normal-as-mundane lands Earth, so it already lives in Earth Rabbit cluster alongside Bunnelby-Diggersby. Aura column defers: 兔 + 土 paired with 1999 / 2059 Year-of-Rabbit Earth cycles is the stronger investment fit.'], []],
  ]],
  ['Dragon', [
    ['wood',     4, 'Sceptile',    '2024 / 2084', ['Treecko-Grovyle-Sceptile (Mega Sceptile is Grass/Dragon — Hoenn starter)', 'Applin-Flapple/Appletun (Grass/Dragon — apple wyrm)', 'Tropius (Grass/Flying — leaf-fruit dragon)'], []],
    ['fire',     4, 'Charizard',   '2036 / 2096', ['Charmander-Charmeleon-Charizard (Fire/Flying; Mega X is Fire/Dragon — TPC Year of the Dragon 2024 Taiwan/HK flagship per R9)', 'Reshiram (Dragon/Fire — Tao trio)', 'Turtonator (Fire/Dragon — turtle-dragon)'], []],
    ['earth',    5, 'Drampa',      '1988 / 2048', ['Drampa (Normal/Dragon — modeled on the Zhulong 燭龍, Chinese torch-dragon. Long-bodied, whiskered, serpentine — clean loong. Normal-as-mundane lands the element.)', 'Larvitar-Pupitar-Tyranitar (Rock/Dark — kaiju armored saurian; Rock=Earth; restored under R9)', 'Gible-Gabite-Garchomp (Dragon/Ground — Ground=Earth)', 'Trapinch-Vibrava-Flygon (Ground/Dragon — desert spirit)'], []],
    ['metal',    4, 'Dialga',      '2000 / 2060', ['Dialga (Steel/Dragon — temporal legendary)', 'Duraludon-Archaludon (Steel/Dragon — alloy dragon)', 'Hisuian Goodra (Steel/Dragon)'], []],
    ['water',    4, 'Kingdra',     '2012 / 2072', ['Horsea-Seadra-Kingdra (Water/Dragon — seahorse-loong, whiskered, serpentine)', 'Palkia (Water/Dragon, sky/water-associated)', 'Magikarp-Gyarados (Water/Flying — carp-dragon transformation, 鯉躍龍門, explicit per criterion 5)'], []],
    ['agnostic', 5, 'Dragonite',   'animal',      ['Dratini-Dragonair-Dragonite (Dragon/Flying — pure Dragon-typing has no Wuxing mapping; Flying is element-orphan. The original pseudo-legendary Dragon mascot.)', 'Bagon-Shelgon-Salamence (Dragon/Flying)', 'Deino-Zweilous-Hydreigon (Dark/Dragon — Dark also element-orphan)', 'Dragapult line (Dragon/Ghost — both element-orphan)', 'Goomy-Sliggoo-Goodra (Dragon)', 'Jangmo-o-Hakamo-o-Kommo-o (Dragon/Fighting)'], []],
  ]],
  ['Snake', [
    ['wood',     2, 'Serperior',   '2025 / 2085', ['Snivy-Servine-Serperior (Grass, Royal Pokémon, Unova starter)'], []],
    ['open',     0, 'open',        '2037 / 2097', [], []],
    ['earth',    4, 'Sandaconda',  '1989 / 2049', ['Silicobra-Sandaconda (Ground)', 'Onix-Steelix (Rock/Ground; cross-codes Metal Snake)', 'Ekans-Arbok (Poison + terrestrial habitat — R5 extension; cobras are chthonic ground-dwellers; TPC\'s 2019 Year of the Pig 12-zodiac spawn list pick for Year of the Snake)', 'Dunsparce-Dudunsparce (Normal-as-mundane)'], []],
    ['metal',    2, 'Steelix',     '2001 / 2061', ['Onix-Steelix (Steel/Ground; cross-codes Earth Snake)'], []],
    ['water',    2, 'Milotic',     '2013 / 2073', ['Feebas-Milotic (sea-serpent visual coding, not carp-dragon)'], []],
    ['agnostic', 2, 'Eelektross',  'animal',      ['Tynamo-Eelektrik-Eelektross (pure Electric — strict 蛇 reading orphans eels per Case 06, but R9 animal-fit precedent set by TPC\'s 2025 Year of the Snake collection bundling Gorebyss/Huntail sea-serpent fish. Element-orphan via R5, but the zodiac aura is real.)'], []],
  ]],
  ['Horse', [
    ['open',     0, 'open',        '2014 / 2074', [], []],
    ['fire',     2, 'Rapidash',    '2026 / 2086', ['Ponyta-Rapidash (Fire, single-toed equine, mane — clean 马 fit; TPC\'s 2019 Year of the Pig 12-zodiac spawn list pick for Year of the Horse)'], [], true],
    ['earth',    2, 'Mudsdale',    '2038 / 2098', ['Mudbray-Mudsdale line — line-as-unit via Mudsdale (Draft Horse, clean 马). Mudbray reads donkey (驴) by visual; same precedent as Mamoswine via Swinub anchor.'], []],
    ['open',     0, 'open',        '1990 / 2050', [], []],
    ['water',    2, 'Keldeo',      '2002 / 2062', ['Keldeo (Water/Fighting, pony-with-horn, Swords of Justice)'], ['swords']],
    ['agnostic', 2, 'G-Rapidash',  'animal',      ['Galarian Ponyta-Galarian Rapidash (Psychic / Psychic-Fairy — both element-orphan unicorn flex). Strong Year-of-the-Horse zodiac aura via the unicorn mythological convergence; expected merchandise pick for 2026 Horse cycle.'], []],
  ]],
  ['Goat', [
    ['wood',     3, 'Gogoat',      '2015 / 2075', ['Skiddo-Gogoat (Grass, horned ruminant)', 'Virizion (Grass/Fighting, Swords of Justice)'], ['swords']],
    ['open',     0, 'open',        '2027 / 2087', [], []],
    ['earth',    2, 'Wooloo',      '2039 / 2099', ['Wooloo-Dubwool (Normal-as-mundane Galar sheep — Terrakion moved to Earth Ox per Bulbapedia "bovine, quadrupedal" classification)'], []],
    ['metal',    2, 'Cobalion',    '1991 / 2051', ['Cobalion (Steel/Fighting, most goat-coded of Swords of Justice — ungulate horned design)'], ['swords']],
    ['water',    2, 'Gastrodon',   '2003 / 2063', ['Shellos-Gastrodon (West Sea form, ram horns per Serebii)'], []],
    ['agnostic', 2, 'Mareep',      'animal',      ['Mareep-Flaaffy-Ampharos (pure Electric — fan tradition since 2015 Year of the Sheep, vindicated by TPC\'s 2019 Year of the Pig 12-zodiac spawn list assigning Mareep to Goat. The single most enduring "Mareep is the Year-of-Sheep mascot" community consensus.)'], []],
  ]],
  ['Monkey', [
    ['wood',     3, 'Rillaboom',   '2004 / 2064', ['Grookey-Thwackey-Rillaboom (Grass, Galar starter)', 'Pansage-Simisage (Grass, Sim trio)'], ['sims']],
    ['fire',     4, 'Infernape',   '2016 / 2076', ['Chimchar-Monferno-Infernape (Fire, Sinnoh starter)', 'Pansear-Simisear (Fire, Sim trio)', 'Darumaka-Darmanitan (Fire)'], ['sims']],
    ['earth',    2, 'Slaking',     '2028 / 2088', ['Slakoth-Vigoroth-Slaking (Normal-as-mundane — big ape that sits on the ground)'], []],
    ['open',     0, 'open',        '2040 / 2100', [], []],
    ['water',    2, 'Simipour',    '1992 / 2052', ['Panpour-Simipour (Water, Sim trio)'], ['sims']],
    ['agnostic', 2, 'Mankey',      'animal',      ['Mankey-Primeape-Annihilape (pure Fighting → Ghost/Fighting at Annihilape — both Fighting and Ghost are element-orphan per R5; Wuxing has no martial or spirit phase). TPC\'s 2019 Year of the Pig 12-zodiac spawn list assigned Mankey to Monkey — the canonical Year-of-Monkey pick despite humanoid simian-fighter coding.'], []],
  ]],
  ['Rooster', [
    ['open',     0, 'open',        '2005 / 2065', [], []],
    ['fire',     2, 'Blaziken',    '2017 / 2077', ['Torchic-Combusken-Blaziken (Fire/Fighting — literally rooster-fighter, and TPC\'s 2019 Year of the Pig 12-zodiac spawn list pick for Year of the Rooster)'], []],
    ['open',     0, 'open',        '2029 / 2089', [], []],
    ['open',     0, 'open',        '2041 / 2101', [], []],
    ['open',     0, 'open',        '1993 / 2053', [], []],
    ['agnostic', 0, '→ Torchic',   'animal',      ['TPC\'s 2019 Year of the Pig 12-zodiac spawn list pick for Year of the Rooster was Torchic — Fire/Fighting, already lives in Fire Rooster as Blaziken anchor. Aura column defers: 鸡 + 火 paired with 2017 / 2077 Year-of-Rooster Fire cycles is the stronger investment fit.'], []],
  ]],
  ['Dog', [
    ['open',     0, 'open',        '1994 / 2054', [], []],
    ['fire',     4, 'Arcanine',    '2006 / 2066', ['Growlithe-Arcanine (Kantonian, pure Fire — Legendary Pokémon classified as Fire dog, domestic-coded)', 'Hisuian Growlithe-Arcanine (Fire/Rock — primary read here)', 'Houndour-Houndoom (Dark/Fire — quadrupedal canine with decorative horns; Fire on the card lands element; market accepts as 火狗 fire-dog under R9 despite European hellhound lore)'], []],
    ['earth',    4, 'Stoutland',   '2018 / 2078', ['Lillipup-Herdier-Stoutland (Normal-as-mundane working dog)', 'Hisuian Growlithe-Arcanine (Fire/Rock — Rock-as-Earth cross-flex)', 'Rockruff-Lycanroc (Rock — Wolf Pokémon; Rock=Earth lands element, R9 restores 狼 to Dog row via TPC Year of Dog 2018 Poochyena precedent)'], []],
    ['open',     0, 'open',        '2030 / 2090', [], []],
    ['water',    2, 'Vaporeon',    '2042 / 2102', ['Eevee-Vaporeon (Water — fox-coded eeveelution; R9 restores 狐 to Dog row via TPC Year of Dog 2018 Eevee bundling. Vulpix-Ninetales kept orphan: kitsune is Japanese supernatural cross-cultural)'], []],
    ['agnostic', 2, 'Mightyena',   'animal',      ['Poochyena-Mightyena (pure Dark — TPC\'s explicit Year of the Dog 2018 Pokémon GO mascot, Shiny Poochyena debut. R5 element-orphan structurally — Wuxing has no shadow phase — but R9 animal-fit is publisher-ratified.)'], []],
  ]],
  ['Pig', [
    ['open',     0, 'open',        '1995 / 2055', [], []],
    ['fire',     2, 'Emboar',      '2007 / 2067', ['Tepig-Pignite-Emboar (Fire/Fighting Mega Fire Pig, Unova starter)'], []],
    ['earth',    3, 'Mamoswine',   '2019 / 2079', ['Swinub-Piloswine-Mamoswine (Ice/Ground woolly mammoth)', 'Lechonk-Oinkologne (Normal-as-mundane pastoral pig)'], []],
    ['open',     0, 'open',        '2031 / 2091', [], []],
    ['open',     0, 'open',        '2043 / 2103', [], []],
    ['agnostic', 2, 'Spoink',      'animal',      ['Spoink-Grumpig (pure Psychic — TPC\'s 2019 Year of the Pig Pokémon GO event mascot, Shiny Spoink debut. R5 element-orphan but R9 zodiac aura is the canonical Year-of-Pig pick.)'], []],
  ]],
];

const TRIO_NAMES = {
  swords:  'Swords of Justice — Cobalion · Terrakion · Virizion · Keldeo',
  sims:    'Sim Monkey trio — Simisage · Simisear · Simipour',
};

const ROW_NOTES = [
  'Rat (BROAD) — 鼠 covers any rodent. 松鼠 (squirrel = "pine rat"), 仓鼠 (hamster = "storage rat"), 老鼠 (mouse/rat). Earth Rat is the deepest cluster: Skwovet + Drilbur + Sandshrew (R9-restored — TPC bundled Sandshrew in Year of the Rat 2020 spawn list despite pangolin silhouette).',
  'Ox (BROAD) — 牛 covers all bovines: cattle, water buffalo (水牛), yak (牦牛), wild ox (野牛 — includes 北美野牛, American bison). Bouffalant restored to Earth Ox under R9 market-acceptance test: TPC ran Bouffalant as a Year-of-Ox 2021 Max Raid boss, AAPI community accepted, ratification stands.',
  'Tiger (STRICT) — 虎 means tiger specifically. Unlike 鼠 (any rodent) and 羊 (goat/sheep/ram), the tiger character does not broaden — Chinese has separate characters for lion (狮), leopard (豹), cat (猫). A lion is not a tiger the way a mouse IS a rodent. The dex has Pyroar, Solgaleo, Entei, Suicune (lions), Hisuian Arcanine (lion-tiger), Raikou (saber-tooth) — all big cats, none of them tigers. Row stays fully open: TPC also declined to ship lions for Year of Tiger 2022, so strict rule and R9 agree.',
  'Rabbit (BROAD) — 兔 covers lagomorphs (rabbits + hares, 野兔). Long ears beat digger silhouette; Diggersby and Azumarill pass cleanly.',
  'Dragon — strict reading is loong-only (Chinese serpentine + carp-dragon), but R9 restores Western heraldic dragons and kaiju via TPC merchandising. 2024 Taiwan/HK Year of the Dragon shipped Charizard EX as flagship. Row goes from 2 cells to 5: Wood (Sceptile/Flapple), Fire (Charizard/Reshiram/Turtonator), Earth (Drampa/Tyranitar/Garchomp/Flygon), Metal (Dialga/Duraludon/H-Goodra), Water (Kingdra/Palkia/Gyarados). Findings preserves the cultural-design observation that the dex over-indexes Western dragons.',
  'Snake (STRICT) — 蛇 means legless reptile specifically. Eels are 鳗 (fish radical 魚), not 蛇 — fish in Chinese tradition, not snakes. Arbok stays in Earth Snake via R5 extension (Poison + terrestrial habitat → Earth; cobras are chthonic ground-dwellers). 2025 TPC Year of Snake bundled Gorebyss/Huntail (Water sea-serpents) and Giratina Origin Forme (Ghost/Dragon) — animal-fit accepted under R9 visual coding, but Eelektross stays element-orphan (pure Electric, R5 structural).',
  'Horse (STRICT) — 马 means horse specifically. Donkeys are 驴, separate character; mules are 骡. Year of the Horse celebrates horses, not equines broadly. Zebras additionally orphan via non-Chinese fauna.',
  'Goat (BROAD) — 羊 covers goat / sheep / ram interchangeably. 山羊 (mountain 羊 = goat), 绵羊 (cotton 羊 = sheep). Houndoom moved to Fire Dog — predatory canid silhouette, decorative horns are flourish not anatomy; passes Dog under R9. Stantler-Wyrdeer dropped (deer = 鹿, separate character). Cobalion + Virizion carry the Swords of Justice connection across two cells.',
  'Monkey (BROAD) — 猴 covers any primate. Sun Wukong (美猴王, "Beautiful Monkey King") canon. Sim trio fills Wood / Fire / Water in synchrony.',
  'Rooster (STRICT) — 鸡 means chicken specifically. Other birds have separate characters (鸭 duck, 鹅 goose, 雁 wild goose, 鹰 eagle). The dex\'s avian variety is a structural mismatch with a one-bird zodiac slot. Row almost entirely empty.',
  'Dog — strict 狗 reading is domestic-only with 狼 (wolf), 狐 (fox), 豺 (jackal) separate, BUT R9 restores under TPC Year of Dog 2018 precedent: Pokémon GO event bundled Poochyena (wolf/hyena) + Eevee (fox) + Growlithe + Snubbull + Electrike as Year-of-Dog spawns. Restored: Lycanroc (wolf, Earth Dog), Vaporeon (eeveelution, Water Dog), Houndoom (hellhound, Fire Dog). Mightyena stays R5-orphan (pure Dark, no Wuxing slot). Vulpix-Ninetales stays orphan: kitsune is Japanese 狐仙 sacred-category, AAPI cross-cultural objection blocks R9.',
  'Pig (BROAD) — 猪 covers suids broadly. 野猪 (wild boar = "wild 猪"), 家猪 (domestic pig). Mamoswine line passes via Swinub\'s pig coding; mammoth endpoint accepted as line-as-unit.',
];

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    const futureYears = years === 'animal'
      ? '12-yr cycle'
      : (years.split('/').map(y => y.trim()).filter(y => parseInt(y, 10) >= CURRENT_YEAR).join(' / ') || years.split('/').map(y => y.trim()).pop());
    const yearLabel = futureYears;
    cell.innerHTML = `
      <div class="zn">${anchor}</div>
      ${dotsHTML(depth)}
      <div class="zy">${members.length} ${members.length === 1 ? 'line' : 'lines'} · ${yearLabel}</div>
    `;
    grid.appendChild(cell);
    cellRefs[`${rIdx}-${cIdx}`] = cell;
  });
});

const cells = document.querySelectorAll('.zc');
const headers = document.querySelectorAll('.zh');
const labels = document.querySelectorAll('.zl');

if (REDUCED_MOTION) {
  utils.set(cells, { scale: 1, opacity: 1 });
  utils.set(headers, { y: 0, opacity: 1 });
  utils.set(labels, { x: 0, opacity: 1 });
  utils.set('.dot.on', { scale: 1 });
} else {
  utils.set(cells, { scale: 0, opacity: 0 });
  utils.set(headers, { y: -16, opacity: 0 });
  utils.set(labels, { x: -16, opacity: 0 });

  animate(headers, { y: 0, opacity: 1, duration: 500, delay: stagger(60), ease: 'outQuad' });
  animate(labels, { x: 0, opacity: 1, duration: 500, delay: stagger(50, { start: 200 }), ease: 'outQuad' });
  animate(cells, {
    scale: [0, 1], opacity: [0, 1],
    duration: 600,
    delay: stagger(25, { grid: [6, 12], from: 'center', start: 350 }),
    ease: spring({ mass: 1, stiffness: 120, damping: 12 }),
  });
  animate('.dot.on', {
    scale: [0, 1], duration: 350,
    delay: stagger(40, { start: 1100 }),
    ease: spring({ mass: 0.6, stiffness: 220, damping: 9 }),
  });
}

const titleEl = document.getElementById('title');
const titleText = titleEl.textContent;
titleEl.innerHTML = titleText.split('').map(c =>
  c === ' ' ? '<span class="ch">&nbsp;</span>' : `<span class="ch">${c}</span>`
).join('');
if (!REDUCED_MOTION) {
  animate(titleEl.querySelectorAll('.ch'), {
    y: [-30, 0], opacity: [0, 1],
    duration: 700, delay: stagger(25),
    ease: spring({ mass: 1, stiffness: 100, damping: 10 }),
  });
}

// Now-cell and deep-cell pulse loops both removed — they competed
// with the selection outline and never released. The static
// "You are here" pill at the top conveys present-year cleanly,
// and deep cells already stand out via the four/five lit dots.

const toast = document.getElementById('triotoast');
let toastAnim = null;
function showToast(msg, sticky = false) {
  if (toastAnim) toastAnim.pause();
  toast.textContent = msg;
  if (sticky) {
    utils.set(toast, { opacity: 1 });
    return;
  }
  toastAnim = animate(toast, {
    keyframes: [
      { opacity: 1, duration: 200 },
      { opacity: 1, duration: 1400 },
      { opacity: 0, duration: 400 },
    ],
    ease: 'outQuad',
  });
}
function hideToast() {
  if (toastAnim) toastAnim.pause();
  utils.set(toast, { opacity: 0 });
}

document.querySelectorAll('.zl').forEach((label, idx) => {
  label.addEventListener('mouseenter', () => showToast(ROW_NOTES[idx], true));
  label.addEventListener('mouseleave', () => hideToast());
});

cells.forEach(cell => {
  cell.addEventListener('mouseenter', () => {
    animate(cell, {
      scale: 1.06, duration: 400,
      ease: spring({ mass: 0.8, stiffness: 200, damping: 10 }),
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
      ease: spring({ mass: 0.8, stiffness: 200, damping: 12 }),
    });
    cells.forEach(other => {
      other.classList.remove('trio-hl', 'trio-swords', 'trio-sims');
    });
  });
});

const panel = document.getElementById('panel');
let selected = null;
let panelAnim = null;
let panelLiAnim = null;

function cellSlug(cell) {
  return `${cell.dataset.animal}-${cell.dataset.element}`.toLowerCase().replace(/\s+/g, '-');
}

function showPanel(cell, opts = {}) {
  if (selected && selected !== cell) {
    selected.classList.remove('zc-selected');
    animate(selected, { scale: 1, duration: 250, ease: 'outQuad' });
  }
  selected = cell;
  cell.classList.add('zc-selected');

  if (opts.pushHash !== false) {
    const slug = cellSlug(cell);
    if (location.hash.replace('#', '') !== slug) {
      history.replaceState(null, '', `#${slug}`);
    }
  }

  animate(cell, {
    keyframes: [
      { scale: 0.92, duration: 100 },
      { scale: 1.08, duration: 200, ease: spring({ stiffness: 300, damping: 8 }) },
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

  const yearsLine = cell.dataset.years === 'animal'
    ? `<div class="pyears">Aura column · 12-year cycle (every Year of the ${cell.dataset.animal}, regardless of element). Off the 60-year Wuxing grid.</div>`
    : `<div class="pyears">Year cycle: ${cell.dataset.years}</div>`;

  panel.classList.remove('empty');
  panel.innerHTML = `
    <div class="ptitle">${cell.dataset.title}</div>
    ${yearsLine}
    <div class="pdepth">Cluster depth ${dotsHTML(depth)} <span class="pcount">(${members.length} ${members.length === 1 ? 'line' : 'lines'})</span></div>
    ${memberHTML}
    ${trioHTML}
  `;

  utils.set(panel, { opacity: 0, y: 20 });

  panelAnim = animate(panel, {
    opacity: 1, y: 0,
    duration: 450,
    ease: spring({ mass: 1, stiffness: 150, damping: 14 }),
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
  history.replaceState(null, '', `#${year}`);

  cell.scrollIntoView({ behavior: 'smooth', block: 'center' });
  animate(cell, {
    keyframes: [
      { scale: 1.15, duration: 250, ease: spring({ stiffness: 200, damping: 8 }) },
      { scale: 1.0,  duration: 350 },
    ],
  });
  setTimeout(() => showPanel(cell, { pushHash: false }), 400);
}

yrBtn.addEventListener('click', runLookup);
yrInput.addEventListener('keydown', e => { if (e.key === 'Enter') runLookup(); });

// --- Hash deeplinks ---
function findCellBySlug(slug) {
  for (const cell of cells) {
    if (cellSlug(cell) === slug) return cell;
  }
  return null;
}

function applyHash() {
  const raw = location.hash.replace('#', '').trim();
  if (!raw) return;
  if (/^\d{4}$/.test(raw)) {
    yrInput.value = raw;
    runLookup();
    return;
  }
  const cell = findCellBySlug(raw.toLowerCase());
  if (cell) {
    cell.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => showPanel(cell, { pushHash: false }), 200);
  }
}

window.addEventListener('hashchange', applyHash);

// Wait for entrance animation to settle before honoring an inbound hash.
const initialDelay = REDUCED_MOTION ? 0 : 1100;
setTimeout(applyHash, initialDelay);

// --- Case-file inline markdown reader ---
// CSP forbids remote scripts (script-src 'self'), so this is a minimal hand-rolled
// renderer for the subset of markdown the case files actually use:
// h1/h2/h3, **bold**, *italic*, `code`, [link](url), unordered lists,
// horizontal rules, GitHub-flavored tables, paragraphs, blockquotes.

function escapeHTML(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderInline(text) {
  // Order matters: code first (locks raw), then links, then bold/italic.
  const codes = [];
  text = text.replace(/`([^`]+)`/g, (_, c) => {
    codes.push(c);
    return `\u0001CODE${codes.length - 1}\u0001`;
  });
  text = escapeHTML(text);
  text = text.replace(/\[([^\]]+)\]\(((?:[^()]|\([^()]*\))+)\)/g, (_, label, url) => {
    const safeUrl = url.replace(/"/g, '&quot;');
    return `<a href="${safeUrl}" target="_blank" rel="noopener">${label}</a>`;
  });
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  text = text.replace(/\u0001CODE(\d+)\u0001/g, (_, i) =>
    `<code>${escapeHTML(codes[parseInt(i, 10)])}</code>`);
  return text;
}

function renderMarkdown(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Skip blank lines.
    if (/^\s*$/.test(line)) { i++; continue; }

    // Horizontal rule.
    if (/^---+\s*$/.test(line)) { out.push('<hr>'); i++; continue; }

    // Headings.
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      out.push(`<h${level}>${renderInline(h[2])}</h${level}>`);
      i++;
      continue;
    }

    // Tables (GFM): a header line containing | followed by a separator |---|---|.
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]+\s*$/.test(lines[i + 1])) {
      const splitRow = (row) => row.replace(/^\s*\||\|\s*$/g, '').split('|').map(c => c.trim());
      const headers = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push(splitRow(lines[i]));
        i++;
      }
      const thead = `<thead><tr>${headers.map(h => `<th>${renderInline(h)}</th>`).join('')}</tr></thead>`;
      const tbody = `<tbody>${rows.map(r =>
        `<tr>${r.map(c => `<td>${renderInline(c)}</td>`).join('')}</tr>`
      ).join('')}</tbody>`;
      out.push(`<table>${thead}${tbody}</table>`);
      continue;
    }

    // Unordered list.
    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ''));
        i++;
      }
      out.push(`<ul>${items.map(it => `<li>${renderInline(it)}</li>`).join('')}</ul>`);
      continue;
    }

    // Ordered list.
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''));
        i++;
      }
      out.push(`<ol>${items.map(it => `<li>${renderInline(it)}</li>`).join('')}</ol>`);
      continue;
    }

    // Blockquote.
    if (/^>\s?/.test(line)) {
      const items = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        items.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      out.push(`<blockquote>${renderInline(items.join(' '))}</blockquote>`);
      continue;
    }

    // Paragraph — gather until blank line or block-start.
    const para = [line];
    i++;
    while (i < lines.length
        && !/^\s*$/.test(lines[i])
        && !/^#{1,6}\s+/.test(lines[i])
        && !/^[-*]\s+/.test(lines[i])
        && !/^\d+\.\s+/.test(lines[i])
        && !/^>\s?/.test(lines[i])
        && !/^---+\s*$/.test(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    out.push(`<p>${renderInline(para.join(' '))}</p>`);
  }
  return out.join('\n');
}

const caseToggles = document.querySelectorAll('.case-toggle');
const casePanel = document.getElementById('case-panel');
const caseTitle = document.getElementById('case-title');
const caseBody = document.getElementById('case-body');
const caseClose = document.getElementById('case-close');
const caseCache = {};
let activeCaseToggle = null;
let activeSlug = null;

async function loadCase(slug, label) {
  caseToggles.forEach(t => t.classList.remove('active'));
  const trigger = Array.from(caseToggles).find(t => t.dataset.case === slug);
  if (trigger) {
    trigger.classList.add('active');
    activeCaseToggle = trigger;
  }
  activeSlug = slug;
  casePanel.hidden = false;
  caseTitle.textContent = label;
  caseBody.innerHTML = '<p class="case-loading">Loading…</p>';
  casePanel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (caseCache[slug]) {
    caseBody.innerHTML = caseCache[slug];
    return;
  }
  try {
    const res = await fetch(`../md/${slug}.md`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const md = await res.text();
    const html = renderMarkdown(md);
    caseCache[slug] = html;
    if (activeSlug === slug) caseBody.innerHTML = html;
  } catch (err) {
    if (activeSlug === slug) {
      caseBody.innerHTML = `<p class="case-error">Couldn't load <code>${slug}.md</code> — ${escapeHTML(err.message)}. Try opening the file directly: <a href="../md/${slug}.md" target="_blank" rel="noopener">${slug}.md</a></p>`;
    }
  }
}

caseToggles.forEach(btn => {
  btn.addEventListener('click', () => {
    const slug = btn.dataset.case;
    loadCase(slug, btn.textContent.trim());
  });
});

caseClose.addEventListener('click', () => {
  casePanel.hidden = true;
  caseToggles.forEach(t => t.classList.remove('active'));
  activeCaseToggle = null;
  activeSlug = null;
});
