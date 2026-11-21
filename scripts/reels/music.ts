// Background music for a reel, synthesized (no third-party audio): desert
// drone, doum-tek frame drum at 92 BPM and oud-like plucks in Phrygian dominant.
//
//   bun music.ts episodes/01-serpent.json   (after plan.ts: it reads the reel length)
import { N, SR, ad, add, bp, brown, buf, env, hp, lp, mix, norm, pluck, reverb, setSeed, swell, thump, unison, white } from "../claude-sounds/dsp";
import { readJson, workDir, writeWav } from "./lib.mjs";

const ep = readJson(process.argv[2]);
const dir = workDir(ep);
if (ep.music) { console.log("episode uses", ep.music); process.exit(0); }
const D = readJson(`${dir}/timeline.json`).end + 1;
setSeed(ep.musicSeed ?? 42);
const beat = 60 / 92;
const out = buf(D);
add(out, env(lp(unison({ f: N(-31), d: D, w: "saw", n: 4, detune: 0.006 }), 500), [[0, 0], [2, 1], [D - 2, 1], [D, 0]]), 0, 0.22);
add(out, env(lp(unison({ f: N(-24), d: D, w: "saw", n: 3, detune: 0.006 }), 700), [[0, 0], [3, 1], [D - 2, 0.8], [D, 0]]), 0, 0.12);
add(out, swell(lp(brown(D), 300), 0.5, 0.6), 0, 0.15);
const doum = () => mix(0.5, [[thump(110, 55, 0.5, 0.12), 0, 1], [ad(lp(white(0.1), 900), 0.001, 0.02), 0, 0.3]]);
const tek = () => mix(0.2, [[ad(bp(white(0.15), 2500, 1.2), 0.001, 0.03), 0, 1], [thump(320, 260, 0.08, 0.02), 0, 0.3]]);
const pattern: Array<[number, "D" | "T", number]> = [[0, "D", 1], [1, "T", 0.6], [1.5, "T", 0.4], [2, "D", 0.8], [3, "T", 0.7], [3.5, "T", 0.35]];
for (let bar = 8 * beat; bar < D - 3; bar += 4 * beat)
  for (const [b, k, g] of pattern) add(out, k === "D" ? doum() : tek(), bar + b * beat, g * (k === "D" ? 0.55 : 0.3));
const scale = [-19, -18, -15, -14, -12, -11, -9, -7]; // D Eb F# G A Bb C D
const phrase = [0, 1, 2, 1, 0, -1, 0, 4, 3, 2, 1, 2, 1, 0];
let t = 4 * beat;
for (let i = 0; t < D - 4; i++) {
  const p = phrase[i % phrase.length];
  add(out, lp(pluck(N(scale[(p + 8) % 8] + (p < 0 ? -12 : 0)), 0.9, 0.6, 0.994), 2600), t, 0.32);
  t += (i % 4 === 3 ? 2 : 1) * beat;
}
writeWav(`${dir}/music.wav`, norm(reverb(hp(out, 40), 0.25, 0.8), 0.8), SR);
console.log("music", D.toFixed(1), "s");
