// Cover (thumbnail) of a reel: a painted scene of the episode in the poster's
// pixel-art painting style (OpenAI image edit with the poster as the only
// reference, no text in the picture) and the big title on top, drawn here so
// the letters are always crisp and spelled right.
//
//   bun cover.ts episodes/08-sandals.json          # scene (once) + title -> public/reels/covers/<id>.jpg
//   bun cover.ts episodes/08-sandals.json --text   # redraw the title only, keep the scene
//
// Episode fields: `cover.scene` (what to paint), `cover.text` (title; words in
// *stars* are gold; defaults to `hook`). The scene is kept in
// scripts/reels/covers/<id>-scene.png. Needs OPENAI_API_KEY for the scene.
// The title sits in the middle 3:4 of the frame, which every network's grid shows.
import fs from "node:fs";
import path from "node:path";
import { createCanvas, GlobalFonts, loadImage, type SKRSContext2D } from "@napi-rs/canvas";

const [epPath, flag] = process.argv.slice(2);
if (!epPath) throw new Error("usage: bun cover.ts <episode.json> [--text]");
const ep = JSON.parse(fs.readFileSync(epPath, "utf8"));
const HERE = import.meta.dir;
const OUT = path.join(HERE, "..", "..", "public", "reels", "covers");
fs.mkdirSync(OUT, { recursive: true });
const scenePath = path.join(HERE, "covers", `${ep.id}-scene.png`);
const W = 1080, H = 1920;

async function paintScene() {
  const scene = ep.cover?.scene;
  if (!scene) throw new Error(`${ep.id}: add cover.scene to the episode`);
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  const f = new FormData();
  f.append("model", "gpt-image-1.5");
  f.append("image[]", new Blob([fs.readFileSync(path.join(HERE, "cards", "exodus-survivors-poster.png"))], { type: "image/png" }), "poster.png");
  f.append("prompt", `Paint a brand-new vertical scene in exactly the same art style as this image: vivid high-detail pixel-art painting, saturated warm colours, strong rim light, dramatic sky, epic biblical mood. Do NOT copy the title or layout of the reference, and draw NO text, letters or logos anywhere. Keep the top 35% of the picture as open dramatic sky (empty space for a big title added later); put the subject large and close to the camera in the middle and lower part, so it reads instantly on a small phone screen. Scene: ${scene}`);
  f.append("size", "1024x1536");
  f.append("quality", "high");
  f.append("input_fidelity", "low");
  const r = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: f });
  const j = await r.json();
  if (!j.data?.[0]?.b64_json) throw new Error(`OpenAI ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  fs.writeFileSync(scenePath, Buffer.from(j.data[0].b64_json, "base64"));
}

const fontDir = path.join(HERE, "node_modules", "@fontsource", "rubik", "files");
GlobalFonts.registerFromPath(path.join(fontDir, "rubik-latin-900-normal.woff2"), "RubikBlack");
GlobalFonts.registerFromPath(path.join(fontDir, "rubik-latin-700-normal.woff2"), "RubikBold");

type Word = { t: string; gold: boolean };
function words(text: string): Word[] {
  const out: Word[] = [];
  let gold = false;
  for (const part of text.toUpperCase().split(/(\*)/)) {
    if (part === "*") { gold = !gold; continue; }
    for (const t of part.split(/\s+/)) {
      if (!t) continue;
      // Punctuation right after a gold word ("*40 YEARS*?") sticks to it.
      if (/^[?!.,:;]+$/.test(t) && out.length && !/^\s/.test(part)) out[out.length - 1].t += t;
      else out.push({ t, gold });
    }
  }
  return out;
}

/** Greedy line break at the given size. */
function lines(ctx: SKRSContext2D, ws: Word[], size: number, maxW: number): Word[][] {
  ctx.font = `${size}px RubikBlack`;
  const out: Word[][] = [[]];
  for (const w of ws) {
    const cur = out[out.length - 1];
    const test = [...cur, w].map((x) => x.t).join(" ");
    if (cur.length && ctx.measureText(test).width > maxW) out.push([w]);
    else cur.push(w);
  }
  return out;
}

async function draw() {
  const ctx0 = createCanvas(W, H);
  const ctx = ctx0.getContext("2d");
  const img = await loadImage(scenePath);
  // Cover-fit the 2:3 scene into 9:16.
  const s = Math.max(W / img.width, H / img.height);
  ctx.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s);
  // Darken the top so the title pops, and a soft vignette.
  const g = ctx.createLinearGradient(0, 0, 0, H * 0.55);
  g.addColorStop(0, "rgba(20,8,2,0.55)"); g.addColorStop(0.6, "rgba(20,8,2,0.25)"); g.addColorStop(1, "rgba(20,8,2,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);

  const ws = words(ep.cover?.text ?? ep.hook);
  const maxW = W - 150;
  // Largest size that fits in at most 3 lines, 420 px tall, every line inside the frame.
  const fits = (sz: number, l: Word[][]) => l.length <= 3 && sz * 1.02 * l.length <= 420 && l.every((x) => ctx.measureText(x.map((w) => w.t).join(" ")).width <= maxW);
  let size = 150, ls = lines(ctx, ws, size, maxW);
  while (!fits(size, ls) && size > 60) { size -= 4; ls = lines(ctx, ws, size, maxW); }
  const lh = size * 1.02;
  const top = 270; // inside the 3:4 centre crop (y 240..1680)
  ctx.textBaseline = "top";
  ctx.lineJoin = "round";
  ls.forEach((line, i) => {
    ctx.font = `${size}px RubikBlack`;
    const full = line.map((w) => w.t).join(" ");
    let x = (W - ctx.measureText(full).width) / 2;
    const y = top + i * lh;
    for (const w of line) {
      const ww = ctx.measureText(w.t).width;
      // Shadow, thick dark outline, then the fill.
      ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillText(w.t, x + 8, y + 12);
      ctx.strokeStyle = "#2a1206"; ctx.lineWidth = size * 0.16; ctx.strokeText(w.t, x, y);
      ctx.fillStyle = w.gold ? "#ffc93c" : "#fff8ec"; ctx.fillText(w.t, x, y);
      x += ww + ctx.measureText(" ").width;
    }
  });
  // The Bible reference as a small pill under the title.
  if (ep.ref) {
    const ref = String(ep.ref).split(";")[0].trim();
    ctx.font = "50px RubikBold";
    const tw = ctx.measureText(ref).width;
    const py = top + ls.length * lh + 34, ph = 78, pw = tw + 64;
    ctx.fillStyle = "rgba(30,12,4,0.78)";
    ctx.beginPath(); ctx.roundRect((W - pw) / 2, py, pw, ph, ph / 2); ctx.fill();
    ctx.strokeStyle = "#ffc93c"; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = "#ffe6a8"; ctx.textBaseline = "middle";
    ctx.fillText(ref, (W - tw) / 2, py + ph / 2 + 2);
  }
  const out = path.join(OUT, `${ep.id}.jpg`);
  fs.writeFileSync(out, await ctx0.encode("jpeg", 90));
  console.log("cover", out);
}

if (flag !== "--text" || !fs.existsSync(scenePath)) {
  if (!fs.existsSync(scenePath) || flag === "--scene") await paintScene();
}
await draw();
