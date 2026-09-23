// Formant robot voice: text -> phonemes -> glottal buzz + noise through three bandpass formants.
// planUtterance is pure (runs in node); createVoice schedules everything with AudioParam automation.

// Phoneme table: [kind, F1, F2, F3, band gains, voicing, noise]. Vowels: Peterson & Barney male means.
const V = (f1, f2, f3) => ['vowel', f1, f2, f3, [1, 0.8, 0.45], 1, 0];
const PH = {
  IY: V(270, 2290, 3010), IH: V(390, 1990, 2550), EH: V(530, 1840, 2480), AE: V(660, 1720, 2410),
  AH: V(520, 1190, 2390), AA: V(730, 1090, 2440), AO: V(570, 840, 2410), UH: V(440, 1020, 2240),
  UW: V(300, 870, 2240), ER: V(490, 1350, 1690),
  EY: ['diph', 530, 1840, 2480, [1, 0.8, 0.45], 1, 0, [270, 2290, 3010]],
  AY: ['diph', 730, 1090, 2440, [1, 0.8, 0.45], 1, 0, [390, 1990, 2550]],
  OY: ['diph', 570, 840, 2410, [1, 0.8, 0.45], 1, 0, [390, 1990, 2550]],
  AW: ['diph', 730, 1090, 2440, [1, 0.8, 0.45], 1, 0, [440, 1020, 2240]],
  OW: ['diph', 570, 840, 2410, [1, 0.8, 0.45], 1, 0, [300, 870, 2240]],
  P: ['stop', 600, 1000, 2200, [0.4, 0.6, 0.4], 0, 0.5], B: ['stop', 600, 1000, 2200, [0.4, 0.6, 0.4], 0.25, 0.35],
  T: ['stop', 1800, 3000, 3900, [0.2, 0.7, 1], 0, 0.6], D: ['stop', 1800, 3000, 3900, [0.2, 0.7, 1], 0.25, 0.4],
  K: ['stop', 1500, 2200, 2800, [0.4, 1, 0.6], 0, 0.6], G: ['stop', 1500, 2200, 2800, [0.4, 1, 0.6], 0.25, 0.4],
  CH: ['aff', 1800, 2500, 3200, [0.3, 1, 0.7], 0, 0.55], JH: ['aff', 1800, 2500, 3200, [0.3, 1, 0.7], 0.35, 0.4],
  F: ['fric', 1700, 2700, 3600, [0.3, 0.5, 0.6], 0, 0.3], V: ['fric', 1700, 2700, 3600, [0.3, 0.5, 0.6], 0.45, 0.2],
  TH: ['fric', 1400, 2200, 3400, [0.3, 0.5, 0.6], 0, 0.25], DH: ['fric', 1400, 2200, 3400, [0.3, 0.5, 0.6], 0.45, 0.15],
  S: ['fric', 2600, 3700, 4300, [0.1, 0.6, 1], 0, 0.55], Z: ['fric', 2600, 3700, 4300, [0.1, 0.6, 1], 0.4, 0.35],
  SH: ['fric', 1800, 2500, 3200, [0.3, 1, 0.7], 0, 0.55], ZH: ['fric', 1800, 2500, 3200, [0.3, 1, 0.7], 0.4, 0.35],
  HH: ['fric', 0, 0, 0, [1, 0.8, 0.45], 0, 0.35], // formants borrowed from the next vowel
  M: ['nasal', 250, 1100, 2100, [1, 0.15, 0.08], 0.7, 0], N: ['nasal', 250, 1700, 2600, [1, 0.15, 0.08], 0.7, 0],
  NG: ['nasal', 250, 2300, 2750, [1, 0.15, 0.08], 0.7, 0],
  L: ['liquid', 360, 1050, 2880, [1, 0.5, 0.3], 0.85, 0], R: ['liquid', 310, 1060, 1380, [1, 0.7, 0.4], 0.85, 0],
  W: ['liquid', 290, 610, 2150, [1, 0.5, 0.3], 0.85, 0], Y: ['liquid', 260, 2070, 3020, [1, 0.6, 0.4], 0.85, 0],
};
export const PHONEMES = Object.keys(PH);
const DUR = { vowel: 110, diph: 110, stop: 70, aff: 100, fric: 90, nasal: 80, liquid: 70 };

// Exception dictionary: the game's own words plus function words the rules get wrong.
const DICT = {
  massage: 'M AH S AA ZH', serenity: 'S ER EH N IH T IY', incorporated: 'IH N K AO R P ER EY T IH D',
  licensee: 'L AY S AH N S IY', fundamentals: 'F AH N D AH M EH N T AH L Z', woodstock: 'W UH D S T AA K',
  permit: 'P ER M IH T', brand: 'B R AE N D', chair: 'CH EH R', plaza: 'P L AA Z AH',
  adamczyk: 'AE D AH M CH IH K', lmt: 'EH L EH M T IY', the: 'DH AH', a: 'AH', of: 'AH V', to: 'T UW',
  you: 'Y UW', your: 'Y AO R', "you're": 'Y UH R', "we'd": 'W IY D', they: 'DH EY', them: 'DH EH M',
  this: 'DH IH S', that: 'DH AE T', there: 'DH EH R', then: 'DH EH N', with: 'W IH TH', have: 'HH AE V',
  do: 'D UW', "don't": 'D OW N T', word: 'W ER D', one: 'W AH N', two: 'T UW', sir: 'S ER', group: 'G R UW P',
  are: 'AA R', is: 'IH Z', was: 'W AH Z', what: 'W AH T', i: 'AY', operating: 'AA P ER EY T IH NG',
  without: 'W IH TH AW T', certifies: 'S ER T IH F AY Z', module: 'M AA JH UW L', pressure: 'P R EH SH ER',
  escaped: 'IH S K EY P T', about: 'AH B AW T', people: 'P IY P AH L', elbow: 'EH L B OW', client: 'K L AY AH N T',
  give: 'G IH V', get: 'G EH T', says: 'S EH Z', said: 'S EH D', been: 'B IH N', any: 'EH N IY', many: 'M EH N IY',
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

// Letter-to-phoneme rules for one lowercase word.
export function wordToPhones(word) {
  if (DICT[word]) return DICT[word].split(' ');
  if (word.endsWith("'s") && DICT[word.slice(0, -2)]) return [...DICT[word.slice(0, -2)].split(' '), 'Z'];
  let w = word.replace(/'/g, '');
  let suffix = [];
  if (w.length > 4 && w.endsWith('ed') && !isV(w[w.length - 3])) { // past tense
    let stem = w.slice(0, -2);
    const last = stem[stem.length - 1];
    suffix = 'td'.includes(last) ? ['IH', 'D'] : 'pkfsx'.includes(last) || stem.endsWith('sh') || stem.endsWith('ch') ? ['T'] : ['D'];
    if (last === stem[stem.length - 2]) stem = stem.slice(0, -1);
    else if (isV(stem[stem.length - 2]) && !isV(stem[stem.length - 3])) stem += 'e';
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
    if (three === 'tch') { push('CH'); i += 3; continue; }
    if (three === 'igh') { push('AY'); i += 3; continue; }
    if (three === 'all') { push('AO L'); i += 3; continue; }
    if (i === 0 && (two === 'kn' || two === 'wr')) { push(two === 'kn' ? 'N' : 'R'); i += 2; continue; }
    if (DIGRAPHS[two] !== undefined) { push(DIGRAPHS[two]); i += 2; continue; }
    if (two === 'ow') { push(i + 2 >= w.length ? 'OW' : 'AW'); i += 2; continue; }
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
    if (c === 'g') { push('eiy'.includes(n) && n ? 'JH' : 'G'); i += 1; continue; }
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
  const re = /([A-Za-z']+)|(\d)|([,;:])|([.!?])/g;
  let m;
  while ((m = re.exec(text))) {
    if (m[1]) {
      const raw = m[1].replace(/^'+|'+$/g, '');
      if (!raw) continue;
      const lw = raw.toLowerCase();
      if (!DICT[lw] && raw.length > 1 && raw.length <= 4 && raw === raw.toUpperCase() && !/[AEIOU]/.test(raw)) {
        toks.push({ phones: [...raw].flatMap((ch) => LETTERS[ch.charCodeAt(0) - 65].split(' ')) });
      } else toks.push({ phones: wordToPhones(lw) });
    } else if (m[2]) toks.push({ phones: wordToPhones(DIGITS[+m[2]]) });
    else if (m[3]) toks.push({ pause: 120 });
    else toks.push({ pause: 250, end: m[4] });
  }
  return toks;
}

export const PRESETS = {
  narrator: { f0: 110, rate: 1, q: 10 },
  goon: { f0: 75, rate: 0.8, q: 5 },
  ranger: { f0: 150, rate: 1.15, q: 10 },
  client: { f0: 150, rate: 1.15, q: 10 },
};

function hashRng(str) { // deterministic jitter so planUtterance stays pure
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}

export function planUtterance(text, preset = 'narrator') {
  const pr = typeof preset === 'string' ? PRESETS[preset] || PRESETS.narrator : { ...PRESETS.narrator, ...preset };
  const rnd = hashRng(String(text));
  const phones = [];
  let sentenceStart = 0;
  const closeSentence = (end) => {
    const seg = phones.slice(sentenceStart).filter((p) => p.kind !== 'sil');
    seg.forEach((p, k) => { p.f0 *= 1 - 0.15 * (seg.length > 1 ? k / (seg.length - 1) : 0); });
    const voiced = seg.filter((p) => p.av > 0).slice(-3);
    voiced.forEach((p, k) => { p.f0 *= end === '?' ? 1.1 + 0.12 * k : 0.97 - 0.05 * k; });
    sentenceStart = phones.length;
  };
  for (const t of tokenize(text)) {
    if (t.pause) {
      phones.push({ ph: '_', dur: t.pause / 1000, f0: pr.f0, f1: 0, f2: 0, f3: 0, kind: 'sil', av: 0, an: 0, g: [0, 0, 0], q: pr.q });
      if (t.end) closeSentence(t.end);
      continue;
    }
    for (const ph of t.phones) {
      const e = PH[ph];
      if (!e) { phones.push({ ph, unknown: true, dur: 0, f0: pr.f0, f1: 0, f2: 0, f3: 0, kind: 'sil', av: 0, an: 0, g: [0, 0, 0], q: pr.q }); continue; }
      const [kind, f1, f2, f3, g, av, an, to] = e;
      const q = kind === 'fric' || kind === 'aff' || kind === 'stop' ? pr.q * 0.3 : pr.q;
      phones.push({ ph, dur: DUR[kind] / 1000 / pr.rate, f0: pr.f0 * (1 + (rnd() - 0.5) * 0.03), f1, f2, f3, kind, av, an, g, q, ...(to ? { to } : {}) });
    }
  }
  closeSentence('.');
  while (phones.length && phones[phones.length - 1].kind === 'sil') phones.pop();
  for (let i = 0; i < phones.length; i++) { // HH takes the formants of the next vowel
    if (phones[i].ph !== 'HH') continue;
    const nx = phones.slice(i + 1).find((p) => p.kind === 'vowel' || p.kind === 'diph') || { f1: 500, f2: 1500, f3: 2500 };
    Object.assign(phones[i], { f1: nx.f1, f2: nx.f2, f3: nx.f3 });
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
    const t0 = ctx.currentTime + 0.05, end = t0 + plan.duration;
    const osc = ctx.createOscillator(); osc.type = 'sawtooth';
    const noise = ctx.createBufferSource(); noise.buffer = noiseBuffer(ctx); noise.loop = true;
    const vg = ctx.createGain(), ng = ctx.createGain(), mix = ctx.createGain();
    vg.gain.value = 0; ng.gain.value = 0; mix.gain.value = 1.6;
    osc.connect(vg); noise.connect(ng);
    const bands = [0, 1, 2].map(() => {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
      const bg = ctx.createGain(); bg.gain.value = 0;
      vg.connect(bp); ng.connect(bp); bp.connect(bg); bg.connect(mix);
      return { bp, bg };
    });
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4000; lp.Q.value = 0.5;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.1;
    const out = ctx.createGain(); out.gain.value = 0.7 * Math.sqrt(Math.min(1, plan.q / 10));
    mix.connect(lp); lp.connect(comp); comp.connect(out); out.connect(output);

    const G = 0.03; // formant glide
    let prevF = null;
    osc.frequency.setValueAtTime(plan.phones[0].f0, t0);
    for (const p of plan.phones) {
      const t = t0 + p.t;
      if (p.kind === 'sil') {
        vg.gain.setTargetAtTime(0, t, 0.012); ng.gain.setTargetAtTime(0, t, 0.012);
        continue;
      }
      const F = [p.f1, p.f2, p.f3];
      bands.forEach(({ bp, bg }, i) => {
        if (prevF) { bp.frequency.setValueAtTime(prevF[i], t); bp.frequency.linearRampToValueAtTime(F[i], t + Math.min(G, p.dur)); }
        else bp.frequency.setValueAtTime(F[i], t);
        if (p.to) bp.frequency.linearRampToValueAtTime(p.to[i], t + p.dur);
        bp.Q.setTargetAtTime(p.q, t, 0.01);
        bg.gain.setTargetAtTime(p.g[i], t, 0.01);
      });
      prevF = p.to || F;
      osc.frequency.linearRampToValueAtTime(p.f0, t + p.dur * 0.5);
      if (p.kind === 'stop' || p.kind === 'aff') { // closure (voice bar if voiced), then burst or frication
        const rel = t + p.dur * (p.kind === 'stop' ? 0.6 : 0.4);
        vg.gain.setTargetAtTime(p.av * 0.5, t, 0.006); ng.gain.setTargetAtTime(0, t, 0.006);
        ng.gain.setTargetAtTime(p.an, rel, 0.002);
        vg.gain.setTargetAtTime(p.av, rel, 0.004);
        if (p.kind === 'stop') ng.gain.setTargetAtTime(0, rel + 0.008, 0.012);
      } else {
        vg.gain.setTargetAtTime(p.av, t, 0.008); ng.gain.setTargetAtTime(p.an, t, 0.008);
      }
    }
    vg.gain.setTargetAtTime(0, end, 0.015); ng.gain.setTargetAtTime(0, end, 0.015);
    osc.start(t0); noise.start(t0, Math.random());
    osc.stop(end + 0.15); noise.stop(end + 0.15);
    const me = { out, srcs: [osc, noise] };
    osc.onended = () => { out.disconnect(); if (cur === me) cur = null; };
    cur = me;
    return { duration: plan.duration };
  }

  return { speak, stop, presets: PRESETS, output };
}
