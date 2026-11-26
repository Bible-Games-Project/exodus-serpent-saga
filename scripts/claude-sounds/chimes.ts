// Renders the "blessing / plague chosen" chime and a shorter sibling for
// picking up a bonus (2026-11-26): the same warm bell timbre, a rising major
// arpeggio over a soft chord and a little sparkle. Two takes of each, written
// as MP3 to public/audio/Library/ClaudeFx (merged into its pack.json).
//
//   bun scripts/claude-sounds/chimes.ts
//   bun scripts/build-sound-library.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Mp3Encoder } from "@breezystack/lamejs";
import { SR, ad, add, buf, dc, fade, fadeIn, lp, mix, modal, N, norm, osc, reverb, rr, scaleTau, setSeed, GLASS, swell, trim, type Buf } from "./dsp";

const OUT = join(import.meta.dir, "..", "..", "public", "audio", "Library", "ClaudeFx");
mkdirSync(OUT, { recursive: true });

function encode(b: Buf): Uint8Array {
  const pcm = new Int16Array(b.length);
  for (let i = 0; i < b.length; i++) pcm[i] = Math.max(-32767, Math.min(32767, Math.round(b[i] * 32767)));
  const enc = new Mp3Encoder(1, SR, 128);
  const parts: Uint8Array[] = [];
  for (let i = 0; i < pcm.length; i += 1152) {
    const c = enc.encodeBuffer(pcm.subarray(i, i + 1152));
    if (c.length) parts.push(new Uint8Array(c));
  }
  const end = enc.flush();
  if (end.length) parts.push(new Uint8Array(end));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) out.set(p, o), (o += p.length);
  return out;
}

/** Warm bell: near-harmonic partials so it rings sweetly, not clangy. */
const bell = (semi: number, d: number, tau = 0.45) =>
  modal(N(semi), d, [[1, 1, tau], [2, 0.32, tau * 0.55], [3, 0.12, tau * 0.35], [4.16, 0.05, tau * 0.2]], 0.0015);

/** Soft sine chord that swells in under the arpeggio. */
function pad(notes: number[], d: number): Buf {
  const out = buf(d);
  for (const s of notes) add(out, osc({ f: N(s), d, vib: 0.003, vibHz: 5 }), 0, 1 / notes.length);
  return swell(lp(out, 2500), 0.25, 2.2);
}

/** A few glassy high pings. */
function sparkle(d: number, count: number, lo: number, hi: number): Buf {
  const out = buf(d);
  for (let i = 0; i < count; i++) add(out, modal(rr(lo, hi), 0.25, scaleTau(GLASS, 0.22)), rr(0, d - 0.25), rr(0.25, 0.6));
  return out;
}

function chime(notes: number[], step: number, chord: number[], d: number, glitter: number): Buf {
  const parts: Array<[Buf, number?, number?]> = notes.map((s, i) => [bell(s, d - i * step), i * step, i === notes.length - 1 ? 1 : 0.8]);
  parts.push([pad(chord, d * 0.9), 0.04, 0.35]);
  parts.push([sparkle(d * 0.8, glitter, 3500, 7500), step * (notes.length - 1), 0.22]);
  // Tiny soft tick so the first note speaks immediately.
  parts.push([ad(osc({ f: N(notes[0] + 24), d: 0.03 }), 0.0005, 0.006), 0, 0.15]);
  return reverb(mix(d, parts), 0.22, 0.65, 0.45, 0.7);
}

const TAKES = [
  // Blessing / plague chosen: C major run up to the octave over a C chord.
  { file: "blessing-chosen-1.mp3", name: "Blessing chosen: warm bell chime", action: "event.blessing", vol: 0.7,
    make: () => chime([3, 7, 10, 15], 0.06, [3, 10, 19], 1.15, 7) },
  { file: "blessing-chosen-2.mp3", name: "Blessing chosen: warm bell chime 2", action: "event.blessing", vol: 0.7,
    make: () => chime([-2, 2, 5, 10, 14], 0.05, [-2, 5, 14], 1.2, 8) },
  // Bonus pickup: the same bell, two quick notes up and a shorter tail.
  { file: "bonus-pickup-1.mp3", name: "Bonus picked up: short bell chime", action: "bonus.star", vol: 0.62,
    make: () => chime([10, 15], 0.065, [10, 19], 0.65, 4) },
  { file: "bonus-pickup-2.mp3", name: "Bonus picked up: short bell chime 2", action: "bonus.star", vol: 0.62,
    make: () => chime([7, 10, 15], 0.045, [7, 15], 0.7, 4) },
];

const packFile = join(OUT, "pack.json");
const pack = existsSync(packFile) ? JSON.parse(readFileSync(packFile, "utf8")) : { source: "Claude", license: "Made for this game by Claude (procedural synthesis, no third-party audio)", sounds: [] };
const mine = new Set(TAKES.map((t) => t.file));
pack.sounds = pack.sounds.filter((s: { file: string }) => !mine.has(s.file));
TAKES.forEach((t, i) => {
  setSeed(9100 + i * 613);
  let b = trim(norm(dc(t.make()), 0.9));
  b = fade(fadeIn(norm(b, t.vol), 0.002), 0.08);
  writeFileSync(join(OUT, t.file), encode(b));
  pack.sounds.push({ file: t.file, name: t.name, group: t.action === "event.blessing" ? "Events (Claude)" : "Bonuses (Claude)", action: t.action });
  console.log(t.file, (b.length / SR).toFixed(2) + "s");
});
writeFileSync(packFile, JSON.stringify(pack, null, 2) + "\n");
