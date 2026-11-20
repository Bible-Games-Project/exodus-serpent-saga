// Small offline synthesis toolkit for the "Claude" sound pack: oscillators,
// noises, time-varying biquad filters, envelopes, modal (struck) bodies,
// plucked strings, formant voices, crackle, bubbles and a Freeverb-style
// reverb. Everything is mono Float32 at SR. Deterministic (seeded random).

export const SR = 44100;
export type Buf = Float32Array;
/** A parameter over time: constant, [start, end] exponential glide, or f(t, dur). */
export type P = number | [number, number] | ((t: number, dur: number) => number);

let seed = 1;
export const setSeed = (s: number) => (seed = Math.max(1, Math.floor(s) % 2147483646));
export const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
export const rr = (a: number, b: number) => a + (b - a) * rnd();

export const buf = (sec: number): Buf => new Float32Array(Math.max(1, Math.ceil(sec * SR)));
export const dur = (b: Buf) => b.length / SR;
export function val(p: P, t: number, d: number): number {
  if (typeof p === "number") return p;
  if (typeof p === "function") return p(t, d);
  const k = Math.min(1, Math.max(0, t / d));
  return p[0] * Math.pow(p[1] / p[0], k);
}
export const N = (semi: number) => 440 * Math.pow(2, semi / 12); // semitones from A4

// ---------- sources ----------
export type Wave = "sine" | "tri" | "saw" | "square" | "pulse";
function shape(w: Wave, x: number, pw = 0.3) {
  switch (w) {
    case "sine": return Math.sin(2 * Math.PI * x);
    case "tri": return 1 - 4 * Math.abs(x - 0.5);
    case "saw": return 2 * x - 1;
    case "square": return x < 0.5 ? 1 : -1;
    case "pulse": return x < pw ? 1 : -1;
  }
}
/** Oscillator with frequency curve, optional vibrato and FM. */
export function osc(o: { f: P; d: number; w?: Wave; vib?: number; vibHz?: number; fm?: number; fmRatio?: number; phase?: number }): Buf {
  const b = buf(o.d);
  let ph = o.phase ?? 0, mph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    let f = val(o.f, t, o.d);
    if (o.vib) f *= 1 + o.vib * Math.sin(2 * Math.PI * (o.vibHz ?? 5.5) * t);
    if (o.fm) { mph += (f * (o.fmRatio ?? 2)) / SR; f *= 1 + o.fm * Math.sin(2 * Math.PI * mph); }
    ph += f / SR;
    ph -= Math.floor(ph);
    b[i] = shape(o.w ?? "sine", ph);
  }
  return b;
}
/** Several detuned oscillators (chorus / swarm / pad). */
export function unison(o: { f: P; d: number; w?: Wave; n?: number; detune?: number; vib?: number; vibHz?: number }): Buf {
  const n = o.n ?? 5;
  const out = buf(o.d);
  for (let k = 0; k < n; k++) {
    const det = 1 + (o.detune ?? 0.01) * (n === 1 ? 0 : (k / (n - 1)) * 2 - 1);
    const f = o.f;
    const fk: P = typeof f === "number" ? f * det : typeof f === "function" ? (t, d) => f(t, d) * det : [f[0] * det, f[1] * det];
    add(out, osc({ f: fk, d: o.d, w: o.w, vib: o.vib, vibHz: (o.vibHz ?? 5) * (0.8 + 0.4 * rnd()), phase: rnd() }), 0, 1 / n);
  }
  return out;
}
export function white(d: number): Buf {
  const b = buf(d);
  for (let i = 0; i < b.length; i++) b[i] = rnd() * 2 - 1;
  return b;
}
export function pink(d: number): Buf {
  const b = buf(d);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < b.length; i++) {
    const w = rnd() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    b[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return b;
}
export function brown(d: number): Buf {
  const b = buf(d);
  let y = 0;
  for (let i = 0; i < b.length; i++) { y = (y + 0.02 * (rnd() * 2 - 1)) / 1.02; b[i] = y * 3.5; }
  return b;
}

// ---------- filters ----------
export type FType = "lp" | "hp" | "bp" | "notch" | "peak";
/** RBJ biquad with a cutoff that may move over time (updated every 16 samples). */
export function filt(b: Buf, type: FType, fc: P, q = 0.707, gainDb = 0): Buf {
  const d = dur(b);
  let b0 = 0, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const A = Math.pow(10, gainDb / 40);
  for (let i = 0; i < b.length; i++) {
    if (i % 16 === 0) {
      const f = Math.min(SR * 0.45, Math.max(20, val(fc, i / SR, d)));
      const w0 = (2 * Math.PI * f) / SR, cs = Math.cos(w0), al = Math.sin(w0) / (2 * q);
      let a0 = 1;
      if (type === "lp") { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
      else if (type === "hp") { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
      else if (type === "bp") { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
      else if (type === "notch") { b0 = 1; b1 = -2 * cs; b2 = 1; a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al; }
      else { b0 = 1 + al * A; b1 = -2 * cs; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cs; a2 = 1 - al / A; }
      b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
    }
    const x = b[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    b[i] = y;
  }
  return b;
}
export const lp = (b: Buf, fc: P, q = 0.707) => filt(b, "lp", fc, q);
export const hp = (b: Buf, fc: P, q = 0.707) => filt(b, "hp", fc, q);
export const bp = (b: Buf, fc: P, q = 1) => filt(b, "bp", fc, q);

// ---------- envelopes / dynamics ----------
/** attack (s) then exponential decay (time constant tau). */
export function ad(b: Buf, attack: number, tau: number): Buf {
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    b[i] *= t < attack ? t / attack : Math.exp(-(t - attack) / tau);
  }
  return fade(b);
}
/** Piecewise linear gain envelope [[t, gain], ...] (times in seconds). */
export function env(b: Buf, pts: Array<[number, number]>): Buf {
  let k = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    while (k < pts.length - 2 && t > pts[k + 1][0]) k++;
    const [t0, g0] = pts[k], [t1, g1] = pts[Math.min(k + 1, pts.length - 1)];
    const g = t <= t0 ? g0 : t >= t1 ? g1 : g0 + ((g1 - g0) * (t - t0)) / (t1 - t0);
    b[i] *= g;
  }
  return b;
}
/** Swell: rises to a peak at `peak` (fraction of the duration) then falls. */
export function swell(b: Buf, peak = 0.4, curve = 2): Buf {
  const n = b.length;
  for (let i = 0; i < n; i++) {
    const k = i / n;
    b[i] *= k < peak ? Math.pow(k / peak, curve) : Math.pow(1 - (k - peak) / (1 - peak), curve);
  }
  return b;
}
export function am(b: Buf, hz: P, depth = 0.5): Buf {
  let ph = 0;
  const d = dur(b);
  for (let i = 0; i < b.length; i++) {
    ph += val(hz, i / SR, d) / SR;
    b[i] *= 1 - depth * (0.5 + 0.5 * Math.sin(2 * Math.PI * ph));
  }
  return b;
}
export function drive(b: Buf, k = 2): Buf {
  const n = Math.tanh(k);
  for (let i = 0; i < b.length; i++) b[i] = Math.tanh(b[i] * k) / n;
  return b;
}
export function gain(b: Buf, g: number): Buf {
  for (let i = 0; i < b.length; i++) b[i] *= g;
  return b;
}
export function fade(b: Buf, sec = 0.008): Buf {
  const n = Math.min(b.length, Math.floor(sec * SR));
  for (let i = 0; i < n; i++) b[b.length - 1 - i] *= i / n;
  return b;
}
export function fadeIn(b: Buf, sec = 0.003): Buf {
  const n = Math.min(b.length, Math.floor(sec * SR));
  for (let i = 0; i < n; i++) b[i] *= i / n;
  return b;
}
export function norm(b: Buf, peak = 0.9): Buf {
  let m = 0;
  for (const v of b) m = Math.max(m, Math.abs(v));
  if (m > 0) for (let i = 0; i < b.length; i++) b[i] *= peak / m;
  return b;
}
/** Removes DC / sub-rumble below 25 Hz. */
export const dc = (b: Buf) => hp(b, 25, 0.6);

// ---------- mixing ----------
export function add(out: Buf, b: Buf, t = 0, g = 1): Buf {
  const o = Math.floor(t * SR);
  for (let i = 0; i < b.length && o + i < out.length; i++) if (o + i >= 0) out[o + i] += b[i] * g;
  return out;
}
/** Mix parts [buffer, start time, gain] into a buffer of `d` seconds. */
export function mix(d: number, parts: Array<[Buf, number?, number?]>): Buf {
  const out = buf(d);
  for (const [b, t, g] of parts) add(out, b, t ?? 0, g ?? 1);
  return out;
}

// ---------- building blocks ----------
/** Struck body: sum of decaying partials (ratios, amps, decay time constants). */
export function modal(f: number, d: number, parts: Array<[number, number, number]>, attack = 0.0008): Buf {
  const b = buf(d);
  for (const [r, a, tau] of parts) {
    const ff = f * r;
    if (ff > SR * 0.45) continue;
    const ph = rnd() * 6.283;
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      b[i] += a * Math.sin(2 * Math.PI * ff * t + ph) * (t < attack ? t / attack : Math.exp(-(t - attack) / tau));
    }
  }
  return fade(b);
}
export const WOOD: Array<[number, number, number]> = [[1, 1, 0.05], [2.57, 0.5, 0.025], [4.6, 0.25, 0.012], [7.1, 0.12, 0.007]];
export const METAL: Array<[number, number, number]> = [[1, 1, 0.5], [2.32, 0.6, 0.35], [4.25, 0.4, 0.22], [6.63, 0.25, 0.14], [9.38, 0.15, 0.09]];
export const GLASS: Array<[number, number, number]> = [[1, 1, 0.35], [2.76, 0.45, 0.18], [5.4, 0.25, 0.09], [8.93, 0.12, 0.05]];
export const STONE: Array<[number, number, number]> = [[1, 1, 0.03], [1.73, 0.7, 0.02], [2.9, 0.5, 0.012], [4.4, 0.3, 0.008]];
export const scaleTau = (parts: Array<[number, number, number]>, k: number) => parts.map(([r, a, t]) => [r, a, t * k] as [number, number, number]);

/** Sine "body" thump with falling pitch. */
export const thump = (f0: number, f1: number, d: number, tau = d / 3) => ad(osc({ f: [f0, f1], d }), 0.002, tau);
/** Filtered-noise whoosh with a swell shape and moving band. */
export const whoosh = (d: number, c0: number, c1: number, q = 1.2, peak = 0.45) => swell(bp(pink(d), [c0, c1], q), peak, 1.6);
/** Short noise click / transient. */
export const click = (fc = 4000, d = 0.012, q = 0.9) => ad(bp(white(d + 0.01), fc, q), 0.0003, d / 3);
/** Plucked string (Karplus-Strong). */
export function pluck(f: number, d: number, bright = 0.5, decay = 0.996): Buf {
  const b = buf(d);
  const n = Math.max(2, Math.round(SR / f));
  const line = new Float32Array(n);
  for (let i = 0; i < n; i++) line[i] = rnd() * 2 - 1;
  let idx = 0, prev = 0;
  for (let i = 0; i < b.length; i++) {
    const cur = line[idx];
    const nxt = line[(idx + 1) % n];
    const avg = (bright * cur + (1 - bright) * (cur + nxt) * 0.5) * decay;
    b[i] = cur;
    line[idx] = avg * 0.5 + prev * 0.5;
    prev = avg;
    idx = (idx + 1) % n;
  }
  return fade(b);
}
/** Random crackle (fire, debris, wings): `rate` clicks per second. */
export function crackle(d: number, rate: P, fc: P = 3000, q = 1.5, decay = 0.003): Buf {
  const b = buf(d);
  let next = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    if (t >= next) {
      const amp = 0.3 + 0.7 * rnd();
      const len = Math.floor(decay * SR * (0.5 + rnd()));
      for (let k = 0; k < len && i + k < b.length; k++) b[i + k] += (rnd() * 2 - 1) * amp * Math.exp(-k / (len / 3));
      next = t - Math.log(1 - rnd() * 0.999) / Math.max(1, val(rate, t, d));
    }
  }
  return bp(b, fc, q);
}
/** Water bubbles: short rising sine chirps. */
export function bubbles(d: number, count: number, f0: number, f1: number): Buf {
  const b = buf(d);
  for (let k = 0; k < count; k++) {
    const t = rnd() * (d - 0.06);
    const f = rr(f0, f1);
    const l = rr(0.02, 0.06);
    add(b, ad(osc({ f: [f, f * rr(1.6, 2.4)], d: l }), 0.001, l / 3), t, rr(0.4, 1));
  }
  return b;
}
const VOWELS: Record<string, Array<[number, number]>> = {
  a: [[800, 1], [1150, 0.5], [2900, 0.25]],
  o: [[450, 1], [800, 0.45], [2830, 0.15]],
  u: [[325, 1], [700, 0.3], [2700, 0.1]],
  e: [[400, 1], [1600, 0.4], [2700, 0.2]],
  i: [[270, 1], [2100, 0.35], [3000, 0.2]],
};
/** Formant voice: a buzzy source through three vowel resonances. */
export function voice(src: Buf, vowel: keyof typeof VOWELS, shift = 1, q = 6): Buf {
  const out = buf(dur(src));
  for (const [f, a] of VOWELS[vowel]) add(out, bp(src.slice(), f * shift, q), 0, a);
  return out;
}
/** Soft choir "ah" chord (several voices per note, slow vibrato). */
export function choir(notes: number[], d: number, vowel: keyof typeof VOWELS = "a", attack = 0.25): Buf {
  const out = buf(d);
  for (const f of notes) add(out, voice(unison({ f, d, w: "saw", n: 4, detune: 0.006, vib: 0.006, vibHz: 5 }), vowel, 1, 5), 0, 1);
  return env(out, [[0, 0], [attack, 1], [d * 0.6, 0.8], [d, 0]]);
}

// ---------- space ----------
/** Freeverb-style reverb. size 0..1, damp 0..1, wet 0..1. Adds a tail. */
export function reverb(b: Buf, wet = 0.25, size = 0.75, damp = 0.4, tail = 0.8): Buf {
  const out = buf(dur(b) + tail);
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  const aps = [556, 441, 341, 225];
  const fb = 0.7 + 0.28 * size;
  const wetBuf = new Float32Array(out.length);
  for (const c of combs) {
    const line = new Float32Array(c);
    let idx = 0, store = 0;
    for (let i = 0; i < out.length; i++) {
      const x = i < b.length ? b[i] * 0.015 : 0;
      const y = line[idx];
      store = y * (1 - damp) + store * damp;
      line[idx] = x + store * fb;
      idx = (idx + 1) % c;
      wetBuf[i] += y;
    }
  }
  for (const a of aps) {
    const line = new Float32Array(a);
    let idx = 0;
    for (let i = 0; i < out.length; i++) {
      const bufout = line[idx];
      const x = wetBuf[i];
      wetBuf[i] = -x + bufout;
      line[idx] = x + bufout * 0.5;
      idx = (idx + 1) % a;
    }
  }
  for (let i = 0; i < out.length; i++) out[i] = (i < b.length ? b[i] * (1 - wet * 0.5) : 0) + wetBuf[i] * wet;
  return fade(out, 0.05);
}
/** Echo. */
export function echo(b: Buf, time = 0.18, fb = 0.35, wet = 0.4, tail = 0.6): Buf {
  const out = buf(dur(b) + tail);
  out.set(b);
  const n = Math.floor(time * SR);
  for (let i = n; i < out.length; i++) out[i] += out[i - n] * fb * (i - n < b.length ? wet / Math.max(wet, fb) : 1);
  return fade(out, 0.05);
}
/** Trim trailing near-silence. */
export function trim(b: Buf, thr = 0.0015): Buf {
  let end = b.length;
  while (end > 1 && Math.abs(b[end - 1]) < thr) end--;
  return fade(b.slice(0, Math.min(b.length, end + Math.floor(0.01 * SR))), 0.01);
}
