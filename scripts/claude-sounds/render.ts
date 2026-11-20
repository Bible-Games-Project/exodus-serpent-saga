// Renders the "Claude" sound pack: two procedurally synthesized versions of
// every game action, written as MP3 to public/audio/Library/Claude plus a
// pack.json the library builder reads (each sound carries the action it was
// made for, so Sound testing can list it first for that action).
//
//   bun scripts/claude-sounds/render.ts [only-this-action-id]
//   bun scripts/build-sound-library.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Mp3Encoder } from "@breezystack/lamejs";
import { SOUND_CATEGORIES, SOUND_EVENTS } from "../../src/game/audio/soundCatalog";
import { SR, dc, fade, fadeIn, norm, setSeed, trim, type Buf } from "./dsp";
import { RECIPES } from "./recipes";

const OUT = join(import.meta.dir, "..", "..", "public", "audio", "Library", "Claude");
mkdirSync(OUT, { recursive: true });
const only = process.argv[2];

function encode(b: Buf): Uint8Array {
  const pcm = new Int16Array(b.length);
  for (let i = 0; i < b.length; i++) pcm[i] = Math.max(-32767, Math.min(32767, Math.round(b[i] * 32767)));
  const enc = new Mp3Encoder(1, SR, 96);
  const parts: Uint8Array[] = [];
  for (let i = 0; i < pcm.length; i += 1152) {
    const chunk = enc.encodeBuffer(pcm.subarray(i, i + 1152));
    if (chunk.length) parts.push(new Uint8Array(chunk));
  }
  const end = enc.flush();
  if (end.length) parts.push(new Uint8Array(end));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) out.set(p, o), (o += p.length);
  return out;
}

function loudness(b: Buf): number {
  const w = Math.floor(0.1 * SR);
  let acc = 0, max = 0;
  for (let i = 0; i < b.length; i++) {
    acc += b[i] * b[i];
    if (i >= w) acc -= b[i - w] * b[i - w];
    max = Math.max(max, acc / Math.min(w, i + 1));
  }
  return 10 * Math.log10(max + 1e-12);
}
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const catLabel = Object.fromEntries(SOUND_CATEGORIES.map((c) => [c.id, c.label]));
const sounds: Array<{ file: string; name: string; group: string; action: string }> = [];

for (const r of RECIPES) {
  const ev = SOUND_EVENTS.find((e) => e.id === r.id);
  if (!ev) throw new Error(`Unknown action ${r.id}`);
  for (const v of [0, 1] as const) {
    const file = `${r.id.replace(/\./g, "-")}-${v + 1}.mp3`;
    sounds.push({ file, name: `${ev.label} ${v + 1}`, group: `${catLabel[ev.category]} (Claude)`, action: r.id });
    if (only && only !== r.id) continue;
    setSeed(hash(r.id) + v * 977);
    let b = r.make(v);
    b = trim(norm(dc(b), 0.85));
    // Level by loudness (loudest 100 ms), not by peak, so short clicks and long drones sit together.
    const target = r.loud ?? (ev.category === "ui" ? -15 : ev.category === "pickups" ? -13 : -10);
    b = fade(fadeIn(norm(b, Math.min(0.95, 0.85 * Math.pow(10, (target - loudness(b)) / 20))), 0.002), 0.02);
    let peak = 0;
    for (const x of b) peak = Math.max(peak, Math.abs(x));
    if (!Number.isFinite(peak)) throw new Error(`${file}: not finite`);
    writeFileSync(join(OUT, file), encode(b));
    console.log(`${file.padEnd(40)} ${(b.length / SR).toFixed(2)}s`);
  }
}

writeFileSync(
  join(OUT, "pack.json"),
  JSON.stringify({ source: "Claude", license: "Made for this game by Claude (procedural synthesis, no third-party audio)", sounds }, null, 2) + "\n",
);
console.log(`${sounds.length} sounds`);
