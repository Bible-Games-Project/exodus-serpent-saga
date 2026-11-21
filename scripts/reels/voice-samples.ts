// Renders the same short narration with several ElevenLabs voices so the
// owner can pick one by ear: public/reels/voices/NN-name.mp3 + index.html.
//
//   bun voice-samples.ts   (needs ELEVENLABS_API_KEY)
import fs from "node:fs";
import { REPO } from "./lib.mjs";

const TEXT =
  "Over three thousand years ago, Egypt was struck by ten plagues in a row. First, the river turned red as blood. Then came the frogs... millions of them. And the worst was yet to come.";
// American male voices from the ElevenLabs shared library.
const VOICES: Array<[string, string, string]> = [
  ["e5WNhrdI30aXpS2RSGm1","Ian Cartwell","suspense and mystery"],
  ["n1PvBOwxb8X6m7tahp2h","Michael C. Vincent (suspense)","cinematic, theatrical"],
  ["uju3wxzG5OhpWcoi3SMy","Michael C. Vincent (warm)","confident, expressive"],
  ["EkK5I93UQWFDigLMpZcX","James","husky, bold"],
  ["pVnrL6sighQX7hVz89cp","Henry","deep documentary"],
  ["ppLqTilh7rH7fbUVlXsf","David (documentary)","older, authoritative"],
  ["kqVT88a5QfII1HNAEPTJ","Declan Sage","deep, wise"],
  ["dtSEyYGNJqjrtBArPCVZ","Titan","bold, powerful, intense"],
  ["V33LkP9pVLdcjeB2y5Na","Maverick","commanding, movie trailer"],
  ["dPah2VEoifKnZT37774q","Knox Dark","serious, slow"],
  ["tZssYepgGaQmegsMEXjK","True","true crime, half whisper"],
  ["fCxG8OHm4STbIsWe4aT9","Harrison Gale","smooth, velvety"],
  ["SAxJUlDKRc79XAyeWyMu","Morgan","deep, warm, confident"],
  ["wAGzRVkxKEs8La0lmdrE","Sully","mature, intriguing"],
  ["HIGUfNOdjuWQwwapnTRW","Chuck Miller","raspy, weathered"],
  ["6xPz2opT0y5qtoRh1U1Y","Christian","serious TV host"],
  ["Dslrhjl3ZpzrctukrQSN","Brad","casual documentary"],
  ["PGoKnSD4gKn2aS99wOR2","Brian S.","calm viral shorts"],
  ["VCgLBmBjldJmfphyB8sZ","Liam","hyped viral shorts, young"],
  ["S9GPGBaMND8XWwwzxQXp","Charles","energetic, social media"],
];
const OUT = `${REPO}/public/reels/voices`;
fs.mkdirSync(OUT, { recursive: true });
const rows: string[] = [];
for (let i = 0; i < VOICES.length; i++) {
  const [id, name, desc] = VOICES[i];
  const file = `${String(i + 1).padStart(2, "0")}-${name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "")}.mp3`;
  if (!fs.existsSync(`${OUT}/${file}`)) {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${id}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({ text: TEXT, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.3 } }),
    });
    if (!r.ok) throw new Error(`${name}: ${r.status} ${await r.text()}`);
    fs.writeFileSync(`${OUT}/${file}`, Buffer.from(await r.arrayBuffer()));
    console.log(file);
  }
  rows.push(`<li><b>${i + 1}. ${name}</b> <span>${desc}</span><audio controls preload="none" src="${file}"></audio></li>`);
}
fs.writeFileSync(`${OUT}/index.html`, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reel narrator voices</title>
<style>body{font:16px system-ui;background:#f6e2ad;color:#3a2412;max-width:640px;margin:20px auto;padding:0 14px}li{list-style:none;background:#fff8e6;border:2px solid #3a2412;border-radius:10px;padding:10px;margin:10px 0}span{color:#7a5a30;font-size:14px;margin-left:6px}audio{display:block;width:100%;margin-top:8px}</style></head>
<body><h1>American male voices</h1><p>Todas leen el mismo texto / all read the same text: “${TEXT}”</p><ol>${rows.join("\n")}</ol></body></html>\n`);
console.log("done", VOICES.length);
