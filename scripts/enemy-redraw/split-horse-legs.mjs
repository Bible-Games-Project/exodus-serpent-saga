// Split each horse leg layer into three bending segments (upper leg, cannon,
// pastern + hoof) so the rig can fold the knee / hock and the fetlock instead
// of swinging a stiff leg. Each lower segment keeps a few extra rows above its
// cut, so the joint never opens a gap when it bends.
//
//   bun scripts/enemy-redraw/split-horse-legs.mjs   (needs pngjs)
//
// Prints the segment origins and joint pivots used by horseGait.ts callers.
import fs from "fs";
import { PNG } from "pngjs";

const A = new URL("../../src/assets/", import.meta.url).pathname;
const RIGS = [
  { prefix: "knight-v3-leg-", out: "knight-v4-leg-", ov: 16, legs: {
    h1: { kind: "hind", knee: 1045, fetlock: 1235 }, h2: { kind: "hind", knee: 1045, fetlock: 1235 },
    f1: { kind: "fore", knee: 1080, fetlock: 1235 }, f2: { kind: "fore", knee: 1080, fetlock: 1235 } } },
  { prefix: "chariot-v3-leg-", out: "chariot-v4-leg-", ov: 10, legs: {
    "hind-a": { kind: "hind", knee: 785, fetlock: 898 }, "hind-b": { kind: "hind", knee: 790, fetlock: 898 },
    fore: { kind: "fore", knee: 790, fetlock: 892 }, "fore-far": { kind: "fore", knee: 790, fetlock: 892 } } },
];

const opaque = (im, x, y) => im.data[(y * im.width + x) * 4 + 3] > 100;
function rowSpan(im, y) {
  let x0 = -1, x1 = -1;
  for (let x = 0; x < im.width; x++) if (opaque(im, x, y)) { if (x0 < 0) x0 = x; x1 = x; }
  return [x0, x1];
}
function crop(im, y0, y1) {
  let bx0 = 1e9, bx1 = -1, by0 = 1e9, by1 = -1;
  for (let y = Math.max(0, y0); y < Math.min(im.height, y1); y++)
    for (let x = 0; x < im.width; x++) if (im.data[(y * im.width + x) * 4 + 3] > 0) {
      bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y);
    }
  const o = new PNG({ width: bx1 - bx0 + 1, height: by1 - by0 + 1 });
  for (let y = by0; y <= by1; y++) im.data.copy(o.data, ((y - by0) * o.width) * 4, (y * im.width + bx0) * 4, (y * im.width + bx1 + 1) * 4);
  return { png: o, x: bx0, y: by0 };
}

for (const rig of RIGS) {
  const out = {};
  for (const [id, leg] of Object.entries(rig.legs)) {
    const im = PNG.sync.read(fs.readFileSync(A + rig.prefix + id + ".png"));
    const segs = [crop(im, 0, leg.knee), crop(im, leg.knee - rig.ov, leg.fetlock), crop(im, leg.fetlock - rig.ov, im.height)];
    segs.forEach((s, k) => fs.writeFileSync(A + rig.out + id + "-" + "abc"[k] + ".png", PNG.sync.write(s.png)));
    // Knee: a fore knee folds backwards (pivot on its front edge); a hind hock
    // folds the cannon forwards (pivot on its back edge). Fetlocks fold the
    // hoof backwards (front edge). Inset 4 px from the outline.
    const [k0, k1] = rowSpan(im, leg.knee), [f0, f1] = rowSpan(im, leg.fetlock);
    out[id] = {
      kind: leg.kind,
      seg: segs.map((s) => [s.x, s.y, s.png.width, s.png.height]),
      knee: [leg.kind === "fore" ? k1 - 4 : k0 + 4, leg.knee],
      fetlock: [f1 - 4, leg.fetlock],
    };
  }
  console.log(rig.out, JSON.stringify(out));
}
