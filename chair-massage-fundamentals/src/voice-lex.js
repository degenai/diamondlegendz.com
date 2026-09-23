// Voice lexicon for voice.js: the phoneme table, the letter-to-phoneme rules, the exception
// dictionary for the game's own words, and the tokenizer. Pure data and functions (runs in node).

// Phoneme table: [kind, F1, F2, F3, band gains (F1..F3), voicing, noise]. Vowels: Peterson & Barney male means.
export const VG = [1, 0.75, 0.45];
const V = (f1, f2, f3) => ['vowel', f1, f2, f3, VG, 1, 0];
const D = (a, b) => ['diph', ...a, VG, 1, 0, b];
export const PH = {
  IY: V(270, 2290, 3010), IH: V(390, 1990, 2550), EH: V(530, 1840, 2480), AE: V(660, 1720, 2410),
  AH: V(520, 1190, 2390), AA: V(730, 1090, 2440), AO: V(570, 840, 2410), UH: V(440, 1020, 2240),
  UW: V(300, 870, 2240), ER: V(490, 1350, 1690),
  EY: D([530, 1840, 2480], [280, 2250, 2950]), AY: D([730, 1090, 2440], [300, 2150, 2800]),
  OY: D([570, 840, 2410], [300, 2150, 2800]), AW: D([730, 1090, 2440], [320, 870, 2240]),
  OW: D([570, 840, 2410], [310, 870, 2240]), // off-glides go all the way to IY / UW
  // Stops: formant loci (the vowel glides out of them); the burst colour comes from PLACE below.
  P: ['stop', 400, 900, 2200, VG, 0, 1], B: ['stop', 400, 900, 2200, VG, 1, 1],
  T: ['stop', 400, 1800, 2700, VG, 0, 1], D: ['stop', 400, 1800, 2700, VG, 1, 1],
  K: ['stop', 400, 2000, 2400, VG, 0, 1], G: ['stop', 400, 2000, 2400, VG, 1, 1],
  CH: ['aff', 400, 1900, 2600, VG, 0, 1], JH: ['aff', 400, 1900, 2600, VG, 1, 1],
  F: ['fric', 400, 1400, 2400, [0.6, 0.3, 0.2], 0, 1], V: ['fric', 400, 1400, 2400, [0.6, 0.3, 0.2], 0.45, 0.6],
  TH: ['fric', 400, 1500, 2500, [0.6, 0.3, 0.2], 0, 1], DH: ['fric', 400, 1500, 2500, [0.6, 0.3, 0.2], 0.45, 0.6],
  S: ['fric', 400, 1700, 2600, [0.6, 0.3, 0.2], 0, 1], Z: ['fric', 400, 1700, 2600, [0.6, 0.3, 0.2], 0.4, 0.7],
  SH: ['fric', 400, 1900, 2600, [0.6, 0.3, 0.2], 0, 1], ZH: ['fric', 400, 1900, 2600, [0.6, 0.3, 0.2], 0.4, 0.7],
  HH: ['aspir', 0, 0, 0, VG, 0.06, 1], // formants borrowed from the next vowel
  M: ['nasal', 250, 1100, 2100, [1, 0.12, 0.06], 0.75, 0], N: ['nasal', 250, 1700, 2600, [1, 0.12, 0.06], 0.75, 0],
  NG: ['nasal', 250, 2300, 2750, [1, 0.12, 0.06], 0.75, 0],
  L: ['liquid', 360, 1050, 2880, [1, 0.5, 0.3], 0.85, 0], R: ['liquid', 310, 1060, 1380, [1, 0.7, 0.4], 0.85, 0],
  W: ['liquid', 290, 610, 2150, [1, 0.5, 0.3], 0.85, 0], Y: ['liquid', 260, 2070, 3020, [1, 0.6, 0.4], 0.85, 0],
};
export const PHONEMES = Object.keys(PH);
// Noise colour per consonant: which filter in the noise bank carries its burst or frication.
export const PLACE = { P: 'lab', B: 'lab', T: 'alv', D: 'alv', K: 'vel', G: 'vel', CH: 'sh', JH: 'sh', S: 's', Z: 's', SH: 'sh', ZH: 'sh', F: 'f', V: 'f', TH: 'f', DH: 'f' };
export const ANTI = { M: 1000, N: 1700, NG: 2800 }; // nasal anti-resonance (notch) frequency
export const DUR = { vowel: 100, diph: 130, stop: 75, aff: 100, fric: 95, aspir: 65, nasal: 65, liquid: 60 };
const FUNC = new Set('the a an of to and is in at for it on by as be or but was are i my me we he she you your'.split(' '));

// Exception dictionary: the game's own words plus words the rules get wrong (checked against every line the game speaks).
const DICT = {
  massage: 'M AH S AA ZH', serenity: 'S AH R EH N IH T IY', incorporated: 'IH N K AO R P ER EY T IH D',
  licensee: 'L AY S AH N S IY', fundamentals: 'F AH N D AH M EH N T AH L Z', woodstock: 'W UH D S T AA K',
  permit: 'P ER M IH T', brand: 'B R AE N D', chair: 'CH EH R', plaza: 'P L AA Z AH',
  adamczyk: 'AE D AH M CH IH K', lmt: 'EH L EH M T IY', the: 'DH AH', a: 'AH', of: 'AH V', to: 'T UW',
  you: 'Y UW', your: 'Y AO R', "you're": 'Y UH R', "we'd": 'W IY D', they: 'DH EY', them: 'DH EH M',
  this: 'DH IH S', that: 'DH AE T', there: 'DH EH R', then: 'DH EH N', with: 'W IH TH', have: 'HH AE V',
  do: 'D UW', "don't": 'D OW N T', word: 'W ER D', one: 'W AH N', two: 'T UW', sir: 'S ER', group: 'G R UW P',
  are: 'AA R', is: 'IH Z', was: 'W AH Z', what: 'W AH T', i: 'AY', operating: 'AA P ER EY T IH NG',
  without: 'W IH TH AW T', certifies: 'S ER T IH F AY Z', module: 'M AA JH UW L', pressure: 'P R EH SH ER',
  escaped: 'IH S K EY P T', escape: 'IH S K EY P', about: 'AH B AW T', people: 'P IY P AH L', elbow: 'EH L B OW',
  client: 'K L AY AH N T', give: 'G IH V', get: 'G EH T', says: 'S EH Z', said: 'S EH D', been: 'B IH N',
  any: 'EH N IY', many: 'M EH N IY',
  // Second pass, from the game's lines.
  actually: 'AE K CH UW AH L IY', again: 'AH G EH N', ahh: 'AA', alex: 'AE L AH K S', along: 'AH L AO NG',
  already: 'AO L R EH D IY', anything: 'EH N IY TH IH NG', anyway: 'EH N IY W EY', arrested: 'AH R EH S T IH D',
  barrel: 'B AE R AH L', because: 'B IH K AH Z', bigger: 'B IH G ER', booking: 'B UH K IH NG', brought: 'B R AO T',
  calves: 'K AE V Z', change: 'CH EY N JH', cooked: 'K UH K T', could: 'K UH D', should: 'SH UH D', would: 'W UH D',
  course: 'K AO R S', cursor: 'K ER S ER', dana: 'D EY N AH', "didn't": 'D IH D AH N T', does: 'D AH Z',
  dollar: 'D AA L ER', done: 'D AH N', double: 'D AH B AH L', earned: 'ER N D', eh: 'EH', eleven: 'IH L EH V AH N',
  every: 'EH V R IY', fiber: 'F AY B ER', figured: 'F IH G Y ER D', fixed: 'F IH K S T', forearm: 'F AO R AA R M',
  fountain: 'F AW N T AH N', four: 'F AO R', from: 'F R AH M', ga: 'JH AO R JH AH', aka: 'EY K EY EY',
  geese: 'G IY S', gift: 'G IH F T', head: 'HH EH D', heard: 'HH ER D', hinge: 'HH IH N JH', hoa: 'EY CH OW EY',
  how: 'HH AW', now: 'N AW', wow: 'W AW', ow: 'AW', hundred: 'HH AH N D R IH D', jogger: 'JH AA G ER', key: 'K IY',
  laugh: 'L AE F', later: 'L EY T ER', lose: 'L UW Z', maybe: 'M EY B IY', minutes: 'M IH N AH T S', mind: 'M AY N D',
  modality: 'M OW D AE L AH T IY', move: 'M UW V', neighborhood: 'N EY B ER HH UH D', ninety: 'N AY N T IY',
  nobody: 'N OW B AA D IY', nothing: 'N AH TH IH NG', oh: 'OW', okay: 'OW K EY', once: 'W AH N S', only: 'OW N L IY',
  opinions: 'AH P IH N Y AH N Z', over: 'OW V ER', overworked: 'OW V ER W ER K T', pigeons: 'P IH JH AH N Z',
  polo: 'P OW L OW', problem: 'P R AA B L AH M', push: 'P UH SH', put: 'P UH T', regular: 'R EH G Y AH L ER',
  return: 'R IH T ER N', shoes: 'SH UW Z', sign: 'S AY N', single: 'S IH NG G AH L', some: 'S AH M',
  somebody: 'S AH M B AA D IY', swedish: 'S W IY D IH SH', terrible: 'T EH R AH B AH L', therapist: 'TH EH R AH P IH S T',
  today: 'T AH D EY', told: 'T OW L D', tennis: 'T EH N AH S', unlicensed: 'AH N L AY S AH N S T', vendor: 'V EH N D ER',
  walt: 'W AO L T', want: 'W AA N T', were: 'W ER', where: 'W EH R', who: 'HH UW', whole: 'HH OW L',
  use: 'Y UW Z', trigger: 'T R IH G ER', marcus: 'M AA R K AH S', honestly: 'AA N AH S T L IY', off: 'AO F',
  she: 'SH IY', coffee: 'K AO F IY', whoa: 'W OW', cross: 'K R AO S', long: 'L AO NG', longer: 'L AO NG G ER', ball: 'B AO L', car: 'K AA R',
};
// Stressed vowel (0-based vowel index) for words whose stress is not on the first vowel.
const STRESS = {
  serenity: 1, incorporated: 1, about: 1, licensee: 2, fundamentals: 2, massage: 1, again: 1, arrested: 1,
  escaped: 1, escape: 1, today: 1, without: 1, unlicensed: 1, return: 1, eleven: 1, along: 1, because: 1,
  opinions: 1, modality: 1, already: 1, administration: 3,
};
const LETTERS = 'EY,B IY,S IY,D IY,IY,EH F,JH IY,EY CH,AY,JH EY,K EY,EH L,EH M,EH N,OW,P IY,K Y UW,AA R,EH S,T IY,Y UW,V IY,D AH B AH L Y UW,EH K S,W AY,Z IY'.split(',');
const DIGITS = 'zero,one,two,three,four,five,six,seven,eight,nine'.split(',');
const VOW = 'aeiouy';
const isV = (c) => !!c && VOW.includes(c);
const isC = (c) => !!c && /[a-z]/.test(c) && !isV(c);
const LONG = { a: 'EY', e: 'IY', i: 'AY', o: 'OW', u: 'UW' };
const SHORT = { a: 'AE', e: 'EH', i: 'IH', o: 'AA', u: 'AH' };
const PAIRS = { ee: 'IY', ea: 'IY', oo: 'UW', ou: 'AW', ai: 'EY', ay: 'EY', oi: 'OY', oy: 'OY', au: 'AO', aw: 'AO', ew: 'UW', ei: 'EY', ey: 'EY', oa: 'OW' };
const DIGRAPHS = { th: 'TH', sh: 'SH', ch: 'CH', ng: 'NG', ph: 'F', wh: 'W', ck: 'K', qu: 'K W', gh: '', dg: 'JH' };
const SINGLE = { b: 'B', d: 'D', f: 'F', h: 'HH', j: 'JH', k: 'K', l: 'L', m: 'M', n: 'N', p: 'P', r: 'R', t: 'T', v: 'V', w: 'W', x: 'K S', z: 'Z' };

// -s ending (plural, possessive, 's contraction) voiced by the sound before it.
function addS(ph) {
  const last = ph[ph.length - 1];
  if (['S', 'Z', 'SH', 'ZH', 'CH', 'JH'].includes(last)) return [...ph, 'IH', 'Z'];
  return [...ph, ['P', 'T', 'K', 'F', 'TH'].includes(last) ? 'S' : 'Z'];
}

// Letter-to-phoneme rules for one lowercase word.
export function wordToPhones(word) {
  if (DICT[word]) return DICT[word].split(' ');
  if (word.endsWith("'s")) return addS(wordToPhones(word.slice(0, -2)));
  let w = word.replace(/'/g, '');
  if (DICT[w]) return DICT[w].split(' ');
  if (w.length >= 4 && w.endsWith('s') && !/(ss|us|is)$/.test(w)) { // plurals and 3rd person
    if (DICT[w.slice(0, -1)]) return addS(DICT[w.slice(0, -1)].split(' '));
    if (/(sh|ch|x|z|ss)es$/.test(w)) return addS(wordToPhones(w.slice(0, -2)));
    return addS(wordToPhones(w.slice(0, -1)));
  }
  let suffix = [];
  if (w.length > 4 && w.endsWith('ed') && !isV(w[w.length - 3])) { // past tense
    let stem = w.slice(0, -2);
    const last = stem[stem.length - 1];
    suffix = 'td'.includes(last) ? ['IH', 'D'] : 'pkfsx'.includes(last) || stem.endsWith('sh') || stem.endsWith('ch') ? ['T'] : ['D'];
    if (last === stem[stem.length - 2] && !'sl'.includes(last)) stem = stem.slice(0, -1);
    else if (isV(stem[stem.length - 2]) && !isV(stem[stem.length - 3])) stem += 'e';
    if (DICT[stem]) return DICT[stem].split(' ').concat(suffix);
    w = stem;
  }
  const out = [];
  const push = (s) => { if (s) out.push(...s.split(' ')); };
  for (let i = 0; i < w.length;) {
    const c = w[i], n = w[i + 1], n2 = w[i + 2], p = w[i - 1], end = i === w.length - 1;
    const two = w.slice(i, i + 2), three = w.slice(i, i + 3), four = w.slice(i, i + 4);
    if (four === 'tion') { push('SH AH N'); i += 4; continue; }
    if (four === 'sion') { push('ZH AH N'); i += 4; continue; }
    if (four === 'ture') { push('CH ER'); i += 4; continue; }
    if (four === 'ough' && w[i + 4] === 't') { push('AO'); i += 4; continue; } // thought, bought
    if (c === 'a' && w.slice(i + 1, i + 5) === 'tion') { push('EY'); i += 1; continue; } // -ation
    if (three === 'tch') { push('CH'); i += 3; continue; }
    if (three === 'igh') { push('AY'); i += 3; continue; }
    if (three === 'all') { push('AO L'); i += 3; continue; }
    if (three === 'wor') { push('W ER'); i += 3; continue; } // work, worth, word
    if (i === 0 && (two === 'kn' || two === 'wr')) { push(two === 'kn' ? 'N' : 'R'); i += 2; continue; }
    if (two === 'gu' && isV(n2)) { push('G'); i += 2; continue; } // guess, guide, guy
    if (DIGRAPHS[two] !== undefined) { push(DIGRAPHS[two]); i += 2; continue; }
    if (two === 'ow') { push(i + 2 >= w.length ? 'OW' : 'AW'); i += 2; continue; }
    if (two === 'oo' && n2 === 'k') { push('UH'); i += 2; continue; } // look, book, took
    if (PAIRS[two]) { push(PAIRS[two]); i += 2; continue; }
    if (two === 'ar') { push('AA R'); i += 2; continue; }
    if (two === 'or') { push('AO R'); i += 2; continue; }
    if ((two === 'er' || two === 'ir' || two === 'ur') && !isV(n2)) { push('ER'); i += 2; continue; }
    if (isC(c) && c === n) { i += 1; continue; } // doubled consonant: say it once
    if (c === 'l' && n === 'e' && i + 2 === w.length && isC(p)) { push('AH L'); i += 2; continue; }
    if (c === 'e' && end && w.length > 2) { i += 1; continue; } // silent final e
    if (c === 'y') { push(i === 0 ? 'Y' : !end ? 'IH' : w.length <= 3 ? 'AY' : 'IY'); i += 1; continue; }
    if (LONG[c]) {
      const magic = isC(n) && n2 === 'e' && (i + 3 === w.length || (i + 4 === w.length && 'sd'.includes(w[i + 3])));
      const open = end && w.length <= 3; // go, no, he, we
      push(magic || open ? LONG[c] : SHORT[c]); i += 1; continue;
    }
    if (c === 'c') { push('eiy'.includes(n) && n ? 'S' : 'K'); i += 1; continue; }
    if (c === 'g') { push('eiy'.includes(n) && n && p !== 'g' ? 'JH' : 'G'); i += 1; continue; }
    if (c === 's') { push((end && (isV(p) || /[bdglmnrvw]/.test(p || ''))) || (isV(p) && isV(n)) ? 'Z' : 'S'); i += 1; continue; }
    if (c === 'q') { push('K'); i += 1; continue; }
    push(SINGLE[c] || ''); i += 1;
  }
  return out.concat(suffix);
}

// Text -> tokens: words (as phone lists), and pauses. "[AA IY]" passes phonemes through literally.
export function tokenize(text) {
  const toks = [];
  const lit = /^\s*\[([A-Z ]+)\]\s*$/.exec(text);
  if (lit) return [{ phones: lit[1].trim().split(/\s+/) }];
  const src = text.replace(/\ba\.k\.a\./gi, 'aka');
  const re = /([A-Za-z']+)|(\d)|([,;:]+)|([.!?]+)/g;
  let m;
  while ((m = re.exec(src))) {
    if (m[1]) {
      const lead = m[1].length - m[1].replace(/^'+/, '').length;
      const raw = m[1].replace(/^'+|'+$/g, '');
      if (!raw) continue;
      const lw = raw.toLowerCase(), at = m.index + lead;
      const slash = src[at + raw.length] === '/' || src[at - 1] === '/';
      const spell = raw === raw.toUpperCase() && !DICT[lw] && ( // initialisms and key names: W/S, A/D, E
        (raw.length === 1 && (!'AI'.includes(raw) || slash)) || (raw.length > 1 && raw.length <= 4 && !/[AEIOU]/.test(raw)));
      toks.push({ phones: spell ? [...raw].flatMap((ch) => LETTERS[ch.charCodeAt(0) - 65].split(' ')) : wordToPhones(lw), func: FUNC.has(lw), stress: spell ? 0 : STRESS[lw] || 0 });
    } else if (m[2]) toks.push({ phones: wordToPhones(DIGITS[+m[2]]) });
    else if (m[3]) toks.push({ pause: 150 });
    else toks.push({ pause: 300, end: m[4][m[4].length - 1] });
  }
  return toks;
}
