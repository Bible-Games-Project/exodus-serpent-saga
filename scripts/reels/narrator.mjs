// The narrator who opens the reel: a portrait (episode `narrator.image`) that
// blinks and moves its mouth with the voice. Makes six sprites (eyes open/closed
// x mouth closed/half/open) by repainting the eyes and mouth of the portrait,
// then a frame-by-frame list (narr.txt, for ffmpeg's concat demuxer) that picks
// the mouth from the loudness of the voice and blinks every few seconds.
//
//   node narrator.mjs episodes/02-plagues.json   (after plan.ts and voice.ts)
//
// The face regions (`eyes`, `mouth`, in pixels of the original image) are in the
// episode's `narrator` block; the defaults fit scripts/reels/narrator/narrator.png.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { FFMPEG, REPO, browser, readJson, workDir, writeJson } from "./lib.mjs";

const ep = readJson(process.argv[2]);
const dir = workDir(ep);
const N = {
  image: "scripts/reels/narrator/narrator.png",
  width: 720, // on screen, in reel pixels
  eyes: [[480, 267, 26, 18], [604, 247, 30, 18]], // centre x, centre y, radius x, radius y
  mouth: [505, 352, 618, 394], // box around the open mouth: x0 y0 x1 y1
  ...ep.narrator,
};
const { TEMPO, VO0, narrator: span } = readJson(`${dir}/timeline.json`);
const OUT = `${dir}/narr`;
fs.mkdirSync(OUT, { recursive: true });

// --- Sprites, painted on a canvas in headless Chromium.
const b = await browser();
const pg = await b.newPage();
const src = "data:image/png;base64," + fs.readFileSync(`${REPO}/${N.image}`).toString("base64");
const sprites = await pg.evaluate(async (src, N) => {
  const img = new Image();
  img.src = src;
  await img.decode();
  const W = img.width, H = img.height;
  const make = (eyesClosed, mouth) => {
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, W, H), p = d.data;
    const at = (x, y) => (y * W + x) * 4;
    const set = (x, y, [r, gg, bb]) => { const i = at(x, y); p[i] = r; p[i + 1] = gg; p[i + 2] = bb; p[i + 3] = 255; };
    const get = (x, y) => { const i = at(x, y); return [p[i], p[i + 1], p[i + 2]]; };
    if (eyesClosed)
      for (const [cx, cy, rx, ry] of N.eyes) {
        // Lid: one even skin tone (the average just under the eye), a little darker, over the eye and its outline.
        const sk = [0, 0, 0];
        let n = 0;
        for (let y = cy + ry + 5; y <= cy + ry + 9; y++) for (let x = cx - 8; x <= cx + 8; x++) { get(x, y).forEach((v, i) => (sk[i] += v)); n++; }
        const skin = sk.map((v) => v / n);
        const RX = rx + 1, RY = ry + 2;
        for (let y = cy - RY; y <= cy + RY; y++)
          for (let x = cx - RX; x <= cx + RX; x++) {
            if (((x - cx) / RX) ** 2 + ((y - cy) / RY) ** 2 > 1) continue;
            const k = y < cy + 2 ? 0.91 : 0.97;
            set(x, y, skin.map((v) => Math.round(v * k)));
          }
        // Lashes: a thick dark curve.
        for (let x = cx - rx; x <= cx + rx; x++) {
          const u = (x - cx) / rx;
          const y = Math.round(cy + 1 + 6 * (1 - u * u));
          for (let t = -4; t <= 3; t++) set(x, y + t, [40, 20, 14]);
        }
      }
    const [x0, y0, x1, y1] = N.mouth;
    // Mouth pixels: the dark inside and the white teeth.
    const isMouth = (x, y) => {
      const [r, gg, bb] = get(x, y);
      const l = 0.3 * r + 0.59 * gg + 0.11 * bb;
      return l < 62 || (l > 165 && Math.abs(r - bb) < 70);
    };
    const top = [], bot = [];
    for (let x = x0; x <= x1; x++) {
      top[x] = -1; bot[x] = -1;
      for (let y = y0; y <= y1; y++) if (isMouth(x, y)) { if (top[x] < 0) top[x] = y; bot[x] = y; }
    }
    if (mouth === "closed") {
      // Moustache colour above the seam, lip colour below, a dark seam between.
      const before = new Uint8ClampedArray(p);
      const grab = (x, y) => { const i = at(x, y); return [before[i], before[i + 1], before[i + 2]]; };
      for (let x = x0; x <= x1; x++) {
        if (top[x] < 0) continue;
        const t0 = top[x] - 2, b0 = bot[x] + 2, m = Math.round((t0 + b0) / 2);
        const up = grab(x, t0 - 2), down = grab(x, b0 + 2);
        for (let y = t0; y <= b0; y++) set(x, y, y < m ? up : down);
        for (let t = -2; t <= 2; t++) set(x, m + t, [62, 26, 18]);
      }
    }
    if (mouth === "open") {
      // Drop the lower lip (and the beard under it) to open the mouth wider.
      const before = new Uint8ClampedArray(p);
      const grab = (x, y) => { const i = at(x, y); return [before[i], before[i + 1], before[i + 2]]; };
      for (let x = x0; x <= x1; x++) {
        if (bot[x] < 0) continue;
        const k = Math.round(13 * Math.sin((Math.PI * (x - x0)) / (x1 - x0)));
        for (let y = bot[x] + 60; y > bot[x]; y--) set(x, y + k, grab(x, y));
        for (let y = bot[x] + 1; y <= bot[x] + k; y++) set(x, y, [44, 12, 10]);
      }
    }
    g.putImageData(d, 0, 0);
    return c.toDataURL("image/png");
  };
  const out = { W, H };
  for (const e of [false, true]) for (const m of ["closed", "half", "open"]) out[`${e ? "ec" : "eo"}-${m}`] = make(e, m);
  return out;
}, src, N);
await b.close();
const { W: IW, H: IH, ...images } = sprites;
for (const [name, url] of Object.entries(images)) {
  const raw = `${OUT}/${name}-full.png`;
  fs.writeFileSync(raw, Buffer.from(url.split(",")[1], "base64"));
  execFileSync(FFMPEG, ["-v", "error", "-y", "-i", raw, "-vf", `scale=${N.width}:-1:flags=lanczos`, `${OUT}/${name}.png`]);
  fs.rmSync(raw);
}

// --- Which sprite on each frame (15 per second: a pixel-art pace).
const SR = 8000;
const raw = execFileSync(FFMPEG, ["-v", "error", "-i", `${dir}/vo.wav`, "-f", "f32le", "-ac", "1", "-ar", String(SR), "-"], { maxBuffer: 1 << 28 });
const vo = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
const STEP = 1 / 15;
const level = (t) => {
  // Reel time -> voice time (the voice starts at VO0 and plays TEMPO times faster).
  const a = Math.floor((t - VO0) * TEMPO * SR), n = Math.floor(STEP * TEMPO * SR);
  if (a < 0 || a >= vo.length) return 0;
  let s = 0;
  for (let i = a; i < Math.min(vo.length, a + n); i++) s += vo[i] * vo[i];
  return Math.sqrt(s / n);
};
const steps = [];
for (let t = span.a; t < span.b; t += STEP) steps.push(level(t));
const peak = Math.max(...steps, 1e-6);
const list = [];
let blinkAt = span.a + 1.1;
steps.forEach((l, i) => {
  const t = span.a + i * STEP;
  const r = l / peak;
  const mouth = r < 0.12 ? "closed" : r < 0.45 ? "half" : "open";
  const closed = t >= blinkAt && t < blinkAt + 0.14;
  if (t >= blinkAt + 0.14) blinkAt += 2.4 + ((i * 7) % 10) / 10; // every 2.4-3.4 s
  list.push(`file '${OUT}/${closed ? "ec" : "eo"}-${mouth}.png'`, `duration ${STEP.toFixed(4)}`);
});
list.push(`file '${OUT}/eo-closed.png'`);
fs.writeFileSync(`${dir}/narr.txt`, list.join("\n") + "\n");
const h = Math.round((N.width * IH) / IW);
writeJson(`${dir}/narr.json`, { ...span, width: N.width, x: N.x ?? -30, y: N.y ?? 1920 - Math.round(h * 0.93) });
console.log("narrator:", steps.length, "steps,", Object.keys(images).length, "sprites");
