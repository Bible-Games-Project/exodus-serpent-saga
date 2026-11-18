// Generates the five alternatives of every sound event in
// src/game/audio/soundCatalog.ts with the ElevenLabs Sound Effects API and
// writes public/audio/manifest.json (--manifest only rewrites the manifest).
//
//   ELEVENLABS_API_KEY=... bun scripts/generate-sounds.ts [--only id,id] [--force]
//
// Existing files are kept unless --force is given, so the script can be re-run
// to fill in anything missing. The key is read from the environment only.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { SOUND_ACTIONS, SOUND_EVENTS, ALTERNATIVES, soundPath, type SoundEvent } from "../src/game/audio/soundCatalog";
import { DEFAULT_SOUNDS } from "../src/game/audio/soundChoices";
import { SOUND_LIBRARY } from "../src/game/audio/soundLibrary";

const KEY = process.env.ELEVENLABS_API_KEY;
const PUBLIC = join(import.meta.dir, "..", "public");
const args = process.argv.slice(2);
const force = args.includes("--force");
const onlyArg = args[args.indexOf("--only") + 1];
const only = args.includes("--only") && onlyArg ? new Set(onlyArg.split(",")) : null;

async function generate(ev: SoundEvent, n: number): Promise<"ok" | "skip" | string> {
  const file = join(PUBLIC, soundPath(ev, n));
  if (!force && existsSync(file)) return "skip";
  const take = ev.takes[n - 1] ?? "";
  const body = {
    text: `${ev.prompt}${take ? `, ${take}` : ""}`,
    duration_seconds: ev.duration,
    prompt_influence: 0.55,
  };
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch("https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128", {
      method: "POST",
      headers: { "xi-api-key": KEY!, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok) {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, Buffer.from(await r.arrayBuffer()));
      return "ok";
    }
    const msg = `${r.status} ${(await r.text()).slice(0, 200)}`;
    if (r.status !== 429 && r.status < 500) return msg;
    await new Promise((res) => setTimeout(res, 2000 * (attempt + 1)));
  }
  return "gave up";
}

async function main() {
  if (!KEY) throw new Error("ELEVENLABS_API_KEY is not set");
  const jobs: Array<[SoundEvent, number]> = [];
  for (const ev of SOUND_EVENTS) {
    if (only && !only.has(ev.id)) continue;
    if (ev.noFiles) continue;
    for (let n = 1; n <= ALTERNATIVES; n++) jobs.push([ev, n]);
  }
  let done = 0;
  const failures: string[] = [];
  const workers = Array.from({ length: 4 }, async () => {
    for (;;) {
      const job = jobs.shift();
      if (!job) return;
      const [ev, n] = job;
      const res = await generate(ev, n);
      done++;
      if (res !== "ok" && res !== "skip") failures.push(`${ev.id} #${n}: ${res}`);
      if (done % 20 === 0) console.log(`${done} done`);
    }
  });
  await Promise.all(workers);
  writeManifest();
  console.log(failures.length ? `Failures:\n${failures.join("\n")}` : "All generated.");
}

function writeManifest() {
  const manifest = {
    note: "Game sound actions with their default sound, and the sound library (see src/game/audio). Rebuild the library first: bun scripts/build-sound-library.ts",
    actions: SOUND_ACTIONS.map((ev) => ({ id: ev.id, category: ev.category, label: ev.label, sound: DEFAULT_SOUNDS[ev.id] ?? null })),
    library: SOUND_LIBRARY,
  };
  writeFileSync(join(PUBLIC, "audio", "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
}

if (args.includes("--manifest")) writeManifest();
else await main();
