import { read, inPoly, downsample, inpaint, writeLayer, dropSpecks } from "./split-lib.mjs";
const im = read(process.argv[2]); const outDir = process.argv[3];
const BAND = [[497,460],[880,455],[880,592],[497,592]];
const BOW = [[640,95],[770,95],[945,340],[945,700],[770,1000],[680,1000],[675,930],[800,720],[850,520],[800,320],[650,150]];
const T = [692,117], B = [725,967], HND = [458,505];
const segD = ([ax, ay], [bx, by], x, y) => { const dx = bx-ax, dy = by-ay; const t = Math.max(0, Math.min(1, ((x-ax)*dx + (y-ay)*dy) / (dx*dx+dy*dy))); return Math.hypot(x - ax - t*dx, y - ay - t*dy); };
const skin = (r, g, b) => r - b > 90 && g < 0.75 * r;
const label = (x, y, r, g, b) => {
  if (inPoly(BAND, x, y) || inPoly(BOW, x, y)) return "arm";
  if (x > 488 && y < 1000 && (segD(T, HND, x, y) < 18 || segD(B, HND, x, y) < 18)) return "drop";
  if (y >= 1060 && (y >= 1125 || skin(r, g, b))) return x < 390 ? "legB" : "legF";
  return "body";
};
const d = downsample(im, 84, label, 275);
const { W, H, px } = d;
const L = { body: [], legB: [], legF: [], arm: [] };
for (let i = 0; i < W * H; i++) if (px[i] && L[px[i].label]) L[px[i].label][i] = px[i];
const [ex] = d.toLow(525, 0);
const holes = []; for (let i = 0; i < W * H; i++) if (px[i]?.label === "arm" && (i % W) < ex) holes.push(i);
inpaint(W, H, L.body, holes);
for (const k of ["legB", "legF"]) { let top = H; for (let i = 0; i < W*H; i++) if (L[k][i]) top = Math.min(top, (i / W) | 0);
  for (let x = 0; x < W; x++) { const c = L[k][(top + 1) * W + x]; if (c) for (let y = top - 3; y <= top; y++) if (!L[k][y*W+x]) L[k][y*W+x] = c; } }
for (const k of Object.keys(L)) dropSpecks(W, H, L[k], 6);
for (const k of Object.keys(L)) writeLayer(`${outDir}/${k}.png`, W, H, L[k]);
const P = (x, y) => d.toLow(x, y).map((v) => +v.toFixed(1));
console.log(JSON.stringify({ W, H, s: d.s.toFixed(2), HIP_B: P(300, 1000), HIP_F: P(470, 1000), CX: P(400, 0)[0], TOP: P(...T), BOT: P(...B), HAND: P(...HND), GRIP: P(905, 515) }));
