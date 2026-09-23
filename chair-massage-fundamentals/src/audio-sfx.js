// One-shot and looping sound effects for audio.js. All synthesized; positional via a listener x,z.

const TYPE_PITCH = { cart: 2.2, van: 0.8, swatvan: 0.7, copcar: 1.1, sedan: 1 };

export function createSfx(ctx, { bus, direct, noise, listener }) {
  const engines = new Map();
  const sirens = new Map();

  function atten(o) {
    const vol = o.volume ?? 1;
    if (o.x === undefined || o.z === undefined) return vol;
    const d = Math.hypot(o.x - listener.x, o.z - listener.z);
    if (d > 90) return 0;
    return vol / (1 + Math.max(0, d - 3) / 8);
  }

  function env(g, t, peak, attack, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  function tone(t, { type = 'sine', f, f2, glide = 0.1, peak = 0.5, attack = 0.004, decay = 0.3, out = bus }) {
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + glide);
    const g = ctx.createGain(); env(g, t, peak, attack, decay);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + attack + decay + 0.05);
    return g;
  }

  function burst(t, { filter = 'bandpass', f = 1000, q = 1, peak = 0.5, attack = 0.002, decay = 0.05, out = bus }) {
    const s = ctx.createBufferSource(); s.buffer = noise;
    const bq = ctx.createBiquadFilter(); bq.type = filter; bq.frequency.value = f; bq.Q.value = q;
    const g = ctx.createGain(); env(g, t, peak, attack, decay);
    s.connect(bq); bq.connect(g); g.connect(out);
    s.start(t, Math.random() * 1.5); s.stop(t + attack + decay + 0.05);
  }

  function engine(o) {
    const now = ctx.currentTime;
    let e = engines.get(o.id);
    if (!e) {
      const saw = ctx.createOscillator(); saw.type = 'sawtooth';
      const sub = ctx.createOscillator(); sub.type = 'square';
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2;
      const sg = ctx.createGain(); sg.gain.value = 0.35;
      const g = ctx.createGain(); g.gain.value = 0;
      saw.connect(lp); sub.connect(sg); sg.connect(lp); lp.connect(g); g.connect(bus);
      saw.start(); sub.start();
      e = { saw, sub, lp, g, type: o.type };
      engines.set(o.id, e);
    }
    const rpmIn = o.rpm ?? 0;
    const rpm = rpmIn <= 1 ? 800 + rpmIn * 5200 : rpmIn; // accepts 0..1 or real RPM
    const load = Math.min(1, Math.max(0, o.load ?? 0.3));
    const f = (rpm / 30) * (TYPE_PITCH[o.type || e.type] ?? 1); // 4-cylinder firing rate
    e.saw.frequency.setTargetAtTime(f, now, 0.05);
    e.sub.frequency.setTargetAtTime(f / 2, now, 0.05);
    e.lp.frequency.setTargetAtTime(250 + load * 1400 + f * 3, now, 0.05);
    e.g.gain.setTargetAtTime((0.06 + 0.1 * load) * atten(o), now, 0.05);
  }

  function engineStop(o) {
    const e = engines.get(o.id);
    if (!e) return;
    const now = ctx.currentTime;
    e.g.gain.setTargetAtTime(0, now, 0.08);
    e.saw.stop(now + 0.5); e.sub.stop(now + 0.5);
    e.saw.onended = () => e.g.disconnect();
    engines.delete(o.id);
  }

  function siren(o) {
    const now = ctx.currentTime;
    let s = sirens.get(o.id);
    if (o.on === false) {
      if (!s) return;
      s.g.gain.setTargetAtTime(0, now, 0.05);
      s.osc.stop(now + 0.4); s.lfo.stop(now + 0.4);
      sirens.delete(o.id);
      return;
    }
    if (!s) {
      const osc = ctx.createOscillator(); osc.type = 'square'; osc.frequency.value = 865;
      const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 1; // hi-lo each 0.5 s
      const depth = ctx.createGain(); depth.gain.value = 95;
      lfo.connect(depth); depth.connect(osc.frequency);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
      const g = ctx.createGain(); g.gain.value = 0;
      osc.connect(lp); lp.connect(g); g.connect(bus);
      osc.start(now); lfo.start(now);
      s = { osc, lfo, g };
      sirens.set(o.id, s);
    }
    s.g.gain.setTargetAtTime(0.09 * atten(o), now, 0.05);
  }

  const oneShots = {
    thud(t, a) { // the Healing Palm
      tone(t, { f: 130, f2: 38, glide: 0.25, peak: 0.9 * a, decay: 0.35 });
      burst(t, { filter: 'lowpass', f: 700, q: 0.7, peak: 0.5 * a, decay: 0.12 });
    },
    tap(t, a) { // massage gun
      burst(t, { f: 2500, q: 2, peak: 0.35 * a, decay: 0.015 });
      tone(t, { f: 190, f2: 120, glide: 0.02, peak: 0.3 * a, decay: 0.03 });
    },
    chairFold(t, a) { // metallic clack, twice
      for (const [dt, k] of [[0, 1], [0.07, 0.55]]) {
        burst(t + dt, { f: 2300, q: 25, peak: 0.8 * a * k, decay: 0.08 });
        burst(t + dt, { f: 3450, q: 30, peak: 0.6 * a * k, decay: 0.06 });
        burst(t + dt, { filter: 'highpass', f: 4000, q: 0.7, peak: 0.2 * a * k, decay: 0.01 });
      }
    },
    pay(t, a) { // coin ping
      tone(t, { f: 1976, peak: 0.25 * a, decay: 0.35 });
      tone(t + 0.07, { f: 2637, peak: 0.25 * a, decay: 0.5 });
      tone(t + 0.07, { f: 2637 * 2.76, peak: 0.05 * a, decay: 0.2 });
    },
    star(t, a) { // wanted level up
      tone(t, { type: 'square', f: 660, peak: 0.12 * a, decay: 0.12 });
      tone(t + 0.12, { type: 'square', f: 988, peak: 0.12 * a, decay: 0.25 });
    },
    stamp(t, a) { // slow-mo stamp: bypasses the duck so it lands over silence
      tone(t, { f: 95, f2: 32, glide: 0.4, peak: 1.0 * a, decay: 0.6, out: direct });
      burst(t, { filter: 'lowpass', f: 400, q: 0.7, peak: 0.6 * a, decay: 0.2, out: direct });
      burst(t, { filter: 'highpass', f: 3000, q: 0.7, peak: 0.5 * a, decay: 0.012, out: direct });
    },
  };

  function sfx(name, o = {}) {
    if (name === 'engine') return engine(o);
    if (name === 'engineStop') return engineStop(o);
    if (name === 'siren') return siren(o);
    const fn = oneShots[name];
    if (!fn) return;
    const a = atten(o);
    if (a > 0.001) fn(o.at ?? ctx.currentTime + 0.005, a);
  }

  function stopAll() {
    for (const id of [...engines.keys()]) engineStop({ id });
    for (const id of [...sirens.keys()]) siren({ id, on: false });
  }

  return { sfx, stopAll, names: ['engine', 'engineStop', 'siren', ...Object.keys(oneShots)] };
}
