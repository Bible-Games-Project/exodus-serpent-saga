// Renders the same short narration with several ElevenLabs voices so the
// owner can pick one by ear: public/reels/voces/NN-name.mp3 + index.html.
//
//   bun voice-samples.ts   (needs ELEVENLABS_API_KEY)
import fs from "node:fs";
import { REPO } from "./lib.mjs";

const TEXT =
  "Hace más de tres mil años, Egipto sufrió diez plagas seguidas. Primero, el río se volvió rojo como la sangre. Después llegaron las ranas... millones de ranas. Y lo peor aún estaba por llegar.";
const VOICES: Array<[string, string, string]> = [
  ["5egO01tkUjEzu7xSSE8M", "Carmelo", "España · maduro, misterioso"],
  ["o0SveC0zgHFuCsEO3vHR", "Gabo", "España · grave, evocador"],
  ["QtPMrakdgePQIUwOX7Ut", "Arconte", "España · profundo, elegante"],
  ["OjrdP8Z2fWjVyt0scrL7", "Mario", "España · grave, cálido"],
  ["sDuUJMeNJR828mXTRrDh", "Hernán", "España · aterciopelado, pausado"],
  ["t9LRTh3y1ioN00e9wsNh", "Aarón Abad", "España · narrador profesional"],
  ["z3kTTwYbQrmL7ckdGcJi", "Martín (intenso)", "España · suspense"],
  ["W5JElH3dK1UYYAiHH7uh", "Martín (íntimo)", "España · cercano, susurrado"],
  ["D7dkYvH17OKLgp4SLulf", "Martín (enérgico)", "España · anuncio de TV"],
  ["ZCh4e9eZSUf41K4cmCEL", "Emilio", "España · cálido, seguro"],
  ["43h7ymOnaaYdWr3dRbsS", "Jaime", "España · grave, claro"],
  ["orF2qy9215xjwqqxqsWW", "Rafael", "España · mayor, teatral"],
  ["Nh2zY9kknu6z4pZy6FhD", "David Martín", "España · joven, seguro"],
  ["7QQzpAyzlKTVrRzQJmTE", "Dani", "España · joven, rápido, redes"],
  ["gc61tTk93h3LBXPxew2V", "Rafa", "España · tranquilo"],
  ["7ilYbYb99yBZGMUUKSaf", "Álex", "España · suave, neutro"],
  ["k8cFOyAg7B9qwBlDDNTC", "Miguel", "Latino · tráiler de cine"],
  ["Rl2JPHsuEWSfwCD4ZHIQ", "El Faraón", "Latino · poderoso, misterioso"],
  ["K3TeN3ZVK8WnOeJ0NYqZ", "David (misterio)", "Latino · grave, estilo terror viral"],
  ["YqZLNYWZm98oKaaLZkUA", "Edoardo", "Latino · oscuro, medido"],
];
const OUT = `${REPO}/public/reels/voces`;
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
fs.writeFileSync(`${OUT}/index.html`, `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Voces para los reels</title>
<style>body{font:16px system-ui;background:#f6e2ad;color:#3a2412;max-width:640px;margin:20px auto;padding:0 14px}li{list-style:none;background:#fff8e6;border:2px solid #3a2412;border-radius:10px;padding:10px;margin:10px 0}span{color:#7a5a30;font-size:14px;margin-left:6px}audio{display:block;width:100%;margin-top:8px}</style></head>
<body><h1>Voces masculinas</h1><p>Todas leen el mismo texto: «${TEXT}»</p><ol>${rows.join("\n")}</ol></body></html>\n`);
console.log("done", VOICES.length);
