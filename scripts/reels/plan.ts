// Turns the episode text + Whisper word timings into the overlay list
// (overlays.json: name -> HTML) and the timeline (when each one shows).
//
//   bun plan.ts episodes/01-serpent.json
import { REPO, readJson, workDir, writeJson } from "./lib.mjs";

export const TEMPO = 1.06; // the voice is played 6 % faster: reels need pace
export const VO0 = 0.3; // the story starts 0.3 s into the reel

const ep = readJson(process.argv[2]);
const dir = workDir(ep);
const vo = readJson(`${dir}/vo.json`);
const cta = readJson(`${dir}/cta.json`);
const chunks: string[][] = ep.story.split("|").map((c: string) => c.trim().split(/\s+/));
const words: Array<[string, number, number]> = vo.words;
const nWords = chunks.flat().length;
if (nWords !== words.length)
  throw new Error(`The story has ${nWords} words but Whisper heard ${words.length}: ${words.map((w) => w[0]).join(" ")}. Adjust the text (e.g. join or split words) or delete work/${ep.id}/vo.* to re-record.`);

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const T = (s: number) => +(VO0 + s / TEMPO).toFixed(3);
const overlays: Record<string, string> = {};
const timeline: Array<{ png: string; a: number; b: number }> = [];
let wi = 0;
for (let c = 0; c < chunks.length; c++) {
  const ws = chunks[c];
  const nextChunk = c + 1 < chunks.length ? words[wi + ws.length][1] : words[words.length - 1][2] + 0.4;
  for (let i = 0; i < ws.length; i++) {
    const end = i + 1 < ws.length ? words[wi + i + 1][1] : nextChunk;
    const name = `sub-${c}-${i}`;
    overlays[name] = `<div class="sub">${ws.map((x, j) => (j === i ? `<b>${esc(x)}</b>` : esc(x))).join(" ")}</div>`;
    timeline.push({ png: name, a: T(c === 0 && i === 0 ? 0 : words[wi + i][1]), b: T(end) });
  }
  wi += ws.length;
}
const storyEnd = T(words[words.length - 1][2]);
overlays.hook = `<div class="hook">${esc(ep.hook)}</div><div class="ref">${esc(ep.ref)}</div>`;
timeline.unshift({ png: "hook", a: 0, b: storyEnd + 0.3 });

const card = +(storyEnd + 0.35).toFixed(2);
const ctaVo = +(card + 0.3).toFixed(2);
const cue = cta.words.find((w: [string, number]) => w[0].startsWith(ep.card.buttonCue)) ?? cta.words[Math.floor(cta.words.length / 2)];
const end = +(ctaVo + cta.duration / TEMPO + 0.9).toFixed(2);
overlays.card = `<div class="card"><img src="file://${REPO}/${ep.card.image ?? "src/assets/moses-home.png"}"></div>`;
overlays.cardtitle = `<div class="title">${ep.card.title}</div><div class="tag">${esc(ep.card.tag)}</div>`;
overlays.cardbtn = `<div class="btn">${esc(ep.card.button)}<small>${esc(ep.card.buttonSmall)}</small></div>`;

writeJson(`${dir}/overlays.json`, overlays);
writeJson(`${dir}/timeline.json`, {
  timeline, TEMPO, VO0, storyEnd, card, ctaVo, end,
  fades: [["card", card, 0.5], ["cardtitle", card + 0.35, 0.4], ["cardbtn", +(ctaVo + cue[1] / TEMPO - 0.1).toFixed(2), 0.3]],
});
console.log(`story ends ${storyEnd} s, card ${card} s, reel ${end} s, ${timeline.length} subtitle steps`);
