// Formant robot voice: text -> phonemes -> glottal pulse + noise through four bandpass formants,
// plus a place-shaped noise bank for bursts and fricatives and a notch for nasals.
// planUtterance is pure (runs in node); createVoice schedules everything with AudioParam automation.
// Tuning brief (2026-09-23, "too muddy"): consonants cut, words have gaps, still a crunchy 80s chip.
// Pass 3 ("one notch clearer"): ~6% slower, consonants +2 dB, F1/F2 Q 13, diphthongs land on target,
// lexical stress for long words, gentler sentence-final fall, released word-final stops.

// Phoneme table: [kind, F1, F2, F3, band gains (F1..F3), voicing, noise]. Vowels: Peterson & Barney male means.
const VG = [1, 0.75, 0.45];
const V = (f1, f2, f3) => ['vowel', f1, f2, f3, VG, 1, 0];
const D = (a, b) => ['diph', ...a, VG, 1, 0, b];
const PH = {
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
const PLACE = { P: 'lab', B: 'lab', T: 'alv', D: 'alv', K: 'vel', G: 'vel', CH: 'sh', JH: 'sh', S: 's', Z: 's', SH: 'sh', ZH: 'sh', F: 'f', V: 'f', TH: 'f', DH: 'f' };
const ANTI = { M: 1000, N: 1700, NG: 2800 }; // nasal anti-resonance (notch) frequency
const DUR = { vowel: 100, diph: 130, stop: 75, aff: 100, fric: 95, aspir: 65, nasal: 65, liquid: 60 };
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
function tokenize(text) {
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

export const PRESETS = {
  narrator: { f0: 110, rate: 1, q: 13 },
  goon: { f0: 72, rate: 0.85, q: 13 },   // low and slow, same formant sharpness as the narrator
  ranger: { f0: 150, rate: 1.1, q: 13 },
  client: { f0: 150, rate: 1.1, q: 13 },
};
// q sharpens F1/F2 only; F3 keeps its old Q 11 (scaled), F4 is fixed at 8.
const Q3 = 11 / 13;
const WORD_GAP = 0.055;
const FINAL_TAIL = 0.06; // extra hold on a sentence's last sonorant so the final word is not clipped

function hashRng(str) { // deterministic jitter so planUtterance stays pure
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}

const VOWELISH = (p) => !!p && (p.kind === 'vowel' || p.kind === 'diph');

export function planUtterance(text, preset = 'narrator') {
  const pr = typeof preset === 'string' ? PRESETS[preset] || PRESETS.narrator : { ...PRESETS.narrator, ...preset };
  const rnd = hashRng(String(text));
  const phones = [];
  const sil = (ms) => ({ ph: '_', dur: ms / 1000, f0: pr.f0, f1: 0, f2: 0, f3: 0, kind: 'sil', av: 0, an: 0, g: [0, 0, 0], q: pr.q });
  let sentenceStart = 0;
  const closeSentence = (end) => {
    const seg = phones.slice(sentenceStart).filter((p) => p.kind !== 'sil');
    seg.forEach((p, k) => { p.f0 *= 1 - 0.05 * (seg.length > 1 ? k / (seg.length - 1) : 0); }); // fall capped near 10%
    const voiced = seg.filter((p) => p.av > 0).slice(-3);
    voiced.forEach((p, k) => { p.f0 *= end === '?' ? 1.1 + 0.12 * k : 0.99 - 0.02 * k; });
    sentenceStart = phones.length;
  };
  const toks = tokenize(text);
  toks.forEach((t, ti) => {
    if (t.pause) {
      phones.push(sil(t.pause));
      if (t.end) closeSentence(t.end);
      return;
    }
    const first = phones.length;
    for (const ph of t.phones) {
      const e = PH[ph];
      if (!e) { phones.push({ ...sil(0), ph, unknown: true }); continue; }
      const [kind, f1, f2, f3, g, av, an, to] = e;
      phones.push({ ph, dur: DUR[kind] / 1000 / pr.rate, f0: pr.f0 * (1 + (rnd() - 0.5) * 0.01), f1, f2, f3, kind, av, an, g, q: pr.q, ...(to ? { to } : {}), ...(PLACE[ph] ? { place: PLACE[ph] } : {}) });
    }
    // Crude stress: function words short, the stressed vowel longer, phrase-final vowel longest.
    const word = phones.slice(first), vows = word.filter(VOWELISH);
    if (t.func) vows.forEach((p) => { p.dur *= 0.85; });
    else if (vows.length) vows[Math.min(t.stress || 0, vows.length - 1)].dur *= 1.2;
    const nx = toks[ti + 1];
    if (vows.length && (!nx || nx.pause)) vows[vows.length - 1].dur *= 1.2;
    if (!nx || (nx.pause && nx.end)) { // sentence-final word: hold its last sonorant a little
      const son = word.filter((p) => VOWELISH(p) || p.kind === 'liquid' || p.kind === 'nasal').pop();
      if (son) son.dur += FINAL_TAIL;
    }
    if (nx && nx.phones) phones.push(sil(WORD_GAP * 1000));
  });
  closeSentence('.');
  while (phones.length && phones[phones.length - 1].kind === 'sil') phones.pop();
  for (let i = 0; i < phones.length; i++) {
    const p = phones[i], nx = phones[i + 1];
    if (p.kind === 'aspir') { // HH takes the formants of the next vowel
      const v = phones.slice(i + 1).find(VOWELISH) || { f1: 500, f2: 1500, f3: 2500 };
      Object.assign(p, { f1: v.f1, f2: v.f2, f3: v.f3 });
    }
    if (p.kind === 'stop') { // release into the next vowel or glide: aspirated if voiceless
      const opens = VOWELISH(nx) || (!!nx && nx.kind === 'liquid');
      p.asp = p.av === 0 && opens;
      p.release = opens ? [nx.f1, nx.f2, nx.f3] : null;
    }
  }
  let t = 0;
  for (const p of phones) { p.t = t; t += p.dur; }
  return { phones, duration: t, q: pr.q, unknown: phones.filter((p) => p.unknown).map((p) => p.ph) };
}

let noiseBuf = null;
function noiseBuffer(ctx) {
  if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf;
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

// Glottal source: a flat-spectrum pulse train (all harmonics equal), tilted by a one-pole lowpass at ~1 kHz.
const pulseWaves = new WeakMap();
function pulseWave(ctx) {
  if (pulseWaves.has(ctx)) return pulseWaves.get(ctx);
  const N = 80, re = new Float32Array(N), im = new Float32Array(N);
  for (let k = 1; k < N; k++) im[k] = 1;
  const w = ctx.createPeriodicWave(re, im);
  pulseWaves.set(ctx, w);
  return w;
}

// Noise bank: [type, frequency, Q, level]. Bursts and fricatives are shaped by place, not by the formants.
const BANK = {
  s: ['bandpass', 6000, 3.5, 0.48],    // S Z: high, narrow hiss
  sh: ['bandpass', 3000, 3, 0.38],     // SH ZH CH JH
  f: ['bandpass', 2200, 0.6, 0.18],    // F V TH DH: broad 1-4 kHz
  alv: ['bandpass', 4000, 1.6, 1.0],   // T D burst
  vel: ['bandpass', 2000, 2.5, 0.88],  // K G burst
  lab: ['lowpass', 800, 0.7, 0.5],     // P B burst
}; // levels are +2 dB over pass 2

export function createVoice(ctx, { destination = ctx.destination } = {}) {
  const output = ctx.createGain();
  output.connect(destination);
  let cur = null;

  function stop() {
    if (!cur) return;
    const { out, srcs } = cur, now = ctx.currentTime;
    out.gain.cancelScheduledValues(now);
    out.gain.setTargetAtTime(0, now, 0.01);
    for (const s of srcs) { try { s.stop(now + 0.06); } catch (e) { /* already stopped */ } }
    cur = null;
  }

  function speak(text, preset = 'narrator') {
    stop();
    const plan = planUtterance(text, preset);
    if (!plan.phones.length) return { duration: 0 };
    // A suspended context (first line after load) gets resumed and a longer lead-in, so the output
    // device's wake-up does not eat the first word.
    const cold = ctx.state === 'suspended' && !ctx.startRendering; // offline renders start suspended by design
    if (cold && ctx.resume) ctx.resume().catch(() => {});
    const t0 = ctx.currentTime + (cold ? 0.25 : 0.05), end = t0 + plan.duration;
    const osc = ctx.createOscillator(); osc.setPeriodicWave(pulseWave(ctx));
    const a = Math.exp(-2 * Math.PI * 1000 / ctx.sampleRate);
    const tilt = ctx.createIIRFilter([1 - a], [1, -a]);
    const vib = ctx.createOscillator(); vib.frequency.value = 5.3;
    const vibDepth = ctx.createGain(); vibDepth.gain.value = 9; // cents
    vib.connect(vibDepth); vibDepth.connect(osc.detune);
    const noise = ctx.createBufferSource(); noise.buffer = noiseBuffer(ctx); noise.loop = true;
    const vg = ctx.createGain(), ng = ctx.createGain(), mix = ctx.createGain();
    vg.gain.value = 0; ng.gain.value = 0; mix.gain.value = 1.3;
    const notch = ctx.createBiquadFilter(); notch.type = 'notch'; notch.frequency.value = 18000; notch.Q.value = 3;
    osc.connect(tilt); tilt.connect(vg); vg.connect(notch); noise.connect(ng);
    const bands = [0, 1, 2, 3].map((i) => {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
      if (i === 3) { bp.frequency.value = 3300; bp.Q.value = 8; }
      const bg = ctx.createGain(); bg.gain.value = 0;
      notch.connect(bp); ng.connect(bp); bp.connect(bg); bg.connect(mix);
      return { bp, bg };
    });
    const bank = {};
    for (const [k, [type, f, Q, lvl]] of Object.entries(BANK)) {
      const flt = ctx.createBiquadFilter(); flt.type = type; flt.frequency.value = f; flt.Q.value = Q;
      const g = ctx.createGain(); g.gain.value = 0;
      noise.connect(flt); flt.connect(g); g.connect(mix);
      bank[k] = { g: g.gain, lvl };
    }
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000; lp.Q.value = 0.5;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 4; comp.attack.value = 0.002; comp.release.value = 0.08;
    const out = ctx.createGain(); out.gain.value = 0.75;
    mix.connect(lp); lp.connect(comp); comp.connect(out); out.connect(output);

    const G = 0.02; // formant glide
    const VOICE = 6; // pulse train level (a normalised pulse train is far quieter than a sawtooth)
    const F3 = bands.slice(0, 3);
    let prevF = null;
    const setGains = (g, g4, t) => bands.forEach(({ bg }, i) => bg.gain.setTargetAtTime(i < 3 ? g[i] : g4, t, 0.005));
    const setQ = (q, t) => F3.forEach(({ bp }, i) => bp.Q.setValueAtTime(i < 2 ? q : q * Q3, t));
    const gate = (k, t, len, lvl = 1) => { // noise-bank gate: sharp on, hold, sharp off
      const p = bank[k].g;
      p.setTargetAtTime(bank[k].lvl * lvl, t, 0.002); p.setTargetAtTime(0, t + len, 0.004);
    };
    osc.frequency.setValueAtTime(plan.phones[0].f0, t0);
    for (const p of plan.phones) {
      const t = t0 + p.t;
      notch.frequency.setValueAtTime(ANTI[p.ph] || 18000, t);
      if (p.kind === 'sil') {
        vg.gain.setTargetAtTime(0, t, 0.006); ng.gain.setTargetAtTime(0, t, 0.006);
        continue;
      }
      osc.frequency.linearRampToValueAtTime(p.f0, t + p.dur * 0.5);
      const F = [p.f1, p.f2, p.f3];
      if (p.kind === 'stop') {
        // Closure (near silence, or a low voice bar), a short place-shaped burst, then aspiration or voicing.
        const tb = t + Math.min(0.035, p.dur * 0.42), vowelF = p.release || F;
        vg.gain.setTargetAtTime(p.av ? 0.12 * VOICE : 0, t, 0.004); ng.gain.setTargetAtTime(0, t, 0.004);
        setGains([1, 0.05, 0], 0, t); setQ(p.q, t);
        F3.forEach(({ bp }, i) => bp.frequency.setValueAtTime(i === 0 ? 220 : (prevF || F)[i], t));
        // Word-final stops are released too (longer, louder burst plus a short puff), not swallowed.
        gate(p.place, tb, p.release ? (p.av ? 0.01 : 0.014) : 0.02, (p.av ? 0.7 : 1) * (p.release ? 1 : 1.2));
        const start = vowelF.map((v, i) => v + 0.5 * (F[i] - v)); // start from between the locus and the vowel
        F3.forEach(({ bp }, i) => { bp.frequency.setValueAtTime(start[i], tb); bp.frequency.linearRampToValueAtTime(vowelF[i], tb + 0.03); });
        setGains(VG, 0.15, tb);
        if (p.asp) { ng.gain.setTargetAtTime(0.63, tb + 0.012, 0.003); setQ(p.q * 0.5, tb); }
        else if (p.av && p.release) vg.gain.setTargetAtTime(0.8 * VOICE, tb + 0.008, 0.005);
        else {
          vg.gain.setTargetAtTime(0, tb, 0.003);
          if (!p.av) { ng.gain.setTargetAtTime(0.35, tb + 0.01, 0.003); ng.gain.setTargetAtTime(0, tb + 0.03, 0.006); setQ(p.q * 0.5, tb); }
        }
        prevF = vowelF;
        continue;
      }
      F3.forEach(({ bp }, i) => {
        if (prevF) { bp.frequency.setValueAtTime(prevF[i], t); bp.frequency.linearRampToValueAtTime(F[i], t + Math.min(G, p.dur)); }
        else bp.frequency.setValueAtTime(F[i], t);
        if (p.to) { bp.frequency.setValueAtTime(F[i], t + p.dur * 0.25); bp.frequency.linearRampToValueAtTime(p.to[i], t + p.dur * 0.65); } // land and hold
      });
      prevF = p.to || F;
      setQ(p.kind === 'aspir' ? p.q * 0.4 : p.q, t);
      if (p.kind === 'aff') { // closure then SH-coloured frication
        const tr = t + p.dur * 0.35;
        vg.gain.setTargetAtTime(p.av ? 0.12 * VOICE : 0, t, 0.004); ng.gain.setTargetAtTime(0, t, 0.004);
        setGains([1, 0.1, 0.05], 0, t);
        gate('alv', tr, 0.008, p.av ? 0.5 : 0.8); // the T-like release that makes CH a CH, not an SH
        gate('sh', tr + 0.004, p.dur * 0.65 - 0.014, p.av ? 0.6 : 1.1);
        if (p.av) vg.gain.setTargetAtTime(0.35 * VOICE, tr, 0.005);
      } else if (p.kind === 'fric') {
        vg.gain.setTargetAtTime(p.av * VOICE, t, 0.005); ng.gain.setTargetAtTime(0, t, 0.004);
        setGains(p.g, 0, t);
        gate(p.place, t + 0.004, p.dur - 0.014, p.an);
      } else if (p.kind === 'aspir') {
        vg.gain.setTargetAtTime(p.av * VOICE, t, 0.006); ng.gain.setTargetAtTime(0.55, t, 0.006);
        setGains(p.g, 0.1, t);
      } else {
        vg.gain.setTargetAtTime(p.av * VOICE, t, 0.006); ng.gain.setTargetAtTime(p.an, t, 0.006);
        setGains(p.g, p.kind === 'nasal' ? 0 : 0.15, t);
        notch.Q.setValueAtTime(p.kind === 'nasal' ? 4 : 3, t);
      }
    }
    vg.gain.setTargetAtTime(0, end, 0.015); ng.gain.setTargetAtTime(0, end, 0.015);
    osc.start(t0); vib.start(t0); noise.start(t0, Math.random());
    osc.stop(end + 0.15); vib.stop(end + 0.15); noise.stop(end + 0.15);
    const me = { out, srcs: [osc, vib, noise] };
    osc.onended = () => { out.disconnect(); if (cur === me) cur = null; };
    cur = me;
    return { duration: plan.duration };
  }

  return { speak, stop, presets: PRESETS, output };
}
