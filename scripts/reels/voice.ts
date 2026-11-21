// Moses' voice for an episode: OpenAI text-to-speech for the story and the
// call to action, then Whisper word timings for the karaoke subtitles.
// Files already in the work folder are kept (delete them to re-record).
//
//   bun voice.ts episodes/01-serpent.json   (needs OPENAI_API_KEY; ELEVENLABS_API_KEY for "elevenlabs:" voices)
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { FFMPEG, readJson, workDir, writeJson } from "./lib.mjs";

const ep = readJson(process.argv[2]);
const dir = workDir(ep);
const KEY = process.env.OPENAI_API_KEY;
if (!KEY) throw new Error("OPENAI_API_KEY is not set");
const persona =
  "You are Moses, an old, wise Hebrew prophet in his eighties, telling a personal memory to a friend by the fire. " +
  "Deep, warm, slightly raspy older male voice. " + (ep.voiceStyle ?? "") +
  " Calm, intimate storytelling with dramatic pauses, a touch of awe at the miracle. Not theatrical, not robotic.";

async function speak(text: string, file: string) {
  if (fs.existsSync(file)) return;
  // "elevenlabs:<voice id>" uses ElevenLabs (any voice of its library); anything else is an OpenAI voice.
  if (String(ep.voice).startsWith("elevenlabs:")) {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ep.voice.slice(11)}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({ text, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.3, speed: ep.speed ?? 1 } }),
    });
    if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${await r.text()}`);
    fs.writeFileSync(`${file}.mp3`, Buffer.from(await r.arrayBuffer()));
    execFileSync(FFMPEG, ["-v", "error", "-y", "-i", `${file}.mp3`, file]);
    fs.rmSync(`${file}.mp3`);
    return;
  }
  const r = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o-mini-tts", voice: ep.voice ?? "onyx", input: text, response_format: "wav", instructions: persona }),
  });
  if (!r.ok) throw new Error(`TTS ${r.status}: ${await r.text()}`);
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
}

async function timings(wav: string, json: string) {
  if (fs.existsSync(json)) return;
  const fd = new FormData();
  fd.append("file", new Blob([fs.readFileSync(wav)]), "voice.wav");
  fd.append("model", "whisper-1");
  fd.append("language", ep.lang ?? "es");
  fd.append("response_format", "verbose_json");
  fd.append("timestamp_granularities[]", "word");
  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${KEY}` }, body: fd });
  if (!r.ok) throw new Error(`Whisper ${r.status}: ${await r.text()}`);
  const j: any = await r.json();
  writeJson(json, { duration: j.duration, text: j.text, words: j.words.map((w: any) => [w.word, +w.start.toFixed(2), +w.end.toFixed(2)]) });
}

const story = ep.story.split("|").map((s: string) => s.trim()).join(" ");
await speak(story, `${dir}/vo.wav`);
await speak(ep.cta, `${dir}/cta.wav`);
await timings(`${dir}/vo.wav`, `${dir}/vo.json`);
await timings(`${dir}/cta.wav`, `${dir}/cta.json`);
console.log("voice ready:", readJson(`${dir}/vo.json`).text);
