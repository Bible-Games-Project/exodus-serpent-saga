// Renders the enemy "vanish in smoke" death sound: a soft poof followed by a
// hissing, evaporating puff. Three takes, written as MP3 to
// public/audio/Library/ClaudeFx with their own pack.json.
//
//   bun scripts/claude-sounds/smoke.ts
//   bun scripts/build-sound-library.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Mp3Encoder } from "@breezystack/lamejs";
import { SR, ad, am, bp, dc, fade, fadeIn, hp, lp, mix, norm, pink, reverb, setSeed, swell, trim, white, type Buf } from "./dsp";

const OUT = join(import.meta.dir, "..", "..", "public", "audio", "Library", "ClaudeFx");
mkdirSync(OUT, { recursive: true });

function encode(b: Buf): Uint8Array {
  const pcm = new Int16Array(b.length);
  for (let i = 0; i < b.length; i++) pcm[i] = Math.max(-32767, Math.min(32767, Math.round(b[i] * 32767)));
  const enc = new Mp3Encoder(1, SR, 96);
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

/** take 0..2: slightly different body, hiss colour and length. */
function smoke(take: number): Buf {
  const k = [1, 0.88, 1.12][take];
  const d = [0.62, 0.7, 0.55][take];
  // Soft "poof": a puff of low air, no hard click.
  const poof = ad(lp(pink(0.25), [1600 * k, 350 * k], 0.9), 0.006, 0.07);
  // Evaporating hiss: high band falling, fluttering like steam escaping.
  const hiss = am(swell(bp(white(d), [4200 * k, 1700 * k], 0.8), 0.12, 2.2), [22, 9], 0.35);
  // Airy rise: the smoke drifting up and away.
  const rise = swell(bp(pink(d), [500 * k, 1500 * k], 1.4), 0.35, 1.8);
  const dry = mix(d + 0.05, [[poof, 0, 1], [lp(hp(hiss, 1200), 6000), 0.02, 0.32], [rise, 0.03, 0.45]]);
  return reverb(dry, 0.22, 0.6, 0.5, 0.5);
}

const sounds: Array<{ file: string; name: string; group: string; action: string }> = [];
for (let t = 0; t < 3; t++) {
  setSeed(4242 + t * 977);
  let b = trim(norm(dc(smoke(t)), 0.85));
  b = fade(fadeIn(norm(b, 0.55), 0.004), 0.06);
  const file = `enemy-death-smoke-${t + 1}.mp3`;
  writeFileSync(join(OUT, file), encode(b));
  sounds.push({ file, name: `Enemy vanishes in smoke ${t + 1}`, group: "Enemies (Claude)", action: "enemy.death.small" });
  console.log(file, (b.length / SR).toFixed(2) + "s");
}
writeFileSync(join(OUT, "pack.json"), JSON.stringify({ source: "Claude", license: "Made for this game by Claude (procedural synthesis, no third-party audio)", sounds }, null, 2) + "\n");
