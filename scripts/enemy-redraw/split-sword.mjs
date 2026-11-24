import { read, inPoly, downsample, inpaint, writeLayer } from "./split-lib.mjs";
const im = read(process.argv[2]); const outDir = process.argv[3];
const ARM = [[545,640],[580,598],[1000,400],[1000,800],[600,800],[570,720]];
const skin = (r, g, b) => r - b > 90 && g < 0.75 * r;
const label = (x, y, r, g, b) => {
  if (inPoly(ARM, x, y)) return "arm";
  if (y >= 1020 && (y >= 1065 || skin(r, g, b))) return x < 430 ? "legB" : "legF";
  return "body";
};
const d = downsample(im, 84, label);
const { W, H, px } = d;
const L = { body: [], legB: [], legF: [], arm: [] };
for (let i = 0; i < W * H; i++) if (px[i]) L[px[i].label][i] = px[i];
// Repaint the body behind the forearm where it overlapped the torso edge.
const [ex] = d.toLow(592, 0);
const holes = []; for (let i = 0; i < W * H; i++) if (px[i]?.label === "arm" && (i % W) < ex) holes.push(i);
inpaint(W, H, L.body, holes);
// Extend each leg 3 rows up (hidden under the kilt) so a swinging leg never leaves a gap.
for (const k of ["legB", "legF"]) { let top = H; for (let i = 0; i < W*H; i++) if (L[k][i]) top = Math.min(top, (i / W) | 0);
  for (let x = 0; x < W; x++) { const c = L[k][(top + 1) * W + x]; if (c) for (let y = top - 3; y <= top; y++) if (!L[k][y*W+x]) L[k][y*W+x] = c; } }
for (const k of Object.keys(L)) writeLayer(`${outDir}/${k}.png`, W, H, L[k]);
const P = (x, y) => d.toLow(x, y).map((v) => +v.toFixed(1));
console.log(JSON.stringify({ W, H, s: d.s.toFixed(2), ELBOW: P(569, 637), HIP_B: P(300, 975), HIP_F: P(545, 975), CX: P(430, 0)[0], HAND: P(687, 712), TIP: P(971, 486) }));
