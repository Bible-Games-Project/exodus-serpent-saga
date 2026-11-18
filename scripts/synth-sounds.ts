// Renders the "Synth" sound pack: short UI, pickup, power-up and impact sounds
// made from scratch (oscillators + filtered noise), so they are free of any
// copyright. Writes WAV files to public/audio/Library/Synth/ and pack.json
// with their names. Deterministic: re-running gives the same files.
//
//   bun scripts/synth-sounds.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SR = 44100;
const OUT = join(import.meta.dir, "..", "public", "audio", "Library", "Synth");

// ---------- seeded random ----------
let seed = 1;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

type Buf = Float32Array;
const buf = (sec: number): Buf => new Float32Array(Math.ceil(sec * SR));

/** add b into a at time t (seconds) with gain g */
function mixAt(a: Buf, b: Buf, t = 0, g = 1) {
  const o = Math.floor(t * SR);
  for (let i = 0; i < b.length && o + i < a.length; i++) a[o + i] += b[i] * g;
  return a;
}

/** attack (s) then exponential decay with time constant tau (s) */
const env = (t: number, attack: number, tau: number) => (t < attack ? t / attack : Math.exp(-(t - attack) / tau));

type Wave = "sine" | "tri" | "square" | "saw";
function wave(w: Wave, ph: number) {
  const x = ph - Math.floor(ph);
  switch (w) {
    case "sine": return Math.sin(2 * Math.PI * x);
    case "tri": return 1 - 4 * Math.abs(x - 0.5);
    case "square": return Math.tanh(4 * Math.sin(2 * Math.PI * x)) * 0.8; // soft, less aliasing
    case "saw": return (2 * x - 1) * 0.7;
  }
}

/** tone with exponential pitch glide f0 → f1, optional vibrato */
function tone(o: { f0: number; f1?: number; dur: number; w?: Wave; a?: number; tau?: number; vib?: number; vibHz?: number }): Buf {
  const b = buf(o.dur);
  const f1 = o.f1 ?? o.f0;
  let ph = 0;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const k = t / o.dur;
    let f = o.f0 * Math.pow(f1 / o.f0, k);
    if (o.vib) f *= 1 + o.vib * Math.sin(2 * Math.PI * (o.vibHz ?? 6) * t);
    ph += f / SR;
    b[i] = wave(o.w ?? "sine", ph) * env(t, o.a ?? 0.002, o.tau ?? o.dur / 4);
  }
  return fadeOut(b);
}

/** bell / glass: inharmonic partials, higher ones die faster */
function bell(f: number, dur: number, bright = 1, tau = dur / 3): Buf {
  const b = buf(dur);
  const parts: Array<[number, number]> = [[1, 1], [2.76, 0.45 * bright], [5.4, 0.25 * bright], [8.93, 0.12 * bright]];
  for (const [m, amp] of parts) {
    const ff = f * m;
    if (ff > SR / 2.2) continue;
    for (let i = 0; i < b.length; i++) {
      const t = i / SR;
      b[i] += amp * Math.sin(2 * Math.PI * ff * t) * env(t, 0.001, tau / m ** 0.6);
    }
  }
  return fadeOut(norm(b, 0.9));
}

/** marimba / wood bar: fundamental + 4th harmonic dying fast */
function marimba(f: number, dur = 0.35): Buf {
  const b = buf(dur);
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    b[i] = Math.sin(2 * Math.PI * f * t) * env(t, 0.001, 0.09) + 0.35 * Math.sin(2 * Math.PI * f * 3.93 * t) * env(t, 0.0005, 0.018);
  }
  return fadeOut(b);
}

/** band-pass filtered noise burst, optional centre sweep c0 → c1 */
function noise(o: { dur: number; c0: number; c1?: number; q?: number; a?: number; tau?: number; wobble?: number }): Buf {
  const b = buf(o.dur);
  let low = 0, band = 0;
  const q = o.q ?? 1.2;
  for (let i = 0; i < b.length; i++) {
    const t = i / SR;
    const c = o.c0 * Math.pow((o.c1 ?? o.c0) / o.c0, t / o.dur);
    const fq = 2 * Math.sin((Math.PI * Math.min(c, SR / 6)) / SR);
    const x = rnd() * 2 - 1;
    low += fq * band;
    const high = x - low - band / q;
    band += fq * high;
    let e = env(t, o.a ?? 0.001, o.tau ?? o.dur / 4);
    if (o.wobble) e *= 0.6 + 0.4 * Math.sin(2 * Math.PI * o.wobble * t + rnd() * 0.3);
    b[i] = band * e;
  }
  return fadeOut(norm(b, 0.8));
}

/** low-pass (one pole) */
function lowpass(b: Buf, hz: number): Buf {
  const k = 1 - Math.exp((-2 * Math.PI * hz) / SR);
  let y = 0;
  for (let i = 0; i < b.length; i++) b[i] = y += k * (b[i] - y);
  return b;
}

/** a little air: a few early reflections */
function room(b: Buf, amount = 0.25): Buf {
  const out = buf(b.length / SR + 0.12);
  mixAt(out, b);
  for (const [d, g] of [[0.023, 0.6], [0.041, 0.45], [0.067, 0.3], [0.089, 0.2]] as const) mixAt(out, b, d, g * amount);
  return fadeOut(out);
}

function fadeOut(b: Buf, sec = 0.01): Buf {
  const n = Math.min(b.length, Math.floor(sec * SR));
  for (let i = 0; i < n; i++) b[b.length - 1 - i] *= i / n;
  return b;
}

function norm(b: Buf, peak = 0.89): Buf {
  let m = 0;
  for (const v of b) m = Math.max(m, Math.abs(v));
  if (m > 0) for (let i = 0; i < b.length; i++) b[i] *= peak / m;
  return b;
}

const seq = (dur: number, parts: Array<[Buf, number, number?]>) => {
  const out = buf(dur);
  for (const [b, t, g] of parts) mixAt(out, b, t, g ?? 1);
  return out;
};

const N = (semi: number) => 440 * Math.pow(2, semi / 12); // semitones from A4

// ---------- the pack ----------
type Def = { file: string; name: string; group: string; make: () => Buf; peak?: number };
const UI = "UI (synth)", PICK = "Pickups (synth)", POWER = "Power-ups (synth)", HIT = "Impacts (synth)";

const DEFS: Def[] = [
  // UI: hovers / ticks
  { file: "ui-soft-tick", name: "Soft tick", group: UI, peak: 0.45, make: () => seq(0.06, [[tone({ f0: 2400, dur: 0.04, tau: 0.008 }), 0], [noise({ dur: 0.015, c0: 5000, tau: 0.003 }), 0, 0.3]]) },
  { file: "ui-glass-tick", name: "Glass tick", group: UI, peak: 0.4, make: () => bell(3136, 0.12, 0.6, 0.03) },
  { file: "ui-bubble-blip", name: "Bubble blip", group: UI, peak: 0.5, make: () => tone({ f0: 480, f1: 1150, dur: 0.06, tau: 0.02 }) },
  { file: "ui-tiny-pip", name: "Tiny pip", group: UI, peak: 0.35, make: () => tone({ f0: 1760, dur: 0.035, w: "tri", tau: 0.01 }) },
  { file: "ui-velvet-tap", name: "Velvet tap", group: UI, peak: 0.45, make: () => lowpass(seq(0.07, [[tone({ f0: 700, f1: 520, dur: 0.05, tau: 0.012 }), 0], [noise({ dur: 0.02, c0: 1800, tau: 0.004 }), 0, 0.5]]), 3000) },
  // UI: clicks
  { file: "ui-wood-click", name: "Wood click", group: UI, make: () => seq(0.08, [[noise({ dur: 0.025, c0: 2600, q: 3, tau: 0.004 }), 0], [tone({ f0: 620, f1: 560, dur: 0.05, tau: 0.012 }), 0, 0.7]]) },
  { file: "ui-wood-tap", name: "Wood tap", group: UI, make: () => marimba(N(15), 0.12) },
  { file: "ui-pop", name: "Pop", group: UI, make: () => tone({ f0: 950, f1: 260, dur: 0.06, tau: 0.018 }) },
  { file: "ui-soft-click", name: "Soft click", group: UI, make: () => seq(0.07, [[noise({ dur: 0.012, c0: 4200, tau: 0.002 }), 0, 0.8], [tone({ f0: 190, f1: 140, dur: 0.05, tau: 0.012 }), 0]]) },
  { file: "ui-retro-blip", name: "Retro blip", group: UI, peak: 0.5, make: () => tone({ f0: 880, dur: 0.05, w: "square", tau: 0.02 }) },
  { file: "ui-stone-click", name: "Stone click", group: UI, make: () => seq(0.08, [[noise({ dur: 0.03, c0: 1400, q: 4, tau: 0.006 }), 0], [noise({ dur: 0.02, c0: 3800, q: 5, tau: 0.003 }), 0.004, 0.6]]) },
  // UI: confirm / back
  { file: "ui-chime-up", name: "Two-note chime up", group: UI, make: () => room(seq(0.45, [[bell(N(15), 0.3, 0.7), 0], [bell(N(22), 0.38, 0.7), 0.07]])) },
  { file: "ui-bright-confirm", name: "Bright confirm", group: UI, make: () => room(seq(0.4, [[tone({ f0: N(15), dur: 0.09, w: "tri", tau: 0.05 }), 0], [tone({ f0: N(19), dur: 0.09, w: "tri", tau: 0.05 }), 0.05], [tone({ f0: N(22), dur: 0.25, w: "tri", tau: 0.09 }), 0.1]])) },
  { file: "ui-harp-confirm", name: "Harp pluck confirm", group: UI, make: () => room(seq(0.5, [[marimba(N(10), 0.3), 0], [marimba(N(17), 0.35), 0.06]]), 0.4) },
  { file: "ui-chime-down", name: "Two-note chime down", group: UI, make: () => room(seq(0.45, [[bell(N(22), 0.3, 0.6), 0], [bell(N(15), 0.38, 0.6), 0.07]])) },
  { file: "ui-soft-cancel", name: "Soft cancel", group: UI, make: () => tone({ f0: 620, f1: 380, dur: 0.16, w: "tri", tau: 0.06 }) },
  { file: "ui-wood-back", name: "Wooden back", group: UI, make: () => seq(0.3, [[marimba(N(10), 0.15), 0], [marimba(N(3), 0.2), 0.07]]) },
  // UI: menus
  { file: "ui-rising-swoosh", name: "Rising swoosh", group: UI, make: () => seq(0.45, [[noise({ dur: 0.3, c0: 500, c1: 3200, q: 2, a: 0.18, tau: 0.05 }), 0], [bell(N(22), 0.25, 0.5), 0.2, 0.5]]) },
  { file: "ui-falling-swoosh", name: "Falling swoosh", group: UI, make: () => seq(0.4, [[noise({ dur: 0.3, c0: 3000, c1: 500, q: 2, a: 0.03, tau: 0.09 }), 0], [tone({ f0: 300, f1: 200, dur: 0.12, tau: 0.04 }), 0.18, 0.5]]) },
  { file: "ui-scroll-open", name: "Scroll unroll", group: UI, make: () => noise({ dur: 0.35, c0: 1200, c1: 2600, q: 1.5, a: 0.05, tau: 0.12, wobble: 38 }) },
  { file: "ui-scroll-close", name: "Scroll roll up", group: UI, make: () => noise({ dur: 0.3, c0: 2600, c1: 1100, q: 1.5, a: 0.02, tau: 0.1, wobble: 44 }) },
  // UI: tabs / cards / paper
  { file: "ui-paper-flick", name: "Paper flick", group: UI, make: () => noise({ dur: 0.08, c0: 3500, c1: 2200, q: 1, a: 0.004, tau: 0.02 }) },
  { file: "ui-card-flip", name: "Card flip", group: UI, make: () => seq(0.15, [[noise({ dur: 0.05, c0: 3000, q: 1, tau: 0.012 }), 0], [noise({ dur: 0.07, c0: 2200, q: 1, tau: 0.02 }), 0.045]]) },
  { file: "ui-page-turn", name: "Page turn", group: UI, make: () => noise({ dur: 0.22, c0: 1500, c1: 3800, q: 0.9, a: 0.03, tau: 0.06, wobble: 25 }) },
  { file: "ui-double-tick", name: "Double tick", group: UI, peak: 0.5, make: () => seq(0.09, [[tone({ f0: 2000, dur: 0.025, tau: 0.006 }), 0], [tone({ f0: 2600, dur: 0.03, tau: 0.007 }), 0.035]]) },
  // UI: pause / resume
  { file: "ui-pause-tones", name: "Pause tones", group: UI, make: () => lowpass(seq(0.4, [[tone({ f0: N(7), dur: 0.15, tau: 0.06 }), 0], [tone({ f0: N(0), dur: 0.25, tau: 0.1 }), 0.1]]), 2500) },
  { file: "ui-resume-tones", name: "Resume tones", group: UI, make: () => lowpass(seq(0.4, [[tone({ f0: N(0), dur: 0.15, tau: 0.06 }), 0], [tone({ f0: N(7), dur: 0.25, tau: 0.1 }), 0.1]]), 2500) },
  { file: "ui-hush", name: "Hush (muffled drop)", group: UI, make: () => lowpass(seq(0.4, [[noise({ dur: 0.3, c0: 1200, c1: 300, a: 0.01, tau: 0.1 }), 0], [tone({ f0: 220, f1: 110, dur: 0.3, tau: 0.1 }), 0, 0.6]]), 1500) },
  // UI: toggles / sliders
  { file: "ui-toggle-on", name: "Toggle on", group: UI, make: () => seq(0.1, [[noise({ dur: 0.012, c0: 4000, tau: 0.002 }), 0, 0.7], [tone({ f0: 1250, dur: 0.06, tau: 0.02 }), 0.01]]) },
  { file: "ui-toggle-off", name: "Toggle off", group: UI, make: () => seq(0.1, [[noise({ dur: 0.012, c0: 3000, tau: 0.002 }), 0, 0.7], [tone({ f0: 760, dur: 0.06, tau: 0.02 }), 0.01]]) },
  { file: "ui-switch-click", name: "Switch click", group: UI, make: () => seq(0.08, [[noise({ dur: 0.01, c0: 5000, q: 4, tau: 0.0015 }), 0], [noise({ dur: 0.012, c0: 3500, q: 4, tau: 0.002 }), 0.022, 0.8]]) },
  { file: "ui-slider-tick", name: "Slider tick", group: UI, peak: 0.3, make: () => tone({ f0: 3200, dur: 0.02, tau: 0.004 }) },
  { file: "ui-ratchet-tick", name: "Ratchet tick", group: UI, peak: 0.4, make: () => noise({ dur: 0.02, c0: 2800, q: 6, tau: 0.003 }) },
  // UI: error
  { file: "ui-error-buzz", name: "Error buzz", group: UI, make: () => lowpass(seq(0.3, [[tone({ f0: 165, dur: 0.1, w: "square", a: 0.003, tau: 0.08 }), 0], [tone({ f0: 155, dur: 0.12, w: "square", a: 0.003, tau: 0.08 }), 0.13]]), 1800) },
  { file: "ui-soft-error", name: "Soft error", group: UI, make: () => seq(0.3, [[tone({ f0: 330, f1: 300, dur: 0.1, w: "tri", tau: 0.05 }), 0], [tone({ f0: 262, f1: 240, dur: 0.15, w: "tri", tau: 0.06 }), 0.11]]) },
  { file: "ui-wood-thunk", name: "Wooden thunk (denied)", group: UI, make: () => seq(0.2, [[marimba(110, 0.18), 0], [noise({ dur: 0.04, c0: 600, q: 2, tau: 0.01 }), 0, 0.6]]) },
  // UI: shop
  { file: "ui-coin-chime", name: "Coin chime", group: UI, make: () => room(seq(0.45, [[bell(N(24), 0.12, 0.8, 0.05), 0], [bell(N(31), 0.4, 0.8, 0.12), 0.06]])) },
  { file: "ui-coins-jingle", name: "Coins jingle", group: UI, make: () => { seed = 77; const parts: Array<[Buf, number, number]> = []; for (let i = 0; i < 9; i++) parts.push([bell(2400 + rnd() * 2600, 0.18, 1, 0.05), i * 0.03 + rnd() * 0.02, 0.4 + rnd() * 0.5]); return room(seq(0.55, parts)); } },
  { file: "ui-purchase-sparkle", name: "Purchase sparkle", group: UI, make: () => room(seq(0.7, [[bell(N(19), 0.2, 0.7, 0.06), 0], [bell(N(22), 0.2, 0.7, 0.06), 0.06], [bell(N(26), 0.2, 0.7, 0.06), 0.12], [bell(N(31), 0.5, 0.8, 0.16), 0.18]])) },
  { file: "ui-metal-clink", name: "Metal clink", group: UI, make: () => seq(0.35, [[noise({ dur: 0.01, c0: 6000, tau: 0.002 }), 0, 0.6], [bell(1830, 0.3, 1.3, 0.1), 0.002]]) },
  { file: "ui-leather-buckle", name: "Leather and buckle", group: UI, make: () => seq(0.35, [[noise({ dur: 0.12, c0: 700, q: 1, a: 0.01, tau: 0.04 }), 0], [bell(2400, 0.2, 1.2, 0.05), 0.08, 0.5]]) },
  { file: "ui-heavy-equip", name: "Heavy equip", group: UI, make: () => seq(0.4, [[tone({ f0: 140, f1: 70, dur: 0.2, tau: 0.06 }), 0], [noise({ dur: 0.05, c0: 900, tau: 0.012 }), 0, 0.6], [bell(1500, 0.3, 1.4, 0.09), 0.03, 0.6]]) },

  // Pickups
  { file: "pickup-gem-chime", name: "Gem chime", group: PICK, peak: 0.6, make: () => bell(N(27), 0.16, 0.5, 0.04) },
  { file: "pickup-glass-gem", name: "Glass gem", group: PICK, peak: 0.55, make: () => seq(0.14, [[tone({ f0: 2637, dur: 0.12, tau: 0.03 }), 0], [tone({ f0: 5274, dur: 0.06, tau: 0.01 }), 0, 0.3]]) },
  { file: "pickup-marimba-blip", name: "Marimba blip", group: PICK, peak: 0.6, make: () => marimba(N(15), 0.16) },
  { file: "pickup-twinkle", name: "Sparkle twinkle", group: PICK, peak: 0.55, make: () => { seed = 12; return seq(0.25, [[bell(3520, 0.1, 0.4, 0.03), 0], [bell(4186, 0.1, 0.4, 0.03), 0.035], [bell(5274, 0.12, 0.4, 0.03), 0.07]]); } },
  { file: "pickup-soft-pluck", name: "Soft pluck", group: PICK, peak: 0.55, make: () => lowpass(tone({ f0: N(19), dur: 0.12, w: "tri", tau: 0.03 }), 4000) },

  // Power-ups / bonuses
  { file: "power-arpeggio", name: "Power-up arpeggio", group: POWER, make: () => room(seq(0.5, [0, 4, 7, 12].map((s, i) => [tone({ f0: N(3 + s), dur: 0.14, w: "tri", tau: 0.06 }), i * 0.055] as [Buf, number]))) },
  { file: "power-magic-rise", name: "Magic rise", group: POWER, make: () => room(seq(0.7, [[tone({ f0: 400, f1: 1600, dur: 0.5, a: 0.05, tau: 0.25, vib: 0.02, vibHz: 9 }), 0], [bell(N(27), 0.3, 0.6), 0.4, 0.5]])) },
  { file: "power-heal-chord", name: "Heal chord", group: POWER, make: () => room(seq(0.9, [[bell(N(15), 0.8, 0.4, 0.3), 0], [bell(N(19), 0.8, 0.4, 0.3), 0.04], [bell(N(22), 0.8, 0.4, 0.3), 0.08]]), 0.4) },
  { file: "power-shield-shimmer", name: "Shield shimmer", group: POWER, make: () => { const b = seq(0.8, [[bell(1320, 0.7, 1.5, 0.25), 0], [bell(1980, 0.6, 1.2, 0.2), 0.05]]); for (let i = 0; i < b.length; i++) b[i] *= 0.7 + 0.3 * Math.sin(2 * Math.PI * 14 * (i / SR)); return room(b); } },
  { file: "power-speed-zip", name: "Speed zip", group: POWER, make: () => seq(0.3, [[tone({ f0: 300, f1: 2400, dur: 0.18, w: "saw", tau: 0.08 }), 0, 0.5], [noise({ dur: 0.2, c0: 1500, c1: 6000, q: 1.5, tau: 0.06 }), 0, 0.6]]) },
  { file: "power-magnet-hum", name: "Magnet hum rise", group: POWER, make: () => { const b = seq(0.6, [[tone({ f0: 110, f1: 220, dur: 0.55, a: 0.1, tau: 0.3 }), 0], [tone({ f0: 220, f1: 440, dur: 0.55, a: 0.1, tau: 0.3 }), 0, 0.4]]); for (let i = 0; i < b.length; i++) b[i] *= 0.6 + 0.4 * Math.sin(2 * Math.PI * 22 * (i / SR)); return b; } },
  { file: "power-star-fanfare", name: "Star fanfare", group: POWER, make: () => room(seq(0.8, [7, 12, 16, 19].map((s, i) => [bell(N(10 + s), 0.45, 0.6, 0.15), i * 0.07] as [Buf, number]))) },
  { file: "power-retro", name: "Retro power-up", group: POWER, peak: 0.6, make: () => seq(0.5, [0, 3, 7, 12, 15, 19, 24, 27].map((s, i) => [tone({ f0: N(s), dur: 0.06, w: "square", tau: 0.04 }), i * 0.045] as [Buf, number])) },
  { file: "power-holy-chord", name: "Holy chord", group: POWER, make: () => room(seq(1.0, [[tone({ f0: N(3), dur: 0.9, a: 0.15, tau: 0.35, vib: 0.004 }), 0], [tone({ f0: N(7), dur: 0.9, a: 0.18, tau: 0.35, vib: 0.004 }), 0], [tone({ f0: N(10), dur: 0.9, a: 0.2, tau: 0.35, vib: 0.004 }), 0], [tone({ f0: N(15), dur: 0.9, a: 0.22, tau: 0.35, vib: 0.004 }), 0, 0.5]]), 0.5) },
  { file: "power-bonus-pop", name: "Bonus pop", group: POWER, make: () => seq(0.35, [[tone({ f0: 700, f1: 300, dur: 0.07, tau: 0.02 }), 0], [bell(N(31), 0.25, 0.5, 0.07), 0.05, 0.5]]) },

  // Impacts
  { file: "hit-thud", name: "Thud", group: HIT, make: () => seq(0.2, [[tone({ f0: 160, f1: 60, dur: 0.15, tau: 0.04 }), 0], [noise({ dur: 0.04, c0: 500, q: 1, tau: 0.01 }), 0, 0.7]]) },
  { file: "hit-heavy-thud", name: "Heavy thud", group: HIT, make: () => seq(0.35, [[tone({ f0: 110, f1: 40, dur: 0.3, tau: 0.08 }), 0], [noise({ dur: 0.1, c0: 300, q: 0.8, tau: 0.03 }), 0, 0.8]]) },
  { file: "hit-punch", name: "Punch", group: HIT, make: () => lowpass(seq(0.15, [[noise({ dur: 0.06, c0: 900, q: 0.7, tau: 0.012 }), 0], [tone({ f0: 120, f1: 70, dur: 0.1, tau: 0.03 }), 0]]), 3500) },
  { file: "hit-stab", name: "Stab", group: HIT, make: () => seq(0.15, [[noise({ dur: 0.05, c0: 2500, c1: 900, q: 1.5, tau: 0.012 }), 0], [tone({ f0: 220, f1: 110, dur: 0.07, tau: 0.02 }), 0.005, 0.6]]) },
  { file: "hit-slice", name: "Slice", group: HIT, make: () => seq(0.25, [[noise({ dur: 0.06, c0: 6000, c1: 3000, q: 1, tau: 0.015 }), 0], [bell(2900, 0.2, 0.8, 0.05), 0.01, 0.35]]) },
  { file: "hit-metal", name: "Metal hit", group: HIT, make: () => seq(0.35, [[noise({ dur: 0.02, c0: 4000, tau: 0.004 }), 0], [bell(1250, 0.3, 1.6, 0.08), 0.002, 0.7]]) },
  { file: "hit-crunch", name: "Crunch", group: HIT, make: () => { seed = 5; const parts: Array<[Buf, number, number]> = []; for (let i = 0; i < 6; i++) parts.push([noise({ dur: 0.03, c0: 800 + rnd() * 1800, q: 2, tau: 0.008 }), i * 0.012 + rnd() * 0.01, 1 - i * 0.12]); return seq(0.15, parts); } },
  { file: "hit-wood-knock", name: "Wood knock", group: HIT, make: () => seq(0.15, [[marimba(330, 0.12), 0], [noise({ dur: 0.02, c0: 1800, q: 3, tau: 0.004 }), 0, 0.7]]) },
  { file: "hit-ground-slam", name: "Ground slam", group: HIT, make: () => seq(0.6, [[tone({ f0: 90, f1: 35, dur: 0.5, tau: 0.15 }), 0], [noise({ dur: 0.4, c0: 400, c1: 150, q: 0.7, tau: 0.12 }), 0, 0.9], [noise({ dur: 0.15, c0: 2500, q: 1, tau: 0.03 }), 0.01, 0.3]]) },
  { file: "hit-soft-splat", name: "Soft splat", group: HIT, make: () => lowpass(noise({ dur: 0.12, c0: 700, c1: 300, q: 0.8, tau: 0.03 }), 2000) },
];

// ---------- WAV writer ----------
function wav(b: Buf): Buffer {
  const out = Buffer.alloc(44 + b.length * 2);
  out.write("RIFF", 0); out.writeUInt32LE(36 + b.length * 2, 4); out.write("WAVE", 8);
  out.write("fmt ", 12); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(1, 22);
  out.writeUInt32LE(SR, 24); out.writeUInt32LE(SR * 2, 28); out.writeUInt16LE(2, 32); out.writeUInt16LE(16, 34);
  out.write("data", 36); out.writeUInt32LE(b.length * 2, 40);
  for (let i = 0; i < b.length; i++) out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, b[i])) * 32767), 44 + i * 2);
  return out;
}

mkdirSync(OUT, { recursive: true });
const pack = DEFS.map((d) => {
  seed = 1 + d.file.length * 97;
  const b = norm(d.make(), d.peak ?? 0.8);
  writeFileSync(join(OUT, `${d.file}.wav`), wav(b));
  return { file: `${d.file}.wav`, name: d.name, group: d.group };
});
writeFileSync(join(OUT, "pack.json"), JSON.stringify({ source: "Synth", license: "Made for this game (no third-party audio)", sounds: pack }, null, 2) + "\n");
console.log(`${pack.length} synth sounds written`);
