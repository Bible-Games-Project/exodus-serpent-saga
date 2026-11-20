// Rebuilds the game's sound effects from the capture log (which file played
// when, at what pitch and volume) into one track, cut where the Steam card starts.
//
//   bun sfx.ts episodes/01-serpent.json
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { FFMPEG, REPO, readJson, workDir, writeWav } from "./lib.mjs";

const dir = workDir(readJson(process.argv[2]));
const { card, end } = readJson(`${dir}/timeline.json`);
const SR = 44100;
const events: Array<{ url: string; t: number; offset: number; rate: number; gain: number }> = readJson(`${dir}/sounds.json`);
const cache = new Map<string, Float32Array>();
const load = (url: string) => {
  if (!cache.has(url)) {
    const file = `${REPO}/public${decodeURI(new URL(url, "http://x").pathname)}`;
    const raw = execFileSync(FFMPEG, ["-v", "error", "-i", file, "-f", "f32le", "-ac", "1", "-ar", String(SR), "-"], { maxBuffer: 1 << 28 });
    cache.set(url, new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4));
  }
  return cache.get(url)!;
};
const mix = new Float32Array(Math.ceil(end * SR));
const stop = Math.min(mix.length, Math.floor(card * SR));
for (const e of events) {
  if (e.t < 0 || e.t >= card) continue;
  const src = load(e.url);
  const o = Math.floor(e.t * SR);
  for (let i = 0; o + i < stop; i++) {
    const p = e.offset * SR + i * e.rate; // resample by playback rate
    const j = Math.floor(p);
    if (j + 1 >= src.length) break;
    mix[o + i] += (src[j] + (src[j + 1] - src[j]) * (p - j)) * e.gain;
  }
}
for (let i = 0; i < mix.length; i++) mix[i] = Math.tanh(mix[i]);
writeWav(`${dir}/sfx.wav`, mix, SR);
console.log(events.length, "sound events,", cache.size, "files");
