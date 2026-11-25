// Enemy death alternatives generated with the ElevenLabs sound-effects API
// (2026-11-25, after the smoke puff was rejected). Writes MP3s and a
// pack.json to public/audio/Library/ElevenFx.
//
//   ELEVENLABS_API_KEY=... bun scripts/claude-sounds/eleven-death.ts
//   bun scripts/build-sound-library.ts
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Falls back to the second key when the first runs out of credits.
const KEYS = [process.env.ELEVENLABS_API_KEY, process.env.ELEVENLABS_API_KEY_2].filter(Boolean) as string[];
let k = 0;
const OUT = join(import.meta.dir, "..", "..", "public", "audio", "Library", "ElevenFx");
mkdirSync(OUT, { recursive: true });

const TAKES = [
  { file: "enemy-death-thud-1.mp3", name: "Enemy falls: soft thud and sand", d: 0.6,
    text: "Short arcade game enemy defeat sound: a soft dull body thud hitting sand with a tiny scatter of sand grains, no voice, no music, dry, clean" },
  { file: "enemy-death-thud-2.mp3", name: "Enemy falls: soft thud and sand 2", d: 0.6,
    text: "Quick muffled thump of a defeated soldier dropping onto desert sand, light dust scatter, video game sound effect, no voice, no music" },
  { file: "enemy-death-pop-1.mp3", name: "Enemy defeated: soft pop", d: 0.5,
    text: "Short satisfying soft pop when an enemy is defeated in a casual video game, round and warm, tiny sparkle tail, no voice, no music" },
  { file: "enemy-death-pop-2.mp3", name: "Enemy defeated: soft pop 2", d: 0.5,
    text: "Gentle bubbly pop sound effect, rounded and low, game enemy disappearing, very short, no voice, no music" },
  { file: "enemy-death-hit-1.mp3", name: "Enemy defeated: final hit", d: 0.5,
    text: "Short punchy final hit impact sound for defeating an enemy in an action game, wooden staff whack with a soft low thump, no voice, no music" },
  { file: "enemy-death-chime-1.mp3", name: "Enemy defeated: low chime", d: 0.7,
    text: "Short soft magical low chime with a gentle whoosh as a defeated enemy fades away, warm and subtle, video game, no voice" },
];

const sounds: Array<{ file: string; name: string; group: string; action: string }> = [];
for (const t of TAKES) {
  sounds.push({ file: t.file, name: t.name, group: "Enemies (ElevenLabs)", action: "enemy.death.small" });
  if (existsSync(join(OUT, t.file))) continue;
  for (let attempt = 0; attempt < 6 && k < KEYS.length; attempt++) {
    const r = await fetch("https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128", {
      method: "POST",
      headers: { "xi-api-key": KEYS[k], "content-type": "application/json" },
      body: JSON.stringify({ text: t.text, duration_seconds: t.d, prompt_influence: 0.6 }),
    });
    if (r.ok) { writeFileSync(join(OUT, t.file), Buffer.from(await r.arrayBuffer())); console.log("ok", t.file); break; }
    console.log(t.file, r.status, (await r.text()).slice(0, 160));
    if (r.status === 401 && k + 1 < KEYS.length) { k++; continue; }
    if (r.status !== 429 && r.status < 500) break;
    await new Promise((res) => setTimeout(res, 2000 * (attempt + 1)));
  }
}
const made = sounds.filter((x) => existsSync(join(OUT, x.file)));
writeFileSync(join(OUT, "pack.json"), JSON.stringify({ source: "ElevenLabs", license: "Generated for this game with the ElevenLabs sound-effects API", sounds: made }, null, 2) + "\n");
