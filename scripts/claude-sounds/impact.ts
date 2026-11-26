// Renders the soft weapon-impact sound (2026-11-26): a muffled low thump with
// a short wooden knock and a puff of cloth/dust, no sharp click. Three takes,
// written as MP3 to public/audio/Library/ClaudeFx (merged into its pack.json).
// The game plays it once per swing, however many enemies the swing hits.
//
//   bun scripts/claude-sounds/impact.ts
//   bun scripts/build-sound-library.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Mp3Encoder } from "@breezystack/lamejs";
import { SR, ad, dc, drive, fade, fadeIn, lp, mix, modal, norm, pink, reverb, setSeed, thump, trim, WOOD, scaleTau, type Buf } from "./dsp";

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

/** take 0..2: slightly different pitch, knock and puff. */
function softHit(take: number): Buf {
  const k = [1, 0.88, 1.14][take];
  // Body: a round low thump gliding down.
  const body = thump(150 * k, 75 * k, 0.2, 0.045);
  // Knock: a short muted wooden tone, low in the mix.
  const knock = modal(240 * k, 0.12, scaleTau(WOOD, 0.35), 0.002);
  // Puff: soft filtered noise, like a blow on cloth.
  const puff = ad(lp(pink(0.12), [2200 * k, 500 * k], 0.8), 0.002, 0.022);
  const dry = mix(0.24, [[body, 0, 1], [knock, 0.001, 0.35], [puff, 0, 0.45]]);
  return reverb(lp(dry, 3200), 0.08, 0.35, 0.6, 0.3);
}

const packFile = join(OUT, "pack.json");
const pack = existsSync(packFile) ? JSON.parse(readFileSync(packFile, "utf8")) : { source: "Claude", license: "Made for this game by Claude (procedural synthesis, no third-party audio)", sounds: [] };
const files = [0, 1, 2].map((t) => `soft-hit-${t + 1}.mp3`);
pack.sounds = pack.sounds.filter((s: { file: string }) => !files.includes(s.file));
for (let t = 0; t < 3; t++) {
  setSeed(7300 + t * 389);
  // Gentle saturation keeps it round but louder (2026-11-26: 2.5x after "too quiet").
  let b = trim(norm(drive(norm(dc(softHit(t)), 0.9), 1.6), 0.9));
  b = fade(fadeIn(norm(b, 0.95), 0.002), 0.03);
  writeFileSync(join(OUT, files[t]), encode(b));
  pack.sounds.push({ file: files[t], name: `Soft weapon hit ${t + 1}`, group: "Weapons (Claude)", action: "weapon.staff.hit" });
  console.log(files[t], (b.length / SR).toFixed(2) + "s");
}
writeFileSync(packFile, JSON.stringify(pack, null, 2) + "\n");
