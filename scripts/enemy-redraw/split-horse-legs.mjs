// Split each horse leg layer into three bending segments (upper leg, cannon,
// pastern + hoof) so the rig can fold the knee / hock and the fetlock instead
// of swinging a stiff leg. Each joint pivots at the centre of its cut, and the
// lower segment carries a round cap (a disc of the leg's half-width around the
// pivot, taken from the art above the cut): a disc turning around its own
// centre keeps its shape, so the joint looks round and never opens a gap.
//
//   bun scripts/enemy-redraw/split-horse-legs.mjs   (needs pngjs)
//
// Prints the segment origins and joint pivots used by horseGait.ts callers.
import fs from "fs";
import { PNG } from "pngjs";

const A = new URL("../../src/assets/", import.meta.url).pathname;
const RIGS = [
  { prefix: "knight-v3-leg-", out: "knight-v4-leg-", legs: {
    h1: { kind: "hind", knee: 1045, fetlock: 1235 }, h2: { kind: "hind", knee: 1045, fetlock: 1235 },
    f1: { kind: "fore", knee: 1080, fetlock: 1235 }, f2: { kind: "fore", knee: 1080, fetlock: 1235 } } },
  { prefix: "chariot-v3-leg-", out: "chariot-v4-leg-", legs: {
    "hind-a": { kind: "hind", knee: 785, fetlock: 898 }, "hind-b": { kind: "hind", knee: 790, fetlock: 898 },
    fore: { kind: "fore", knee: 790, fetlock: 892 }, "fore-far": { kind: "fore", knee: 790, fetlock: 892 } } },
];

const opaque = (im, x, y) => im.data[(y * im.width + x) * 4 + 3] > 100;
function rowSpan(im, y) {
  let x0 = -1, x1 = -1;
  for (let x = 0; x < im.width; x++) if (opaque(im, x, y)) { if (x0 < 0) x0 = x; x1 = x; }
  return [x0, x1];
}
/** Rows y0..y1 of the layer, plus a disc of radius r around cap (if any). */
function crop(im, y0, y1, cap) {
  const keep = (x, y) => (y >= y0 && y < y1) || (cap && Math.hypot(x + 0.5 - cap.x, y + 0.5 - cap.y) <= cap.r);
  let bx0 = 1e9, bx1 = -1, by0 = 1e9, by1 = -1;
  for (let y = 0; y < Math.min(im.height, y1); y++)
    for (let x = 0; x < im.width; x++) if (im.data[(y * im.width + x) * 4 + 3] > 0 && keep(x, y)) {
      bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y);
    }
  const o = new PNG({ width: bx1 - bx0 + 1, height: by1 - by0 + 1 });
  for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) if (keep(x, y))
    im.data.copy(o.data, ((y - by0) * o.width + x - bx0) * 4, (y * im.width + x) * 4, (y * im.width + x + 1) * 4);
  return { png: o, x: bx0, y: by0 };
}

for (const rig of RIGS) {
  const out = {};
  for (const [id, leg] of Object.entries(rig.legs)) {
    const im = PNG.sync.read(fs.readFileSync(A + rig.prefix + id + ".png"));
    const [k0, k1] = rowSpan(im, leg.knee), [f0, f1] = rowSpan(im, leg.fetlock);
    const knee = { x: (k0 + k1 + 1) / 2, y: leg.knee, r: (k1 - k0 + 1) / 2 };
    const fet = { x: (f0 + f1 + 1) / 2, y: leg.fetlock, r: (f1 - f0 + 1) / 2 };
    const segs = [crop(im, 0, leg.knee), crop(im, leg.knee, leg.fetlock, knee), crop(im, leg.fetlock, im.height, fet)];
    segs.forEach((s, k) => fs.writeFileSync(A + rig.out + id + "-" + "abc"[k] + ".png", PNG.sync.write(s.png)));
    out[id] = {
      kind: leg.kind,
      seg: segs.map((s) => [s.x, s.y, s.png.width, s.png.height]),
      knee: [knee.x, knee.y],
      fetlock: [fet.x, fet.y],
    };
  }
  console.log(rig.out, JSON.stringify(out));
}
