// Cover (thumbnail) of a reel: a gameplay frame from the finished reel as the
// background, the narrator big in front (the three poses take turns by episode
// number) and the question as a big title on top, drawn here so the letters
// are crisp and spelled right.
//
//   bun cover.ts episodes/08-sandals.json   # -> public/reels/covers/<id>.jpg (needs public/reels/<id>.mp4)
//
// Optional episode fields, all in `cover`: `text` (title, default `hook`;
// words in *stars* are gold), `frame` (second of the reel to use as the
// background, default 45% in, after the narrator has left; pick a moment with
// action and the subtitle low on the screen, the narrator hides it), `narrator`
// (0, 1 or 2 to force a pose). The title sits in the middle 3:4 of the frame,
// which every network's grid shows.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createCanvas, GlobalFonts, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import { FFMPEG } from "./lib.mjs";

const [epPath] = process.argv.slice(2);
if (!epPath) throw new Error("usage: bun cover.ts <episode.json>");
const ep = JSON.parse(fs.readFileSync(epPath, "utf8"));
const HERE = import.meta.dir;
const REPO = path.join(HERE, "..", "..");
const OUT = path.join(REPO, "public", "reels", "covers");
fs.mkdirSync(OUT, { recursive: true });
const W = 1080, H = 1920;
const POSES = ["narrator.png", "narrator-v2.png", "narrator-v3.png"];

const fontDir = path.join(HERE, "node_modules", "@fontsource", "rubik", "files");
GlobalFonts.registerFromPath(path.join(fontDir, "rubik-latin-900-normal.woff2"), "RubikBlack");
GlobalFonts.registerFromPath(path.join(fontDir, "rubik-latin-700-normal.woff2"), "RubikBold");

/** A frame of the finished reel as a PNG, `dt` seconds after the chosen moment. */
function grabFrame(dt = 0): string {
  const video = path.join(REPO, "public", "reels", `${ep.id}.mp4`);
  if (!fs.existsSync(video)) throw new Error(`No video ${video}: run compose.ts first`);
  const probe = spawnSync(FFMPEG, ["-i", video], { encoding: "utf8" }).stderr;
  const m = probe.match(/Duration: (\d+):(\d+):([\d.]+)/);
  const dur = m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 20;
  const t = Math.min(dur - 3, Math.max(0, (ep.cover?.frame ?? dur * 0.45) + dt));
  const out = path.join(process.env.TMPDIR ?? "/tmp", `cover-${ep.id}-${dt}.png`);
  const r = spawnSync(FFMPEG, ["-y", "-v", "error", "-ss", String(t), "-i", video, "-frames:v", "1", out]);
  if (r.status !== 0) throw new Error("ffmpeg could not read a frame");
  return out;
}

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
    if (cur.length && ctx.measureText([...cur, w].map((x) => x.t).join(" ")).width > maxW) out.push([w]);
    else cur.push(w);
  }
  return out;
}

const canvas = createCanvas(W, H);
const ctx = canvas.getContext("2d");

// The game. The reel's frames carry its own title (top, down to y ~560) and
// the subtitles (y ~1220-1350): the top is filled with clean ground from
// another moment of the reel and the narrator's shoulders cover the subtitles.
const CLEAN = 560;
const frame = await loadImage(grabFrame());
const other = await loadImage(grabFrame(-2.5));
ctx.drawImage(frame, 0, CLEAN, W, H - CLEAN, 0, CLEAN, W, H - CLEAN);
ctx.drawImage(other, 0, CLEAN, W, CLEAN, 0, 0, W, CLEAN);
// Subtitle band: ground from below the subtitles of the other moment, feathered in.
{
  const SUB0 = 1180, SUB1 = 1380, F = 40;
  const patch = createCanvas(W, SUB1 - SUB0 + 2 * F);
  const p = patch.getContext("2d");
  p.drawImage(other, 0, 1480, W, patch.height, 0, 0, W, patch.height);
  p.globalCompositeOperation = "destination-in";
  const m = p.createLinearGradient(0, 0, 0, patch.height);
  m.addColorStop(0, "rgba(0,0,0,0)"); m.addColorStop(F / patch.height, "rgba(0,0,0,1)");
  m.addColorStop(1 - F / patch.height, "rgba(0,0,0,1)"); m.addColorStop(1, "rgba(0,0,0,0)");
  p.fillStyle = m; p.fillRect(0, 0, W, patch.height);
  ctx.drawImage(patch, 0, SUB0 - F);
}

// Dark top for the title, a soft vignette and a glow behind the narrator.
const top = ctx.createLinearGradient(0, 0, 0, 900);
top.addColorStop(0, "rgba(26,10,2,0.92)"); top.addColorStop(0.62, "rgba(26,10,2,0.78)"); top.addColorStop(1, "rgba(26,10,2,0)");
ctx.fillStyle = top; ctx.fillRect(0, 0, W, 900);
const vig = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.3, W / 2, H * 0.55, H * 0.75);
vig.addColorStop(0, "rgba(0,0,0,0)"); vig.addColorStop(1, "rgba(0,0,0,0.4)");
ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
const glow = ctx.createRadialGradient(W / 2, 1250, 80, W / 2, 1250, 620);
glow.addColorStop(0, "rgba(255,214,120,0.55)"); glow.addColorStop(1, "rgba(255,214,120,0)");
ctx.fillStyle = glow; ctx.fillRect(0, 700, W, 1220);

// The narrator, big, standing on the bottom edge.
const pose = ep.cover?.narrator ?? (parseInt(ep.id, 10) || 0) % POSES.length;
const nar = await loadImage(path.join(HERE, "narrator", POSES[pose]));
const nw = 1100, nh = nar.height * (nw / nar.width);
const ny = 770; // shoulders at ~y 1200, over the subtitles
ctx.save();
ctx.shadowColor = "rgba(0,0,0,0.55)"; ctx.shadowBlur = 40; ctx.shadowOffsetY = 10;
ctx.drawImage(nar, (W - nw) / 2, ny, nw, nh);
ctx.restore();

// The question.
const ws = words(ep.cover?.text ?? ep.hook);
const maxW = W - 120;
const fits = (sz: number, l: Word[][]) => l.length <= 4 && sz * 1.04 * l.length <= 470 && l.every((x) => ctx.measureText(x.map((w) => w.t).join(" ")).width <= maxW);
let size = 150, ls = lines(ctx, ws, size, maxW);
while (!fits(size, ls) && size > 60) { size -= 4; ls = lines(ctx, ws, size, maxW); }
const lh = size * 1.04;
const y0 = 270; // inside the 3:4 centre crop (y 240..1680)
ctx.textBaseline = "top";
ctx.lineJoin = "round";
ls.forEach((line, i) => {
  ctx.font = `${size}px RubikBlack`;
  const sp = ctx.measureText(" ").width;
  let x = (W - ctx.measureText(line.map((w) => w.t).join(" ")).width) / 2;
  const y = y0 + i * lh;
  for (const w of line) {
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillText(w.t, x + 7, y + 11);
    ctx.strokeStyle = "#1e0c03"; ctx.lineWidth = size * 0.17; ctx.strokeText(w.t, x, y);
    ctx.fillStyle = w.gold ? "#ffc93c" : "#fffaf0"; ctx.fillText(w.t, x, y);
    x += ctx.measureText(w.t).width + sp;
  }
});
// The Bible reference as a small gold pill under it.
if (ep.ref) {
  const ref = String(ep.ref).split(";")[0].trim();
  ctx.font = "48px RubikBold";
  const tw = ctx.measureText(ref).width;
  const py = y0 + ls.length * lh + 26, ph = 74, pw = tw + 60;
  ctx.fillStyle = "#ffc93c";
  ctx.beginPath(); ctx.roundRect((W - pw) / 2, py, pw, ph, ph / 2); ctx.fill();
  ctx.fillStyle = "#2a1206"; ctx.textBaseline = "middle";
  ctx.fillText(ref, (W - tw) / 2, py + ph / 2 + 2);
}

const out = path.join(OUT, `${ep.id}.jpg`);
fs.writeFileSync(out, await canvas.encode("jpeg", 90));
console.log("cover", out, "pose", pose);
