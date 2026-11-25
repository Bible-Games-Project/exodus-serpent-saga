// node grade.mjs in.png out.png k skinK skinHue contrast bright — vibrance/warmth grade to match Moses
import fs from "fs"; import { PNG } from "pngjs"; import { rgb2hsl, hsl2rgb } from "./color.mjs";
const [inp, out, k = 1.35, skinK = 1.5, skinHue = 22, contrast = 1.08, bright = -0.03] = process.argv.slice(2).map((v, i) => i < 2 ? v : +v);
const im = PNG.sync.read(fs.readFileSync(inp));
for (let i = 0; i < im.data.length; i += 4) { if (!im.data[i+3]) continue;
  let [h, s, l] = rgb2hsl(im.data[i], im.data[i+1], im.data[i+2]);
  // skin weight: smooth membership in the warm skin band
  const hueW = h < 4 || h > 34 ? 0 : h > 28 ? (34 - h) / 6 : 1;
  const band = hueW && s > 0.15 && l > 0.18 && l < 0.86 ? hueW * Math.min(1, (s - 0.15) / 0.15) * Math.min(1, (0.86 - l) / 0.1) : 0;
  if (band) h = h + (skinHue - h) * 0.6 * band;
  // Gold trims stay golden (not orange) once the vibrance goes up.
  const goldW = h > 28 && h < 58 && s > 0.3 ? 1 - hueW : 0;
  if (goldW) h = h + (43 - h) * 0.7 * goldW;
  let [r, g, b] = hsl2rgb(h, s, l);
  const y = 0.299 * r + 0.587 * g + 0.114 * b; const kk = k + (skinK - k) * band;
  [r, g, b] = [r, g, b].map((c) => y + (c - y) * kk);
  [r, g, b] = [r, g, b].map((c) => ((c / 255 - 0.5) * contrast + 0.5 + bright) * 255);
  im.data[i] = Math.max(0, Math.min(255, r)); im.data[i+1] = Math.max(0, Math.min(255, g)); im.data[i+2] = Math.max(0, Math.min(255, b)); }
fs.writeFileSync(out, PNG.sync.write(im));
