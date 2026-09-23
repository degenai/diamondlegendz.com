// Formant robot voice: text -> phonemes -> glottal pulse + noise through four bandpass formants,
// plus a place-shaped noise bank for bursts and fricatives and a notch for nasals.
// planUtterance is pure (runs in node); createVoice schedules everything with AudioParam automation.
// Tuning brief (2026-09-23, "too muddy"): consonants cut, words have gaps, still a crunchy 80s chip.
// Pass 3 ("one notch clearer"): ~6% slower, consonants +2 dB, F1/F2 Q 13, diphthongs land on target,
// lexical stress for long words, gentler sentence-final fall, released word-final stops.
import { PH, PLACE, ANTI, DUR, VG, tokenize } from './voice-lex.js';
export { PHONEMES, wordToPhones } from './voice-lex.js';

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
  // The glottal tilt is one IIR node per voice, reused by every line: creating an IIRFilterNode
  // costs several ms in Chrome (Phase 7 profile), far more than the rest of an utterance's graph.
  const a = Math.exp(-2 * Math.PI * 1000 / ctx.sampleRate);
  const tilt = ctx.createIIRFilter([1 - a], [1, -a]);

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
    tilt.disconnect();                  // the previous line's voicing path (it was just stopped)
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
