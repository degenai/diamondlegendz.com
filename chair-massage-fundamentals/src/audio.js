// Procedural score: spa pad + rain (MASSAGE), detune-and-collapse (pivot), bass pulse (RUN),
// ducked silence with one low tone (SLOWMO / ARREST / DEATH / ESCAPE), a wrong chime (SUMMARY).
// Everything is scheduled on AudioParams; a lookahead pump sequences the loops. Silent until resume().
import { createSfx } from './audio-sfx.js';

const instances = new Set();
export function resume() { return Promise.all([...instances].map((a) => a.resume())); }

const SLOW = new Set(['SLOWMO', 'ARREST', 'DEATH', 'ESCAPE']);
const PENTA = [1174.7, 1318.5, 1480.0, 1760.0, 1975.5, 2349.3]; // D major pentatonic, high
const BASS = [0, 0, 12, 0, 0, 0, 10, 0, 0, 0, 12, 0, 3, 3, 5, 7]; // two bars of 8ths over A1
const semi = (n) => Math.pow(2, n / 12);

function hold(param, t) {
  if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(t);
  else { param.cancelScheduledValues(t); param.setValueAtTime(param.value, t); }
}

export function createAudio(ctx) {
  const offline = typeof ctx.startRendering === 'function';
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 6; comp.ratio.value = 5; comp.attack.value = 0.005; comp.release.value = 0.2;
  comp.connect(ctx.destination);
  const master = ctx.createGain(); master.gain.value = 0.7; master.connect(comp);
  const bus = (v = 1) => { const g = ctx.createGain(); g.gain.value = v; g.connect(master); return g; };
  const music = bus(), sfxBus = bus(), direct = bus();
  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const listener = { x: 0, z: 0 };
  const fx = createSfx(ctx, { bus: sfxBus, direct, noise, listener });

  let started = false, want = null, mode = null, layer = null, slowTone = null, intensity = 0, timer = null;

  const osc = (type, f, detune = 0) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune; return o; };
  const gain = (v, to) => { const g = ctx.createGain(); g.gain.value = v; if (to) g.connect(to); return g; };
  const filt = (type, f, q, to) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; if (to) b.connect(to); return b; };
  const noiseSrc = () => { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; return s; };

  function ping(t, f, peak, decay, to, detune = 0) {
    for (const [mul, k, dk] of [[1, 1, 1], [2.76, 0.25, 0.35]]) {
      const o = osc('sine', f * mul, detune), g = gain(0.0001, to);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak * k, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay * dk);
      o.connect(g); o.start(t); o.stop(t + decay * dk + 0.05);
    }
  }

  function fadeLayer(t, fade = 0.8) {
    if (!layer) return;
    const L = layer; layer = null;
    hold(L.out.gain, t); L.out.gain.setTargetAtTime(0, t, fade / 4);
    for (const s of L.srcs) s.stop(t + fade * 1.5);
  }

  function startMassage(t) {
    const out = gain(0, music);
    out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(1, t + 2);
    const lp = filt('lowpass', 900, 1.2);
    const pad = gain(1, null); lp.connect(pad); pad.connect(out);
    const lfo = osc('sine', 0.07), lfoG = gain(350); lfo.connect(lfoG); lfoG.connect(lp.frequency);
    const mk = (f, det) => [osc('triangle', f, -det), osc('sine', f, det)];
    const d1 = mk(146.83, 5), d2 = mk(220, 4); // D3 and A3, a fifth apart
    for (const o of [...d1, ...d2]) { const g = gain(0.06, lp); o.connect(g); }
    const wet = gain(0.45, out), lfos = [];
    for (const [base, depth, f] of [[0.015, 0.004, 0.27], [0.022, 0.005, 0.37]]) { // two-voice chorus
      const dl = ctx.createDelay(0.1); dl.delayTime.value = base;
      const l = osc('sine', f), lg = gain(depth); l.connect(lg); lg.connect(dl.delayTime);
      lp.connect(dl); dl.connect(wet); lfos.push(l);
    }
    const rain = noiseSrc(), rainG = gain(0.04, out);
    rain.connect(filt('highpass', 600, 0.5, filt('lowpass', 5200, 0.5, rainG)));
    const srcs = [lfo, rain, ...lfos, ...d1, ...d2];
    for (const s of srcs) if (s !== rain) s.start(t);
    rain.start(t, Math.random());
    return { kind: 'massage', out, lp, lfoG, d1, d2, rainG, srcs, rainNext: t + 0.5, chimeNext: t + 3 + Math.random() * 4, cut: false };
  }

  function startRun(t) {
    const out = gain(0, music);
    out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(1, t + 0.05);
    return { kind: 'run', out, srcs: [], next: t, step: 0 };
  }

  function bassNote(t, f, dur, out) {
    const lp = filt('lowpass', 2200, 8), g = gain(0.0001, out); lp.connect(g);
    lp.frequency.setValueAtTime(2200, t); lp.frequency.exponentialRampToValueAtTime(180, t + 0.12);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.95);
    for (const o of [osc('sawtooth', f), osc('square', f, -7)]) { o.connect(lp); o.start(t); o.stop(t + dur); }
  }

  function runStep(L, t, i, stepDur) {
    const n = BASS[i % 16];
    bassNote(t, 55 * semi(n), stepDur, L.out);
    const s = ctx.createBufferSource(); s.buffer = noise; // hi-hat tick
    const g = gain(0.0001, L.out); s.connect(filt('highpass', 7000, 0.7, g));
    const pk = i % 2 ? 0.09 : 0.04;
    g.gain.setValueAtTime(pk, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    s.start(t, Math.random()); s.stop(t + 0.05);
    if (i % 32 === 0 && intensity > 0.05) { // minor stab every 4 bars, layered in by intensity
      const lp = filt('lowpass', 1800, 1, null), sg = gain(0.0001, L.out); lp.connect(sg);
      sg.gain.setValueAtTime(0.0001, t); sg.gain.exponentialRampToValueAtTime(0.05 + 0.08 * intensity, t + 0.01);
      sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      for (const f of [220, 261.63, 329.63]) { const o = osc('sawtooth', f, (Math.random() - 0.5) * 10); o.connect(lp); o.start(t); o.stop(t + 0.65); }
    }
  }

  function pump(until) {
    const L = layer;
    if (!L) return;
    if (L.kind === 'massage' && !L.cut) {
      while (L.rainNext < until) { // gentle random ripples in the rain level
        L.rainG.gain.setTargetAtTime(0.025 + Math.random() * 0.045, L.rainNext, 0.15);
        L.rainNext += 0.3 + Math.random() * 0.6;
      }
      while (L.chimeNext < until) {
        ping(L.chimeNext, PENTA[(Math.random() * PENTA.length) | 0], 0.06, 2.5, L.out);
        L.chimeNext += 6 + Math.random() * 8;
      }
    }
    if (L.kind === 'run') {
      if (L.next < ctx.currentTime - 0.1) L.next = ctx.currentTime + 0.05; // tab was throttled
      while (L.next < until) {
        const stepDur = 60 / (116 * (1 + 0.1 * intensity)) / 2;
        runStep(L, L.next, L.step++, stepDur);
        L.next += stepDur;
      }
    }
  }

  function enterSlow(t) {
    for (const b of [music, sfxBus]) { hold(b.gain, t); b.gain.linearRampToValueAtTime(0, t + 0.3); }
    const o = osc('sine', 49), o2 = osc('triangle', 49, 3), g = gain(0, direct), g2 = gain(0.3, g);
    o.connect(g); o2.connect(g2);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.28, t + 0.5);
    o.start(t); o2.start(t);
    slowTone = { g, srcs: [o, o2] };
  }

  function leaveSlow(t) {
    for (const b of [music, sfxBus]) { hold(b.gain, t); b.gain.linearRampToValueAtTime(1, t + 0.3); }
    if (!slowTone) return;
    hold(slowTone.g.gain, t); slowTone.g.gain.setTargetAtTime(0, t, 0.1);
    for (const s of slowTone.srcs) s.stop(t + 0.8);
    slowTone = null;
  }

  function apply(name, t) {
    const target = SLOW.has(name) ? 'SLOWMO' : name;
    if (target === mode) return;
    if (mode === 'SLOWMO') leaveSlow(t);
    if (target === 'MASSAGE' || (target === 'PIVOT' && mode !== 'MASSAGE')) {
      if (!layer || layer.kind !== 'massage') { fadeLayer(t); layer = startMassage(t); }
    } else if (target === 'RUN') {
      if (!layer || layer.kind !== 'run') { fadeLayer(t, 0.3); layer = startRun(t + 0.05); }
    } else if (target === 'SLOWMO') enterSlow(t);
    else if (target === 'SUMMARY') {
      fadeLayer(t);
      // a C major certificate chime with the E a quarter-tone flat
      [[523.25, 0], [659.26, -50], [783.99, 0], [1046.5, 0]].forEach(([f, det], k) => ping(t + 0.3 + k * 0.09, f, 0.09, 3.5, music, det));
    } else if (target === 'TITLE') fadeLayer(t);
    mode = target;
    pump(t + 0.4);
  }

  function pivot() {
    if (!started) return;
    const t = ctx.currentTime;
    if (mode === 'SLOWMO') leaveSlow(t);
    const L = layer && layer.kind === 'massage' ? layer : null;
    let collapse = t;
    if (L) {
      collapse = t + 3;
      L.cut = true;
      for (const [set, ratio] of [[L.d1, semi(-3)], [L.d2, semi(1)]]) { // down a minor third, up a semitone
        for (const o of set) { hold(o.frequency, t); o.frequency.exponentialRampToValueAtTime(o.frequency.value * ratio, collapse); }
      }
      hold(L.lfoG.gain, t); L.lfoG.gain.linearRampToValueAtTime(0, t + 0.5);
      hold(L.lp.frequency, t); L.lp.frequency.exponentialRampToValueAtTime(6500, collapse);
      hold(L.lp.Q, t); L.lp.Q.linearRampToValueAtTime(14, collapse);
      hold(L.rainG.gain, t); L.rainG.gain.setTargetAtTime(0, t, 0.04);
      hold(L.out.gain, t); L.out.gain.linearRampToValueAtTime(1.4, collapse);
      L.out.gain.setTargetAtTime(0, collapse, 0.015);
      for (const s of L.srcs) s.stop(collapse + 0.3);
      layer = null;
    } else fadeLayer(t, 0.2);
    // sub thump, then a second of silence, then RUN
    const o = osc('sine', 62), g = gain(0.0001, music);
    o.frequency.setValueAtTime(62, collapse); o.frequency.exponentialRampToValueAtTime(26, collapse + 0.6);
    g.gain.setValueAtTime(0.0001, collapse); g.gain.exponentialRampToValueAtTime(0.9, collapse + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, collapse + 0.8);
    o.connect(g); o.start(collapse); o.stop(collapse + 0.85);
    layer = startRun(collapse + 1.8);
    mode = 'RUN'; want = 'RUN';
  }

  const api = {
    resume() {
      started = true;
      if (!offline && !timer) timer = setInterval(() => pump(ctx.currentTime + 0.4), 50);
      if (want && want !== mode) apply(want, ctx.currentTime);
      return !offline && ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
    },
    setState(name) { want = name; if (started) apply(name, ctx.currentTime); },
    setIntensity(v) { intensity = Math.min(1, Math.max(0, +v || 0)); },
    pivot,
    sfx(name, opts) { if (started) fx.sfx(name, opts); },
    setListener(x, z) { listener.x = x; listener.z = z; },
    setVolume(v) { master.gain.setTargetAtTime(v, ctx.currentTime, 0.05); },
    stop() {
      const t = ctx.currentTime;
      fadeLayer(t, 0.3); fx.stopAll();
      if (slowTone) leaveSlow(t);
      mode = null; want = null;
    },
    get state() { return mode; },
    sfxNames: fx.names,
    _pump: pump, // offline rendering: schedule loops up to a time without the timer
  };
  instances.add(api);
  return api;
}
