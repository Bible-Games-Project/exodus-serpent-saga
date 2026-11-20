// Builds src/game/audio/soundLibrary.json: every sound file the game can use,
// with a readable name and a group, for the Sound testing dropdowns.
//
//   bun scripts/build-sound-library.ts
//
// Sources: the ElevenLabs alternatives of every catalog event that exist in
// public/audio, plus every pack in public/audio/Library/<Pack>/pack.json
// ({ source, license, sounds: [{ file, name, group, action?, author?, url? }] }).
// Claude's pack is rendered by scripts/claude-sounds/render.ts.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ALTERNATIVES, SOUND_CATEGORIES, SOUND_EVENTS, soundPath } from "../src/game/audio/soundCatalog";

const PUBLIC = join(import.meta.dir, "..", "public");
type Entry = { path: string; name: string; group: string; source: string; action?: string };
const out: Entry[] = [];

const catLabel = Object.fromEntries(SOUND_CATEGORIES.map((c) => [c.id, c.label]));
for (const ev of SOUND_EVENTS) {
  if (ev.noFiles) continue;
  const name = ev.label.replace(/\s*\(.*?\)\s*/g, " ").trim();
  for (let n = 1; n <= ALTERNATIVES; n++) {
    const p = soundPath(ev, n);
    if (existsSync(join(PUBLIC, p))) out.push({ path: p, name: `${name} ${n}`, group: `${catLabel[ev.category]} (AI)`, source: "ElevenLabs" });
  }
}

const LIB = join(PUBLIC, "audio", "Library");
for (const pack of existsSync(LIB) ? readdirSync(LIB).sort() : []) {
  const f = join(LIB, pack, "pack.json");
  if (!existsSync(f)) continue;
  const meta = JSON.parse(readFileSync(f, "utf8")) as { source: string; sounds: Array<{ file: string; name: string; group: string; action?: string }> };
  for (const s of meta.sounds)
    out.push({ path: `audio/Library/${pack}/${s.file}`, name: s.name, group: s.group, source: meta.source, ...(s.action ? { action: s.action } : {}) });
}

writeFileSync(join(import.meta.dir, "..", "src", "game", "audio", "soundLibrary.json"), JSON.stringify(out, null, 0).replace(/},{/g, "},\n{") + "\n");
console.log(`${out.length} sounds in the library`);
