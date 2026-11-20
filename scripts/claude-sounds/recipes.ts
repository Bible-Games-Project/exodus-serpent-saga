// One recipe per game action; each is rendered in two versions (v = 0 / 1).
import {
  N, SR, GLASS, METAL, STONE, WOOD, ad, add, am, bp, brown, bubbles, buf, choir, click, crackle, drive, env, fadeIn, filt, gain,
  hp, lp, mix, modal, norm, osc, pink, pluck, reverb, rnd, rr, scaleTau, swell, thump, unison, voice, white, whoosh, echo,
  type Buf,
} from "./dsp";

type V = 0 | 1;
const pick = <T,>(v: V, a: T, b: T) => (v ? b : a);

// ---------- shared pieces ----------
/** Bright magical sparkle: random high glassy pings. */
function sparkle(d: number, count: number, lo = 2500, hi = 6000): Buf {
  const out = buf(d);
  for (let i = 0; i < count; i++) add(out, modal(rr(lo, hi), 0.25, scaleTau(GLASS, 0.25)), rr(0, d - 0.2), rr(0.2, 0.6));
  return out;
}
/** Bell arpeggio (semitones from A4) with a little room. */
const arp = (notes: number[], step: number, tau = 0.5, d = 1.2) =>
  reverb(mix(d, notes.map((s, i) => [modal(N(s), d * 0.8, scaleTau(GLASS, tau)), i * step] as [Buf, number])), 0.25, 0.6);
/** Soft mallet note (marimba-like). */
const mallet = (f: number, d = 0.4) => modal(f, d, [[1, 1, 0.12], [3.93, 0.3, 0.025], [9.2, 0.08, 0.008]]);
/** Fire: rumble + crackle. */
function fire(d: number, intensity = 1): Buf {
  const roar = swell(lp(brown(d), [300, 900], 0.8), 0.35, 1.2);
  const hiss = swell(bp(pink(d), 2500, 0.7), 0.4, 1.5);
  const cr = crackle(d, (t) => 25 + 60 * intensity * Math.sin((Math.PI * t) / d), 2800, 1.2, 0.002);
  return mix(d, [[roar, 0, 1.2], [hiss, 0, 0.25 * intensity], [cr, 0, 0.9]]);
}
/** Explosion / boom. */
const boom = (d: number, f0 = 90, f1 = 32, tau = 0.25) =>
  mix(d, [[thump(f0, f1, d, tau), 0, 1], [ad(lp(brown(d), [1800, 200], 0.7), 0.002, tau * 1.2), 0, 1.4], [click(1500, 0.02), 0, 0.5]]);
/** Short airy swish of a moving object. */
const swish = (d = 0.18, c0 = 900, c1 = 3200) => whoosh(d, c0, c1, 1.4, 0.55);
/** Vocal grunt (formant voice with a falling pitch). */
const grunt = (f0: number, f1: number, d: number, vowel: "a" | "o" | "u" | "e" = "u", shift = 1) =>
  ad(voice(osc({ f: [f0, f1], d, w: "saw", vib: 0.02, vibHz: 18 }), vowel, shift, 4), 0.01, d / 2.5);
/** Water body (rushing). */
const water = (d: number, c0 = 400, c1 = 1500) => mix(d, [[swell(lp(pink(d), [c0, c1], 0.8), 0.5, 1.3), 0, 1], [bubbles(d, Math.floor(d * 30), 300, 900), 0, 0.25]]);
/** Two-note interval motif. */
const twoNotes = (a: number, b: number, gap = 0.12, len = 0.35, w: "tri" | "sine" = "tri") =>
  reverb(mix(gap + len + 0.1, [[ad(osc({ f: N(a), d: len, w }), 0.005, len / 3), 0], [ad(osc({ f: N(b), d: len, w }), 0.005, len / 3), gap]]), 0.2, 0.5);

/** loud: target loudness in dB (loudest 100 ms) — defaults by category in render.ts. */
export type Recipe = { id: string; make: (v: V) => Buf; loud?: number };

export const RECIPES: Recipe[] = [
  // ======================= Weapons (impacts) =======================
  { id: "weapon.staff.hit", make: (v) => mix(0.25, [[modal(pick(v, 360, 270), 0.2, WOOD), 0, 1], [thump(pick(v, 170, 130), 70, 0.12, 0.03), 0, 0.8], [click(2500, 0.01), 0, 0.5]]) },
  { id: "weapon.spear.hit", make: (v) => mix(0.22, [[ad(bp(white(0.08), [pick(v, 3200, 2600), 1100], 1.6), 0.001, 0.018), 0, 1], [thump(190, 85, 0.12, 0.03), 0.004, 0.8], [modal(pick(v, 2300, 1900), 0.15, scaleTau(METAL, 0.12)), 0.002, 0.15]]) },
  { id: "weapon.sword.hit", make: (v) => mix(0.3, [[ad(bp(white(0.09), [5200, 2200], 1.2), 0.001, 0.02), 0, 0.9], [modal(pick(v, 1650, 1900), 0.28, scaleTau(METAL, 0.25)), 0.002, 0.3], [thump(160, 80, 0.1, 0.025), 0.003, 0.8]]) },
  { id: "weapon.sword.crit", make: (v) => reverb(mix(0.5, [[ad(bp(white(0.12), [6000, 2000], 1.2), 0.001, 0.03), 0, 1], [modal(pick(v, 1400, 1750), 0.45, scaleTau(METAL, 0.5)), 0.002, 0.45], [thump(120, 45, 0.3, 0.07), 0, 1], [sparkle(0.4, 4, 3500, 7000), 0.03, 0.4]]), 0.2, 0.5) },
  { id: "weapon.axe.impact", make: (v) => mix(0.5, [[thump(pick(v, 110, 95), 38, 0.4, 0.09), 0, 1], [ad(lp(brown(0.35), [1400, 300], 0.8), 0.001, 0.08), 0, 1.2], [crackle(0.3, (t) => 250 * Math.exp(-t * 12), 1800, 1, 0.003), 0.01, 0.7], [modal(pick(v, 900, 760), 0.2, scaleTau(METAL, 0.1)), 0, 0.12]]) },
  { id: "weapon.mace.impact", make: (v) => reverb(mix(0.7, [[thump(pick(v, 85, 70), 30, 0.6, 0.14), 0, 1], [ad(lp(brown(0.5), [1000, 180], 0.7), 0.001, 0.12), 0, 1.4], [crackle(0.45, (t) => 300 * Math.exp(-t * 9), 1500, 1, 0.004), 0.015, 0.8], [click(900, 0.02), 0, 0.5]]), 0.15, 0.4, 0.5, 0.4) },
  { id: "weapon.dagger.hit", make: (v) => mix(0.16, [[ad(bp(white(0.06), [pick(v, 6000, 5000), 3000], 1.8), 0.0005, 0.012), 0, 1], [thump(260, 130, 0.07, 0.018), 0.002, 0.6], [modal(pick(v, 3100, 2700), 0.1, scaleTau(METAL, 0.08)), 0.001, 0.15]]) },
  { id: "weapon.harpoon.hit", make: (v) => mix(0.35, [[thump(pick(v, 150, 120), 60, 0.2, 0.05), 0, 1], [ad(bp(white(0.06), 2200, 1.5), 0.0005, 0.012), 0, 0.6], [ad(lp(pink(0.25), [2500, 700], 0.8), 0.005, 0.06), 0.01, 0.6], [bubbles(0.25, 5, 500, 1100), 0.03, 0.3]]) },
  { id: "weapon.harpoon.whirlpool", make: (v) => {
    const d = 1.3;
    const swirl = swell(bp(pink(d), (t) => 700 + 450 * Math.sin(2 * Math.PI * pick(v, 3, 4) * t) + 600 * (t / d), 2.2), 0.4, 1.3);
    return reverb(mix(d, [[swirl, 0, 1.2], [swell(lp(brown(d), 500, 0.8), 0.4, 1.2), 0, 0.8], [bubbles(d, 26, 350, 1000), 0, 0.35]]), 0.25, 0.6);
  } },
  { id: "weapon.boomerang.hit", make: (v) => mix(0.3, [[modal(pick(v, 420, 340), 0.2, WOOD), 0, 1], [thump(160, 80, 0.1, 0.025), 0, 0.7], [swish(0.2, 2400, 800), 0.03, 0.35]]) },
  { id: "weapon.boomerang.catch", make: (v) => mix(0.2, [[ad(lp(pink(0.08), 1600, 0.7), 0.001, 0.02), 0, 1], [modal(pick(v, 520, 460), 0.15, scaleTau(WOOD, 0.6)), 0.004, 0.6]]) },
  { id: "weapon.ring.hit", make: (v) => mix(0.5, [[modal(pick(v, 1180, 1420), 0.5, scaleTau(METAL, 0.6)), 0, 0.8], [click(5000, 0.008), 0, 0.5], [thump(200, 120, 0.06, 0.015), 0, 0.4]]) },
  { id: "weapon.ring.ricochet", make: (v) => mix(0.45, [[modal(pick(v, 1500, 1750), 0.25, scaleTau(METAL, 0.25)), 0, 0.7], [ad(osc({ f: [pick(v, 2600, 3000), pick(v, 1300, 1500)], d: 0.35, vib: 0.01, vibHz: 30 }), 0.005, 0.12), 0.02, 0.35], [click(6000, 0.006), 0, 0.5]]) },
  { id: "weapon.ring.zap", make: (v) => {
    const d = 0.3;
    const z = ad(lp(osc({ f: (t) => pick(v, 140, 180) * (1 + 0.6 * (rnd() - 0.5)) + 60 * Math.sin(t * 900), d, w: "saw" }), 4500), 0.001, 0.08);
    return mix(d, [[drive(z, 2), 0, 0.6], [crackle(d, (t) => 400 * Math.exp(-t * 10), 5000, 0.8, 0.0015), 0, 1], [click(7000, 0.01), 0, 0.6]]);
  } },
  { id: "weapon.projectile.hit", make: (v) => mix(0.45, [[ad(lp(pink(0.35), [4000, 500], 0.8), 0.001, 0.07), 0, 1], [thump(pick(v, 140, 110), 50, 0.2, 0.05), 0, 0.7], [crackle(0.4, (t) => 120 * Math.exp(-t * 6), 3000, 1, 0.002), 0.02, 0.8]]) },
  { id: "weapon.shield.block", make: (v) => mix(0.4, [[modal(pick(v, 620, 540), 0.35, scaleTau(METAL, 0.35)), 0, 0.7], [ad(lp(white(0.04), 3000), 0.0005, 0.008), 0, 0.6], [thump(180, 100, 0.08, 0.02), 0, 0.6]]) },

  // ======================= Staff specials =======================
  { id: "magic.special.charge", make: (v) => {
    const d = 1.2;
    const rise = env(unison({ f: [pick(v, 220, 180), pick(v, 880, 720)], d, w: "tri", n: 5, detune: 0.012 }), [[0, 0], [0.9, 0.8], [1.1, 1], [d, 0]]);
    const air = env(hp(pink(d), [800, 4000]), [[0, 0], [1.0, 0.6], [d, 0]]);
    return reverb(mix(d, [[am(rise, [6, 22], 0.4), 0, 0.6], [air, 0, 0.35], [sparkle(d, 10), 0.3, 0.25]]), 0.25, 0.6);
  } },
  { id: "magic.special.burst", make: (v) => reverb(mix(0.9, [[boom(0.6, 120, 40, 0.15), 0, 0.8], [arp(pick(v, [15, 19, 22, 27], [12, 17, 21, 24]), 0.025, 0.4, 0.8), 0, 0.5], [sparkle(0.6, 12), 0.02, 0.5]]), 0.25, 0.6) },
  { id: "magic.special.ring", make: (v) => reverb(mix(1.0, [[whoosh(0.6, 500, 4000, 1.5, 0.3), 0, 0.8], [ad(unison({ f: [N(pick(v, 3, 5)), N(pick(v, 15, 17))], d: 0.6, w: "tri", n: 4, detune: 0.01 }), 0.02, 0.2), 0, 0.5], [sparkle(0.7, 8), 0.1, 0.35]]), 0.3, 0.7) },
  { id: "magic.special.shard", make: (v) => {
    const out = buf(0.8);
    for (let i = 0; i < 9; i++) add(out, modal(rr(pick(v, 1800, 2400), pick(v, 4200, 5200)), 0.4, scaleTau(GLASS, 0.5)), i * 0.035 + rr(0, 0.02), rr(0.4, 0.9));
    return reverb(mix(0.8, [[click(5000, 0.02), 0, 0.8], [out, 0, 0.6], [ad(hp(white(0.3), 3000), 0.001, 0.05), 0, 0.3]]), 0.2, 0.5);
  } },
  { id: "magic.special.firering", make: (v) => reverb(mix(1.1, [[fire(1.0, pick(v, 1, 1.4)), 0, 1], [whoosh(0.7, 300, 1800, 1, 0.35), 0, 0.7]]), 0.15, 0.5) },
  { id: "magic.special.tornado", make: (v) => {
    const d = 1.5;
    const wind = swell(bp(pink(d), (t) => (pick(v, 500, 650) + 900 * (t / d)) * (1 + 0.25 * Math.sin(2 * Math.PI * 5 * t)), 3), 0.5, 1.3);
    const low = swell(lp(brown(d), 300), 0.5, 1.2);
    return reverb(mix(d, [[wind, 0, 1.3], [low, 0, 0.6]]), 0.2, 0.6);
  } },
  { id: "magic.special.wave", make: (v) => reverb(mix(1.2, [[water(1.1, pick(v, 300, 400), pick(v, 1800, 2400)), 0, 1], [ad(lp(pink(0.6), [3000, 600]), 0.01, 0.2), 0.35, 0.6]]), 0.2, 0.6) },
  { id: "magic.special.light", make: (v) => reverb(mix(1.6, [[choir(pick(v, [N(3), N(7), N(10)], [N(0), N(4), N(7)]), 1.4, "a", 0.15), 0, 0.8], [sparkle(1.2, 14, 3000, 7000), 0.05, 0.35], [ad(osc({ f: N(pick(v, 15, 12)), d: 1.2 }), 0.1, 0.5), 0, 0.3]]), 0.35, 0.8) },
  { id: "magic.special.godhand", make: (v) => reverb(mix(1.8, [[boom(1.0, 70, 28, 0.35), 0.05, 1], [choir(pick(v, [N(-12), N(-5), N(0), N(4)], [N(-9), N(-2), N(3), N(7)]), 1.6, "o", 0.08), 0, 0.7], [sparkle(1.2, 10, 2000, 5000), 0.1, 0.3]]), 0.35, 0.85) },

  // ======================= Plagues =======================
  { id: "plague.serpent.cast", make: (v) => reverb(mix(0.9, [[env(hp(white(0.7), pick(v, 3500, 4500)), [[0, 0], [0.08, 1], [0.5, 0.6], [0.7, 0]]), 0.15, 0.45], [ad(unison({ f: [N(-5), N(7)], d: 0.5, w: "tri", n: 3, detune: 0.01 }), 0.05, 0.2), 0, 0.5], [sparkle(0.5, 5), 0, 0.3]]), 0.2, 0.5) },
  { id: "plague.serpent.hit", make: (v) => mix(0.3, [[env(hp(white(0.25), pick(v, 4000, 5000)), [[0, 0], [0.02, 1], [0.12, 0.3], [0.25, 0]]), 0, 0.45], [click(2000, 0.015), 0.06, 1], [thump(220, 110, 0.08, 0.02), 0.06, 0.6]]) },
  { id: "plague.leprosy.cast", make: (v) => {
    const d = 1.0;
    const tones = unison({ f: [N(pick(v, 2, 0)), N(pick(v, -6, -8))], d, w: "sine", n: 4, detune: 0.03 });
    return reverb(mix(d, [[env(tones, [[0, 0], [0.1, 1], [d, 0]]), 0, 0.6], [env(bp(pink(d), 1200, 0.8), [[0, 0], [0.3, 0.6], [d, 0]]), 0, 0.3]]), 0.35, 0.7);
  } },
  { id: "plague.blood.cast", make: (v) => {
    const d = 1.3;
    const drone = swell(lp(unison({ f: pick(v, 55, 49), d, w: "saw", n: 4, detune: 0.01 }), 400), 0.4, 1.4);
    return reverb(mix(d, [[drone, 0, 0.7], [bubbles(d, 18, 120, 380), 0.05, 0.6], [swell(lp(pink(d), 700), 0.5), 0, 0.4]]), 0.25, 0.6);
  } },
  { id: "plague.frogs.cast", make: (v) => {
    const croak = (f: number) => ad(voice(am(osc({ f: [f, f * 0.85], d: 0.22, w: "pulse" }), 32, 0.9), "o", 0.9, 5), 0.005, 0.08);
    const out = buf(1.0);
    const n = pick(v, 4, 6);
    for (let i = 0; i < n; i++) add(out, croak(rr(90, 150)), i * rr(0.12, 0.18), rr(0.6, 1));
    return reverb(out, 0.15, 0.5);
  } },
  { id: "plague.frogs.hit", make: (v) => mix(0.2, [[ad(lp(pink(0.12), [2200, 500], 0.9), 0.001, 0.03), 0, 1], [thump(pick(v, 300, 240), 120, 0.1, 0.025), 0, 0.6]]) },
  { id: "plague.gnats.cast", make: (v) => {
    const d = 1.3;
    const out = buf(d);
    for (let i = 0; i < 9; i++) add(out, am(osc({ f: rr(pick(v, 550, 700), pick(v, 900, 1200)) , d, w: "saw", vib: 0.04, vibHz: rr(4, 9) }), rr(150, 250), 0.6), 0, 0.12);
    return reverb(swell(bp(out, 1400, 0.7), 0.45, 1.2), 0.15, 0.5);
  } },
  { id: "plague.flies.block", make: (v) => mix(0.35, [[ad(am(osc({ f: pick(v, 190, 230), d: 0.3, w: "saw", vib: 0.08, vibHz: 12 }), 220, 0.5), 0.005, 0.08), 0, 0.4], [click(1800, 0.015), 0, 0.7], [ad(bp(white(0.15), 1200, 1), 0.002, 0.04), 0, 0.4]]) },
  { id: "plague.livestock.cast", make: (v) => {
    const d = 1.6;
    const out = buf(d);
    for (let t = 0; t < d - 0.2; t += rr(0.045, 0.09)) add(out, mix(0.15, [[thump(rr(70, 110), 40, 0.12, 0.03), 0, 1], [ad(lp(pink(0.06), 900), 0.001, 0.015), 0, 0.5]]), t, 0.4 + 0.6 * Math.sin((Math.PI * t) / d));
    const moo = ad(voice(osc({ f: [pick(v, 150, 130), pick(v, 110, 95)], d: 0.9, w: "saw", vib: 0.01, vibHz: 4 }), "u", 0.9, 5), 0.15, 0.4);
    return reverb(mix(d, [[out, 0, 1], [swell(lp(brown(d), 200), 0.5), 0, 0.8], [moo, 0.15, 0.5]]), 0.15, 0.5);
  } },
  { id: "plague.boils.pop", make: (v) => mix(0.15, [[ad(osc({ f: [pick(v, 900, 700), 220], d: 0.06 }), 0.001, 0.015), 0, 1], [ad(lp(pink(0.05), 2500), 0.001, 0.01), 0, 0.4]]) },
  { id: "plague.hail.impact", make: (v) => mix(0.3, [[click(6000, 0.01), 0, 0.8], [modal(pick(v, 2600, 3200), 0.2, scaleTau(GLASS, 0.15)), 0.001, 0.45], [thump(150, 70, 0.1, 0.025), 0, 0.7], [crackle(0.1, 500, 4500, 1, 0.001), 0.005, 0.3]]) },
  { id: "plague.fire.cast", make: (v) => mix(0.9, [[whoosh(0.8, pick(v, 2500, 3000), 500, 1, 0.75), 0, 1], [crackle(0.8, (t) => 30 + 120 * t, 3000, 1.2, 0.002), 0, 0.5]]) },
  { id: "plague.fire.explode", make: (v) => reverb(mix(1.0, [[boom(0.7, pick(v, 100, 80), 32, 0.2), 0, 1], [crackle(0.9, (t) => 200 * Math.exp(-t * 4), 2600, 1.2, 0.003), 0.02, 0.7], [ad(bp(pink(0.6), [3000, 800], 0.8), 0.001, 0.12), 0, 0.5]]), 0.15, 0.6) },
  { id: "plague.locusts.cast", make: (v) => {
    const d = 1.7;
    const wings = am(crackle(d, (t) => 600 + 900 * Math.sin((Math.PI * t) / d), pick(v, 3500, 2800), 0.8, 0.0012), 26, 0.5);
    const buzz = unison({ f: pick(v, 140, 120), d, w: "saw", n: 6, detune: 0.05, vib: 0.03, vibHz: 7 });
    return reverb(swell(mix(d, [[wings, 0, 1], [bp(buzz, 900, 0.8), 0, 0.25]]), 0.5, 1.2), 0.15, 0.5);
  } },
  { id: "plague.darkness.cast", make: (v) => {
    const d = 2.0;
    const drone = env(lp(unison({ f: [pick(v, 65, 58), pick(v, 49, 44)], d, w: "saw", n: 6, detune: 0.012 }), [900, 200]), [[0, 0], [0.5, 1], [1.4, 0.8], [d, 0]]);
    const wind = swell(bp(pink(d), [900, 300], 1.5), 0.45, 1.3);
    return reverb(mix(d, [[drone, 0, 0.8], [wind, 0, 0.6]]), 0.3, 0.8);
  } },
  { id: "plague.firstborn.cast", make: (v) => reverb(mix(1.7, [[choir(pick(v, [N(-2), N(2), N(5), N(9)], [N(-4), N(0), N(3), N(7)]), 1.4, "o", 0.3), 0, 0.7], [whoosh(0.7, 400, 1600, 1, 0.5), 0.05, 0.5], [whoosh(0.6, 400, 1400, 1, 0.5), 0.45, 0.4], [sparkle(1.3, 10, 3000, 6500), 0.2, 0.3]]), 0.35, 0.85) },
  { id: "plague.firstborn.strike", make: (v) => reverb(mix(0.7, [[ad(hp(white(0.15), 1500), 0.0005, 0.03), 0, 1], [crackle(0.25, 900, 4500, 0.8, 0.001), 0, 0.7], [thump(pick(v, 120, 100), 40, 0.4, 0.1), 0.01, 0.8], [modal(pick(v, 2100, 2500), 0.4, scaleTau(GLASS, 0.5)), 0.01, 0.2]]), 0.25, 0.7) },
  { id: "plague.redsea.slam", make: (v) => reverb(mix(1.0, [[boom(0.9, pick(v, 80, 65), 26, 0.3), 0, 1], [modal(pick(v, 180, 150), 0.4, WOOD), 0, 0.5]]), 0.35, 0.85) },
  { id: "plague.redsea.crash", make: (v) => {
    const d = 2.0;
    const roar = env(lp(pink(d), [600, 3500], 0.6), [[0, 0], [0.5, 0.6], [0.9, 1], [d, 0]]);
    return reverb(mix(d, [[roar, 0, 1], [swell(lp(brown(d), 250), 0.45, 1), 0, 1], [boom(0.8, 70, 28, 0.3), pick(v, 0.85, 0.75), 0.6], [bubbles(d, 30, 300, 900), 0.8, 0.2]]), 0.25, 0.8);
  } },
  { id: "plague.pillar.cast", make: (v) => {
    const d = 1.6;
    const wind = swell(bp(pink(d), (t) => (pick(v, 350, 450) + 700 * (t / d)) * (1 + 0.15 * Math.sin(2 * Math.PI * 3 * t)), 2), 0.55, 1.4);
    return reverb(mix(d, [[wind, 0, 1.2], [choir([N(-9), N(-2)], d, "u", 0.5), 0, 0.25]]), 0.3, 0.8);
  } },
  { id: "plague.firepillar.cast", make: (v) => reverb(mix(1.6, [[fire(1.5, pick(v, 1.2, 1.6)), 0, 1], [whoosh(1.2, 200, 1200, 0.9, 0.6), 0, 0.6]]), 0.2, 0.6) },

  // ======================= Pickups =======================
  { id: "pickup.xp", loud: -14, make: (v) => mix(0.2, [[modal(N(pick(v, 27, 31)), 0.18, scaleTau(GLASS, 0.12)), 0, 1], [modal(N(pick(v, 34, 39)), 0.12, scaleTau(GLASS, 0.06)), 0.03, 0.3]]) },
  { id: "pickup.magnet", make: (v) => mix(0.8, [[am(ad(osc({ f: [pick(v, 180, 220), pick(v, 720, 880)], d: 0.7, w: "tri" }), 0.25, 0.25), 18, 0.5), 0, 0.6], [whoosh(0.7, 600, 3500, 1.2, 0.8), 0, 0.5]]) },
  { id: "pickup.bonus.appear", make: (v) => reverb(mix(0.5, [[ad(osc({ f: [pick(v, 500, 600), pick(v, 1200, 1400)], d: 0.08 }), 0.001, 0.03), 0, 0.6], [modal(N(pick(v, 24, 27)), 0.35, scaleTau(GLASS, 0.3)), 0.05, 0.5]]), 0.2, 0.5) },

  // ======================= Bonuses =======================
  { id: "bonus.heart", make: (v) => reverb(mix(0.9, [[mallet(N(pick(v, 3, 5))), 0, 0.8], [mallet(N(pick(v, 7, 9))), 0.08, 0.8], [mallet(N(pick(v, 10, 12))), 0.16, 0.8], [ad(unison({ f: N(pick(v, 15, 17)), d: 0.6, w: "sine", n: 3, detune: 0.004 }), 0.05, 0.25), 0.2, 0.4]]), 0.25, 0.6) },
  { id: "bonus.magnet", make: (v) => mix(0.8, [[am(ad(unison({ f: [pick(v, 110, 130), pick(v, 440, 520)], d: 0.6, w: "saw", n: 3, detune: 0.008 }), 0.2, 0.2), 25, 0.6), 0, 0.3], [modal(pick(v, 1300, 1500), 0.4, scaleTau(METAL, 0.5)), 0.45, 0.4]]) },
  { id: "bonus.star", make: (v) => reverb(mix(1.0, [[arp(pick(v, [12, 16, 19, 24], [15, 19, 22, 27]), 0.06, 0.4, 0.9), 0, 0.8], [sparkle(0.8, 14, 3500, 8000), 0.1, 0.45]]), 0.2, 0.6) },
  { id: "bonus.lightning", make: (v) => mix(0.5, [[ad(osc({ f: [pick(v, 300, 400), pick(v, 2400, 3000)], d: 0.25, w: "saw" }), 0.005, 0.1), 0, 0.3], [whoosh(0.3, 1500, 7000, 1.2, 0.6), 0, 0.7], [crackle(0.3, 300, 5000, 0.8, 0.001), 0.15, 0.4]]) },
  { id: "bonus.shield", make: (v) => reverb(mix(0.9, [[am(modal(pick(v, 880, 990), 0.8, scaleTau(METAL, 1.2)), 12, 0.35), 0, 0.6], [am(modal(pick(v, 1320, 1480), 0.7, scaleTau(GLASS, 1.4)), 9, 0.3), 0.05, 0.4], [whoosh(0.4, 800, 3000), 0, 0.3]]), 0.3, 0.7) },

  // ======================= Enemies =======================
  { id: "enemy.death.small", loud: -12, make: (v) => mix(0.3, [[ad(lp(pink(0.2), [pick(v, 2200, 1800), 400], 0.8), 0.002, 0.04), 0, 0.9], [thump(pick(v, 220, 180), 70, 0.15, 0.04), 0, 0.8]]) },
  { id: "enemy.death.medium", make: (v) => mix(0.45, [[grunt(pick(v, 150, 130), 90, 0.25, "u"), 0, 0.5], [thump(140, 50, 0.25, 0.06), 0.08, 1], [ad(lp(pink(0.2), 900), 0.002, 0.05), 0.08, 0.6]]) },
  { id: "enemy.death.large", make: (v) => mix(0.7, [[grunt(pick(v, 110, 95), 60, 0.35, "o", 0.85), 0, 0.5], [thump(90, 35, 0.45, 0.12), 0.12, 1], [ad(lp(brown(0.4), 700), 0.002, 0.1), 0.12, 1]]) },
  { id: "enemy.death.elite", make: (v) => {
    const out = buf(0.9);
    for (let i = 0; i < 8; i++) add(out, modal(rr(200, 600), 0.2, WOOD), rr(0, 0.25), rr(0.3, 0.8));
    return reverb(mix(0.9, [[out, 0, 0.8], [boom(0.6, pick(v, 100, 85), 35, 0.15), 0, 0.8], [crackle(0.5, (t) => 200 * Math.exp(-t * 6), 1800, 1, 0.004), 0, 0.6]]), 0.15, 0.5);
  } },
  { id: "enemy.melee", make: (v) => mix(0.3, [[swish(0.15, 700, 2600), 0, 0.8], [thump(pick(v, 180, 150), 80, 0.1, 0.025), 0.1, 0.8], [click(1500, 0.015), 0.1, 0.5]]) },
  { id: "enemy.arrow", make: (v) => mix(0.45, [[lp(pluck(pick(v, 196, 220), 0.3, 0.3, 0.993), 3000), 0, 0.8], [swish(0.25, 3000, 1500), 0.03, 0.5]]) },
  { id: "enemy.spear.throw", make: (v) => mix(0.45, [[whoosh(0.4, pick(v, 400, 500), 1400, 1.5, 0.4), 0, 1], [ad(lp(pink(0.05), 1500), 0.002, 0.015), 0, 0.5]]) },
  { id: "enemy.mage.cast", make: (v) => reverb(mix(0.6, [[ad(unison({ f: [N(pick(v, 10, 8)), N(pick(v, 22, 20))], d: 0.4, w: "tri", n: 3, detune: 0.01 }), 0.02, 0.15), 0, 0.5], [sparkle(0.4, 6, 2500, 5000), 0.05, 0.4]]), 0.25, 0.6) },
  { id: "enemy.knight.charge", make: (v) => {
    const out = buf(1.0);
    const gap = pick(v, 0.11, 0.095);
    for (let i = 0; i < 8; i++) add(out, mix(0.12, [[thump(rr(110, 140), 60, 0.08, 0.02), 0, 1], [click(1800, 0.01), 0, 0.4]]), i * gap + (i % 2) * 0.03, 0.4 + 0.08 * i);
    return mix(1.0, [[out, 0, 1], [whoosh(0.9, 400, 1100, 1.2, 0.8), 0, 0.3]]);
  } },
  { id: "enemy.agile.dash", make: (v) => whoosh(0.25, pick(v, 800, 1000), pick(v, 3500, 4200), 1.3, 0.35) },
  { id: "enemy.lion.roar", make: (v) => {
    const d = 1.2;
    const src = mix(d, [[osc({ f: (t) => pick(v, 95, 80) * (1 + 0.35 * Math.sin(Math.PI * Math.min(1, t / 0.8))), d, w: "saw", vib: 0.06, vibHz: 27 }), 0, 1], [pink(d), 0, 0.6]]);
    return reverb(env(drive(voice(src, "a", 0.8, 3), 2.5), [[0, 0], [0.15, 1], [0.7, 0.8], [d, 0]]), 0.2, 0.6);
  } },
  { id: "enemy.wolf.howl", make: (v) => {
    const d = 1.5;
    const f0 = pick(v, 420, 380);
    const src = osc({ f: (t) => f0 * (t < 0.4 ? 0.75 + 0.25 * (t / 0.4) : 1 - 0.25 * ((t - 0.4) / 1.1)), d, w: "tri", vib: 0.012, vibHz: 5 });
    return reverb(env(voice(src, "u", 1.3, 4), [[0, 0], [0.2, 1], [1.1, 0.7], [d, 0]]), 0.35, 0.8);
  } },
  { id: "enemy.chariot.shoot", make: (v) => mix(0.6, [[lp(pluck(pick(v, 165, 185), 0.35, 0.35, 0.993), 2500), 0, 0.8], [swish(0.3, 2800, 1200), 0.04, 0.4], [swell(lp(brown(0.6), 250), 0.4), 0, 0.4]]) },
  { id: "boss.appear", make: (v) => {
    const d = 2.2;
    const horn = env(lp(unison({ f: N(pick(v, -24, -26)), d: 1.6, w: "saw", n: 4, detune: 0.006, vib: 0.004 }), [400, 1300]), [[0, 0], [0.3, 1], [1.3, 0.9], [1.6, 0]]);
    const horn5 = env(lp(unison({ f: N(pick(v, -17, -19)), d: 1.4, w: "saw", n: 4, detune: 0.006 }), [400, 1100]), [[0, 0], [0.3, 1], [1.1, 0.8], [1.4, 0]]);
    return reverb(mix(d, [[boom(1.0, 70, 28, 0.35), 0, 1], [horn, 0.1, 0.6], [horn5, 0.3, 0.45]]), 0.3, 0.85);
  } },
  { id: "boss.wake", make: (v) => {
    const d = 1.8;
    const growl = env(drive(voice(mix(d, [[osc({ f: [pick(v, 55, 50), pick(v, 80, 72)], d, w: "saw", vib: 0.05, vibHz: 22 }), 0, 1], [brown(d), 0, 0.6]]), "o", 0.6, 3), 2), [[0, 0], [0.8, 0.8], [1.4, 1], [d, 0]]);
    return reverb(mix(d, [[growl, 0, 0.8], [swell(lp(brown(d), 160), 0.6), 0, 1]]), 0.25, 0.8);
  } },
  { id: "boss.smash", make: (v) => reverb(mix(1.1, [[boom(0.9, pick(v, 75, 65), 25, 0.3), 0, 1], [crackle(0.7, (t) => 350 * Math.exp(-t * 6), 1500, 1, 0.005), 0.02, 0.8], [modal(110, 0.4, STONE), 0, 0.5]]), 0.25, 0.7) },
  { id: "boss.leap", make: (v) => mix(0.8, [[whoosh(0.7, pick(v, 250, 300), 1600, 1.2, 0.5), 0, 1], [grunt(130, 170, 0.3, "a", 0.8), 0, 0.35]]) },
  { id: "boss.land", make: (v) => reverb(mix(1.0, [[boom(0.9, pick(v, 70, 60), 24, 0.32), 0, 1], [crackle(0.5, (t) => 250 * Math.exp(-t * 8), 1200, 1, 0.005), 0.02, 0.6]]), 0.2, 0.7) },
  { id: "boss.spear", make: (v) => mix(0.9, [[whoosh(0.6, 300, 1300, 1.3, 0.35), 0, 1], [fire(0.8, pick(v, 0.8, 1.1)), 0, 0.5]]) },
  { id: "boss.defeated", make: (v) => {
    const d = 2.4;
    const horn = env(lp(unison({ f: [N(pick(v, -19, -21)), N(pick(v, -31, -33))], d: 2.0, w: "saw", n: 4, detune: 0.008 }), [1200, 300]), [[0, 0], [0.2, 1], [1.6, 0.6], [2.0, 0]]);
    return reverb(mix(d, [[horn, 0, 0.6], [boom(1.2, 80, 25, 0.4), 0.15, 0.8], [swell(lp(brown(d), 200), 0.3), 0, 0.6]]), 0.3, 0.85);
  } },
  { id: "boss.revive", make: (v) => {
    const d = 1.8;
    const rise = env(lp(unison({ f: [N(pick(v, -36, -34)), N(pick(v, -24, -22))], d, w: "saw", n: 5, detune: 0.012 }), [200, 1500]), [[0, 0], [1.4, 1], [1.5, 1], [d, 0]]);
    return reverb(mix(d, [[rise, 0, 0.6], [boom(0.4, 90, 35, 0.15), 1.4, 0.9]]), 0.3, 0.85);
  } },

  // ======================= Player =======================
  { id: "player.hurt", make: (v) => mix(0.35, [[grunt(pick(v, 190, 170), 120, 0.22, "u", 1.1), 0, 0.6], [thump(160, 80, 0.1, 0.025), 0, 0.7], [click(1200, 0.015), 0, 0.4]]) },
  { id: "player.shield.absorb", make: (v) => reverb(mix(0.6, [[am(modal(pick(v, 1050, 1200), 0.5, scaleTau(GLASS, 0.7)), 14, 0.3), 0, 0.7], [thump(200, 120, 0.08, 0.02), 0, 0.4]]), 0.2, 0.6) },
  { id: "player.helmet.block", make: (v) => mix(0.4, [[modal(pick(v, 2100, 2400), 0.35, scaleTau(METAL, 0.3)), 0, 0.6], [click(5000, 0.008), 0, 0.5]]) },
  { id: "player.death", make: (v) => reverb(mix(2.0, [[twoNotes(pick(v, 3, 5), pick(v, -2, 0), 0.25, 0.6), 0, 0.6], [ad(osc({ f: N(pick(v, -9, -7)), d: 1.0, w: "tri" }), 0.01, 0.4), 0.5, 0.5], [thump(110, 40, 0.4, 0.1), 0.55, 0.7]]), 0.3, 0.8) },
  { id: "player.revive", make: (v) => reverb(mix(1.5, [[choir(pick(v, [N(3), N(7), N(10)], [N(5), N(9), N(12)]), 1.2, "a", 0.4), 0, 0.6], [arp(pick(v, [15, 19, 22, 27], [17, 21, 24, 29]), 0.09, 0.4, 1.0), 0.2, 0.5]]), 0.3, 0.8) },

  // ======================= Game events =======================
  { id: "event.levelup", make: (v) => reverb(mix(1.1, [[arp(pick(v, [3, 7, 10, 15, 19], [5, 9, 12, 17, 21]), 0.07, 0.5, 1.0), 0, 0.8], [sparkle(0.7, 8, 3500, 7000), 0.3, 0.3]]), 0.2, 0.6) },
  { id: "event.plague.unlock", make: (v) => reverb(mix(2.0, [[modal(pick(v, 110, 98), 1.8, scaleTau(METAL, 2.5)), 0, 0.6], [choir(pick(v, [N(-12), N(-5), N(0)], [N(-14), N(-7), N(-2)]), 1.6, "o", 0.2), 0.05, 0.5]]), 0.3, 0.85) },
  { id: "event.plague.evolve", make: (v) => reverb(mix(1.0, [[ad(unison({ f: [N(pick(v, 3, 5)), N(pick(v, 15, 17))], d: 0.5, w: "tri", n: 4, detune: 0.01 }), 0.05, 0.2), 0, 0.5], [modal(N(pick(v, 22, 24)), 0.6, scaleTau(GLASS, 0.6)), 0.35, 0.6], [sparkle(0.5, 6), 0.3, 0.3]]), 0.25, 0.7) },
  { id: "event.blessing", make: (v) => reverb(choir(pick(v, [N(3), N(7), N(10), N(15)], [N(0), N(4), N(7), N(12)]), 1.0, "a", 0.15), 0.35, 0.8) },
  { id: "event.champion.summon", make: (v) => {
    const note = (s: number, t: number, l: number) => [env(lp(unison({ f: N(s), d: l, w: "saw", n: 3, detune: 0.005, vib: 0.005 }), 1800), [[0, 0], [0.04, 1], [l * 0.7, 0.8], [l, 0]]), t] as [Buf, number];
    const notes = pick(v, [[-14, 0, 0.18], [-9, 0.18, 0.18], [-5, 0.36, 0.6]], [[-12, 0, 0.18], [-7, 0.18, 0.18], [-2, 0.36, 0.6]]);
    return reverb(mix(1.3, [...notes.map(([s, t, l]) => note(s, t, l)), [sparkle(0.8, 8), 0.4, 0.3]]), 0.3, 0.8);
  } },
  { id: "event.champion.down", make: (v) => mix(0.9, [[twoNotes(pick(v, 0, 2), pick(v, -5, -3), 0.15, 0.4), 0, 0.7], [thump(140, 50, 0.25, 0.06), 0.2, 0.6]]) },
  { id: "event.champion.revive", make: (v) => mix(1.0, [[twoNotes(pick(v, -5, -3), pick(v, 2, 4), 0.12, 0.45), 0, 0.7], [sparkle(0.6, 7), 0.15, 0.4]]) },
  { id: "event.gameover", make: (v) => {
    const notes = pick(v, [7, 3, 0, -5], [5, 1, -2, -7]);
    return reverb(mix(2.6, notes.map((s, i) => [ad(lp(unison({ f: N(s), d: 0.9, w: "tri", n: 3, detune: 0.004 }), 2000), 0.02, 0.35), i * 0.42, i === notes.length - 1 ? 1 : 0.8] as [Buf, number, number])), 0.35, 0.85);
  } },

  // ======================= UI =======================
  { id: "ui.hover", loud: -19, make: (v) => ad(osc({ f: pick(v, 1900, 2400), d: 0.04, w: "sine" }), 0.002, 0.01) },
  { id: "ui.click", loud: -14, make: (v) => mix(0.08, [[modal(pick(v, 780, 980), 0.07, scaleTau(WOOD, 0.4)), 0, 1], [click(3500, 0.006), 0, 0.5]]) },
  { id: "ui.confirm", make: (v) => twoNotes(pick(v, 12, 15), pick(v, 19, 22), 0.07, 0.25, "sine") },
  { id: "ui.back", make: (v) => twoNotes(pick(v, 19, 22), pick(v, 12, 15), 0.07, 0.22, "sine") },
  { id: "ui.menu.open", make: (v) => mix(0.35, [[whoosh(0.25, 600, 2600, 1.2, 0.4), 0, 0.7], [mallet(N(pick(v, 15, 17)), 0.2), 0.15, 0.5]]) },
  { id: "ui.menu.close", make: (v) => mix(0.35, [[whoosh(0.22, 2600, 600, 1.2, 0.3), 0, 0.7], [mallet(N(pick(v, 8, 10)), 0.2), 0.12, 0.5]]) },
  { id: "ui.tab", loud: -17, make: (v) => ad(bp(white(0.06), pick(v, 2600, 3300), 1.2), 0.002, 0.015) },
  { id: "ui.pause", make: (v) => lp(twoNotes(pick(v, 7, 10), pick(v, 0, 3), 0.1, 0.25, "sine"), 2500) },
  { id: "ui.resume", make: (v) => lp(twoNotes(pick(v, 0, 3), pick(v, 7, 10), 0.1, 0.25, "sine"), 2500) },
  { id: "ui.toggle", loud: -15, make: (v) => mix(0.08, [[click(4500, 0.006), 0, 0.7], [ad(osc({ f: pick(v, 1300, 1050), d: 0.05 }), 0.001, 0.015), 0.008, 0.7]]) },
  { id: "ui.slider", loud: -20, make: (v) => ad(osc({ f: pick(v, 2800, 3400), d: 0.02 }), 0.001, 0.004) },
  { id: "ui.error", make: (v) => lp(mix(0.32, [[ad(osc({ f: pick(v, 196, 175), d: 0.12, w: "square" }), 0.003, 0.06), 0, 1], [ad(osc({ f: pick(v, 185, 165), d: 0.14, w: "square" }), 0.003, 0.07), 0.14, 1]]), 1400) },
  { id: "ui.buy", make: (v) => reverb(mix(0.5, [[modal(N(pick(v, 24, 26)), 0.15, scaleTau(METAL, 0.12)), 0, 0.7], [modal(N(pick(v, 31, 33)), 0.4, scaleTau(METAL, 0.25)), 0.07, 0.7]]), 0.15, 0.5) },
  { id: "ui.equip", make: (v) => mix(0.35, [[ad(lp(pink(0.1), 1500), 0.002, 0.03), 0, 0.6], [modal(pick(v, 1500, 1800), 0.3, scaleTau(METAL, 0.25)), 0.04, 0.5]]) },
  { id: "ui.card", make: (v) => mix(0.3, [[ad(bp(white(0.06), [3500, 2000], 0.9), 0.002, 0.015), 0, 0.7], [modal(N(pick(v, 19, 22)), 0.25, scaleTau(GLASS, 0.3)), 0.03, 0.5]]) },
];

export { fadeIn, filt, gain, hp, rnd, SR };
